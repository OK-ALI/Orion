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
import { Toggle } from "./SettingsControls";

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
  const needsReview = steadyActive ? steady.phase === "needs-review" || steady.phase === "error" : state.phase === "needs-review" || state.phase === "error";
  const badge = steadyActive
    ? steady.phase === "synced" ? "Synced"
      : steady.phase === "paused" ? "Paused"
        : steady.phase === "offline" ? "Offline"
          : steady.phase === "needs-review" ? "Needs review"
            : steady.phase === "checking" ? "Checking"
              : steady.phase === "syncing" ? "Syncing"
                : steady.phase === "error" ? "Error" : "Automatic"
    : state.phase === "ready" ? "Ready"
      : state.phase === "checking" ? "Checking"
        : state.phase === "syncing" ? "Syncing"
          : needsReview ? "Needs review" : "Manual";
  const feedback = steadyActive
    ? steady.phase === "synced" ? null
      : steady.phase === "paused" ? "Automatic Viewing Activity sync is paused. Local verified playback stays available until you choose Sync now or turn Auto Sync back on."
        : steady.phase === "offline" ? "Viewing Activity is waiting for a connection. Local History and Progress remain available."
          : steady.message
    : state.phase === "ready"
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
      {steadyActive && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--border)", borderRadius: 9, padding: "12px 14px", marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 700 }}>Auto sync</div>
            <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.45, marginTop: 2 }}>{steady.automatic ? "Sync verified History and Progress automatically when Orion is online." : "Automatic sync is paused. Local verified playback stays on this Desktop until you sync manually."}</div>
          </div>
          <Toggle value={steady.automatic} onChange={steady.setAutomatic} title={steady.automatic ? "Pause automatic Viewing Activity sync" : "Enable automatic Viewing Activity sync"} />
        </div>
      )}

      {steadyReviewAvailable && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "12px 14px", marginTop: 14 }}>
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
          <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.5, marginTop: 10 }}>Both copies changed after the last verified sync. Orion cannot prove deletion intent from the v1 checkpoint, so post-checkpoint recovery uses an explicit whole-copy choice instead of Combine.</div>
          {steadyResolution && (
            <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 10 }}>
              {steadyResolution === "desktop"
                ? `Keep this Desktop's ${countCopy(steady.review.localCount)} and replace the current Orion Cloud Viewing Activity?`
                : `Keep Orion Cloud's ${countCopy(steady.review.cloudCount)} and replace this Desktop's portable History and Progress?`}
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {state.inspection.availableResolutions.map((choice) => (
            <button key={choice} className={choice === "combine" ? "btn btn-primary" : "btn btn-secondary"} disabled={busy} onClick={() => setResolution(choice)}>
              {labelFor(choice)}
            </button>
          ))}
          <button className="btn btn-ghost" disabled={busy} onClick={() => void checkEnrollment()}>Check again</button>
        </div>
      )}

      {!enrolled && state.phase !== "ready" ? (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn btn-ghost" disabled={busy || !profileId} onClick={() => void checkEnrollment()}>
            {busy ? (state.phase === "syncing" ? "Syncing…" : "Checking…") : "Check Viewing Activity"}
          </button>
        </div>
      ) : enrolled && !steadyReviewAvailable ? (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn btn-ghost" disabled={busy || !profileId} onClick={() => steady.refresh()}>
            {busy ? (steady.phase === "syncing" ? "Syncing…" : "Checking…") : steady.automatic ? "Check now" : "Sync now"}
          </button>
        </div>
      ) : null}

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
