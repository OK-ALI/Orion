import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackTelemetryInput } from './usePlaybackTelemetryController';
import { animeReadinessDeadline, createAnimeReadiness, expireAnimeReadiness, observeAnimeReadiness } from './animeReadiness';

/** Adds bounded Anime readiness without changing existing-provider load semantics. */
export function useAnimeReadiness(enabled: boolean, sessionId: string, attempt: number, onFailure: () => void, providerId?: string) {
  const state = useRef(createAnimeReadiness(sessionId, Date.now()));
  const failure = useRef(onFailure);
  failure.current = onFailure;
  const [status, setStatus] = useState(state.current.status);
  const failed = useCallback(() => {
    if (state.current.status === 'failed') return;
    state.current = { ...state.current, status: 'failed' };
    setStatus('failed'); failure.current();
  }, []);
  useEffect(() => {
    state.current = createAnimeReadiness(sessionId, Date.now());
    setStatus('opening');
    if (!enabled) return undefined;
    const timer = setTimeout(() => {
      if (expireAnimeReadiness(state.current, Date.now(), providerId).status === 'failed') failed();
    }, animeReadinessDeadline(providerId));
    return () => clearTimeout(timer);
  }, [enabled, sessionId, attempt, failed, providerId]);
  const observe = useCallback((input: PlaybackTelemetryInput) => {
    if (!enabled) return true;
    const next = observeAnimeReadiness(state.current, sessionId, input, Date.now());
    if (next.status === 'failed' && state.current.status !== 'failed') { failed(); return false; }
    state.current = next; setStatus(next.status);
    return next.status === 'ready';
  }, [enabled, sessionId, failed]);
  return { status, observe, fail: failed, getStatus: () => state.current.status,
    detail: !enabled || status === 'ready' ? undefined : status === 'failed'
      ? 'This source did not start. Retry or choose another source.' : 'Waiting for playback.' };
}
