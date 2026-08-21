import { useEffect, useRef, useState } from "react";
import {
  executePortableViewingActivityOneShotSyncV1,
  inspectPortableViewingActivityOneShotSyncV1,
} from "@orion/shared/api";
import { PORTABLE_PROFILE_PRIMARY_KEY } from "@orion/shared/types";
import { useDesktopViewingActivitySteadyStateSync } from "../../account/ViewingActivitySteadyStateSync";
import { DesktopPortableProfileCloudStore } from "../../../services/portableProfileCloudStore";
import {
  applyDesktopPortableViewingActivityStateV1,
  readDesktopPortableViewingActivityPreviewV1,
} from "../../../services/viewingActivityOneShotLocalStore";
import {
  loadDesktopViewingActivitySyncCheckpointV1,
  saveDesktopViewingActivitySyncCheckpointV1,
} from "../../../services/viewingActivitySyncCheckpoint";
import AccountSyncDomainRow from "./AccountSyncDomainRow";
import { HistoryIcon } from "../../../components/common/Icons";

function countCopy(count) {
  return `${count.history} history ${count.history === 1 ? "entry" : "entries"}, ${count.progress} playback ${count.progress === 1 ? "position" : "positions"}`;
}

function labelFor(resolution) {
  if (resolution === "device") return "Keep this Desktop";
  if (resolution === "cloud") return "Keep Orion Cloud";
  return "Combine recent activity";
}

function inspectionMessage(result) {
  if (result.reason === "profile-identity-mismatch") return "Viewing Activity in Orion Cloud belongs to a different Orion profile. Nothing was changed.";
  if (result.reason === "local-invalid") return "Some local viewing activity needs review before Orion can sync it. Nothing was changed.";
  if (result.reason === "cloud-invalid") return "Viewing Activity in Orion Cloud needs review before this Orion version can sync it. Nothing was changed.";
  return "Orion could not find a safe first-sync choice for Viewing Activity. Nothing was overwritten.";
}

function executionMessage(result) {
  if (result.reason === "cloud-conflict" || result.reason === "cloud-changed-before-apply") return "Orion Cloud changed while Viewing Activity was syncing. Orion stopped instead of overwriting it. Check again.";
  if (result.reason === "local-changed-during-sync") return `Viewing Activity changed on this Desktop while sync was running.${result.cloudWasWritten ? " The verified Cloud update was preserved, but setup was not completed." : ""} Check again.`;
  if (result.reason === "cloud-verification-failed") return "Orion Cloud was updated, but Orion could not safely verify the new copy. Setup was not completed.";
  if (result.reason === "local-apply-failed") return `Orion could not verify the local Viewing Activity update.${result.cloudWasWritten ? " The verified Orion Cloud copy was preserved, but setup was not completed." : ""}`;
  if (result.reason === "resolution-no-longer-safe") return "That sync choice is no longer safe because Viewing Activity changed. Check again.";
  return "Viewing Activity changed after the readiness check. Orion stopped before using the stale plan.";
}

function confirmationCopy(resolution, inspection) {
  if (resolution === "device") return `Keep this Desktop's ${countCopy(inspection.localCount)} in Orion Cloud?`;
  if (resolution === "cloud") return `Restore Orion Cloud's ${countCopy(inspection.cloudCount)} to this Desktop?`;
  return "Combine recent activity from both copies. If Orion cannot determine a safe result, nothing will be changed.";
}

