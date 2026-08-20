import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { reconcilePortableViewingActivitySteadyStateSyncV1, resolvePortableViewingActivitySteadyStateConflictV1 } from '@orion/shared/api';
import { PORTABLE_PROFILE_PRIMARY_KEY, portableViewingActivityTruthSignatureV1, type PortableViewingActivityPreviewV1, type PortableViewingActivityStateV1 } from '@orion/shared/types';
import { useOrionAccount } from '../../context/AccountContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNetworkStatus } from '../../context/NetworkContext';
import { buildLocalMobileViewingActivitySnapshotV1, buildMobilePortableViewingActivityPreviewV1 } from '../library/viewingStatePortableAdapter';
import { useOrionLibraryProfile } from './LibraryProfileContext';
import { GoogleDriveCloudProfileStore } from './googleDriveCloudProfileStore';
import { checkGoogleDriveAppDataAuthorization, isNativeGoogleDriveAuthorizationAvailable } from './nativeGoogleDriveAuthorization';
import { useOrionSyncPolicy } from './SyncPolicyContext';
import { loadViewingActivitySyncCheckpointV1, saveViewingActivitySyncCheckpointV1 } from './viewingActivitySyncCheckpoint';

export type ViewingActivitySteadyStatePhase = 'inactive' | 'unenrolled' | 'checking' | 'syncing' | 'synced' | 'paused' | 'offline' | 'needs-review' | 'error';

interface ViewingActivitySteadyStateReview {
  reason: 'two-sided-divergence';
  localCount: { history: number; progress: number };
  cloudCount: { history: number; progress: number };
}

interface ViewingActivitySteadyStateValue {
  phase: ViewingActivitySteadyStatePhase;
  hasCheckpoint: boolean;
  count: { history: number; progress: number } | null;
  message: string | null;
  refresh: () => void;
  review: ViewingActivitySteadyStateReview | null;
  resolveReview: (resolution: 'device' | 'cloud') => void;
}

const ViewingActivitySteadyStateContext = createContext<ViewingActivitySteadyStateValue | null>(null);
type ReconcileMode = 'automatic' | 'manual';

function reviewMessage(result: Extract<Awaited<ReturnType<typeof reconcilePortableViewingActivitySteadyStateSyncV1>>, { state: 'needs-review' }>): string {
  if (result.reason === 'profile-missing-after-checkpoint') return 'Previously verified Viewing Activity is missing from Orion Cloud. Orion will not recreate it automatically.';
  if (result.reason === 'two-sided-removal-ambiguity') return 'Viewing Activity changed on both sides and Orion cannot prove whether missing local items are Cloud additions or offline local removals. Nothing was overwritten.';
  if (result.reason === 'event-time-conflict') return 'Viewing Activity contains an exact-time verified conflict. Orion stopped instead of guessing which playback truth is correct.';
  if (result.reason === 'cloud-conflict' || result.reason === 'cloud-changed-before-pull') return 'Orion Cloud changed while Viewing Activity was syncing. Orion stopped without overwriting it.';
  if (result.reason === 'local-changed-during-sync') return `Viewing Activity changed on this device while sync was running.${result.cloudWasWritten ? ' The verified Cloud write is preserved, but no checkpoint was created.' : ''}`;
  if (result.reason === 'cloud-verification-failed') return 'Orion Cloud was updated, but Orion could not verify the new Viewing Activity copy. No checkpoint was created.';
  if (result.reason === 'local-apply-failed') return 'Orion could not verify the local Viewing Activity update. The operation was not marked as synced.';
  if (result.reason.includes('identity') || result.reason.includes('profile')) return 'Viewing Activity does not match this signed-in Orion profile.';
  if (result.reason.includes('invalid') || result.reason === 'local-update-unsafe') return 'Viewing Activity contains data Orion cannot reconcile safely without losing verified playback truth.';
  return 'Viewing Activity no longer matches the last verified checkpoint. Orion stopped without choosing a winner.';
}

