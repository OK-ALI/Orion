import type { PlaybackTelemetryInput } from './usePlaybackTelemetryController';

export const ANIME_READINESS_DEADLINE_MS = 35_000;
// AniLink publishes a 90-second recovery budget; allow ten seconds for page startup.
export const ANILINK_READINESS_DEADLINE_MS = 100_000;
export const animeReadinessDeadline = (providerId?: string) => providerId === 'anilink'
  ? ANILINK_READINESS_DEADLINE_MS : ANIME_READINESS_DEADLINE_MS;
export interface AnimeReadiness {
  sessionId: string;
  status: 'opening' | 'waiting' | 'ready' | 'failed';
  startedAt: number;
  lastTime: number | null;
  lastObservedAt: number;
}
export function createAnimeReadiness(sessionId: string, now: number): AnimeReadiness {
  return { sessionId, status: 'opening', startedAt: now, lastTime: null, lastObservedAt: now };
}
export function observeAnimeReadiness(state: AnimeReadiness, sessionId: string,
  input: PlaybackTelemetryInput, now: number): AnimeReadiness {
  if (sessionId !== state.sessionId || state.status === 'failed') return state;
  const observedAt = input.observedAt ?? now;
  if (!Number.isFinite(observedAt) || observedAt < state.lastObservedAt || Math.abs(now - observedAt) > 15_000) return state;
  if (input.state === 'error') return { ...state, status: 'failed', lastObservedAt: observedAt };
  if (!['provider-message', 'provider-video-event'].includes(input.evidence)) return state;
  const time = input.currentTime;
  const duration = input.duration;
  if (typeof time !== 'number' || !Number.isFinite(time) || time < 0
    || typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0 || time > duration + 5) return state;
  const advances = input.state === 'playing' && state.lastTime !== null && time > state.lastTime + 0.05;
  return { ...state, lastTime: time, lastObservedAt: observedAt, status: state.status === 'ready' || advances ? 'ready' : 'waiting' };
}
export function expireAnimeReadiness(state: AnimeReadiness, now: number, providerId?: string): AnimeReadiness {
  return state.status !== 'ready' && now - state.startedAt >= animeReadinessDeadline(providerId)
    ? { ...state, status: 'failed' } : state;
}
