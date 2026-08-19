import { useRef, useState } from "react";
import {
  executePortableWatchedOneShotSyncV1,
  inspectPortableWatchedOneShotSyncV1,
} from "@orion/shared/api";
import { PORTABLE_PROFILE_PRIMARY_KEY } from "@orion/shared/types";
import { useDesktopWatchedSteadyStateSync } from "../../account/WatchedSteadyStateSync";
import { DesktopPortableProfileCloudStore } from "../../../services/portableProfileCloudStore";
import {
  applyDesktopPortableWatchedPreviewV1,
  readDesktopPortableWatchedPreviewV1,
} from "../../../services/watchedOneShotLocalStore";
import {
  loadDesktopWatchedSyncCheckpointV1,
  saveDesktopWatchedSyncCheckpointV1,
} from "../../../services/watchedSyncCheckpoint";
import { Toggle } from "./SettingsControls";

function itemLabel(count) {
  return `${count} Watched item${count === 1 ? "" : "s"}`;
}

function readyCopy(result) {
  if (result.action === "pull") return `Cloud has ${itemLabel(result.targetCount)} ready to restore on this Desktop.`;
  if (result.action === "merge") return `Orion can safely combine both copies into ${itemLabel(result.targetCount)} without deleting either side.`;
  if (result.action === "create") return `No portable profile was found. Orion can create one with ${itemLabel(result.targetCount)}.`;
  return `This Desktop can update Orion cloud to ${itemLabel(result.targetCount)}.`;
}

function reviewCopy(result) {
  if (result.reason === "tombstone-conflict") return `${itemLabel(result.conflictKeys.length)} were previously removed in the cloud. Orion will not resurrect them automatically.`;
  if (result.reason === "both-changed") return "Watched changed locally and in the cloud since the last verified sync. Orion stopped instead of choosing a winner.";
  if (result.reason === "profile-missing-after-checkpoint") return "The previously verified portable profile is missing. Orion will not recreate it automatically.";
  if (result.reason.includes("identity")) return "The portable Watched state does not match this signed-in Google identity.";
  if (result.reason.includes("invalid")) return "Watched contains data this Orion version cannot reconcile safely.";
  return "The verified Watched checkpoint no longer matches both copies. Orion stopped without overwriting either side.";
}

