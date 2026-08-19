import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { resolvePortableMyListSteadyStateConflictV1 } from '@orion/shared/api';
import {
  buildPortableMyListPreviewFromProfileV1,
  buildPortableMyListPreviewV1,
  buildPortableMyListSteadyStateProfileV1,
  portableMyListActiveMatchesPreviewV1,
  portableMyListNamespaceSignatureV1,
  portableMyListPreviewSignatureV1,
  PORTABLE_PROFILE_PRIMARY_KEY,
  type PortableProfileV3,
} from '@orion/shared/types';
import { useLibrary } from '../../context/LibraryContext';
import { useNetworkStatus } from '../../context/NetworkContext';
import { useOrionAccount } from '../../context/AccountContext';
import { buildLocalMyListSnapshotV1 } from '../library/myListPortableAdapter';
import { GoogleDriveCloudProfileStore } from './googleDriveCloudProfileStore';
import { readBackCloudProfileUntilVerified } from './cloudProfileReadBackVerification';
import { useOrionSyncPolicy } from './SyncPolicyContext';
import { checkGoogleDriveAppDataAuthorization, isNativeGoogleDriveAuthorizationAvailable } from './nativeGoogleDriveAuthorization';
import {
  loadMyListSyncCheckpointV1,
  saveMyListSyncCheckpointV1,
} from './myListSyncCheckpoint';

export type MyListSteadyStatePhase =
  | 'inactive'
  | 'unenrolled'
  | 'checking'
  | 'syncing'
  | 'synced'
  | 'paused'
  | 'offline'
  | 'needs-review'
  | 'error';

interface MyListSteadyStateReview {
  reason: 'both-changed';
  localCount: number;
  cloudCount: number;
}

interface MyListSteadyStateValue {
  phase: MyListSteadyStatePhase;
  hasCheckpoint: boolean;
  message: string | null;
  refresh: () => void;
  review: MyListSteadyStateReview | null;
  resolveReview: (resolution: 'device' | 'cloud') => void;
}

const MyListSteadyStateContext = createContext<MyListSteadyStateValue | null>(null);

function itemLabel(count: number): string {
  return `${count} item${count === 1 ? '' : 's'}`;
}

function unrelatedNamespacesMatch(expected: PortableProfileV3, actual: PortableProfileV3): boolean {
  const expectedNames = Object.keys(expected.namespaces).filter((name) => name !== 'myList').sort();
  const actualNames = Object.keys(actual.namespaces).filter((name) => name !== 'myList').sort();
  if (expectedNames.length !== actualNames.length) return false;
  return expectedNames.every((name, index) => (
    actualNames[index] === name
    && JSON.stringify(expected.namespaces[name]) === JSON.stringify(actual.namespaces[name])
  ));
}

