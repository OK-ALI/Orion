import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  buildPortableMyListPreviewFromProfileV1,
  buildPortableMyListPreviewV1,
  buildPortableMyListSteadyStateProfileV1,
  portableMyListActiveMatchesPreviewV1,
  portableMyListNamespaceSignatureV1,
  portableMyListPreviewSignatureV1,
  PORTABLE_PROFILE_PRIMARY_KEY,
} from "@orion/shared/types";
import { DesktopPortableProfileCloudStore } from "../../services/portableProfileCloudStore";
import { readBackCloudProfileUntilVerified } from "../../services/cloudProfileReadBackVerification";
import {
  applyDesktopPortableMyListPreviewV1,
} from "../../services/myListSyncLocalStore";
import {
  loadDesktopMyListSyncCheckpointV1,
  saveDesktopMyListSyncCheckpointV1,
} from "../../services/myListSyncCheckpoint";
import {
  loadDesktopMyListAutomaticV1,
  saveDesktopMyListAutomaticV1,
} from "../../services/syncPolicy";

const DesktopMyListSteadyStateContext = createContext(null);

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

function normalizeOrder(saved, savedOrder) {
  return Array.isArray(savedOrder) ? savedOrder : Object.keys(saved || {});
}

export function DesktopMyListSteadyStateSyncProvider({ googleProfile, networkStatus, saved, savedOrder, children }) {
  const profileId = typeof googleProfile?.sub === "string" ? googleProfile.sub.trim() : "";
  const preview = useMemo(
    () => buildPortableMyListPreviewV1(saved || {}, normalizeOrder(saved, savedOrder)),
    [saved, savedOrder],
  );
  const localSignature = useMemo(() => portableMyListPreviewSignatureV1(preview), [preview]);
  const [policy, setPolicy] = useState({ profileId: "", automatic: true });
  const automatic = policy.profileId === profileId ? policy.automatic : true;
  const [status, setStatus] = useState({ phase: "inactive", hasCheckpoint: false, count: preview.orderedKeys.length, message: null });
  const busyRef = useRef(false);
  const pendingModeRef = useRef(null);
  const reconcileRef = useRef(async () => {});
  const latestRef = useRef({ profileId, networkStatus, automatic, preview, localSignature });
  latestRef.current = { profileId, networkStatus, automatic, preview, localSignature };

  useEffect(() => {
    setPolicy({
      profileId,
      automatic: profileId ? loadDesktopMyListAutomaticV1(profileId) : true,
    });
  }, [profileId]);

  const setAutomatic = useCallback((enabled) => {
    if (!profileId) return;
    saveDesktopMyListAutomaticV1(profileId, enabled);
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
    const startCount = start.preview.orderedKeys.length;
    if (!start.profileId) {
      setStatus({ phase: "inactive", hasCheckpoint: false, count: startCount, message: null });
      return;
    }

    const checkpoint = loadDesktopMyListSyncCheckpointV1(start.profileId);
    const hasCheckpoint = !!checkpoint;
    if (mode === "automatic" && !start.automatic) {
      setStatus((current) => hasCheckpoint && current.phase === "needs-review"
        ? { ...current, hasCheckpoint: true, count: startCount }
        : hasCheckpoint
          ? { phase: "paused", hasCheckpoint: true, count: startCount, message: "Automatic My List sync is paused on this Desktop. Use Sync now for a one-time safe sync." }
          : { phase: "unenrolled", hasCheckpoint: false, count: startCount, message: null });
      return;
    }
    if (start.preview.rejectedKeys.length > 0) {
      setStatus({
        phase: "needs-review",
        hasCheckpoint,
        count: startCount,
        message: `${itemLabel(start.preview.rejectedKeys.length)} on this Desktop cannot be synced safely. Orion changed nothing.`,
      });
      return;
    }
    if (start.networkStatus === "offline") {
      setStatus({ phase: "offline", hasCheckpoint, count: startCount, message: "My List is waiting for a connection. Your local My List stays available." });
      return;
    }
    if (start.networkStatus === "checking") {
      setStatus({ phase: "checking", hasCheckpoint, count: startCount, message: "Waiting for Orion's connection check before syncing My List." });
      return;
    }

    const operationProfileId = start.profileId;
    const operationLocalSignature = start.localSignature;
    const sameAccount = () => latestRef.current.profileId === operationProfileId;
    const automaticStillAllowed = () => mode === "manual" || latestRef.current.automatic;
    const setPaused = () => setStatus({
      phase: "paused",
      hasCheckpoint,
      count: latestRef.current.preview.orderedKeys.length,
      message: "Automatic My List sync is paused on this Desktop. Use Sync now for a one-time safe sync.",
    });
    const setVerified = (count) => setStatus(latestRef.current.automatic
      ? { phase: "synced", hasCheckpoint: true, count, message: null }
      : { phase: "paused", hasCheckpoint: true, count, message: "My List is synced. Automatic sync remains paused on this Desktop." });

    busyRef.current = true;
    setStatus({ phase: "checking", hasCheckpoint, count: startCount, message: null });
    try {
      const store = new DesktopPortableProfileCloudStore(operationProfileId);
      const remote = await store.read(PORTABLE_PROFILE_PRIMARY_KEY);
      if (!sameAccount()) return;
      if (!automaticStillAllowed()) {
        setPaused();
        return;
      }

      if (remote.state === "missing") {
        setStatus(hasCheckpoint
          ? { phase: "needs-review", hasCheckpoint: true, count: startCount, message: "Previously synced Orion Cloud data is missing. Orion will not recreate it automatically." }
          : { phase: "unenrolled", hasCheckpoint: false, count: startCount, message: null });
        return;
      }

      const cloudPreview = buildPortableMyListPreviewFromProfileV1(remote.profile);
      const cloudNamespaceSignature = portableMyListNamespaceSignatureV1(remote.profile);
      if (!cloudPreview || !cloudNamespaceSignature) {
        setStatus({ phase: "needs-review", hasCheckpoint, count: startCount, message: "My List in Orion Cloud cannot be reconciled safely by this Orion version." });
        return;
      }

      if (!checkpoint) {
        if (portableMyListActiveMatchesPreviewV1(remote.profile, start.preview)) {
          saveDesktopMyListSyncCheckpointV1({
            profileId: operationProfileId,
            localSignature: operationLocalSignature,
            cloudNamespaceSignature,
            verifiedAt: Date.now(),
          });
          setVerified(startCount);
        } else {
          setStatus({ phase: "unenrolled", hasCheckpoint: false, count: startCount, message: null });
        }
        return;
      }

      if (portableMyListActiveMatchesPreviewV1(remote.profile, start.preview)) {
        saveDesktopMyListSyncCheckpointV1({
          profileId: operationProfileId,
          localSignature: operationLocalSignature,
          cloudNamespaceSignature,
          verifiedAt: Date.now(),
        });
        setVerified(startCount);
        return;
      }

      const localChanged = operationLocalSignature !== checkpoint.localSignature;
      const cloudChanged = cloudNamespaceSignature !== checkpoint.cloudNamespaceSignature;

      if (localChanged && cloudChanged) {
        setStatus({ phase: "needs-review", hasCheckpoint: true, count: startCount, message: "My List changed on this Desktop and in Orion Cloud since the last sync. Orion stopped instead of choosing a winner." });
        return;
      }

      if (localChanged && !cloudChanged) {
        if (latestRef.current.localSignature !== operationLocalSignature) {
          pendingModeRef.current = mode;
          return;
        }
        setStatus({ phase: "syncing", hasCheckpoint: true, count: startCount, message: "Syncing My List with Orion Cloud." });
        const candidate = buildPortableMyListSteadyStateProfileV1(remote.profile, start.preview, {
          profileId: operationProfileId,
          updatedBy: operationProfileId,
        });
        if (latestRef.current.localSignature !== operationLocalSignature) {
          pendingModeRef.current = mode;
          return;
        }
        if (!automaticStillAllowed()) {
          setPaused();
          return;
        }

        const write = await store.write(PORTABLE_PROFILE_PRIMARY_KEY, {
          profile: candidate,
          expectedRevisionTag: remote.revisionTag,
        });
        if (write.state === "conflict") {
          setStatus({ phase: "needs-review", hasCheckpoint: true, count: startCount, message: "Orion Cloud changed while My List was syncing. Orion did not overwrite it." });
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
                return readBack.profile.profileId === operationProfileId
                  && readBack.profile.revision === candidate.revision
                  && readBack.profile.updatedAt === candidate.updatedAt
                  && verifiedNamespaceSignature === candidateNamespaceSignature
                  && unrelatedNamespacesMatch(candidate, readBack.profile)
                  && portableMyListActiveMatchesPreviewV1(readBack.profile, start.preview);
              },
            );
        const verifiedNamespaceSignature = verify ? portableMyListNamespaceSignatureV1(verify.profile) : null;
        if (!verify || !verifiedNamespaceSignature) {
          setStatus({ phase: "needs-review", hasCheckpoint: true, count: startCount, message: "Orion could not verify the updated Orion Cloud copy. Your local My List was left unchanged." });
          return;
        }

        saveDesktopMyListSyncCheckpointV1({
          profileId: operationProfileId,
          localSignature: operationLocalSignature,
          cloudNamespaceSignature: verifiedNamespaceSignature,
          verifiedAt: Date.now(),
        });
        if (latestRef.current.localSignature !== operationLocalSignature) {
          pendingModeRef.current = mode;
          setStatus({ phase: "syncing", hasCheckpoint: true, count: latestRef.current.preview.orderedKeys.length, message: "My List changed again. Orion is checking the newer copy." });
          return;
        }
        setVerified(startCount);
        return;
      }

      if (!localChanged && cloudChanged) {
        if (latestRef.current.localSignature !== operationLocalSignature) {
          pendingModeRef.current = mode;
          return;
        }
        setStatus({ phase: "syncing", hasCheckpoint: true, count: startCount, message: "Applying a verified My List update from Orion Cloud." });
        if (!automaticStillAllowed()) {
          setPaused();
          return;
        }
        const freshPull = await store.read(PORTABLE_PROFILE_PRIMARY_KEY);
        const freshPullSignature = freshPull.state === "found" ? portableMyListNamespaceSignatureV1(freshPull.profile) : null;
        if (
          freshPull.state !== "found"
          || freshPull.revisionTag !== remote.revisionTag
          || freshPull.profile.profileId !== operationProfileId
          || freshPullSignature !== cloudNamespaceSignature
        ) {
          pendingModeRef.current = mode;
          return;
        }
        if (latestRef.current.localSignature !== operationLocalSignature) {
          pendingModeRef.current = mode;
          return;
        }
        if (!automaticStillAllowed()) {
          setPaused();
          return;
        }

        applyDesktopPortableMyListPreviewV1(cloudPreview);
        saveDesktopMyListSyncCheckpointV1({
          profileId: operationProfileId,
          localSignature: portableMyListPreviewSignatureV1(cloudPreview),
          cloudNamespaceSignature,
          verifiedAt: Date.now(),
        });
        setVerified(cloudPreview.orderedKeys.length);
        return;
      }

      setStatus({ phase: "needs-review", hasCheckpoint: true, count: startCount, message: "The saved My List checkpoint no longer matches both copies. Orion stopped without changing either side." });
    } catch (error) {
      if (!sameAccount()) return;
      const message = error?.code === "GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE"
        ? "Orion Cloud could not complete a safe My List update on this Desktop. Nothing was overwritten."
        : "Orion could not sync My List right now. Your local My List was left available.";
      setStatus({ phase: "error", hasCheckpoint, count: startCount, message });
    } finally {
      busyRef.current = false;
      const pendingMode = pendingModeRef.current;
      pendingModeRef.current = null;
      if (pendingMode) setTimeout(() => enqueueReconcile(pendingMode), 0);
    }
  };

  useEffect(() => {
    requestAutomaticReconcile();
  }, [profileId, localSignature, networkStatus, automatic, requestAutomaticReconcile]);

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

  const value = useMemo(() => ({ ...status, automatic, setAutomatic, refresh: requestManualReconcile }), [automatic, requestManualReconcile, setAutomatic, status]);
  return <DesktopMyListSteadyStateContext.Provider value={value}>{children}</DesktopMyListSteadyStateContext.Provider>;
}

export function useDesktopMyListSteadyStateSync() {
  const value = useContext(DesktopMyListSteadyStateContext);
  if (!value) throw new Error("useDesktopMyListSteadyStateSync must be used within DesktopMyListSteadyStateSyncProvider");
  return value;
}
