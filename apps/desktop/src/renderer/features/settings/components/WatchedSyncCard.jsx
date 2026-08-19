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
  if (result.action === "pull") return `Orion Cloud has ${itemLabel(result.targetCount)} ready to restore on this Desktop.`;
  if (result.action === "merge") return `Orion can safely combine both copies into ${itemLabel(result.targetCount)} without deleting either side.`;
  if (result.action === "create") return `Watched is not in Orion Cloud yet. Orion can start it with ${itemLabel(result.targetCount)}.`;
  return `This Desktop can update Orion Cloud to ${itemLabel(result.targetCount)}.`;
}

function reviewCopy(result) {
  if (result.reason === "tombstone-conflict") return `${itemLabel(result.conflictKeys.length)} were previously removed in Orion Cloud. Orion will not restore them automatically.`;
  if (result.reason === "both-changed") return "Watched changed on this Desktop and in Orion Cloud since the last sync. Orion stopped instead of choosing a winner.";
  if (result.reason === "profile-missing-after-checkpoint") return "Previously synced Watched data is missing from Orion Cloud. Orion will not recreate it automatically.";
  if (result.reason.includes("identity")) return "Watched in Orion Cloud does not match this signed-in Google account.";
  if (result.reason.includes("invalid")) return "Watched contains data this Orion version cannot reconcile safely.";
  return "Watched no longer matches the last synced copies. Orion stopped without overwriting either side.";
}

