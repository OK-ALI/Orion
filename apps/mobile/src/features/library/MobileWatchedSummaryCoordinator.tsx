import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { tmdbFetch } from '@orion/shared/api';
import { useLibrary } from '../../context/LibraryContext';
import { useNetworkStatus } from '../../context/NetworkContext';
import {
  nextSeriesWatchedSummaryExpiry,
  selectSeriesWatchedReconciliationCandidates,
} from './watchedState';
import { runSeriesWatchedReconciliationBatch } from './seriesWatchedReconciler';

/**
 * Rebuilds derived TV completion markers without requiring a Media Detail visit.
 * Episode records remain the durable truth; this only adds a summary after
 * current TMDB metadata proves that every released episode is represented.
 */
const MAX_EXPIRY_TIMER_DELAY_MS = 24 * 60 * 60 * 1000;
const EXPIRY_TIMER_GRACE_MS = 50;

export function MobileWatchedSummaryCoordinator() {
  const { watched, reconcileSeriesWatched } = useLibrary();
  const { remoteReady, recoveryEpoch } = useNetworkStatus();
  const watchedRef = useRef(watched);
  const remoteReadyRef = useRef(remoteReady);
  const mountedRef = useRef(true);
  const activeControllersRef = useRef(new Set<AbortController>());
  const attemptedRef = useRef(new Set<string>());
  const [reevaluationEpoch, setReevaluationEpoch] = useState(0);

  watchedRef.current = watched;
  remoteReadyRef.current = remoteReady;

  const candidates = useMemo(
    () => selectSeriesWatchedReconciliationCandidates(watched),
    [watched, reevaluationEpoch, recoveryEpoch],
  );
  const nextExpiry = useMemo(
    () => nextSeriesWatchedSummaryExpiry(watched),
    [watched, reevaluationEpoch],
  );
  const candidateKey = candidates
    .map((candidate) => candidate.seriesId + ':' + candidate.signature)
    .join('||');

  useEffect(() => {
    if (nextExpiry == null) return;
    const remaining = nextExpiry - Date.now() + EXPIRY_TIMER_GRACE_MS;
    const delay = Math.max(1, Math.min(MAX_EXPIRY_TIMER_DELAY_MS, remaining));
    const timer = setTimeout(
      () => setReevaluationEpoch((value) => value + 1),
      delay,
    );
    return () => clearTimeout(timer);
  }, [nextExpiry, reevaluationEpoch]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setReevaluationEpoch((value) => value + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => () => {
    mountedRef.current = false;
    for (const controller of activeControllersRef.current) controller.abort();
    activeControllersRef.current.clear();
  }, []);

  useEffect(() => {
    if (remoteReady) return;
    for (const controller of activeControllersRef.current) controller.abort();
    activeControllersRef.current.clear();
  }, [remoteReady]);

  useEffect(() => {
    if (!remoteReady || candidates.length === 0) return;
    const pending = candidates.filter((candidate) => {
      const attemptKey = recoveryEpoch + ':' + candidate.seriesId + ':' + candidate.signature;
      if (attemptedRef.current.has(attemptKey)) return false;
      attemptedRef.current.add(attemptKey);
      return true;
    });
    if (pending.length === 0) return;

    void runSeriesWatchedReconciliationBatch({
      candidates: pending,
      fetchSeries: (seriesId, signal) => tmdbFetch('/tv/' + encodeURIComponent(seriesId), { signal }),
      applySeries: reconcileSeriesWatched,
      isCurrent: (candidate) => {
        if (!mountedRef.current || !remoteReadyRef.current) return false;
        return selectSeriesWatchedReconciliationCandidates(watchedRef.current)
          .some((current) => (
            current.seriesId === candidate.seriesId
            && current.signature === candidate.signature
          ));
      },
      onController: (controller, active) => {
        if (active) activeControllersRef.current.add(controller);
        else activeControllersRef.current.delete(controller);
      },
    });
  }, [candidateKey, candidates, reconcileSeriesWatched, recoveryEpoch, remoteReady]);

  return null;
}