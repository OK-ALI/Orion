import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  reconcilePortableWatchedSteadyStateSyncV1,
  resolvePortableWatchedSteadyStateConflictV1,
} from "@orion/shared/api";
import { PORTABLE_PROFILE_PRIMARY_KEY, portableWatchedTruthSignatureV1 } from "@orion/shared/types";
import { DesktopPortableProfileCloudStore } from "../../services/portableProfileCloudStore";
import {
  applyDesktopPortableWatchedPreviewV1,
  readDesktopPortableWatchedPreviewV1,
} from "../../services/watchedOneShotLocalStore";
import {
  loadDesktopWatchedSyncCheckpointV1,
  saveDesktopWatchedSyncCheckpointV1,
} from "../../services/watchedSyncCheckpoint";
import {
  loadDesktopWatchedAutomaticV1,
  saveDesktopWatchedAutomaticV1,
} from "../../services/syncPolicy";

const DesktopWatchedSteadyStateContext = createContext(null);

function itemLabel(count) {
  return `${count} Watched item${count === 1 ? "" : "s"}`;
}

function reviewMessage(reason, conflictKeys, cloudWasWritten) {
  if (reason === "both-changed") return "Watched changed on this Desktop and in the cloud since the last verified sync. Orion stopped instead of choosing a winner.";
  if (reason === "profile-missing-after-checkpoint") return "The previously verified portable profile is missing. Orion will not recreate it automatically.";
  if (reason === "tombstone-conflict") return `${itemLabel(conflictKeys.length)} collide with cloud removals. Orion will not resurrect them automatically.`;
  if (reason === "cloud-conflict" || reason === "cloud-changed-before-pull") return "The cloud profile changed while Watched was syncing. Orion did not overwrite it.";
  if (reason === "local-changed-during-sync") return `Watched changed on this Desktop while sync was running.${cloudWasWritten ? " The verified cloud write is preserved, but no checkpoint was created." : ""}`;
  if (reason === "cloud-verification-failed") return "The cloud write completed, but Orion could not verify the new copy within the safety window. No checkpoint was created.";
  if (reason.includes("identity")) return "The portable Watched state does not match this signed-in Google identity.";
  if (reason.includes("invalid")) return "Watched contains data this Orion version cannot reconcile safely.";
  return "The verified Watched checkpoint no longer matches both copies. Orion stopped without overwriting either side.";
}