export default function WatchedSyncCard({ googleProfile }) {
  const profileId = typeof googleProfile?.sub === "string" ? googleProfile.sub.trim() : "";
  const steady = useDesktopWatchedSteadyStateSync();
  const [state, setState] = useState({ phase: "idle" });
  const busyRef = useRef(false);
  const locallyEnrolled = !!(profileId && loadDesktopWatchedSyncCheckpointV1(profileId));
  const steadyActive = locallyEnrolled || steady.hasCheckpoint;

  const checkEnrollment = async () => {
    if (busyRef.current || !profileId || steadyActive) return;
    busyRef.current = true;
    setState({ phase: "checking" });
    try {
      const store = new DesktopPortableProfileCloudStore(profileId);
      const result = await inspectPortableWatchedOneShotSyncV1({
        store,
        profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
        profileId,
        localPreview: readDesktopPortableWatchedPreviewV1(),
        checkpoint: null,
      });
      if (result.state === "aligned") {
        saveDesktopWatchedSyncCheckpointV1(result.checkpoint);
        setState({ phase: "synced", count: result.localCount, action: "aligned" });
        steady.refresh();
      } else if (result.state === "ready") {
        setState({ phase: "ready", result });
      } else {
        setState({ phase: "needs-review", message: reviewCopy(result) });
      }
    } catch (error) {
      setState({ phase: "error", message: error?.message || "Orion could not check Watched sync." });
    } finally {
      busyRef.current = false;
    }
  };

  const confirmEnrollment = async () => {
    if (busyRef.current || state.phase !== "ready" || !profileId || steadyActive) return;
    const expected = state.result;
    busyRef.current = true;
    setState({ phase: "syncing" });
    try {
      const store = new DesktopPortableProfileCloudStore(profileId);
      const result = await executePortableWatchedOneShotSyncV1({
        store,
        profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
        profileId,
        updatedBy: profileId,
        expectedConfirmationKey: expected.confirmationKey,
        checkpoint: null,
        readLocalPreview: readDesktopPortableWatchedPreviewV1,
        applyLocalPreview: applyDesktopPortableWatchedPreviewV1,
      });
      if (result.state === "verified") {
        saveDesktopWatchedSyncCheckpointV1(result.checkpoint);
        setState({ phase: "synced", count: result.count, action: result.action });
        steady.refresh();
        return;
      }
      const message = result.reason === "cloud-conflict" || result.reason === "cloud-changed-before-pull"
        ? "The cloud profile changed while Watched was syncing. Orion did not overwrite it. Check again."
        : result.reason === "local-changed-during-sync"
          ? `Watched changed locally while sync was running.${result.cloudWasWritten ? " The verified cloud write is preserved, but no checkpoint was created." : ""} Check again.`
          : result.reason === "cloud-verification-failed"
            ? "The cloud write completed, but Orion could not verify the new copy within the safety window. Local Watched was left untouched and no checkpoint was created."
            : "Watched changed after the readiness check. Orion stopped before using the stale plan.";
      setState({ phase: "needs-review", message });
    } catch (error) {
      const message = error?.code === "GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE"
        ? "Google Drive did not provide the strong conditional-write token Orion requires on this Desktop. Nothing was overwritten."
        : error?.message || "Watched sync could not finish safely.";
      setState({ phase: "error", message });
    } finally {
      busyRef.current = false;
    }
  };

  const steadyBusy = steady.phase === "checking" || steady.phase === "syncing";
  const enrollmentBusy = state.phase === "checking" || state.phase === "syncing";
  const busy = steadyActive ? steadyBusy : enrollmentBusy;
  const needsReview = steadyActive ? steady.phase === "needs-review" : state.phase === "needs-review";
  const badge = steadyActive
    ? steady.phase === "synced" ? "Verified"
      : steady.phase === "paused" ? "Paused"
        : steady.phase === "offline" ? "Offline"
          : steady.phase === "needs-review" ? "Review"
            : steady.phase === "checking" ? "Checking"
              : steady.phase === "syncing" ? "Syncing"
                : steady.phase === "error" ? "Error" : "Automatic"
    : state.phase === "ready" ? "Ready"
      : state.phase === "needs-review" ? "Review"
        : state.phase === "checking" ? "Checking"
          : state.phase === "syncing" ? "Syncing"
            : state.phase === "synced" ? "Verified"
              : state.phase === "error" ? "Error" : "Manual";
  const buttonLabel = busy
    ? (steadyActive ? (steady.phase === "syncing" ? "Syncing…" : "Checking…") : (state.phase === "syncing" ? "Syncing…" : "Checking…"))
    : steadyActive && !steady.automatic && !needsReview ? "Sync now"
      : steadyActive ? "Check sync status" : "Check Watched";
  const feedback = steadyActive
    ? steady.message
    : state.phase === "ready" ? `${readyCopy(state.result)} Nothing changes until you confirm.`
      : state.phase === "syncing" ? "Verifying local Watched and the cloud copy. Orion will only mark this complete after both agree."
        : state.phase === "synced" ? `${itemLabel(state.count)} verified across this Desktop and Orion cloud.`
          : state.phase === "needs-review" || state.phase === "error" ? state.message : null;

  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "18px 20px", marginTop: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700 }}>Cross-device Watched sync</div>
          <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 4 }}>
            Exact movies and episodes only. First enrollment is explicit; after that, sync can run automatically or stay paused on this Desktop.
          </div>
        </div>
        <span style={{ border: "1px solid var(--border)", borderRadius: 999, color: needsReview ? "var(--red)" : "var(--text3)", fontSize: 11, fontWeight: 700, padding: "4px 9px" }}>{badge}</span>
      </div>

      {!profileId && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 12 }}>A stable Google subject identity is required. Watched sync is blocked.</div>}
      {steadyActive && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--border)", borderRadius: 9, padding: "12px 14px", marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 700 }}>Auto sync</div>
            <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.45, marginTop: 2 }}>
              {steady.automatic
                ? "Watched changes reconcile automatically when Orion is online."
                : "Automatic cloud activity is paused. Local changes stay here until you choose Sync now or turn this back on."}
            </div>
          </div>
          <Toggle value={steady.automatic} onChange={steady.setAutomatic} title={steady.automatic ? "Pause automatic Watched sync" : "Enable automatic Watched sync"} />
        </div>
      )}

      {feedback && <div style={{ color: needsReview ? "var(--red)" : steadyActive && steady.phase === "synced" ? "var(--accent)" : "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 12 }}>{feedback}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <button className="btn btn-ghost" disabled={busy || !profileId} onClick={() => steadyActive ? steady.refresh() : void checkEnrollment()}>
          {buttonLabel}
        </button>
        {!steadyActive && state.phase === "ready" && (
          <button className="btn btn-primary" disabled={busy} onClick={() => void confirmEnrollment()}>
            Confirm sync
          </button>
        )}
      </div>
    </div>
  );
}