export default function WatchedSyncCard({ googleProfile }) {
  const profileId = typeof googleProfile?.sub === "string" ? googleProfile.sub.trim() : "";
  const steady = useDesktopWatchedSteadyStateSync();
  const [state, setState] = useState({ phase: "idle" });
  const [steadyResolution, setSteadyResolution] = useState(null);
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
      setState({ phase: "error", message: "Orion could not check Watched with Orion Cloud. Nothing was changed." });
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
        ? "Orion Cloud changed while Watched was syncing. Orion did not overwrite it. Check again."
        : result.reason === "local-changed-during-sync"
          ? `Watched changed on this Desktop while sync was running.${result.cloudWasWritten ? " The earlier Orion Cloud update was preserved, but Orion did not finish the sync." : ""} Check again.`
          : result.reason === "cloud-verification-failed"
            ? "Orion Cloud was updated, but Orion could not safely verify the new copy. Local Watched was left untouched."
            : "Watched changed after the readiness check. Orion stopped before using the stale plan.";
      setState({ phase: "needs-review", message });
    } catch (error) {
      const message = error?.code === "GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE"
        ? "Orion Cloud could not complete a safe Watched update on this Desktop. Nothing was overwritten."
        : "Watched could not finish syncing safely. Orion left the operation incomplete instead of guessing.";
      setState({ phase: "error", message });
    } finally {
      busyRef.current = false;
    }
  };

  const steadyBusy = steady.phase === "checking" || steady.phase === "syncing";
  const steadyReviewAvailable = steadyActive && steady.phase === "needs-review" && steady.review?.reason === "both-changed";
  const enrollmentBusy = state.phase === "checking" || state.phase === "syncing";
  const busy = steadyActive ? steadyBusy : enrollmentBusy;
  const needsReview = steadyActive ? steady.phase === "needs-review" : state.phase === "needs-review";
  const failed = steadyActive ? steady.phase === "error" : state.phase === "error";
  const badge = steadyActive
    ? steady.phase === "synced" ? "Synced"
      : steady.phase === "paused" ? "Paused"
        : steady.phase === "offline" ? "Offline"
          : steady.phase === "needs-review" ? "Needs review"
            : steady.phase === "checking" ? "Checking"
              : steady.phase === "syncing" ? "Syncing"
                : steady.phase === "error" ? "Error" : "Automatic"
    : state.phase === "ready" ? "Ready"
      : state.phase === "needs-review" ? "Needs review"
        : state.phase === "checking" ? "Checking"
          : state.phase === "syncing" ? "Syncing"
            : state.phase === "synced" ? "Synced"
              : state.phase === "error" ? "Error" : "Manual";
  const buttonLabel = busy
    ? (steadyActive ? (steady.phase === "syncing" ? "Syncing…" : "Checking…") : (state.phase === "syncing" ? "Syncing…" : "Checking…"))
    : steadyActive && !steady.automatic && !needsReview ? "Sync now"
      : steadyActive ? "Check now" : "Check Watched";
  const localCount = Number.isFinite(steady.count)
    ? steady.count
    : state.phase === "synced" && Number.isFinite(state.count)
      ? state.count
      : null;
  const feedback = steadyActive
    ? steady.phase === "synced"
      ? null
      : steady.phase === "paused"
        ? "Automatic sync is paused. Local Watched changes stay on this Desktop until you choose Sync now or turn Auto Sync back on."
        : steady.phase === "offline"
          ? "Watched is waiting for a connection. Your local Watched state stays available on this Desktop."
          : steady.phase === "checking"
            ? "Checking Watched with Orion Cloud."
            : steady.phase === "syncing"
              ? "Syncing Watched with Orion Cloud."
              : steady.phase === "needs-review"
                ? "Watched needs your attention before Orion can sync it safely. Orion did not choose a winner or overwrite either copy."
                : steady.phase === "error"
                  ? "Orion could not sync Watched right now. Your local Watched state was left available."
                  : null
    : state.phase === "ready" ? `${readyCopy(state.result)} Nothing changes until you confirm.`
      : state.phase === "syncing" ? "Syncing Watched with Orion Cloud. Orion will only mark this complete after both copies agree."
        : state.phase === "synced" ? `${itemLabel(state.count)} synced across this Desktop and Orion Cloud.`
          : state.phase === "needs-review" || state.phase === "error" ? state.message : null;

  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "18px 20px", marginTop: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700 }}>Watched</div>
          <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 4 }}>
            Keep watched movies and episodes in sync across Orion devices.
          </div>
        </div>
        <span style={{ border: "1px solid var(--border)", borderRadius: 999, color: needsReview || failed ? "var(--red)" : "var(--text3)", fontSize: 11, fontWeight: 700, padding: "4px 9px" }}>{badge}</span>
      </div>

      {localCount != null && (
        <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.5, marginTop: 10 }}>
          {localCount} item{localCount === 1 ? "" : "s"} on this Desktop
        </div>
      )}

      {!profileId && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 12 }}>Reconnect Google before syncing Watched. Orion did not change either copy.</div>}
      {steadyActive && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--border)", borderRadius: 9, padding: "12px 14px", marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 700 }}>Auto sync</div>
            <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.45, marginTop: 2 }}>
              {steady.automatic
                ? "Sync changes automatically when Orion is online."
                : "Automatic sync is paused. Local Watched changes stay on this Desktop until you choose Sync now or turn this back on."}
            </div>
          </div>
          <Toggle value={steady.automatic} onChange={steady.setAutomatic} title={steady.automatic ? "Pause automatic Watched sync" : "Enable automatic Watched sync"} />
        </div>
      )}

      {steadyReviewAvailable && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "12px 14px", marginTop: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div>
              <div style={{ color: "var(--text3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>This Desktop</div>
              <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700, marginTop: 3 }}>{steady.review.localCount} watched</div>
            </div>
            <div>
              <div style={{ color: "var(--text3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Orion Cloud</div>
              <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 700, marginTop: 3 }}>{steady.review.cloudCount} watched</div>
            </div>
          </div>
          <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.5, marginTop: 10 }}>
            Both copies changed after the last verified sync. Watched and Unwatched are competing intentions, so Orion will not combine them automatically.
          </div>
        </div>
      )}

      {steadyReviewAvailable && steadyResolution && (
        <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 12 }}>
          {steadyResolution === "desktop"
            ? `Keep this Desktop's ${steady.review.localCount} watched movies and episodes and replace the current Orion Cloud Watched state?`
            : `Keep Orion Cloud's ${steady.review.cloudCount} watched movies and episodes and replace this Desktop Watched state?`}
        </div>
      )}

      {feedback && <div style={{ color: needsReview || failed ? "var(--red)" : "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 12 }}>{feedback}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {steadyReviewAvailable && !steadyResolution ? (
          <>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setSteadyResolution("desktop")}>Keep Desktop Watched</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setSteadyResolution("cloud")}>Keep Orion Cloud Watched</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => steady.refresh()}>Check again</button>
          </>
        ) : steadyReviewAvailable && steadyResolution ? (
          <>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setSteadyResolution(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => { const choice = steadyResolution; setSteadyResolution(null); steady.resolveReview(choice); }}>Confirm</button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost" disabled={busy || !profileId} onClick={() => steadyActive ? steady.refresh() : void checkEnrollment()}>
              {buttonLabel}
            </button>
            {!steadyActive && state.phase === "ready" && (
              <button className="btn btn-primary" disabled={busy} onClick={() => void confirmEnrollment()}>
                Confirm sync
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
