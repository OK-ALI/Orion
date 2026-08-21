import { useRef, useState } from "react";
import {
  buildPortableMyListEnrollmentProfileV1,
  buildPortableMyListPreviewFromProfileV1,
  buildPortableMyListSteadyStateProfileV1,
  inspectPortableMyListV1,
  portableMyListActiveMatchesPreviewV1,
  portableMyListMatchesPreviewV1,
  portableMyListNamespaceSignatureV1,
  portableMyListPreviewSignatureV1,
  PORTABLE_PROFILE_PRIMARY_KEY,
} from "@orion/shared/types";
import { useDesktopMyListSteadyStateSync } from "../../account/MyListSteadyStateSync";
import { DesktopPortableProfileCloudStore } from "../../../services/portableProfileCloudStore";
import { readBackCloudProfileUntilVerified } from "../../../services/cloudProfileReadBackVerification";
import {
  applyDesktopPortableMyListPreviewV1,
  readDesktopPortableMyListPreviewV1,
} from "../../../services/myListSyncLocalStore";
import {
  loadDesktopMyListSyncCheckpointV1,
  saveDesktopMyListSyncCheckpointV1,
} from "../../../services/myListSyncCheckpoint";
import { combinePortableMyListPreviewsV1 } from "../../../services/myListConflictResolution";
import AccountSyncDomainRow from "./AccountSyncDomainRow";
import { BookmarkIcon } from "../../../components/common/Icons";

function itemLabel(count) {
  return `${count} item${count === 1 ? "" : "s"}`;
}

function unrelatedNamespacesMatch(expected, actual) {
  const expectedNames = Object.keys(expected.namespaces).filter((name) => name !== "myList").sort();
  const actualNames = Object.keys(actual.namespaces).filter((name) => name !== "myList").sort();
  if (expectedNames.length !== actualNames.length) return false;
  return expectedNames.every((name, index) => (
    actualNames[index] === name
    && JSON.stringify(expected.namespaces[name]) === JSON.stringify(actual.namespaces[name])
  ));
}