export function ViewingActivitySteadyStateSyncProvider({ children }: { children: React.ReactNode }) {
  const account = useOrionAccount();
  const network = useNetworkStatus();
  const syncPolicy = useOrionSyncPolicy();
  const libraryProfile = useOrionLibraryProfile();
  const automatic = syncPolicy.getAutomatic('viewingActivity');
  const { watched, history, progress, replaceViewingActivityFromSync } = useLibrary();
  const preview = useMemo(() => buildMobilePortableViewingActivityPreviewV1({ watched, history, progress }), [history, progress, watched]);
  const localTruthSignature = useMemo(() => portableViewingActivityTruthSignatureV1(preview), [preview]);
  const stateRef = useRef({ watched, history, progress });
  stateRef.current = { watched, history, progress };
  const [status, setStatus] = useState<Pick<ViewingActivitySteadyStateValue, 'phase' | 'hasCheckpoint' | 'count' | 'message'>>({ phase: 'inactive', hasCheckpoint: false, count: null, message: null });
  const [review, setReview] = useState<ViewingActivitySteadyStateReview | null>(null);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
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
    automatic,
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
    automatic,
    localTruthSignature,
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; pendingModeRef.current = null; };
  }, []);

  const readLocalPreview = useCallback((): PortableViewingActivityPreviewV1 => buildMobilePortableViewingActivityPreviewV1(stateRef.current), []);
  const applyLocalState = useCallback((nextState: PortableViewingActivityStateV1) => {
    const snapshot = buildLocalMobileViewingActivitySnapshotV1(nextState, stateRef.current);
    replaceViewingActivityFromSync(snapshot.history, snapshot.progress);
    stateRef.current = { ...stateRef.current, history: snapshot.history, progress: snapshot.progress };
  }, [replaceViewingActivityFromSync]);

  const enqueueReconcile = useCallback((mode: ReconcileMode) => {
    if (!mountedRef.current) return;
    if (busyRef.current) {
      if (mode === 'manual' || pendingModeRef.current == null) pendingModeRef.current = mode;
      return;
    }
    void reconcileRef.current(mode);
  }, []);
  const requestAutomaticReconcile = useCallback(() => enqueueReconcile('automatic'), [enqueueReconcile]);
  const requestManualReconcile = useCallback(() => enqueueReconcile('manual'), [enqueueReconcile]);

  reconcileRef.current = async (mode) => {
    if (!mountedRef.current || busyRef.current) return;
    const start = latestRef.current;
    const profile = start.profile;
    const startPreview = readLocalPreview();
    const startCount = { history: Object.keys(startPreview.history).length, progress: Object.keys(startPreview.progress).length };
    if (start.accountPhase !== 'signed-in' || !profile || !start.libraryProfileReady || start.libraryProfileId !== profile.accountId) {
      setStatus({ phase: 'inactive', hasCheckpoint: false, count: startCount, message: null });
      return;
    }
    const checkpoint = loadViewingActivitySyncCheckpointV1(profile.accountId);
    if (!checkpoint) {
      setStatus({ phase: 'unenrolled', hasCheckpoint: false, count: startCount, message: null });
      return;
    }
    if (!start.policyReady) {
      setStatus({ phase: 'inactive', hasCheckpoint: true, count: startCount, message: null });
      return;
    }
    if (mode === 'automatic' && !start.automatic) {
      setStatus((current) => current.phase === 'needs-review'
        ? { ...current, hasCheckpoint: true }
        : { phase: 'paused', hasCheckpoint: true, count: startCount, message: 'Automatic Viewing Activity sync is paused on this device. Use Sync now for a one-time safe sync.' });
      return;
    }
    if (!start.online || start.internetReachable === false) {
      setStatus({ phase: 'offline', hasCheckpoint: true, count: startCount, message: 'Viewing Activity is waiting for a connection. Local History and Progress remain available.' });
      return;
    }
    if (!isNativeGoogleDriveAuthorizationAvailable()) {
      setStatus({ phase: 'inactive', hasCheckpoint: true, count: startCount, message: null });
      return;
    }

    const operationProfileId = profile.accountId;
    const sameAccount = () => mountedRef.current
      && latestRef.current.profile?.accountId === operationProfileId
      && latestRef.current.libraryProfileReady
      && latestRef.current.libraryProfileId === operationProfileId;
    const automaticStillAllowed = () => mode === 'manual' || latestRef.current.automatic;
    const canMutate = () => sameAccount() && automaticStillAllowed();
    busyRef.current = true;
    setReview(null);
    setStatus({ phase: 'checking', hasCheckpoint: true, count: startCount, message: null });
    try {
      const authorization = await checkGoogleDriveAppDataAuthorization(profile.email);
      if (!sameAccount()) return;
      if (!automaticStillAllowed()) {
        setStatus({ phase: 'paused', hasCheckpoint: true, count: startCount, message: 'Automatic Viewing Activity sync paused before another mutation.' });
        return;
      }
      if (!authorization.authorized) {
        setStatus({ phase: 'inactive', hasCheckpoint: true, count: startCount, message: 'Orion Cloud access is required before Viewing Activity can sync.' });
        return;
      }
      const result = await reconcilePortableViewingActivitySteadyStateSyncV1({
        store: new GoogleDriveCloudProfileStore(profile.email),
        profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
        profileId: operationProfileId,
        updatedBy: operationProfileId,
        checkpoint,
        readLocalPreview,
        applyLocalState,
        shouldProceed: canMutate,
        onExecutionStart: () => {
          if (sameAccount()) setStatus({ phase: 'syncing', hasCheckpoint: true, count: startCount, message: 'Reconciling verified History and Progress with Orion Cloud.' });
        },
      });
      if (!sameAccount()) return;
      if (result.state === 'cancelled') {
        setStatus({ phase: 'paused', hasCheckpoint: true, count: startCount, message: 'Automatic Viewing Activity sync paused before another mutation.' });
        return;
      }
      if (result.state === 'unenrolled') {
        setStatus({ phase: 'unenrolled', hasCheckpoint: false, count: startCount, message: null });
        return;
      }
      if (result.state === 'needs-review') {
        if (result.reason === 'two-sided-removal-ambiguity' || result.reason === 'event-time-conflict') {
          setReview({ reason: 'two-sided-divergence', localCount: result.localCount, cloudCount: result.cloudCount });
        }
        setStatus({ phase: 'needs-review', hasCheckpoint: true, count: startCount, message: reviewMessage(result) });
        return;
      }
      saveViewingActivitySyncCheckpointV1(result.checkpoint);
      setStatus(latestRef.current.automatic
        ? { phase: 'synced', hasCheckpoint: true, count: result.count, message: null }
        : { phase: 'paused', hasCheckpoint: true, count: result.count, message: 'Viewing Activity synced. Automatic sync remains paused on this device.' });
    } catch {
      if (!sameAccount()) return;
      setStatus({ phase: 'error', hasCheckpoint: true, count: startCount, message: 'Orion could not reconcile Viewing Activity right now. Nothing was marked as synced.' });
    } finally {
      busyRef.current = false;
      const pendingMode = pendingModeRef.current;
      pendingModeRef.current = null;
      if (pendingMode && mountedRef.current) setTimeout(() => enqueueReconcile(pendingMode), 0);
    }
  };

  const resolveReview = useCallback((resolution: 'device' | 'cloud') => {
    if (!mountedRef.current || busyRef.current) return;
    void (async () => {
      const start = latestRef.current;
      const profile = start.profile;
      if (start.accountPhase !== 'signed-in' || !profile || !start.libraryProfileReady || start.libraryProfileId !== profile.accountId) return;
      const checkpoint = loadViewingActivitySyncCheckpointV1(profile.accountId);
      const startPreview = readLocalPreview();
      const startCount = { history: Object.keys(startPreview.history).length, progress: Object.keys(startPreview.progress).length };
      if (!checkpoint || !start.online || start.internetReachable === false || !isNativeGoogleDriveAuthorizationAvailable()) {
        setReview(null);
        setStatus({ phase: 'needs-review', hasCheckpoint: !!checkpoint, count: startCount, message: 'Orion cannot resolve Viewing Activity until the signed-in profile and connection are ready.' });
        return;
      }

      const operationProfileId = profile.accountId;
      const sameAccount = () => mountedRef.current
        && latestRef.current.profile?.accountId === operationProfileId
        && latestRef.current.libraryProfileReady
        && latestRef.current.libraryProfileId === operationProfileId;
      busyRef.current = true;
      setReview(null);
      setStatus({ phase: 'syncing', hasCheckpoint: true, count: startCount, message: 'Applying your confirmed Viewing Activity choice and verifying both copies.' });
      try {
        const authorization = await checkGoogleDriveAppDataAuthorization(profile.email);
        if (!sameAccount()) return;
        if (!authorization.authorized) {
          setStatus({ phase: 'needs-review', hasCheckpoint: true, count: startCount, message: 'Orion Cloud access is required before this Viewing Activity conflict can be resolved.' });
          return;
        }
        const result = await resolvePortableViewingActivitySteadyStateConflictV1({
          store: new GoogleDriveCloudProfileStore(profile.email),
          profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
          profileId: operationProfileId,
          updatedBy: operationProfileId,
          checkpoint,
          resolution: resolution === 'device' ? 'keep-local' : 'keep-cloud',
          readLocalPreview,
          applyLocalState,
          shouldProceed: sameAccount,
        });
        if (!sameAccount()) return;
        if (result.state === 'cancelled') return;
        if (result.state === 'needs-review') {
          setStatus({ phase: 'needs-review', hasCheckpoint: true, count: startCount, message: 'Viewing Activity changed while Orion was preparing the resolution. Orion stopped without overwriting the newer copy. Check again before choosing.' });
          return;
        }
        saveViewingActivitySyncCheckpointV1(result.checkpoint);
        setStatus(latestRef.current.automatic
          ? { phase: 'synced', hasCheckpoint: true, count: result.count, message: 'Viewing Activity is verified across this device and Orion Cloud.' }
          : { phase: 'paused', hasCheckpoint: true, count: result.count, message: 'Viewing Activity synced. Automatic sync remains paused on this device.' });
      } catch {
        if (!sameAccount()) return;
        setStatus({ phase: 'error', hasCheckpoint: true, count: startCount, message: 'Orion could not verify the Viewing Activity resolution. Nothing was marked as synced.' });
      } finally {
        busyRef.current = false;
      }
    })();
  }, [applyLocalState, readLocalPreview]);

  useEffect(() => {
    requestAutomaticReconcile();
  }, [account.state.phase, account.state.profile?.accountId, account.state.profile?.email, libraryProfile.cloudEligible, libraryProfile.profileId, localTruthSignature, network.online, network.internetReachable, syncPolicy.ready, automatic, requestAutomaticReconcile]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => { if (nextState === 'active') requestAutomaticReconcile(); });
    return () => subscription.remove();
  }, [requestAutomaticReconcile]);

  const value = useMemo<ViewingActivitySteadyStateValue>(() => ({
    ...status,
    refresh: requestManualReconcile,
    review,
    resolveReview,
  }), [requestManualReconcile, resolveReview, review, status]);
  return <ViewingActivitySteadyStateContext.Provider value={value}>{children}</ViewingActivitySteadyStateContext.Provider>;
}

export function useViewingActivitySteadyStateSync(): ViewingActivitySteadyStateValue {
  const value = useContext(ViewingActivitySteadyStateContext);
  if (!value) throw new Error('useViewingActivitySteadyStateSync must be used within ViewingActivitySteadyStateSyncProvider');
  return value;
}
