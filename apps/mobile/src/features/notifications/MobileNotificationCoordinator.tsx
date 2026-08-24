import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useLibrary } from '../../context/LibraryContext';
import { useNetworkStatus } from '../../context/NetworkContext';
import { useMyListSteadyStateSync } from '../account/MyListSteadyStateSync';
import { useViewingActivitySteadyStateSync } from '../account/ViewingActivitySteadyStateSync';
import { useWatchedSteadyStateSync } from '../account/WatchedSteadyStateSync';
import { MOBILE_PLAYER_SOURCES } from '../playback/mobileSources';
import { checkWatchlistAvailabilityV1 } from '../../services/mobileAvailabilityChecks';
import {
  deliverMobileNotificationV1,
  getMobileNotificationPreferencesV1,
  initializeMobileNotificationsV1,
  subscribeMobileNotificationPreferencesV1,
} from '../../services/mobileNotifications';
import { getMobileUpdateChannelV1 } from '../../services/mobileReleaseTruth';
import { checkMobileApplicationUpdateStateV1 } from '../../services/mobileApplicationUpdateState';
import { mmkvStorageAdapter } from '../../services/storageAdapter';
import { subscribeMobileSourceHealthV2 } from '../../services/sourceHealth';
import { readMobileDownloadRepositoryV1, subscribeMobileDownloadRepositoryV1 } from '../downloads/downloadRepository';

const UPDATE_POLL_KEY = 'orion.mobile.notifications.updatePoll.v1';
const UPDATE_POLL_INTERVAL_MS = 6 * 60 * 60_000;
const UPDATE_FAILURE_RETRY_MS = 15 * 60_000;
const COORDINATOR_TICK_MS = 60_000;

type SyncDomain = 'My List' | 'Watched' | 'Viewing Activity';

function downloadMediaLabel(job: ReturnType<typeof readMobileDownloadRepositoryV1>['jobs'][number]): string {
  const media = job.media;
  if (media.mediaType === 'tv' && media.season !== null && media.episode !== null) {
    return `${media.seriesTitle || media.title} · S${media.season} E${media.episode}`;
  }
  return media.year ? `${media.title} · ${media.year}` : media.title;
}

