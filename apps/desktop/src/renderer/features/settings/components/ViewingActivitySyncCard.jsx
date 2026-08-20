import { useEffect, useRef, useState } from "react";
import {
  executePortableViewingActivityOneShotSyncV1,
  inspectPortableViewingActivityOneShotSyncV1,
} from "@orion/shared/api";
import { PORTABLE_PROFILE_PRIMARY_KEY } from "@orion/shared/types";
import { DesktopPortableProfileCloudStore } from "../../../services/portableProfileCloudStore";
import {
  applyDesktopPortableViewingActivityStateV1,
  readDesktopPortableViewingActivityPreviewV1,
} from "../../../services/viewingActivityOneShotLocalStore";
import {
  loadDesktopViewingActivitySyncCheckpointV1,
  saveDesktopViewingActivitySyncCheckpointV1,
} from "../../../services/viewingActivitySyncCheckpoint";

function countCopy(count) {
  return `${count.history} History ${count.history === 1 ? "entry" : "entries"} • ${count.progress} progress ${count.progress === 1 ? "item" : "items"}`;
}

function labelFor(resolution) {
  if (resolution === "device") return "Keep this Desktop";
  if (resolution === "cloud") return "Keep Orion Cloud";
  return "Combine recent activity";
}

function inspectionMessage(result) {
  if (result.reason === "profile-identity-mismatch") return "Viewing Activity in Orion Cloud belongs to a different Orion profile. Nothing was changed.";
  if (result.reason === "local-invalid") return "Some verified local History or Progress cannot be represented safely yet. Orion stopped without changing either copy.";
  if (result.reason === "cloud-invalid") return "Viewing Activity in Orion Cloud contains data this Orion version cannot safely reconcile. Nothing was changed.";
  return "Orion could not find a safe first-sync choice for Viewing Activity. Nothing was overwritten.";
}

function executionMessage(result) {
  if (result.reason === "cloud-conflict" || result.reason === "cloud-changed-before-apply") return "Orion Cloud changed while Viewing Activity was syncing. Orion stopped instead of overwriting it. Check again.";
  if (result.reason === "local-changed-during-sync") return `Viewing Activity changed on this Desktop while sync was running.${result.cloudWasWritten ? " The verified Cloud update was preserved, but enrollment was not completed." : ""} Check again.`;
  if (result.reason === "cloud-verification-failed") return "Orion Cloud was updated, but Orion could not safely verify the new copy. Enrollment was not completed.";
  if (result.reason === "local-apply-failed") return `Orion could not verify the local Viewing Activity update.${result.cloudWasWritten ? " The verified Orion Cloud copy was preserved, but no enrollment checkpoint was created." : ""}`;
  if (result.reason === "resolution-no-longer-safe") return "That sync choice is no longer safe because Viewing Activity changed. Check again.";
  return "Viewing Activity changed after the readiness check. Orion stopped before using the stale plan.";
}

function confirmationCopy(resolution, inspection) {
  if (resolution === "device") return `Use this Desktop's ${countCopy(inspection.localCount)} as the verified Viewing Activity kept in Orion Cloud? Newer Cloud playback or removals will still be protected.`;
  if (resolution === "cloud") return `Restore Orion Cloud's ${countCopy(inspection.cloudCount)} to this Desktop? Local-only unverified playback evidence stays local.`;
  return "Combine both copies by keeping the later verified playback or removal for each movie or episode. Exact-time conflicts remain blocked instead of being guessed.";
}

export default function ViewingActivitySyncCard({ googleProfile }) {
  const profileId = typeof googleProfile?.sub === "string" ? googleProfile.sub.trim() : "";
  const [state, setState] = useState({ phase: "idle" });
  const [resolution, setResolution] = useState(null);
  const busyRef = useRef(false);
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, [profileId]);
  const checkpoint = profileId ? loadDesktopViewingActivitySyncCheckpointV1(profileId) : null;
  const enrolled = !!checkpoint || state.phase === "enrolled";
  const busy = state.phase === "checking" || state.phase === "syncing";
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

  const needsReview = state.phase === "needs-review" || state.phase === "error";
  const badge = enrolled ? "Enrolled"
    : state.phase === "ready" ? "Ready"
      : state.phase === "checking" ? "Checking"
        : state.phase === "syncing" ? "Syncing"
          : needsReview ? "Needs review" : "Manual";
  const feedback = state.phase === "ready"
    ? `This Desktop has ${countCopy(state.inspection.localCount)}. Orion Cloud has ${countCopy(state.inspection.cloudCount)}. Choose how to establish Viewing Activity sync.`
    : state.phase === "syncing" ? "Syncing verified History and Progress. Orion will create enrollment only after the Cloud and local result are verified."
      : state.phase === "enrolled" ? `${countCopy(state.count)} verified with Orion Cloud for this account.`
        : needsReview ? state.message : null;

  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "18px 20px", marginTop: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700 }}>Viewing Activity</div>
          <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 4 }}>
            Keep verified History and playback Progress portable across Orion devices. Continue Watching remains derived from Progress on each device.
          </div>
        </div>
        <span style={{ border: "1px solid var(--border)", borderRadius: 999, color: needsReview ? "var(--red)" : "var(--text3)", fontSize: 11, fontWeight: 700, padding: "4px 9px" }}>{badge}</span>
      </div>

      <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.5, marginTop: 10 }}>{countCopy(localCount)} on this Desktop</div>
      {!profileId && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 12 }}>Reconnect Google before syncing Viewing Activity. Orion did not change either copy.</div>}
      {feedback && <div style={{ color: needsReview ? "var(--red)" : "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 12 }}>{feedback}</div>}
      {enrolled && <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 12 }}>Automatic Viewing Activity sync is not enabled yet. New verified playback changes stay on this Desktop.</div>}

      {!enrolled && state.phase === "ready" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {state.inspection.availableResolutions.map((choice) => (
            <button key={choice} className={choice === "combine" ? "btn btn-primary" : "btn btn-secondary"} disabled={busy} onClick={() => setResolution(choice)}>
              {labelFor(choice)}
            </button>
          ))}
          <button className="btn btn-ghost" disabled={busy} onClick={() => void checkEnrollment()}>Check again</button>
        </div>
      )}

      {!enrolled && state.phase !== "ready" && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn btn-ghost" disabled={busy || !profileId} onClick={() => void checkEnrollment()}>
            {busy ? (state.phase === "syncing" ? "Syncing…" : "Checking…") : "Check Viewing Activity"}
          </button>
        </div>
      )}

      {resolution && state.phase === "ready" && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "12px 14px", marginTop: 14 }}>
          <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 700 }}>{labelFor(resolution)}</div>
          <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 5 }}>{confirmationCopy(resolution, state.inspection)}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setResolution(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void confirmResolution()}>Confirm</button>
          </div>
        </div>
      )}

      {(localPreview.rejected.history.length > 0 || localPreview.rejected.progress.length > 0) && (
        <div style={{ color: "var(--red)", fontSize: 12, lineHeight: 1.55, marginTop: 12 }}>Some verified Viewing Activity cannot be represented safely yet and will block enrollment.</div>
      )}
    </div>
  );
}