export function MyListSteadyStateSyncProvider({ children }: { children: React.ReactNode }) {
  const account = useOrionAccount();
  const network = useNetworkStatus();
  const syncPolicy = useOrionSyncPolicy();
  const myListAutomatic = syncPolicy.getAutomatic('myList');
  const { saved, savedOrder, replaceMyListFromSync } = useLibrary();
  const preview = useMemo(() => buildPortableMyListPreviewV1(saved, savedOrder), [saved, savedOrder]);
  const localSignature = useMemo(() => portableMyListPreviewSignatureV1(preview), [preview]);
  const previewRef = useRef(preview);
  previewRef.current = preview;

  const [status, setStatus] = useState<Pick<MyListSteadyStateValue, 'phase' | 'hasCheckpoint' | 'message'>>({
    phase: 'inactive',
    hasCheckpoint: false,
    message: null,
  });
  const [review, setReview] = useState<MyListSteadyStateReview | null>(null);
  const busyRef = useRef(false);
  const pendingModeRef = useRef<'automatic' | 'manual' | null>(null);
  const reconcileRef = useRef<(mode: 'automatic' | 'manual') => Promise<void>>(async () => {});
  const latestRef = useRef({
    profile: account.state.profile,
    accountPhase: account.state.phase,
    preview,
    saved,
    localSignature,
    online: network.online,
    internetReachable: network.internetReachable,
    policyReady: syncPolicy.ready,
    myListAutomatic,
  });
  latestRef.current = {
    profile: account.state.profile,
    accountPhase: account.state.phase,
    preview,
    saved,
    localSignature,
    online: network.online,
    internetReachable: network.internetReachable,
    policyReady: syncPolicy.ready,
    myListAutomatic,
  };

  const enqueueReconcile = useCallback((mode: 'automatic' | 'manual') => {
    if (busyRef.current) {
      if (mode === 'manual' || pendingModeRef.current == null) pendingModeRef.current = mode;
      return;
    }
    void reconcileRef.current(mode);
  }, []);

  const requestAutomaticReconcile = useCallback(() => enqueueReconcile('automatic'), [enqueueReconcile]);
  const requestManualReconcile = useCallback(() => enqueueReconcile('manual'), [enqueueReconcile]);

  reconcileRef.current = async (mode) => {
    if (busyRef.current) {
      if (mode === 'manual' || pendingModeRef.current == null) pendingModeRef.current = mode;
      return;
    }

    const start = latestRef.current;
    const profile = start.profile;
    if (start.accountPhase !== 'signed-in' || !profile) {
      setStatus({ phase: 'inactive', hasCheckpoint: false, message: null });
      return;
    }

    const checkpoint = loadMyListSyncCheckpointV1(profile.accountId);
    const hasCheckpoint = !!checkpoint;
    if (!start.policyReady) {
      setStatus({ phase: 'inactive', hasCheckpoint, message: null });
      return;
    }
    if (mode === 'automatic' && !start.myListAutomatic) {
      setStatus((current) => {
        if (hasCheckpoint && current.phase === 'needs-review') {
          return { ...current, hasCheckpoint: true };
        }
        return hasCheckpoint
          ? {
              phase: 'paused',
              hasCheckpoint: true,
              message: 'Automatic My List sync is paused on this device. Use Sync now for a one-time safe sync, or turn Auto sync back on.',
            }
          : { phase: 'unenrolled', hasCheckpoint: false, message: null };
      });
      return;
    }
    if (start.preview.rejectedKeys.length > 0) {
      setStatus({
        phase: 'needs-review',
        hasCheckpoint,
        message: `${itemLabel(start.preview.rejectedKeys.length)} on this device cannot be synced safely. Orion changed nothing.`,
      });
      return;
    }
    if (!start.online || start.internetReachable === false) {
      setStatus({
        phase: 'offline',
        hasCheckpoint,
        message: 'My List sync is paused while Orion is offline. Your local My List is unchanged.',
      });
      return;
    }
    if (!isNativeGoogleDriveAuthorizationAvailable()) {
      setStatus({ phase: 'inactive', hasCheckpoint, message: null });
      return;
    }

    const operationProfileId = profile.accountId;
    const operationLocalSignature = start.localSignature;
    const sameAccount = () => latestRef.current.profile?.accountId === operationProfileId;
    const automaticStillAllowed = () => mode === 'manual' || latestRef.current.myListAutomatic;
    const setVerifiedStatus = (count: number) => {
      if (latestRef.current.myListAutomatic) {
        setStatus({
          phase: 'synced',
          hasCheckpoint: true,
          message: `${itemLabel(count)} synced with your Orion profile.`,
        });
      } else {
        setStatus({
          phase: 'paused',
          hasCheckpoint: true,
          message: `${itemLabel(count)} synced. Automatic My List sync is paused on this device.`,
        });
      }
    };
    const setPaused = () => setStatus({
      phase: 'paused',
      hasCheckpoint,
      message: 'Automatic My List sync is paused on this device. Use Sync now for a one-time safe sync, or turn Auto sync back on.',
    });

    busyRef.current = true;
    setReview(null);
    setStatus({ phase: 'checking', hasCheckpoint, message: null });
    try {
      const authorization = await checkGoogleDriveAppDataAuthorization(profile.email);
      if (!sameAccount()) return;
      if (!automaticStillAllowed()) {
        setPaused();
        return;
      }
      if (!authorization.authorized) {
        setStatus({ phase: 'inactive', hasCheckpoint, message: null });
        return;
      }

      const store = new GoogleDriveCloudProfileStore(profile.email);
      const remote = await store.read(PORTABLE_PROFILE_PRIMARY_KEY);
      if (!sameAccount()) return;
      if (!automaticStillAllowed()) {
        setPaused();
        return;
      }

      if (remote.state === 'missing') {
        setStatus(hasCheckpoint
          ? {
              phase: 'needs-review',
              hasCheckpoint: true,
              message: 'The previously verified cloud profile is missing. Orion will not recreate it automatically or overwrite local My List data.',
            }
          : { phase: 'unenrolled', hasCheckpoint: false, message: null });
        return;
      }
      if (remote.profile.profileId !== operationProfileId) {
        setStatus({
          phase: 'needs-review',
          hasCheckpoint,
          message: 'This cloud data belongs to a different Orion profile. Automatic My List sync is blocked.',
        });
        return;
      }

      const cloudPreview = buildPortableMyListPreviewFromProfileV1(remote.profile);
      const cloudNamespaceSignature = portableMyListNamespaceSignatureV1(remote.profile);
      if (!cloudPreview || !cloudNamespaceSignature) {
        setStatus({
          phase: 'needs-review',
          hasCheckpoint,
          message: 'The cloud My List contains data this Orion version cannot safely reconcile. Nothing was changed.',
        });
        return;
      }

      if (!checkpoint) {
        if (portableMyListActiveMatchesPreviewV1(remote.profile, start.preview)) {
          saveMyListSyncCheckpointV1({
            profileId: operationProfileId,
            localSignature: operationLocalSignature,
            cloudNamespaceSignature,
            verifiedAt: Date.now(),
          });
          setVerifiedStatus(start.preview.orderedKeys.length);
        } else {
          setStatus({ phase: 'unenrolled', hasCheckpoint: false, message: null });
        }
        return;
      }

      // If both sides already converge semantically, rebase the checkpoint even
      // when record revisions/tombstone housekeeping changed in the cloud.
      if (portableMyListActiveMatchesPreviewV1(remote.profile, start.preview)) {
        saveMyListSyncCheckpointV1({
          profileId: operationProfileId,
          localSignature: operationLocalSignature,
          cloudNamespaceSignature,
          verifiedAt: Date.now(),
        });
        setVerifiedStatus(start.preview.orderedKeys.length);
        return;
      }

      const localChanged = operationLocalSignature !== checkpoint.localSignature;
      const cloudChanged = cloudNamespaceSignature !== checkpoint.cloudNamespaceSignature;

      if (localChanged && cloudChanged) {
        setReview({ reason: 'both-changed', localCount: start.preview.orderedKeys.length, cloudCount: cloudPreview.orderedKeys.length });
        setStatus({
          phase: 'needs-review',
          hasCheckpoint: true,
          message: 'My List changed on this device and in the cloud since the last verified sync. Orion stopped instead of merging or overwriting either copy.',
        });
        return;
      }

      if (localChanged && !cloudChanged) {
        if (latestRef.current.localSignature !== operationLocalSignature) {
          pendingModeRef.current = mode;
          return;
        }
        setStatus({
          phase: 'syncing',
          hasCheckpoint: true,
          message: 'Updating My List and verifying the cloud copy. Other library activity stays local.',
        });
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
        if (write.state === 'conflict') {
          setStatus({
            phase: 'needs-review',
            hasCheckpoint: true,
            message: 'The cloud profile changed while My List was syncing. Orion did not overwrite it. Check sync status again.',
          });
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
        const verifiedNamespaceSignature = verify
          ? portableMyListNamespaceSignatureV1(verify.profile)
          : null;

        // Drive revision tags are opaque concurrency tokens, not document
        // identity. The write was conditional on the fresh pre-write tag above;
        // read-back acceptance instead requires the exact PortableProfileV3
        // revision/timestamp, My List namespace and unrelated namespaces. The
        // next write will again use the tag from its own fresh Drive read.
        if (!verify || !verifiedNamespaceSignature) {
          setStatus({
            phase: 'needs-review',
            hasCheckpoint: true,
            message: 'Orion could not verify the updated cloud My List. Your local My List was left untouched.',
          });
          return;
        }

        saveMyListSyncCheckpointV1({
          profileId: operationProfileId,
          localSignature: operationLocalSignature,
          cloudNamespaceSignature: verifiedNamespaceSignature,
          verifiedAt: Date.now(),
        });
        if (latestRef.current.localSignature !== operationLocalSignature) {
          pendingModeRef.current = mode;
          setStatus({ phase: 'syncing', hasCheckpoint: true, message: 'My List changed again. Orion is checking the newer local copy.' });
          return;
        }
        setVerifiedStatus(start.preview.orderedKeys.length);
        return;
      }

      if (!localChanged && cloudChanged) {
        // Never replace local My List if the user changed it while the cloud read
        // was in flight. That becomes a fresh two-sided comparison instead.
        if (latestRef.current.localSignature !== operationLocalSignature) {
          pendingModeRef.current = mode;
          return;
        }
        setStatus({
          phase: 'syncing',
          hasCheckpoint: true,
          message: 'Applying a verified cloud My List update to this device.',
        });
        if (!automaticStillAllowed()) {
          setPaused();
          return;
        }
        const freshPull = await store.read(PORTABLE_PROFILE_PRIMARY_KEY);
        const freshPullSignature = freshPull.state === 'found'
          ? portableMyListNamespaceSignatureV1(freshPull.profile)
          : null;
        if (
          freshPull.state !== 'found'
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
        const snapshot = buildLocalMyListSnapshotV1(cloudPreview, start.saved);
        replaceMyListFromSync(snapshot.saved, snapshot.savedOrder);
        saveMyListSyncCheckpointV1({
          profileId: operationProfileId,
          localSignature: portableMyListPreviewSignatureV1(cloudPreview),
          cloudNamespaceSignature,
          verifiedAt: Date.now(),
        });
        setVerifiedStatus(cloudPreview.orderedKeys.length);
        return;
      }

      setStatus({
        phase: 'needs-review',
        hasCheckpoint: true,
        message: 'The saved My List checkpoint no longer matches the verified copies. Orion stopped without changing either side.',
      });
    } catch {
      if (!sameAccount()) return;
      setStatus({
        phase: 'error',
        hasCheckpoint,
        message: 'Orion could not check My List sync right now. Your local My List was not changed.',
      });
    } finally {
      busyRef.current = false;
      const pendingMode = pendingModeRef.current;
      pendingModeRef.current = null;
      if (pendingMode) setTimeout(() => enqueueReconcile(pendingMode), 0);
    }
  };


  const resolveReview = useCallback((resolution: 'device' | 'cloud') => {
    if (busyRef.current) return;
    void (async () => {
      const start = latestRef.current;
      const profile = start.profile;
      if (start.accountPhase !== 'signed-in' || !profile) return;
      const checkpoint = loadMyListSyncCheckpointV1(profile.accountId);
      if (!checkpoint || !start.online || start.internetReachable === false || !isNativeGoogleDriveAuthorizationAvailable()) {
        setReview(null);
        setStatus({ phase: 'needs-review', hasCheckpoint: !!checkpoint, message: 'Orion cannot resolve My List until the signed-in profile and connection are ready.' });
        return;
      }

      const operationProfileId = profile.accountId;
      const sameAccount = () => latestRef.current.profile?.accountId === operationProfileId;
      busyRef.current = true;
      setReview(null);
      setStatus({ phase: 'syncing', hasCheckpoint: true, message: 'Applying your confirmed My List choice and verifying both copies.' });
      try {
        const authorization = await checkGoogleDriveAppDataAuthorization(profile.email);
        if (!sameAccount()) return;
        if (!authorization.authorized) {
          setStatus({ phase: 'needs-review', hasCheckpoint: true, message: 'Orion Cloud access is required before this My List conflict can be resolved.' });
          return;
        }

        const store = new GoogleDriveCloudProfileStore(profile.email);
        const result = await resolvePortableMyListSteadyStateConflictV1({
          store,
          profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
          profileId: operationProfileId,
          updatedBy: operationProfileId,
          checkpoint,
          resolution: resolution === 'device' ? 'keep-local' : 'keep-cloud',
          readLocalPreview: () => previewRef.current,
          applyLocalPreview: (nextPreview) => {
            const snapshot = buildLocalMyListSnapshotV1(nextPreview, latestRef.current.saved);
            replaceMyListFromSync(snapshot.saved, snapshot.savedOrder);
            previewRef.current = nextPreview;
          },
          shouldProceed: sameAccount,
        });
        if (!sameAccount()) return;
        if (result.state === 'cancelled') return;
        if (result.state === 'needs-review') {
          setStatus({ phase: 'needs-review', hasCheckpoint: true, message: 'My List changed while Orion was preparing the resolution. Orion stopped without overwriting the newer copy. Check again before choosing.' });
          return;
        }

        saveMyListSyncCheckpointV1(result.checkpoint);
        setStatus(latestRef.current.myListAutomatic
          ? { phase: 'synced', hasCheckpoint: true, message: null }
          : { phase: 'paused', hasCheckpoint: true, message: 'My List is synced. Automatic sync remains paused on this device.' });
      } catch {
        if (!sameAccount()) return;
        setStatus({ phase: 'error', hasCheckpoint: true, message: 'Orion could not verify the My List resolution. Nothing was marked as synced.' });
      } finally {
        busyRef.current = false;
      }
    })();
  }, [replaceMyListFromSync]);

  useEffect(() => {
    requestAutomaticReconcile();
  }, [account.state.phase, account.state.profile?.accountId, account.state.profile?.email, localSignature, network.online, network.internetReachable, syncPolicy.ready, myListAutomatic, requestAutomaticReconcile]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') requestAutomaticReconcile();
    });
    return () => subscription.remove();
  }, [requestAutomaticReconcile]);

  const value = useMemo<MyListSteadyStateValue>(() => ({
    ...status,
    refresh: requestManualReconcile,
    review,
    resolveReview,
  }), [requestManualReconcile, resolveReview, review, status]);

  return (
    <MyListSteadyStateContext.Provider value={value}>
      {children}
    </MyListSteadyStateContext.Provider>
  );
}

export function useMyListSteadyStateSync(): MyListSteadyStateValue {
  const value = useContext(MyListSteadyStateContext);
  if (!value) throw new Error('useMyListSteadyStateSync must be used within MyListSteadyStateSyncProvider');
  return value;
}