export function MobileNotificationCoordinator() {
  const network = useNetworkStatus();
  const { saved, savedOrder } = useLibrary();
  const myList = useMyListSteadyStateSync();
  const watched = useWatchedSteadyStateSync();
  const viewingActivity = useViewingActivitySteadyStateSync();
  const [preferenceRevision, setPreferenceRevision] = useState(0);
  const availabilityBusyRef = useRef(false);
  const updateBusyRef = useRef(false);
  const updateSessionCheckCompletedRef = useRef(false);
  const networkInitializedRef = useRef(false);
  const previouslyUnavailableRef = useRef(false);
  const syncPreviousRef = useRef<Record<SyncDomain, string>>({
    'My List': myList.phase,
    Watched: watched.phase,
    'Viewing Activity': viewingActivity.phase,
  });

  const downloadPreviousRef = useRef<Map<string, string> | null>(null);

  useEffect(() => subscribeMobileNotificationPreferencesV1(() => {
    setPreferenceRevision((value) => value + 1);
  }), []);

  useEffect(() => {
    const baseline = readMobileDownloadRepositoryV1();
    downloadPreviousRef.current = new Map(baseline.jobs.map((job) => [job.jobId, job.state]));
    return subscribeMobileDownloadRepositoryV1((snapshot) => {
      const previous = downloadPreviousRef.current;
      downloadPreviousRef.current = new Map(snapshot.jobs.map((job) => [job.jobId, job.state]));
      if (!previous) return;

      for (const job of snapshot.jobs) {
        if (previous.get(job.jobId) === job.state) continue;
        const label = downloadMediaLabel(job);
        if (job.state === 'completed') {
          void deliverMobileNotificationV1({
            category: 'downloads',
            dedupeKey: `download-completed:${job.jobId}`,
            title: 'Download complete',
            body: `${label} is verified and stored in Orion Library.`,
            target: { target: 'downloads' },
          });
          continue;
        }
        if (job.state === 'failed') {
          void deliverMobileNotificationV1({
            category: 'downloads',
            dedupeKey: `download-failed:${job.jobId}:${job.failure?.code || 'failed'}`,
            title: 'Download failed',
            body: `${label} could not finish downloading. Open Downloads to retry.`,
            target: { target: 'downloads' },
          });
          continue;
        }
        if (job.state === 'storage-blocked' || job.state === 'action-required' || job.state === 'expired') {
          void deliverMobileNotificationV1({
            category: 'downloads',
            dedupeKey: `download-action:${job.jobId}:${job.state}:${job.failure?.code || 'attention'}`,
            title: 'Download needs attention',
            body: `${label} needs an action before it can continue. Open Downloads for details.`,
            target: { target: 'downloads' },
          });
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!getMobileNotificationPreferencesV1().enabled) return;
    void initializeMobileNotificationsV1();
  }, [preferenceRevision]);

  const notifySyncFailure = useCallback((domain: SyncDomain, phase: string, message: string | null) => {
    const previous = syncPreviousRef.current[domain];
    syncPreviousRef.current[domain] = phase;
    if (phase !== 'error' || previous === 'error') return;
    const detail = String(message || '').trim();
    void deliverMobileNotificationV1({
      category: 'syncFailures',
      dedupeKey: `sync-failure:${domain.toLowerCase().replaceAll(' ', '-')}:${detail || 'error'}:${Math.floor(Date.now() / (12 * 60 * 60_000))}`,
      title: 'Sync needs attention',
      body: `${domain} could not finish syncing. Open Account to try again.`,
      target: { target: 'settings', section: 'account' },
    });
  }, []);

  useEffect(() => notifySyncFailure('My List', myList.phase, myList.message), [myList.message, myList.phase, notifySyncFailure]);
  useEffect(() => notifySyncFailure('Watched', watched.phase, watched.message), [notifySyncFailure, watched.message, watched.phase]);
  useEffect(() => notifySyncFailure(
    'Viewing Activity',
    viewingActivity.phase,
    viewingActivity.message,
  ), [notifySyncFailure, viewingActivity.message, viewingActivity.phase]);

  useEffect(() => {
    const unavailable = !network.online || network.internetReachable === false;
    if (!networkInitializedRef.current) {
      networkInitializedRef.current = true;
      previouslyUnavailableRef.current = unavailable;
      return;
    }
    if (previouslyUnavailableRef.current && !unavailable) {
      void deliverMobileNotificationV1({
        category: 'offlineRecovery',
        dedupeKey: `offline-recovery:${Math.floor(Date.now() / (60 * 60_000))}`,
        title: 'Orion is back online',
        body: 'You are connected again. Sync and update checks can continue.',
        target: { target: 'home' },
      });
    }
    previouslyUnavailableRef.current = unavailable;
  }, [network.internetReachable, network.online]);

  useEffect(() => subscribeMobileSourceHealthV2((next, previous) => {
    if (next.state !== 'failed' || previous?.state === 'failed') return;
    const source = MOBILE_PLAYER_SOURCES.find((candidate) => candidate.id === next.sourceId);
    const label = source?.label || next.sourceId;
    void deliverMobileNotificationV1({
      category: 'providerHealth',
      dedupeKey: `provider-failed:${next.sourceId}:${next.mediaType}:${next.lastFailure || 'unknown'}:${Math.floor(Date.now() / (6 * 60 * 60_000))}`,
      title: 'Playback source unavailable',
      body: `${label} is having trouble right now. Orion will avoid it temporarily.`,
      target: { target: 'home' },
    });
  }), []);

  const runAvailabilityCheck = useCallback(async () => {
    const preferences = getMobileNotificationPreferencesV1();
    if (!preferences.enabled || !preferences.categories.watchlist) return;
    if (!network.online || network.internetReachable === false || availabilityBusyRef.current) return;
    availabilityBusyRef.current = true;
    try {
      const result = await checkWatchlistAvailabilityV1(saved, savedOrder);
      for (const event of result.events) await deliverMobileNotificationV1(event);
    } finally {
      availabilityBusyRef.current = false;
    }
  }, [network.internetReachable, network.online, saved, savedOrder]);

  const runUpdateCheck = useCallback(async () => {
    if (!network.online || network.internetReachable === false || updateBusyRef.current) return;
    const now = Date.now();
    const last = Number(mmkvStorageAdapter.get(UPDATE_POLL_KEY) || 0);
    if (
      updateSessionCheckCompletedRef.current
      && Number.isFinite(last)
      && now - last < UPDATE_POLL_INTERVAL_MS
    ) return;

    updateBusyRef.current = true;
    updateSessionCheckCompletedRef.current = true;
    mmkvStorageAdapter.set(UPDATE_POLL_KEY, String(now));
    try {
      const updateState = await checkMobileApplicationUpdateStateV1(getMobileUpdateChannelV1());
      if (updateState.status === 'failed') {
        mmkvStorageAdapter.set(UPDATE_POLL_KEY, String(Date.now() - UPDATE_POLL_INTERVAL_MS + UPDATE_FAILURE_RETRY_MS));
        return;
      }

      const result = updateState.result;
      const release = result?.releaseTruth.mobile.release;
      const actionable = updateState.status === 'available' || updateState.status === 'permission-required';
      if (!actionable || !result || !release) return;

      await deliverMobileNotificationV1({
        category: 'appUpdates',
        dedupeKey: `mobile-update:${result.channel}:${release.version}`,
        title: 'Orion update available',
        body: updateState.status === 'permission-required'
          ? `Orion Mobile ${release.version} is available. Open Updates to allow installation.`
          : `Orion Mobile ${release.version} is ready to install. Open Updates to see what is new.`,
        target: { target: 'settings', section: 'updates' },
      });
    } catch {
      // Retry advisory failures sooner without turning a transient GitHub error into a tight loop.
      mmkvStorageAdapter.set(UPDATE_POLL_KEY, String(Date.now() - UPDATE_POLL_INTERVAL_MS + UPDATE_FAILURE_RETRY_MS));
    } finally {
      updateBusyRef.current = false;
    }
  }, [network.internetReachable, network.online]);

  const runChecks = useCallback(() => {
    if (AppState.currentState !== 'active') return;
    void runUpdateCheck();
    void runAvailabilityCheck();
  }, [runAvailabilityCheck, runUpdateCheck]);

  useEffect(() => {
    runChecks();
    const timer = setInterval(runChecks, COORDINATOR_TICK_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') runChecks();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [preferenceRevision, runChecks]);

  return null;
}