export default function MyListSyncCard({ googleProfile }) {
  const profileId = typeof googleProfile?.sub === "string" ? googleProfile.sub.trim() : "";
  const steady = useDesktopMyListSteadyStateSync();
  const [state, setState] = useState({ phase: "idle" });
  const [steadyResolution, setSteadyResolution] = useState(null);
  const busyRef = useRef(false);
  const locallyEnrolled = !!(profileId && loadDesktopMyListSyncCheckpointV1(profileId));
  const steadyActive = locallyEnrolled || steady.hasCheckpoint;

  const checkEnrollment = async () => {
    if (busyRef.current || !profileId || steadyActive) return;
    const preview = readDesktopPortableMyListPreviewV1();
    if (preview.rejectedKeys.length > 0) {
      setState({ phase: "needs-review", message: `${itemLabel(preview.rejectedKeys.length)} cannot be synced safely from this Desktop.` });
      return;
    }
    const previewSignature = portableMyListPreviewSignatureV1(preview);
    busyRef.current = true;
    setState({ phase: "checking" });
    try {
      const store = new DesktopPortableProfileCloudStore(profileId);
      const remote = await store.read(PORTABLE_PROFILE_PRIMARY_KEY);
      if (remote.state === "missing") {
        setState({ phase: "ready", action: "create", baselineRevisionTag: null, previewSignature, count: preview.orderedKeys.length });
        return;
      }

      const inspection = inspectPortableMyListV1(remote.profile);
      if (inspection.state === "invalid") {
        setState({ phase: "needs-review", message: "My List in Orion Cloud cannot be synced safely by this Orion version." });
        return;
      }
      if (portableMyListActiveMatchesPreviewV1(remote.profile, preview)) {
        const cloudNamespaceSignature = portableMyListNamespaceSignatureV1(remote.profile);
        if (!cloudNamespaceSignature) {
          setState({ phase: "needs-review", message: "Orion could not verify My List in Orion Cloud." });
          return;
        }
        saveDesktopMyListSyncCheckpointV1({ profileId, localSignature: previewSignature, cloudNamespaceSignature, verifiedAt: Date.now() });
        setState({ phase: "synced", count: preview.orderedKeys.length });
        steady.refresh();
        return;
      }
      if (inspection.state === "empty") {
        setState({ phase: "ready", action: "upload", baselineRevisionTag: remote.revisionTag, previewSignature, count: preview.orderedKeys.length });
        return;
      }

      const cloudPreview = buildPortableMyListPreviewFromProfileV1(remote.profile);
      const cloudNamespaceSignature = portableMyListNamespaceSignatureV1(remote.profile);
      if (preview.orderedKeys.length === 0 && cloudPreview && cloudPreview.orderedKeys.length > 0 && cloudNamespaceSignature) {
        setState({
          phase: "ready",
          action: "restore",
          baselineRevisionTag: remote.revisionTag,
          previewSignature,
          cloudNamespaceSignature,
          cloudPreview,
          count: cloudPreview.orderedKeys.length,
        });
        return;
      }
      if (!cloudPreview || !cloudNamespaceSignature) {
        setState({ phase: "needs-review", message: "Orion could not prepare both My Lists for a safe review." });
        return;
      }
      const combined = combinePortableMyListPreviewsV1(preview, cloudPreview);
      setState({
        phase: "conflict",
        baselineRevisionTag: remote.revisionTag,
        previewSignature,
        cloudNamespaceSignature,
        cloudPreview,
        summary: combined.summary,
      });
    } catch {
      setState({ phase: "error", message: "Orion could not check My List with Orion Cloud. Nothing was changed." });
    } finally {
      busyRef.current = false;
    }
  };

  const confirmUpload = async () => {
    if (busyRef.current || state.phase !== "ready" || state.action === "restore" || !profileId || steadyActive) return;
    const expected = state;
    const preview = readDesktopPortableMyListPreviewV1();
    if (portableMyListPreviewSignatureV1(preview) !== expected.previewSignature || preview.rejectedKeys.length > 0) {
      setState({ phase: "needs-review", message: "My List changed after the check. Check again before syncing." });
      return;
    }

    busyRef.current = true;
    setState({ phase: "syncing" });
    try {
      const store = new DesktopPortableProfileCloudStore(profileId);
      const fresh = await store.read(PORTABLE_PROFILE_PRIMARY_KEY);
      const validFresh = expected.action === "create"
        ? fresh.state === "missing"
        : fresh.state === "found"
          && fresh.revisionTag === expected.baselineRevisionTag
          && inspectPortableMyListV1(fresh.profile).state === "empty";
      if (!validFresh) {
        setState({ phase: "needs-review", message: "Orion Cloud changed after the check. Orion stopped before overwriting anything." });
        return;
      }
      if (portableMyListPreviewSignatureV1(readDesktopPortableMyListPreviewV1()) !== expected.previewSignature) {
        setState({ phase: "needs-review", message: "My List changed while sync was starting. Orion stopped before uploading it." });
        return;
      }

      const baseProfile = fresh.state === "found" ? fresh.profile : null;
      const expectedRevisionTag = fresh.state === "found" ? fresh.revisionTag : null;
      const candidate = buildPortableMyListEnrollmentProfileV1(baseProfile, preview, { profileId, updatedBy: profileId });
      const write = await store.write(PORTABLE_PROFILE_PRIMARY_KEY, { profile: candidate, expectedRevisionTag });
      if (write.state === "conflict") {
        setState({ phase: "needs-review", message: "Orion Cloud changed while My List was syncing. Orion did not overwrite it." });
        return;
      }

      const verify = await readBackCloudProfileUntilVerified(
        store,
        PORTABLE_PROFILE_PRIMARY_KEY,
        (readBack) => readBack.profile.profileId === profileId
          && readBack.profile.revision === candidate.revision
          && readBack.profile.createdAt === candidate.createdAt
          && readBack.profile.updatedAt === candidate.updatedAt
          && unrelatedNamespacesMatch(candidate, readBack.profile)
          && portableMyListMatchesPreviewV1(readBack.profile, preview),
      );
      const cloudNamespaceSignature = verify ? portableMyListNamespaceSignatureV1(verify.profile) : null;
      if (!verify || !cloudNamespaceSignature) {
        setState({ phase: "needs-review", message: "Orion could not verify the Orion Cloud copy after syncing. Your local My List was not changed." });
        return;
      }
      if (portableMyListPreviewSignatureV1(readDesktopPortableMyListPreviewV1()) !== expected.previewSignature) {
        setState({ phase: "needs-review", message: "My List changed while syncing. Orion Cloud kept the confirmed copy; your newer local changes were left untouched." });
        return;
      }

      saveDesktopMyListSyncCheckpointV1({ profileId, localSignature: expected.previewSignature, cloudNamespaceSignature, verifiedAt: Date.now() });
      setState({ phase: "synced", count: preview.orderedKeys.length });
      steady.refresh();
    } catch (error) {
      const message = error?.code === "GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE"
        ? "Orion Cloud could not complete a safe My List update on this Desktop. Nothing was overwritten."
        : "My List could not finish syncing safely. Orion stopped instead of guessing.";
      setState({ phase: "error", message });
    } finally {
      busyRef.current = false;
    }
  };

  const confirmRestore = async () => {
    if (busyRef.current || state.phase !== "ready" || state.action !== "restore" || !profileId || steadyActive) return;
    const expected = state;
    const local = readDesktopPortableMyListPreviewV1();
    if (local.orderedKeys.length !== 0 || portableMyListPreviewSignatureV1(local) !== expected.previewSignature) {
      setState({ phase: "needs-review", message: "My List changed on this Desktop before restore. Orion left it untouched." });
      return;
    }

    busyRef.current = true;
    setState({ phase: "syncing" });
    try {
      const store = new DesktopPortableProfileCloudStore(profileId);
      const fresh = await store.read(PORTABLE_PROFILE_PRIMARY_KEY);
      const cloudPreview = fresh.state === "found" ? buildPortableMyListPreviewFromProfileV1(fresh.profile) : null;
      const cloudNamespaceSignature = fresh.state === "found" ? portableMyListNamespaceSignatureV1(fresh.profile) : null;
      if (
        fresh.state !== "found"
        || fresh.revisionTag !== expected.baselineRevisionTag
        || !cloudPreview
        || !cloudNamespaceSignature
        || cloudNamespaceSignature !== expected.cloudNamespaceSignature
        || portableMyListPreviewSignatureV1(cloudPreview) !== portableMyListPreviewSignatureV1(expected.cloudPreview)
      ) {
        setState({ phase: "needs-review", message: "My List changed on this Desktop or in Orion Cloud before restore. Orion changed nothing." });
        return;
      }
      const latestLocal = readDesktopPortableMyListPreviewV1();
      if (latestLocal.orderedKeys.length !== 0 || portableMyListPreviewSignatureV1(latestLocal) !== expected.previewSignature) {
        setState({ phase: "needs-review", message: "My List changed on this Desktop before restore. Orion left it untouched." });
        return;
      }

      applyDesktopPortableMyListPreviewV1(cloudPreview);
      saveDesktopMyListSyncCheckpointV1({
        profileId,
        localSignature: portableMyListPreviewSignatureV1(cloudPreview),
        cloudNamespaceSignature,
        verifiedAt: Date.now(),
      });
      setState({ phase: "synced", count: cloudPreview.orderedKeys.length });
    } catch {
      setState({ phase: "error", message: "Orion could not restore My List safely. Your local My List was left untouched." });
    } finally {
      busyRef.current = false;
    }
  };

const beginConflictResolution = (resolution) => {
  if (busyRef.current || state.phase !== "conflict") return;
  setState({ ...state, phase: "confirm-resolution", resolution });
};

const cancelConflictResolution = () => {
  if (busyRef.current || state.phase !== "confirm-resolution") return;
  const { resolution: _resolution, ...conflictState } = state;
  setState({ ...conflictState, phase: "conflict" });
};

const resolveConflict = async () => {
  if (busyRef.current || state.phase !== "confirm-resolution" || !profileId || steadyActive) return;
  const expected = state;
  const local = readDesktopPortableMyListPreviewV1();
  if (
    local.rejectedKeys.length > 0
    || portableMyListPreviewSignatureV1(local) !== expected.previewSignature
  ) {
    setState({ phase: "needs-review", message: "My List changed on this Desktop after the review. Orion changed nothing." });
    return;
  }

  busyRef.current = true;
  setState({ ...expected, phase: "resolving" });
  try {
    const store = new DesktopPortableProfileCloudStore(profileId);
    const fresh = await store.read(PORTABLE_PROFILE_PRIMARY_KEY);
    const freshCloudPreview = fresh.state === "found"
      ? buildPortableMyListPreviewFromProfileV1(fresh.profile)
      : null;
    const freshCloudNamespaceSignature = fresh.state === "found"
      ? portableMyListNamespaceSignatureV1(fresh.profile)
      : null;

    if (
      fresh.state !== "found"
      || fresh.revisionTag !== expected.baselineRevisionTag
      || !freshCloudPreview
      || !freshCloudNamespaceSignature
      || freshCloudNamespaceSignature !== expected.cloudNamespaceSignature
      || portableMyListPreviewSignatureV1(freshCloudPreview)
        !== portableMyListPreviewSignatureV1(expected.cloudPreview)
    ) {
      setState({ phase: "needs-review", message: "Orion Cloud changed after the review. Orion changed nothing. Check My List again." });
      return;
    }

    const latestLocal = readDesktopPortableMyListPreviewV1();
    if (
      latestLocal.rejectedKeys.length > 0
      || portableMyListPreviewSignatureV1(latestLocal) !== expected.previewSignature
    ) {
      setState({ phase: "needs-review", message: "My List changed on this Desktop after the review. Orion changed nothing." });
      return;
    }

    if (expected.resolution === "cloud") {
      applyDesktopPortableMyListPreviewV1(freshCloudPreview);
      saveDesktopMyListSyncCheckpointV1({
        profileId,
        localSignature: portableMyListPreviewSignatureV1(freshCloudPreview),
        cloudNamespaceSignature: freshCloudNamespaceSignature,
        verifiedAt: Date.now(),
      });
      setState({ phase: "synced", count: freshCloudPreview.orderedKeys.length });
      steady.refresh();
      return;
    }

    const resolved = expected.resolution === "combine"
      ? combinePortableMyListPreviewsV1(latestLocal, freshCloudPreview).preview
      : latestLocal;
    const resolvedSignature = portableMyListPreviewSignatureV1(resolved);
    const candidate = buildPortableMyListSteadyStateProfileV1(fresh.profile, resolved, {
      profileId,
      updatedBy: profileId,
    });

    if (portableMyListPreviewSignatureV1(readDesktopPortableMyListPreviewV1()) !== expected.previewSignature) {
      setState({ phase: "needs-review", message: "My List changed while Orion was preparing the update. Orion changed nothing." });
      return;
    }

    const write = await store.write(PORTABLE_PROFILE_PRIMARY_KEY, {
      profile: candidate,
      expectedRevisionTag: fresh.revisionTag,
    });
    if (write.state === "conflict") {
      setState({ phase: "needs-review", message: "Orion Cloud changed while My List was being updated. Orion did not overwrite it." });
      return;
    }

    const candidateNamespaceSignature = portableMyListNamespaceSignatureV1(candidate);
    const verify = candidateNamespaceSignature == null
      ? null
      : await readBackCloudProfileUntilVerified(
          store,
          PORTABLE_PROFILE_PRIMARY_KEY,
          (readBack) => {
            const verifiedNamespaceSignature = portableMyListNamespaceSignatureV1(readBack.profile);
            return readBack.profile.profileId === profileId
              && readBack.profile.revision === candidate.revision
              && readBack.profile.createdAt === candidate.createdAt
              && readBack.profile.updatedAt === candidate.updatedAt
              && verifiedNamespaceSignature === candidateNamespaceSignature
              && unrelatedNamespacesMatch(candidate, readBack.profile)
              && portableMyListActiveMatchesPreviewV1(readBack.profile, resolved);
          },
        );
    const verifiedNamespaceSignature = verify ? portableMyListNamespaceSignatureV1(verify.profile) : null;

    if (!verify || !verifiedNamespaceSignature) {
      setState({ phase: "needs-review", message: "Orion could not verify the updated Orion Cloud copy. Your Desktop My List was left unchanged." });
      return;
    }

    if (portableMyListPreviewSignatureV1(readDesktopPortableMyListPreviewV1()) !== expected.previewSignature) {
      setState({ phase: "needs-review", message: "My List changed during the update. Orion Cloud kept the confirmed copy; newer Desktop changes were left untouched." });
      return;
    }

    if (expected.resolution === "combine") {
      applyDesktopPortableMyListPreviewV1(resolved);
    }

    saveDesktopMyListSyncCheckpointV1({
      profileId,
      localSignature: resolvedSignature,
      cloudNamespaceSignature: verifiedNamespaceSignature,
      verifiedAt: Date.now(),
    });
    setState({ phase: "synced", count: resolved.orderedKeys.length });
    steady.refresh();
  } catch (error) {
    const message = error?.code === "GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE"
      ? "Orion Cloud could not complete a safe My List update on this Desktop. Nothing was overwritten."
      : "Orion could not resolve My List safely. Nothing was changed automatically.";
    setState({ phase: "error", message });
  } finally {
    busyRef.current = false;
  }
};

  const steadyBusy = steady.phase === "checking" || steady.phase === "syncing";
  const enrollmentBusy = state.phase === "checking" || state.phase === "syncing" || state.phase === "resolving";
  const busy = steadyActive ? steadyBusy : enrollmentBusy;
  const steadyReviewAvailable = steadyActive && steady.phase === "needs-review" && steady.review?.reason === "both-changed";
  const needsReview = steadyActive
    ? steady.phase === "needs-review" || steady.phase === "error"
    : state.phase === "needs-review" || state.phase === "error" || state.phase === "conflict" || state.phase === "confirm-resolution";
  const localPreview = readDesktopPortableMyListPreviewV1();
  const localCount = Number.isFinite(steady.count) ? steady.count : localPreview.orderedKeys.length;
  const status = steadyActive
    ? steady.phase === "synced" ? "Synced"
      : steady.phase === "paused" ? "Paused"
        : steady.phase === "offline" ? "Offline"
          : steady.phase === "checking" ? "Syncing"
            : steady.phase === "syncing" ? "Syncing"
              : steady.phase === "needs-review" || steady.phase === "error" ? "Needs review"
                : steady.automatic ? "Synced" : "Paused"
    : state.phase === "checking" ? "Syncing"
      : state.phase === "syncing" || state.phase === "resolving" ? "Syncing"
        : state.phase === "synced" ? "Synced"
          : needsReview ? "Needs review" : "Set up";

  const feedback = steadyActive
    ? steady.phase === "offline"
      ? "My List is waiting for a connection. Your titles remain available on this Desktop."
      : steady.phase === "needs-review" || steady.phase === "error"
        ? steady.message
        : null
    : state.phase === "ready"
      ? state.action === "restore"
        ? `${itemLabel(state.count)} can be restored from Orion Cloud. Nothing changes until you confirm.`
        : `${itemLabel(state.count)} can start syncing with Orion Cloud. Nothing changes until you confirm.`
      : state.phase === "conflict" || state.phase === "confirm-resolution"
        ? "Your My List is different on this Desktop and in Orion Cloud. Choose which copy Orion should keep, or combine both during first setup."
        : state.phase === "needs-review" || state.phase === "error"
          ? state.message
          : null;

  const action = busy
    ? null
    : steadyActive
      ? !steady.automatic && !needsReview
        ? { label: "Sync now", onClick: () => steady.refresh() }
        : steady.phase === "offline" || steady.phase === "error"
          ? { label: "Try again", onClick: () => steady.refresh() }
          : null
      : state.phase === "idle" || state.phase === "needs-review" || state.phase === "error"
        ? { label: state.phase === "idle" ? "Set up" : "Check again", onClick: () => void checkEnrollment() }
        : null;

  return (
    <AccountSyncDomainRow
      icon={<BookmarkIcon size={18} />}
      title="My List"
      summary={`${localCount} title${localCount === 1 ? "" : "s"}`}
      status={status}
      autoSync={steadyActive ? {
        value: steady.automatic,
        disabled: busy,
        label: steady.automatic ? "Pause automatic My List sync" : "Enable automatic My List sync",
        onChange: steady.setAutomatic,
      } : null}
      action={action}
    >
      {feedback && (
        <div style={{ color: needsReview ? "var(--danger)" : "var(--text3)", fontSize: 12, lineHeight: 1.55 }}>
          {feedback}
        </div>
      )}

      {!steadyActive && (state.phase === "conflict" || state.phase === "confirm-resolution" || state.phase === "resolving") && state.summary && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "12px 14px", marginTop: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div>
              <div style={{ color: "var(--text3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>This Desktop</div>
              <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700, marginTop: 3 }}>{state.summary.desktopCount} title{state.summary.desktopCount === 1 ? "" : "s"}</div>
            </div>
            <div>
              <div style={{ color: "var(--text3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Orion Cloud</div>
              <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700, marginTop: 3 }}>{state.summary.cloudCount} title{state.summary.cloudCount === 1 ? "" : "s"}</div>
            </div>
          </div>
          <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.5, marginTop: 10 }}>
            {state.summary.sharedCount} title{state.summary.sharedCount === 1 ? "" : "s"} already match across both My Lists.
          </div>
        </div>
      )}

      {!steadyActive && state.phase === "confirm-resolution" && state.summary && (
        <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 10 }}>
          {state.resolution === "combine"
            ? `${state.summary.combinedCount} titles after combining. Every title currently present in either My List will be preserved.`
            : state.resolution === "desktop"
              ? `Keep the ${state.summary.desktopCount} titles on this Desktop and replace Orion Cloud? ${state.summary.cloudOnlyCount} Cloud-only title${state.summary.cloudOnlyCount === 1 ? "" : "s"} will no longer be in My List.`
              : `Keep the ${state.summary.cloudCount} titles in Orion Cloud and replace this Desktop? ${state.summary.desktopOnlyCount} Desktop-only title${state.summary.desktopOnlyCount === 1 ? "" : "s"} will no longer be in My List.`}
        </div>
      )}

      {steadyReviewAvailable && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "12px 14px", marginTop: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div>
              <div style={{ color: "var(--text3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>This Desktop</div>
              <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700, marginTop: 3 }}>{steady.review.localCount} title{steady.review.localCount === 1 ? "" : "s"}</div>
            </div>
            <div>
              <div style={{ color: "var(--text3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Orion Cloud</div>
              <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700, marginTop: 3 }}>{steady.review.cloudCount} title{steady.review.cloudCount === 1 ? "" : "s"}</div>
            </div>
          </div>
          <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.5, marginTop: 10 }}>
            Both copies changed. Choose which My List Orion should keep.
          </div>
        </div>
      )}

      {steadyReviewAvailable && steadyResolution && (
        <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 10 }}>
          {steadyResolution === "desktop"
            ? `Keep the ${steady.review.localCount} titles on this Desktop and replace the current Orion Cloud My List?`
            : `Keep the ${steady.review.cloudCount} titles in Orion Cloud and replace this Desktop My List?`}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {steadyReviewAvailable && !steadyResolution ? (
          <>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setSteadyResolution("desktop")}>Keep Desktop My List</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setSteadyResolution("cloud")}>Keep Orion Cloud My List</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => steady.refresh()}>Check again</button>
          </>
        ) : steadyReviewAvailable && steadyResolution ? (
          <>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setSteadyResolution(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => { const choice = steadyResolution; setSteadyResolution(null); steady.resolveReview(choice); }}>Confirm</button>
          </>
        ) : !steadyActive && state.phase === "conflict" ? (
          <>
            <button className="btn btn-primary" disabled={busy} onClick={() => beginConflictResolution("combine")}>Combine both</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => beginConflictResolution("desktop")}>Keep Desktop My List</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => beginConflictResolution("cloud")}>Keep Orion Cloud My List</button>
            <button className="btn btn-ghost" disabled={busy || !profileId} onClick={() => void checkEnrollment()}>Check again</button>
          </>
        ) : !steadyActive && state.phase === "confirm-resolution" ? (
          <>
            <button className="btn btn-secondary" disabled={busy} onClick={cancelConflictResolution}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void resolveConflict()}>
              {state.resolution === "combine" ? "Combine" : "Confirm"}
            </button>
          </>
        ) : !steadyActive && state.phase === "ready" ? (
          <button className="btn btn-primary" disabled={busy} onClick={() => state.action === "restore" ? void confirmRestore() : void confirmUpload()}>
            {state.action === "restore" ? "Confirm restore" : "Confirm sync"}
          </button>
        ) : busy ? (
          <span style={{ color: "var(--text3)", fontSize: 12 }}>{state.phase === "syncing" || state.phase === "resolving" || steady.phase === "syncing" ? "Syncing…" : "Checking…"}</span>
        ) : null}
      </div>
    </AccountSyncDomainRow>
  );
}