export default function ViewingActivitySyncCard({ googleProfile }) {
  const profileId = typeof googleProfile?.sub === "string" ? googleProfile.sub.trim() : "";
  const steady = useDesktopViewingActivitySteadyStateSync();
  const [state, setState] = useState({ phase: "idle" });
  const [resolution, setResolution] = useState(null);
  const [steadyResolution, setSteadyResolution] = useState(null);
  const busyRef = useRef(false);
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, [profileId]);
  const checkpoint = profileId ? loadDesktopViewingActivitySyncCheckpointV1(profileId) : null;
  const enrolled = !!checkpoint || state.phase === "enrolled";
  const localPreview = readDesktopPortableViewingActivityPreviewV1();
  const localCount = {
    history: Object.keys(localPreview.history).length,
    progress: Object.keys(localPreview.progress).length,
  };

  const checkEnrollment = async () => {
    if (busyRef.current || !profileId || enrolled) return;
    busyRef.current = true;
    setState({ phase: "checking" });
    try {
      const result = await inspectPortableViewingActivityOneShotSyncV1({
        store: new DesktopPortableProfileCloudStore(profileId),
        profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
        profileId,
        updatedBy: profileId,
        localPreview: readDesktopPortableViewingActivityPreviewV1(),
      });
      if (!activeRef.current) return;
      if (result.state === "aligned") {
        saveDesktopViewingActivitySyncCheckpointV1(result.checkpoint);
        setState({ phase: "enrolled", count: result.localCount });
        steady.refresh();
      } else if (result.state === "ready") {
        setState({ phase: "ready", inspection: result });
      } else {
        setState({ phase: "needs-review", message: inspectionMessage(result) });
      }
    } catch (error) {
      if (!activeRef.current) return;
      const message = error?.code === "GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE"
        ? "Orion Cloud cannot safely update Viewing Activity on this Desktop right now. Nothing was overwritten."
        : "Orion could not check Viewing Activity with Orion Cloud. Nothing was changed.";
      setState({ phase: "error", message });
    } finally {
      busyRef.current = false;
    }
  };

  const confirmResolution = async () => {
    if (busyRef.current || state.phase !== "ready" || !resolution || enrolled) return;
    const choice = resolution;
    const inspection = state.inspection;
    setResolution(null);
    busyRef.current = true;
    setState({ phase: "syncing" });
    try {
      const result = await executePortableViewingActivityOneShotSyncV1({
        store: new DesktopPortableProfileCloudStore(profileId),
        profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
        profileId,
        updatedBy: profileId,
        resolution: choice,
        expectedConfirmationKey: inspection.confirmationKey,
        readLocalPreview: readDesktopPortableViewingActivityPreviewV1,
        applyLocalState: applyDesktopPortableViewingActivityStateV1,
        shouldProceed: () => activeRef.current,
      });
      if (!activeRef.current) return;
      if (result.state === "verified") {
        saveDesktopViewingActivitySyncCheckpointV1(result.checkpoint);
        setState({ phase: "enrolled", count: result.count });
        steady.refresh();
      } else {
        setState({ phase: "needs-review", message: executionMessage(result) });
      }
    } catch (error) {
      if (!activeRef.current) return;
      const message = error?.code === "GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE"
        ? "Orion Cloud could not complete a safe Viewing Activity update on this Desktop. Nothing was overwritten."
        : "Viewing Activity could not finish syncing safely. Orion left the operation incomplete instead of guessing.";
      setState({ phase: "error", message });
    } finally {
      busyRef.current = false;
    }
  };

  const steadyActive = enrolled;
  const steadyBusy = steady.phase === "checking" || steady.phase === "syncing";
  const enrollmentBusy = state.phase === "checking" || state.phase === "syncing";
  const busy = steadyActive ? steadyBusy : enrollmentBusy;
  const steadyReviewAvailable = steadyActive && steady.phase === "needs-review" && steady.review?.reason === "two-sided-divergence";
  const needsReview = steadyActive
    ? steady.phase === "needs-review" || steady.phase === "error"
    : state.phase === "needs-review" || state.phase === "error";
  const status = steadyActive
    ? steady.phase === "synced" ? "Synced"
      : steady.phase === "paused" ? "Paused"
        : steady.phase === "offline" ? "Offline"
          : steady.phase === "checking" ? "Syncing"
            : steady.phase === "syncing" ? "Syncing"
              : steady.phase === "needs-review" || steady.phase === "error" ? "Needs review"
                : steady.automatic ? "Synced" : "Paused"
    : state.phase === "checking" ? "Syncing"
      : state.phase === "syncing" ? "Syncing"
        : state.phase === "enrolled" ? "Synced"
          : needsReview ? "Needs review" : "Set up";

  const feedback = steadyActive
    ? steady.phase === "offline"
      ? "Viewing Activity is waiting for a connection. Your history and playback positions remain available on this Desktop."
      : steady.phase === "needs-review" || steady.phase === "error"
        ? steady.message
        : null
    : state.phase === "ready"
      ? `This Desktop has ${countCopy(state.inspection.localCount)}. Orion Cloud has ${countCopy(state.inspection.cloudCount)}. Choose how to set up Viewing Activity.`
      : state.phase === "syncing"
        ? "Syncing Viewing Activity with Orion Cloud."
        : state.phase === "enrolled"
          ? `${countCopy(state.count)} synced with Orion Cloud.`
          : needsReview ? state.message : null;

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
      icon={<HistoryIcon size={18} />}
      title="Viewing Activity"
      summary={countCopy(localCount)}
      status={status}
      autoSync={steadyActive ? {
        value: steady.automatic,
        disabled: busy,
        label: steady.automatic ? "Pause automatic Viewing Activity sync" : "Enable automatic Viewing Activity sync",
        onChange: steady.setAutomatic,
      } : null}
      action={action}
    >
      {!profileId && (
        <div style={{ color: "var(--danger)", fontSize: 12, lineHeight: 1.5 }}>
          Reconnect Google before syncing Viewing Activity. Orion did not change either copy.
        </div>
      )}

      {feedback && (
        <div style={{ color: needsReview ? "var(--danger)" : "var(--text3)", fontSize: 12, lineHeight: 1.55 }}>
          {feedback}
        </div>
      )}

      {steadyReviewAvailable && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "12px 14px", marginTop: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div>
              <div style={{ color: "var(--text3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>This Desktop</div>
              <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700, marginTop: 3 }}>{countCopy(steady.review.localCount)}</div>
            </div>
            <div>
              <div style={{ color: "var(--text3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Orion Cloud</div>
              <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700, marginTop: 3 }}>{countCopy(steady.review.cloudCount)}</div>
            </div>
          </div>
          <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.5, marginTop: 10 }}>
            Both copies changed. Choose which Viewing Activity copy Orion should keep.
          </div>

          {steadyResolution && (
            <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 10 }}>
              {steadyResolution === "desktop"
                ? `Keep this Desktop's ${countCopy(steady.review.localCount)} and replace Orion Cloud?`
                : `Keep Orion Cloud's ${countCopy(steady.review.cloudCount)} and replace this Desktop's Viewing Activity?`}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {steadyResolution ? (
              <>
                <button className="btn btn-secondary" disabled={busy} onClick={() => setSteadyResolution(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={busy} onClick={() => { const choice = steadyResolution; setSteadyResolution(null); steady.resolveReview(choice); }}>Confirm</button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary" disabled={busy} onClick={() => setSteadyResolution("desktop")}>Keep this Desktop</button>
                <button className="btn btn-secondary" disabled={busy} onClick={() => setSteadyResolution("cloud")}>Keep Orion Cloud</button>
                <button className="btn btn-ghost" disabled={busy} onClick={() => steady.refresh()}>Check again</button>
              </>
            )}
          </div>
        </div>
      )}

      {!enrolled && state.phase === "ready" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {state.inspection.availableResolutions.map((choice) => (
            <button key={choice} className={choice === "combine" ? "btn btn-primary" : "btn btn-secondary"} disabled={busy} onClick={() => setResolution(choice)}>
              {labelFor(choice)}
            </button>
          ))}
          <button className="btn btn-ghost" disabled={busy} onClick={() => void checkEnrollment()}>Check again</button>
        </div>
      )}

      {resolution && state.phase === "ready" && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "12px 14px", marginTop: 10 }}>
          <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 700 }}>{labelFor(resolution)}</div>
          <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 5 }}>{confirmationCopy(resolution, state.inspection)}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setResolution(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void confirmResolution()}>Confirm</button>
          </div>
        </div>
      )}

      {busy && (
        <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 10 }}>
          {state.phase === "syncing" || steady.phase === "syncing" ? "Syncing…" : "Checking…"}
        </div>
      )}

      {(localPreview.rejected.history.length > 0 || localPreview.rejected.progress.length > 0) && (
        <div style={{ color: "var(--danger)", fontSize: 12, lineHeight: 1.55, marginTop: 10 }}>
          Some viewing activity needs review before Orion can sync it safely.
        </div>
      )}
    </AccountSyncDomainRow>
  );
}
