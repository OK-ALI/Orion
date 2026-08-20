import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { reconcilePortableViewingActivitySteadyStateSyncV1, resolvePortableViewingActivitySteadyStateConflictV1 } from "@orion/shared/api";
import { PORTABLE_PROFILE_PRIMARY_KEY, portableViewingActivityTruthSignatureV1 } from "@orion/shared/types";
import { DesktopPortableProfileCloudStore } from "../../services/portableProfileCloudStore";
import {
  applyDesktopPortableViewingActivityStateV1,
  readDesktopPortableViewingActivityPreviewV1,
} from "../../services/viewingActivityOneShotLocalStore";
import {
  loadDesktopViewingActivitySyncCheckpointV1,
  saveDesktopViewingActivitySyncCheckpointV1,
} from "../../services/viewingActivitySyncCheckpoint";
import {
  loadDesktopViewingActivityAutomaticV1,
  saveDesktopViewingActivityAutomaticV1,
} from "../../services/syncPolicy";

const DesktopViewingActivitySteadyStateContext = createContext(null);

function countLabel(value) {
  return `${value.history} History ${value.history === 1 ? "entry" : "entries"} + ${value.progress} progress ${value.progress === 1 ? "item" : "items"}`;
}

function reviewMessage(result) {
  if (result.reason === "profile-missing-after-checkpoint") return "Previously verified Viewing Activity is missing from Orion Cloud. Orion will not recreate it automatically.";
  if (result.reason === "two-sided-removal-ambiguity") return "Viewing Activity changed on both sides and Orion cannot prove whether missing local items are Cloud additions or offline local removals. Nothing was overwritten.";
  if (result.reason === "event-time-conflict") return "Viewing Activity contains an exact-time verified conflict. Orion stopped instead of guessing which playback truth is correct.";
  if (result.reason === "cloud-conflict" || result.reason === "cloud-changed-before-pull") return "Orion Cloud changed while Viewing Activity was syncing. Orion stopped without overwriting it.";
  if (result.reason === "local-changed-during-sync") return `Viewing Activity changed on this Desktop while sync was running.${result.cloudWasWritten ? " The verified Cloud write is preserved, but no checkpoint was created." : ""}`;
  if (result.reason === "cloud-verification-failed") return "The Cloud write completed, but Orion could not verify the updated Viewing Activity copy. No checkpoint was created.";
  if (result.reason === "local-apply-failed") return "Orion could not verify the local Viewing Activity update. The operation was not marked as synced.";
  if (result.reason.includes("identity") || result.reason.includes("profile")) return "Viewing Activity does not match this signed-in Orion profile.";
  if (result.reason.includes("invalid") || result.reason === "local-update-unsafe") return "Viewing Activity contains data Orion cannot reconcile safely without losing verified playback truth.";
  return "Viewing Activity no longer matches the last verified checkpoint. Orion stopped without choosing a winner.";
}

