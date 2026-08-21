import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { startPortableProfileAutoSyncHeartbeat } from './portableProfileAutoSyncHeartbeat';
import { runPortableProfileCloudTransaction } from './portableProfileCloudTransactionCoordinator';
import {
  reconcilePortableWatchedSteadyStateSyncV1,
  resolvePortableWatchedSteadyStateConflictV1,
} from '@orion/shared/api';
import {
  PORTABLE_PROFILE_PRIMARY_KEY,
  portableWatchedTruthSignatureV1,
  type PortableWatchedPreviewV1,
} from '@orion/shared/types';
import { useOrionAccount } from '../../context/AccountContext';
import { useOrionLibraryProfile } from './LibraryProfileContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNetworkStatus } from '../../context/NetworkContext';
import { buildMobilePortableWatchedPreviewV1 } from '../library/viewingStatePortableAdapter';
import { buildLocalMobileWatchedSnapshotV1 } from '../library/watchedSyncAdapter';
import { describeGoogleDriveCloudFailure, GoogleDriveCloudProfileStore, reportGoogleDriveCloudFailure } from './googleDriveCloudProfileStore';
import { checkGoogleDriveAppDataAuthorization, isNativeGoogleDriveAuthorizationAvailable } from './nativeGoogleDriveAuthorization';
import { useOrionSyncPolicy } from './SyncPolicyContext';
import { loadWatchedSyncCheckpointV1, saveWatchedSyncCheckpointV1 } from './watchedSyncCheckpoint';

export type WatchedSteadyStatePhase =
  | 'inactive'
  | 'unenrolled'
  | 'checking'
  | 'syncing'
  | 'synced'
  | 'paused'
  | 'offline'
  | 'needs-review'
  | 'error';

interface WatchedSteadyStateReview {
  reason: 'both-changed';
  localCount: number;
  cloudCount: number;
}

interface WatchedSteadyStateValue {
  phase: WatchedSteadyStatePhase;
  hasCheckpoint: boolean;
  count: number | null;
  message: string | null;
  refresh: () => void;
  review: WatchedSteadyStateReview | null;
  resolveReview: (resolution: 'device' | 'cloud') => void;
}

type ReconcileMode = 'automatic' | 'manual';

const WatchedSteadyStateContext = createContext<WatchedSteadyStateValue | null>(null);

function itemLabel(count: number): string {
  return `${count} Watched item${count === 1 ? '' : 's'}`;
}

function reviewMessage(reason: string, conflictKeys: string[], cloudWasWritten: boolean): string {
  if (reason === 'both-changed') return 'Watched changed on this device and in Orion Cloud since the last confirmed sync. Orion stopped instead of choosing a winner.';
  if (reason === 'profile-missing-after-checkpoint') return 'Previously synced Watched data is missing from Orion Cloud. Orion will not recreate it automatically.';
  if (reason === 'tombstone-conflict') return `${itemLabel(conflictKeys.length)} collide with cloud removals. Orion will not resurrect them automatically.`;
  if (reason === 'cloud-conflict' || reason === 'cloud-changed-before-pull') return 'The cloud profile changed while Watched was syncing. Orion did not overwrite it.';
  if (reason === 'local-changed-during-sync') return `Watched changed on this device while sync was running.${cloudWasWritten ? ' Orion Cloud kept the verified update, but this device could not confirm it yet.' : ''}`;
  if (reason === 'cloud-verification-failed') return 'Orion Cloud saved the Watched update, but Orion could not confirm the new copy in time.';
  if (reason.includes('identity')) return 'Watched data does not match this signed-in Google identity.';
  if (reason.includes('invalid')) return 'Watched contains data this Orion version cannot sync safely.';
  return 'Watched no longer matches the last confirmed sync on both copies. Orion stopped without changing either side.';
}

