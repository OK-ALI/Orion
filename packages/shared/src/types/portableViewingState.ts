/**
 * Orion portable viewing-state contracts.
 *
 * These values are deliberately provider-neutral. Device/source/session details
 * stay local; only canonical viewing truth is eligible to cross platforms.
 */

export const PORTABLE_VIEWING_STATE_SCHEMA_VERSION = 1 as const;

export type PortableViewingMediaType = 'movie' | 'tv';
export type PortableViewingKind = 'movie' | 'episode';

export interface PortableViewingIdentityV1 {
  mediaType: PortableViewingMediaType;
  id: string | number;
  season: number | null;
  episode: number | null;
  title: string | null;
  year: number | null;
}

export interface PortableViewingPresentationV1 {
  posterPath: string | null;
  backdropPath: string | null;
  seriesTitle: string | null;
  episodeTitle: string | null;
}

export interface PortableWatchedValueV1 {
  schemaVersion: typeof PORTABLE_VIEWING_STATE_SCHEMA_VERSION;
  kind: PortableViewingKind;
  media: PortableViewingIdentityV1;
}

export interface PortableHistoryValueV1 {
  schemaVersion: typeof PORTABLE_VIEWING_STATE_SCHEMA_VERSION;
  media: PortableViewingIdentityV1;
  presentation: PortableViewingPresentationV1;
  lastPlayedAt: number;
  verified: true;
}

export interface PortableProgressValueV1 {
  schemaVersion: typeof PORTABLE_VIEWING_STATE_SCHEMA_VERSION;
  media: PortableViewingIdentityV1;
  presentation: PortableViewingPresentationV1;
  currentTime: number;
  duration: number;
  percent: number | null;
  startedAt: number;
  lastPlayedAt: number;
  verified: true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function finiteNonNegative(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function portableId(value: unknown): string | number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

export function portableViewingKey(
  mediaType: PortableViewingMediaType,
  id: string | number,
  season?: number | null,
  episode?: number | null,
): string {
  if (mediaType === 'tv') {
    const safeSeason = positiveInteger(season);
    const safeEpisode = positiveInteger(episode);
    if (safeSeason == null || safeEpisode == null) {
      throw new Error('Portable TV viewing identity requires an exact episode.');
    }
    return `tv_${String(id)}_s${safeSeason}_e${safeEpisode}`;
  }
  return `movie_${String(id)}`;
}

export function normalizePortableViewingIdentityV1(
  value: unknown,
): PortableViewingIdentityV1 | null {
  if (!isPlainObject(value)) return null;
  const mediaType = value.mediaType === 'movie' || value.mediaType === 'tv'
    ? value.mediaType
    : null;
  const id = portableId(value.id);
  if (!mediaType || id == null) return null;

  const season = value.season == null ? null : positiveInteger(value.season);
  const episode = value.episode == null ? null : positiveInteger(value.episode);
  if (mediaType === 'movie') {
    if (season != null || episode != null) return null;
  } else if (season == null || episode == null) {
    // P8.4 treats TV viewing truth as episode truth. Whole-series watched
    // summaries remain derived locally and are not portable records.
    return null;
  }

  const year = value.year == null ? null : positiveInteger(value.year);
  if (value.year != null && year == null) return null;

  return {
    mediaType,
    id,
    season,
    episode,
    title: value.title == null ? null : nullableText(value.title),
    year,
  };
}

export function normalizePortableViewingPresentationV1(
  value: unknown,
): PortableViewingPresentationV1 | null {
  if (!isPlainObject(value)) return null;
  return {
    posterPath: value.posterPath == null ? null : nullableText(value.posterPath),
    backdropPath: value.backdropPath == null ? null : nullableText(value.backdropPath),
    seriesTitle: value.seriesTitle == null ? null : nullableText(value.seriesTitle),
    episodeTitle: value.episodeTitle == null ? null : nullableText(value.episodeTitle),
  };
}

export function normalizePortableWatchedValueV1(
  value: unknown,
): PortableWatchedValueV1 | null {
  if (!isPlainObject(value) || value.schemaVersion !== PORTABLE_VIEWING_STATE_SCHEMA_VERSION) return null;
  if (value.kind !== 'movie' && value.kind !== 'episode') return null;
  const media = normalizePortableViewingIdentityV1(value.media);
  if (!media) return null;
  if (value.kind === 'movie' && media.mediaType !== 'movie') return null;
  if (value.kind === 'episode' && media.mediaType !== 'tv') return null;
  return { schemaVersion: PORTABLE_VIEWING_STATE_SCHEMA_VERSION, kind: value.kind, media };
}

export function normalizePortableHistoryValueV1(
  value: unknown,
): PortableHistoryValueV1 | null {
  if (!isPlainObject(value) || value.schemaVersion !== PORTABLE_VIEWING_STATE_SCHEMA_VERSION) return null;
  if (value.verified !== true) return null;
  const media = normalizePortableViewingIdentityV1(value.media);
  const presentation = normalizePortableViewingPresentationV1(value.presentation);
  const lastPlayedAt = finiteNonNegative(value.lastPlayedAt);
  if (!media || !presentation || lastPlayedAt == null || lastPlayedAt <= 0) return null;
  return {
    schemaVersion: PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
    media,
    presentation,
    lastPlayedAt,
    verified: true,
  };
}

export function normalizePortableProgressValueV1(
  value: unknown,
): PortableProgressValueV1 | null {
  if (!isPlainObject(value) || value.schemaVersion !== PORTABLE_VIEWING_STATE_SCHEMA_VERSION) return null;
  if (value.verified !== true) return null;
  const media = normalizePortableViewingIdentityV1(value.media);
  const presentation = normalizePortableViewingPresentationV1(value.presentation);
  const currentTime = finiteNonNegative(value.currentTime);
  const duration = finiteNonNegative(value.duration);
  const startedAt = finiteNonNegative(value.startedAt);
  const lastPlayedAt = finiteNonNegative(value.lastPlayedAt);
  if (!media || !presentation || currentTime == null || duration == null || startedAt == null || lastPlayedAt == null) return null;
  if (startedAt <= 0 || lastPlayedAt <= 0 || lastPlayedAt < startedAt) return null;
  if (duration > 0 && currentTime > duration + 5) return null;

  const percent = duration > 0
    ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
    : null;

  return {
    schemaVersion: PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
    media,
    presentation,
    currentTime,
    duration,
    percent,
    startedAt,
    lastPlayedAt,
    verified: true,
  };
}