export function DesktopWatchedSteadyStateSyncProvider({ googleProfile, networkStatus, watched, children }) {
  const profileId = typeof googleProfile?.sub === "string" ? googleProfile.sub.trim() : "";
  const localPreview = useMemo(() => readDesktopPortableWatchedPreviewV1(), [watched]);
  const localTruthSignature = useMemo(() => portableWatchedTruthSignatureV1(localPreview), [localPreview]);
  const [policy, setPolicy] = useState({ profileId: "", automatic: true });
  const automatic = policy.profileId === profileId ? policy.automatic : true;
  const [status, setStatus] = useState({ phase: "inactive", hasCheckpoint: false, count: null, message: null });
  const [review, setReview] = useState(null);
  const busyRef = useRef(false);
  const pendingModeRef = useRef(null);
  const reconcileRef = useRef(async () => {});
  const latestRef = useRef({ profileId, networkStatus, automatic, localTruthSignature });
  latestRef.current = { profileId, networkStatus, automatic, localTruthSignature };

  useEffect(() => {
    setPolicy({
      profileId,
      automatic: profileId ? loadDesktopWatchedAutomaticV1(profileId) : true,
    });
  }, [profileId]);

  const setAutomatic = useCallback((enabled) => {
    if (!profileId) return;
    saveDesktopWatchedAutomaticV1(profileId, enabled);
    setPolicy({ profileId, automatic: !!enabled });
  }, [profileId]);

  const enqueueReconcile = useCallback((mode) => {
    if (busyRef.current) {
      if (mode === "manual" || pendingModeRef.current == null) pendingModeRef.current = mode;
      return;
    }
    void reconcileRef.current(mode);
  }, []);
  const requestAutomaticReconcile = useCallback(() => enqueueReconcile("automatic"), [enqueueReconcile]);
  const requestManualReconcile = useCallback(() => enqueueReconcile("manual"), [enqueueReconcile]);

  reconcileRef.current = async (mode) => {
    if (busyRef.current) {
      if (mode === "manual" || pendingModeRef.current == null) pendingModeRef.current = mode;
      return;
    }
    const start = latestRef.current;
    if (!start.profileId) {
      setStatus({ phase: "inactive", hasCheckpoint: false, count: null, message: null });
      return;
    }

    const checkpoint = loadDesktopWatchedSyncCheckpointV1(start.profileId);
    const hasCheckpoint = !!checkpoint;
    const startPreview = readDesktopPortableWatchedPreviewV1();
    const startCount = Object.keys(startPreview.records).length;
    if (!hasCheckpoint) {
      setStatus({ phase: "unenrolled", hasCheckpoint: false, count: startCount, message: null });
      return;
    }
    if (startPreview.rejectedKeys.length > 0) {
      setStatus({
        phase: "needs-review",
        hasCheckpoint: true,
        count: startCount,
        message: `${itemLabel(startPreview.rejectedKeys.length)} cannot be represented safely. Orion changed nothing.`,
      });
      return;
    }
    if (mode === "automatic" && !start.automatic) {
      setStatus((current) => current.phase === "needs-review"
        ? { ...current, hasCheckpoint: true }
        : {
            phase: "paused",
            hasCheckpoint: true,
            count: startCount,
            message: "Automatic Watched sync is paused on this Desktop. Use Sync now for a one-time safe sync.",
          });
      return;
    }
    if (start.networkStatus === "offline") {
      setStatus({
        phase: "offline",
        hasCheckpoint: true,
        count: startCount,
        message: "Watched sync is waiting for a connection. Your local Watched state remains available.",
      });
      return;
    }
    if (start.networkStatus === "checking") {
      setStatus({ phase: "checking", hasCheckpoint: true, count: startCount, message: "Waiting for Orion's connection check before syncing Watched." });
      return;
    }

    const operationProfileId = start.profileId;
    const sameAccount = () => latestRef.current.profileId === operationProfileId;
    const automaticStillAllowed = () => mode === "manual" || latestRef.current.automatic;
    const canMutate = () => sameAccount() && automaticStillAllowed();
    const setPaused = () => setStatus({
      phase: "paused",
      hasCheckpoint: true,
      count: Object.keys(readDesktopPortableWatchedPreviewV1().records).length,
      message: "Automatic Watched sync is paused on this Desktop. Use Sync now for a one-time safe sync.",
    });

    busyRef.current = true;
    setReview(null);
    setStatus({ phase: "checking", hasCheckpoint: true, count: startCount, message: null });
    try {
      const store = new DesktopPortableProfileCloudStore(operationProfileId);
      const result = await reconcilePortableWatchedSteadyStateSyncV1({
        store,
        profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
        profileId: operationProfileId,
        updatedBy: operationProfileId,
        checkpoint,
        readLocalPreview: readDesktopPortableWatchedPreviewV1,
        applyLocalPreview: applyDesktopPortableWatchedPreviewV1,
        shouldProceed: canMutate,
        onExecutionStart: () => {
          if (sameAccount()) {
            setStatus({
              phase: "syncing",
              hasCheckpoint: true,
              count: Object.keys(readDesktopPortableWatchedPreviewV1().records).length,
              message: "Reconciling Watched and verifying both copies before creating a new checkpoint.",
            });
          }
        },
      });
      if (!sameAccount()) return;
      if (result.state === "cancelled") {
        setPaused();
        return;
      }
      if (result.state === "unenrolled") {
        setStatus({ phase: "unenrolled", hasCheckpoint: false, count: startCount, message: null });
        return;
      }
      if (result.state === "needs-review") {
        if (result.reason === "both-changed") {
          setReview({ reason: "both-changed", localCount: result.localCount, cloudCount: result.cloudCount });
        }
        setStatus({
          phase: "needs-review",
          hasCheckpoint: true,
          count: Object.keys(readDesktopPortableWatchedPreviewV1().records).length,
          message: reviewMessage(result.reason, result.conflictKeys, result.cloudWasWritten),
        });
        return;
      }

      saveDesktopWatchedSyncCheckpointV1(result.checkpoint);
      if (latestRef.current.automatic) {
        setStatus({
          phase: "synced",
          hasCheckpoint: true,
          count: result.count,
          message: `${itemLabel(result.count)} verified across this Desktop and Orion cloud.`,
        });
      } else {
        setStatus({
          phase: "paused",
          hasCheckpoint: true,
          count: result.count,
          message: `${itemLabel(result.count)} synced. Automatic Watched sync remains paused on this Desktop.`,
        });
      }
    } catch (error) {
      if (!sameAccount()) return;
      const message = error?.code === "GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE"
        ? "Google Drive did not provide the strong conditional-write token Orion requires on this Desktop. Nothing was overwritten."
        : error?.message || "Orion could not reconcile Watched right now. It did not mark the operation as verified.";
      setStatus({ phase: "error", hasCheckpoint: true, count: startCount, message });
    } finally {
      busyRef.current = false;
      const pendingMode = pendingModeRef.current;
      pendingModeRef.current = null;
      if (pendingMode) setTimeout(() => enqueueReconcile(pendingMode), 0);
    }
  };


  const resolveReview = useCallback(async (resolution) => {
    if (busyRef.current) return;
    const start = latestRef.current;
    if (!start.profileId) return;
    const checkpoint = loadDesktopWatchedSyncCheckpointV1(start.profileId);
    if (!checkpoint || start.networkStatus === "offline" || start.networkStatus === "checking") {
      setReview(null);
      setStatus({ phase: "needs-review", hasCheckpoint: !!checkpoint, count: Object.keys(readDesktopPortableWatchedPreviewV1().records).length, message: "Orion cannot resolve Watched until the signed-in profile and connection are ready." });
      return;
    }

    const operationProfileId = start.profileId;
    const sameAccount = () => latestRef.current.profileId === operationProfileId;
    busyRef.current = true;
    setReview(null);
    setStatus({ phase: "syncing", hasCheckpoint: true, count: Object.keys(readDesktopPortableWatchedPreviewV1().records).length, message: "Applying your confirmed Watched choice and verifying both copies." });
    try {
      const store = new DesktopPortableProfileCloudStore(operationProfileId);
      const result = await resolvePortableWatchedSteadyStateConflictV1({
        store,
        profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
        profileId: operationProfileId,
        updatedBy: operationProfileId,
        checkpoint,
        resolution: resolution === "desktop" ? "keep-local" : "keep-cloud",
        readLocalPreview: readDesktopPortableWatchedPreviewV1,
        applyLocalPreview: applyDesktopPortableWatchedPreviewV1,
        shouldProceed: sameAccount,
      });
      if (!sameAccount()) return;
      if (result.state === "cancelled") return;
      if (result.state === "needs-review") {
        setStatus({ phase: "needs-review", hasCheckpoint: true, count: Object.keys(readDesktopPortableWatchedPreviewV1().records).length, message: "Watched changed while Orion was preparing the resolution. Orion stopped without overwriting the newer copy. Check again before choosing." });
        return;
      }

      saveDesktopWatchedSyncCheckpointV1(result.checkpoint);
      const automaticNow = latestRef.current.automatic;
      setStatus(automaticNow
        ? { phase: "synced", hasCheckpoint: true, count: result.count, message: `${itemLabel(result.count)} verified across this Desktop and Orion cloud.` }
        : { phase: "paused", hasCheckpoint: true, count: result.count, message: `${itemLabel(result.count)} synced. Automatic Watched sync remains paused on this Desktop.` });
    } catch (error) {
      if (!sameAccount()) return;
      const message = error?.code === "GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE"
        ? "Orion Cloud could not complete a safe Watched resolution. Nothing was overwritten."
        : "Orion could not verify the Watched resolution. Nothing was marked as synced.";
      setStatus({ phase: "error", hasCheckpoint: true, count: Object.keys(readDesktopPortableWatchedPreviewV1().records).length, message });
    } finally {
      busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    requestAutomaticReconcile();
  }, [profileId, localTruthSignature, networkStatus, automatic, requestAutomaticReconcile]);

  useEffect(() => {
    const onFocus = () => requestAutomaticReconcile();
    const onVisibility = () => {
      if (document.visibilityState === "visible") requestAutomaticReconcile();
    };
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

  return <DesktopWatchedSteadyStateContext.Provider value={value}>{children}</DesktopWatchedSteadyStateContext.Provider>;
}

export function useDesktopWatchedSteadyStateSync() {
  const value = useContext(DesktopWatchedSteadyStateContext);
  if (!value) throw new Error("useDesktopWatchedSteadyStateSync must be used within DesktopWatchedSteadyStateSyncProvider");
  return value;
}