export function WatchedSteadyStateSyncProvider({ children }: { children: React.ReactNode }) {
  const account = useOrionAccount();
  const network = useNetworkStatus();
  const syncPolicy = useOrionSyncPolicy();
  const libraryProfile = useOrionLibraryProfile();
  const watchedAutomatic = syncPolicy.getAutomatic('watched');
  const { watched, replaceWatchedFromSync } = useLibrary();
  const preview = useMemo(() => buildMobilePortableWatchedPreviewV1(watched), [watched]);
  const localTruthSignature = useMemo(() => portableWatchedTruthSignatureV1(preview), [preview]);
  const watchedRef = useRef(watched);
  watchedRef.current = watched;

  const [status, setStatus] = useState<Pick<WatchedSteadyStateValue, 'phase' | 'hasCheckpoint' | 'count' | 'message'>>({
    phase: 'inactive',
    hasCheckpoint: false,
    count: null,
    message: null,
  });
  const [review, setReview] = useState<WatchedSteadyStateReview | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  const busyRef = useRef(false);
  const activeLocalSignatureRef = useRef<string | null>(null);
  const pendingModeRef = useRef<ReconcileMode | null>(null);
  const reconcileRef = useRef<(mode: ReconcileMode) => Promise<void>>(async () => {});
  const latestRef = useRef({
    accountPhase: account.state.phase,
    profile: account.state.profile,
    online: network.online,
    internetReachable: network.internetReachable,
    policyReady: syncPolicy.ready,
    libraryProfileReady: libraryProfile.cloudEligible,
    libraryProfileId: libraryProfile.profileId,
    watchedAutomatic,
    localTruthSignature,
  });
  latestRef.current = {
    accountPhase: account.state.phase,
    profile: account.state.profile,
    online: network.online,
    internetReachable: network.internetReachable,
    policyReady: syncPolicy.ready,
    libraryProfileReady: libraryProfile.cloudEligible,
    libraryProfileId: libraryProfile.profileId,
    watchedAutomatic,
    localTruthSignature,
  };

  const readLocalPreview = useCallback((): PortableWatchedPreviewV1 => (
    buildMobilePortableWatchedPreviewV1(watchedRef.current)
  ), []);
  const applyLocalPreview = useCallback((nextPreview: PortableWatchedPreviewV1) => {
    const snapshot = buildLocalMobileWatchedSnapshotV1(nextPreview, watchedRef.current);
    replaceWatchedFromSync(snapshot);
    watchedRef.current = snapshot;
  }, [replaceWatchedFromSync]);

  const enqueueReconcile = useCallback((mode: ReconcileMode) => {
    if (busyRef.current) {
      if (mode === 'manual') {
        pendingModeRef.current = 'manual';
      } else if (
        activeLocalSignatureRef.current != null
        && latestRef.current.localTruthSignature !== activeLocalSignatureRef.current
        && pendingModeRef.current == null
      ) {
        pendingModeRef.current = 'automatic';
      }
      return;
    }
    void reconcileRef.current(mode);
  }, []);
  const requestAutomaticReconcile = useCallback(() => enqueueReconcile('automatic'), [enqueueReconcile]);
  const requestHeartbeatReconcile = useCallback(() => {
    if (busyRef.current || statusRef.current.phase === 'needs-review' || statusRef.current.phase === 'error') return;
    enqueueReconcile('automatic');
  }, [enqueueReconcile]);
  const requestManualReconcile = useCallback(() => enqueueReconcile('manual'), [enqueueReconcile]);

  reconcileRef.current = async (mode) => {
    if (busyRef.current) return;
    const start = latestRef.current;
    const profile = start.profile;
    if (start.accountPhase !== 'signed-in' || !profile) {
      setStatus({ phase: 'inactive', hasCheckpoint: false, count: null, message: null });
      return;
    }

    if (!start.libraryProfileReady || start.libraryProfileId !== profile.accountId) {
      setStatus({ phase: 'inactive', hasCheckpoint: false, count: null, message: null });
      return;
    }

    const checkpoint = loadWatchedSyncCheckpointV1(profile.accountId);
    const hasCheckpoint = !!checkpoint;
    const startPreview = readLocalPreview();
    const startCount = Object.keys(startPreview.records).length;
    if (!start.policyReady) {
      setStatus({ phase: 'inactive', hasCheckpoint, count: startCount, message: null });
      return;
    }
    if (!hasCheckpoint) {
      setStatus({ phase: 'unenrolled', hasCheckpoint: false, count: startCount, message: null });
      return;
    }
    if (startPreview.rejectedKeys.length > 0) {
      setStatus({
        phase: 'needs-review',
        hasCheckpoint: true,
        count: startCount,
        message: `${itemLabel(startPreview.rejectedKeys.length)} cannot be represented safely. Orion changed nothing.`,
      });
      return;
    }
    if (mode === 'automatic' && !start.watchedAutomatic) {
      setStatus((current) => current.phase === 'needs-review'
        ? { ...current, hasCheckpoint: true }
        : {
            phase: 'paused',
            hasCheckpoint: true,
            count: startCount,
            message: 'Automatic Watched sync is paused on this device. Use Sync now for a one-time safe sync.',
          });
      return;
    }
    if (!start.online || start.internetReachable === false) {
      setStatus({
        phase: 'offline',
        hasCheckpoint: true,
        count: startCount,
        message: 'Watched sync is waiting for a connection. Your local Watched state remains available.',
      });
      return;
    }
    if (!isNativeGoogleDriveAuthorizationAvailable()) {
      setStatus({ phase: 'inactive', hasCheckpoint: true, count: startCount, message: null });
      return;
    }

    const operationProfileId = profile.accountId;
    const operationLocalSignature = start.localTruthSignature;
    const sameAccount = () => latestRef.current.profile?.accountId === operationProfileId
        && latestRef.current.libraryProfileReady
        && latestRef.current.libraryProfileId === operationProfileId;
    const automaticStillAllowed = () => mode === 'manual' || latestRef.current.watchedAutomatic;
    const canMutate = () => sameAccount() && automaticStillAllowed();
    const setPaused = () => setStatus({
      phase: 'paused',
      hasCheckpoint: true,
      count: Object.keys(readLocalPreview().records).length,
      message: 'Automatic Watched sync is paused on this device. Use Sync now for a one-time safe sync.',
    });

    busyRef.current = true;
    activeLocalSignatureRef.current = operationLocalSignature;
    try {
      await runPortableProfileCloudTransaction(operationProfileId, async () => {
        if (!sameAccount()) return;
        if (latestRef.current.localTruthSignature !== operationLocalSignature) {
          pendingModeRef.current = mode;
          return;
        }
        setReview(null);
        setStatus({ phase: 'checking', hasCheckpoint: true, count: startCount, message: null });
        const authorization = await checkGoogleDriveAppDataAuthorization(profile.email);
      if (!sameAccount()) return;
      if (!automaticStillAllowed()) {
        setPaused();
        return;
      }
      if (!authorization.authorized) {
        setStatus({ phase: 'inactive', hasCheckpoint: true, count: startCount, message: null });
        return;
      }

      const store = new GoogleDriveCloudProfileStore(profile.email);
      const result = await reconcilePortableWatchedSteadyStateSyncV1({
        store,
        profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
        profileId: operationProfileId,
        updatedBy: operationProfileId,
        checkpoint,
        readLocalPreview,
        applyLocalPreview,
        shouldProceed: canMutate,
        onExecutionStart: () => {
          if (sameAccount()) {
            setStatus({
              phase: 'syncing',
              hasCheckpoint: true,
              count: Object.keys(readLocalPreview().records).length,
              message: 'Syncing Watched and confirming both copies.',
            });
          }
        },
      });
      if (!sameAccount()) return;
      if (result.state === 'cancelled') {
        setPaused();
        return;
      }
      if (result.state === 'unenrolled') {
        setStatus({ phase: 'unenrolled', hasCheckpoint: false, count: startCount, message: null });
        return;
      }
      if (result.state === 'needs-review') {
        if (result.reason === 'both-changed') {
          setReview({ reason: 'both-changed', localCount: result.localCount, cloudCount: result.cloudCount });
        }
        setStatus({
          phase: 'needs-review',
          hasCheckpoint: true,
          count: Object.keys(readLocalPreview().records).length,
          message: reviewMessage(result.reason, result.conflictKeys, result.cloudWasWritten),
        });
        return;
      }

      saveWatchedSyncCheckpointV1(result.checkpoint);
      const syncedCount = result.count;
      if (latestRef.current.watchedAutomatic) {
        setStatus({
          phase: 'synced',
          hasCheckpoint: true,
          count: syncedCount,
          message: `${itemLabel(syncedCount)} verified across this device and Orion Cloud.`,
        });
      } else {
        setStatus({
          phase: 'paused',
          hasCheckpoint: true,
          count: syncedCount,
          message: `${itemLabel(syncedCount)} synced. Automatic Watched sync remains paused on this device.`,
        });
      }
      });
    } catch (error) {
      if (!sameAccount()) return;
      reportGoogleDriveCloudFailure('watched', error);
      setStatus({
        phase: 'error',
        hasCheckpoint: true,
        count: Object.keys(readLocalPreview().records).length,
        message: describeGoogleDriveCloudFailure('Watched', error),
      });
    } finally {
      busyRef.current = false;
      activeLocalSignatureRef.current = null;
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
      if (!start.libraryProfileReady || start.libraryProfileId !== profile.accountId) return;
      const checkpoint = loadWatchedSyncCheckpointV1(profile.accountId);
      if (!checkpoint || !start.online || start.internetReachable === false || !isNativeGoogleDriveAuthorizationAvailable()) {
        setReview(null);
        setStatus({ phase: 'needs-review', hasCheckpoint: !!checkpoint, count: Object.keys(readLocalPreview().records).length, message: 'Orion cannot resolve Watched until the signed-in profile and connection are ready.' });
        return;
      }

      const operationProfileId = profile.accountId;
      const sameAccount = () => latestRef.current.profile?.accountId === operationProfileId
        && latestRef.current.libraryProfileReady
        && latestRef.current.libraryProfileId === operationProfileId;
      busyRef.current = true;
      try {
        await runPortableProfileCloudTransaction(operationProfileId, async () => {
          if (!sameAccount()) return;
          setReview(null);
          setStatus({ phase: 'syncing', hasCheckpoint: true, count: Object.keys(readLocalPreview().records).length, message: 'Applying your confirmed Watched choice and verifying both copies.' });
          const authorization = await checkGoogleDriveAppDataAuthorization(profile.email);
        if (!sameAccount()) return;
        if (!authorization.authorized) {
          setStatus({ phase: 'needs-review', hasCheckpoint: true, count: Object.keys(readLocalPreview().records).length, message: 'Orion Cloud access is required before this Watched conflict can be resolved.' });
          return;
        }

        const store = new GoogleDriveCloudProfileStore(profile.email);
        const result = await resolvePortableWatchedSteadyStateConflictV1({
          store,
          profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
          profileId: operationProfileId,
          updatedBy: operationProfileId,
          checkpoint,
          resolution: resolution === 'device' ? 'keep-local' : 'keep-cloud',
          readLocalPreview,
          applyLocalPreview,
          shouldProceed: sameAccount,
        });
        if (!sameAccount()) return;
        if (result.state === 'cancelled') return;
        if (result.state === 'needs-review') {
          setStatus({ phase: 'needs-review', hasCheckpoint: true, count: Object.keys(readLocalPreview().records).length, message: 'Watched changed while Orion was preparing the resolution. Orion stopped without overwriting the newer copy. Check again before choosing.' });
          return;
        }

        saveWatchedSyncCheckpointV1(result.checkpoint);
        setStatus(latestRef.current.watchedAutomatic
          ? { phase: 'synced', hasCheckpoint: true, count: result.count, message: `${itemLabel(result.count)} verified across this device and Orion Cloud.` }
          : { phase: 'paused', hasCheckpoint: true, count: result.count, message: `${itemLabel(result.count)} synced. Automatic Watched sync remains paused on this device.` });
        });
      } catch {
        if (!sameAccount()) return;
        setStatus({ phase: 'error', hasCheckpoint: true, count: Object.keys(readLocalPreview().records).length, message: 'Orion could not verify the Watched resolution. Nothing was marked as synced.' });
      } finally {
        busyRef.current = false;
      }
    })();
  }, [applyLocalPreview, readLocalPreview]);

  useEffect(() => {
    requestAutomaticReconcile();
  }, [account.state.phase, account.state.profile?.accountId, account.state.profile?.email, libraryProfile.cloudEligible, libraryProfile.profileId, localTruthSignature, network.online, network.internetReachable, syncPolicy.ready, watchedAutomatic, requestAutomaticReconcile]);

  useEffect(() => {
    if (
      account.state.phase !== 'signed-in'
      || !libraryProfile.cloudEligible
      || !syncPolicy.ready
      || !watchedAutomatic
      || !network.online
      || network.internetReachable === false
    ) return undefined;

    return startPortableProfileAutoSyncHeartbeat(
      'watched',
      requestHeartbeatReconcile,
      { isActive: () => AppState.currentState === 'active' },
    );
  }, [
    account.state.phase,
    libraryProfile.cloudEligible,
    syncPolicy.ready,
    watchedAutomatic,
    network.online,
    network.internetReachable,
    requestHeartbeatReconcile,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') requestHeartbeatReconcile();
    });
    return () => subscription.remove();
  }, [requestHeartbeatReconcile]);

  const value = useMemo<WatchedSteadyStateValue>(() => ({
    ...status,
    refresh: requestManualReconcile,
    review,
    resolveReview,
  }), [requestManualReconcile, resolveReview, review, status]);

  return <WatchedSteadyStateContext.Provider value={value}>{children}</WatchedSteadyStateContext.Provider>;
}

export function useWatchedSteadyStateSync(): WatchedSteadyStateValue {
  const value = useContext(WatchedSteadyStateContext);
  if (!value) throw new Error('useWatchedSteadyStateSync must be used within WatchedSteadyStateSyncProvider');
  return value;
}