export function DesktopViewingActivitySteadyStateSyncProvider({ googleProfile, networkStatus, history, progress, children }) {
  const profileId = typeof googleProfile?.sub === "string" ? googleProfile.sub.trim() : "";
  const localPreview = useMemo(() => readDesktopPortableViewingActivityPreviewV1(), [history, progress]);
  const localTruthSignature = useMemo(() => portableViewingActivityTruthSignatureV1(localPreview), [localPreview]);
  const [policy, setPolicy] = useState({ profileId: "", automatic: true });
  const automatic = policy.profileId === profileId ? policy.automatic : true;
  const [status, setStatus] = useState({ phase: "inactive", hasCheckpoint: false, count: null, message: null });
  const [review, setReview] = useState(null);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const pendingModeRef = useRef(null);
  const reconcileRef = useRef(async () => {});
  const latestRef = useRef({ profileId, networkStatus, automatic, localTruthSignature });
  latestRef.current = { profileId, networkStatus, automatic, localTruthSignature };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; pendingModeRef.current = null; };
  }, []);

  useEffect(() => {
    setPolicy({ profileId, automatic: profileId ? loadDesktopViewingActivityAutomaticV1(profileId) : true });
  }, [profileId]);

  const setAutomatic = useCallback((enabled) => {
    if (!profileId) return;
    saveDesktopViewingActivityAutomaticV1(profileId, enabled);
    setPolicy({ profileId, automatic: !!enabled });
  }, [profileId]);

  const enqueueReconcile = useCallback((mode) => {
    if (!mountedRef.current) return;
    if (busyRef.current) {
      if (mode === "manual" || pendingModeRef.current == null) pendingModeRef.current = mode;
      return;
    }
    void reconcileRef.current(mode);
  }, []);
  const requestAutomaticReconcile = useCallback(() => enqueueReconcile("automatic"), [enqueueReconcile]);
  const requestManualReconcile = useCallback(() => enqueueReconcile("manual"), [enqueueReconcile]);

  reconcileRef.current = async (mode) => {
    if (!mountedRef.current || busyRef.current) return;
    const start = latestRef.current;
    const preview = readDesktopPortableViewingActivityPreviewV1();
    const startCount = { history: Object.keys(preview.history).length, progress: Object.keys(preview.progress).length };
    if (!start.profileId) {
      setStatus({ phase: "inactive", hasCheckpoint: false, count: startCount, message: null });
      return;
    }
    const checkpoint = loadDesktopViewingActivitySyncCheckpointV1(start.profileId);
    if (!checkpoint) {
      setStatus({ phase: "unenrolled", hasCheckpoint: false, count: startCount, message: null });
      return;
    }
    if (mode === "automatic" && !start.automatic) {
      setStatus((current) => current.phase === "needs-review"
        ? { ...current, hasCheckpoint: true }
        : { phase: "paused", hasCheckpoint: true, count: startCount, message: "Automatic Viewing Activity sync is paused on this Desktop. Use Sync now for a one-time safe sync." });
      return;
    }
    if (start.networkStatus === "offline") {
      setStatus({ phase: "offline", hasCheckpoint: true, count: startCount, message: "Viewing Activity is waiting for a connection. Local History and Progress remain available." });
      return;
    }
    if (start.networkStatus === "checking") {
      setStatus({ phase: "checking", hasCheckpoint: true, count: startCount, message: "Waiting for Orion's connection check before syncing Viewing Activity." });
      return;
    }

    const operationProfileId = start.profileId;
    const sameAccount = () => mountedRef.current && latestRef.current.profileId === operationProfileId;
    const automaticStillAllowed = () => mode === "manual" || latestRef.current.automatic;
    const canMutate = () => sameAccount() && automaticStillAllowed();
    busyRef.current = true;
    setReview(null);
    setStatus({ phase: "checking", hasCheckpoint: true, count: startCount, message: null });
    try {
      const result = await reconcilePortableViewingActivitySteadyStateSyncV1({
        store: new DesktopPortableProfileCloudStore(operationProfileId),
        profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
        profileId: operationProfileId,
        updatedBy: operationProfileId,
        checkpoint,
        readLocalPreview: readDesktopPortableViewingActivityPreviewV1,
        applyLocalState: applyDesktopPortableViewingActivityStateV1,
        shouldProceed: canMutate,
        onExecutionStart: () => {
          if (sameAccount()) setStatus({ phase: "syncing", hasCheckpoint: true, count: startCount, message: "Reconciling verified History and Progress with Orion Cloud." });
        },
      });
      if (!sameAccount()) return;
      if (result.state === "cancelled") {
        setStatus({ phase: "paused", hasCheckpoint: true, count: startCount, message: "Automatic Viewing Activity sync paused before another mutation." });
        return;
      }
      if (result.state === "unenrolled") {
        setStatus({ phase: "unenrolled", hasCheckpoint: false, count: startCount, message: null });
        return;
      }
      if (result.state === "needs-review") {
        if (result.reason === "two-sided-removal-ambiguity" || result.reason === "event-time-conflict") {
          setReview({ reason: "two-sided-divergence", localCount: result.localCount, cloudCount: result.cloudCount });
        }
        setStatus({ phase: "needs-review", hasCheckpoint: true, count: startCount, message: reviewMessage(result) });
        return;
      }
      saveDesktopViewingActivitySyncCheckpointV1(result.checkpoint);
      setStatus(latestRef.current.automatic
        ? { phase: "synced", hasCheckpoint: true, count: result.count, message: null }
        : { phase: "paused", hasCheckpoint: true, count: result.count, message: `${countLabel(result.count)} synced. Automatic sync remains paused on this Desktop.` });
    } catch (error) {
      if (!sameAccount()) return;
      const message = error?.code === "GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE"
        ? "Orion Cloud did not provide the conditional-write token required for safe Viewing Activity sync. Nothing was overwritten."
        : error?.message || "Orion could not reconcile Viewing Activity right now. Nothing was marked as synced.";
      setStatus({ phase: "error", hasCheckpoint: true, count: startCount, message });
    } finally {
      busyRef.current = false;
      const pendingMode = pendingModeRef.current;
      pendingModeRef.current = null;
      if (pendingMode && mountedRef.current) setTimeout(() => enqueueReconcile(pendingMode), 0);
    }
  };

  const resolveReview = useCallback((resolution) => {
    if (!mountedRef.current || busyRef.current) return;
    void (async () => {
      const start = latestRef.current;
      if (!start.profileId) return;
      const checkpoint = loadDesktopViewingActivitySyncCheckpointV1(start.profileId);
      const startPreview = readDesktopPortableViewingActivityPreviewV1();
      const startCount = { history: Object.keys(startPreview.history).length, progress: Object.keys(startPreview.progress).length };
      if (!checkpoint || start.networkStatus === "offline" || start.networkStatus === "checking") {
        setReview(null);
        setStatus({ phase: "needs-review", hasCheckpoint: !!checkpoint, count: startCount, message: "Orion cannot resolve Viewing Activity until this account and connection are ready." });
        return;
      }
      const operationProfileId = start.profileId;
      const sameAccount = () => mountedRef.current && latestRef.current.profileId === operationProfileId;
      busyRef.current = true;
      setReview(null);
      setStatus({ phase: "syncing", hasCheckpoint: true, count: startCount, message: "Applying your confirmed Viewing Activity choice and verifying both copies." });
      try {
        const result = await resolvePortableViewingActivitySteadyStateConflictV1({
          store: new DesktopPortableProfileCloudStore(operationProfileId),
          profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
          profileId: operationProfileId,
          updatedBy: operationProfileId,
          checkpoint,
          resolution: resolution === "desktop" ? "keep-local" : "keep-cloud",
          readLocalPreview: readDesktopPortableViewingActivityPreviewV1,
          applyLocalState: applyDesktopPortableViewingActivityStateV1,
          shouldProceed: sameAccount,
        });
        if (!sameAccount()) return;
        if (result.state === "cancelled") return;
        if (result.state === "needs-review") {
          setStatus({ phase: "needs-review", hasCheckpoint: true, count: startCount, message: "Viewing Activity changed while Orion was preparing the resolution. Orion stopped without overwriting the newer copy. Check again before choosing." });
          return;
        }
        saveDesktopViewingActivitySyncCheckpointV1(result.checkpoint);
        setStatus(latestRef.current.automatic
          ? { phase: "synced", hasCheckpoint: true, count: result.count, message: "Viewing Activity is verified across this Desktop and Orion Cloud." }
          : { phase: "paused", hasCheckpoint: true, count: result.count, message: `${countLabel(result.count)} synced. Automatic sync remains paused on this Desktop.` });
      } catch (error) {
        if (!sameAccount()) return;
        const message = error?.code === "GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE"
          ? "Orion Cloud did not provide the conditional-write token required for safe Viewing Activity conflict recovery. Nothing was overwritten."
          : "Orion could not verify the Viewing Activity resolution. Nothing was marked as synced.";
        setStatus({ phase: "error", hasCheckpoint: true, count: startCount, message });
      } finally {
        busyRef.current = false;
      }
    })();
  }, []);

  useEffect(() => {
    requestAutomaticReconcile();
  }, [profileId, localTruthSignature, networkStatus, automatic, requestAutomaticReconcile]);

  useEffect(() => {
    const onFocus = () => requestAutomaticReconcile();
    const onVisibility = () => { if (document.visibilityState === "visible") requestAutomaticReconcile(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [requestAutomaticReconcile]);

  const value = useMemo(() => ({
    ...status,
    automatic,
    setAutomatic,
    refresh: requestManualReconcile,
    review,
    resolveReview,
  }), [automatic, requestManualReconcile, resolveReview, review, setAutomatic, status]);
  return <DesktopViewingActivitySteadyStateContext.Provider value={value}>{children}</DesktopViewingActivitySteadyStateContext.Provider>;
}

export function useDesktopViewingActivitySteadyStateSync() {
  const value = useContext(DesktopViewingActivitySteadyStateContext);
  if (!value) throw new Error("useDesktopViewingActivitySteadyStateSync must be used within DesktopViewingActivitySteadyStateSyncProvider");
  return value;
}
