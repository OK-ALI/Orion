import { NativeModules, Platform } from 'react-native';
import { ANIME_IDENTITY_REASONS, normalizeAnimeTitle, type AnimeIdentityDiagnostic,
  type AnimeIdentityDiagnosticSink } from '@orion/shared/api';

const stages = ['request', 'catalog', 'lookup', 'candidate', 'decision'];
const numeric = ['season', 'episode', 'year', 'seasonYear', 'episodes', 'anilistId', 'candidates', 'responseCharacters', 'depth'] as const;
const flags = ['cached', 'titleMatch', 'yearMatch', 'formatMatch', 'countMatch', 'dateMatch', 'episodeInRange'] as const;
let nextAttempt = 0;

/** Reconstruct an allowlisted payload; never serialize arbitrary event material. */
export function sanitizeAnimeIdentityDiagnostic(event: AnimeIdentityDiagnostic): Record<string, string | number | boolean> | null {
  if (!event || !stages.includes(event.stage)) return null;
  const safe: Record<string, string | number | boolean> = { stage: event.stage };
  for (const key of numeric) {
    const value = event[key];
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000) safe[key] = value;
  }
  for (const key of flags) if (typeof event[key] === 'boolean') safe[key] = event[key]!;
  if (typeof event.tmdbId === 'string' && /^\d{1,16}$/.test(event.tmdbId)) safe.tmdbId = event.tmdbId;
  if (event.mediaType === 'movie' || event.mediaType === 'tv') safe.mediaType = event.mediaType;
  if (event.variant === 'sub' || event.variant === 'dub') safe.variant = event.variant;
  if (event.outcome === 'accepted' || event.outcome === 'rejected') safe.outcome = event.outcome;
  if (ANIME_IDENTITY_REASONS.includes(event.reason!)) safe.reason = event.reason!;
  if (['search', 'relation', 'base', 'season'].includes(event.scope!)) safe.scope = event.scope!;
  if (['TV', 'TV_SHORT', 'ONA', 'MOVIE', 'OVA', 'SPECIAL', 'MUSIC'].includes(event.format!)) safe.format = event.format!;
  else if (event.format !== undefined) safe.format = 'UNKNOWN';
  if (typeof event.query === 'string' && !/[:/@=]|\b(?:bearer|cookie|authorization)\b/i.test(event.query)) safe.query = normalizeAnimeTitle(event.query).slice(0, 100);
  return safe;
}

/** At most 64 lines per user attempt, reserving a final decision slot. */
export function createAnimeIdentityTrace(writer?: (payload: string) => void): AnimeIdentityDiagnosticSink {
  const attempt = ++nextAttempt;
  let sequence = 0;
  return (event) => {
    if (sequence >= 64 || (sequence >= 63 && event.stage !== 'decision')) return;
    const safe = sanitizeAnimeIdentityDiagnostic(event);
    if (!safe) return;
    try {
      const write = writer || (Platform.OS === 'android' ? NativeModules.OrionAnimeIdentity?.logEvent : undefined);
      if (typeof write === 'function') write(JSON.stringify({ attempt, sequence: ++sequence, ...safe }));
    } catch {} // A missing diagnostic bridge cannot change identity behavior.
  };
}
