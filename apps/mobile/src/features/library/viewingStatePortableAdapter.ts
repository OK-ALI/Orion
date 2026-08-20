import {
  PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
  portableViewingKey,
  type PortableHistoryValueV1,
  type PortableProgressValueV1,
  type PortableViewingIdentityV1,
  type PortableViewingPresentationV1,
  type PortableWatchedValueV1,
  type PortableWatchedPreviewV1,
  type PortableViewingActivityStateV1,
  type PlaybackProgressV3,
} from '@orion/shared/types';
import {
  historyEntryKey,
  isVerifiedPlaybackEvidence,
  normalizePlaybackProgress,
} from './playbackLibrary';

export interface ViewingStatePreviewRejection {
  key: string;
  reason: string;
}

export interface PortableViewingStatePreviewV1 {
  watched: Record<string, PortableWatchedValueV1>;
  history: Record<string, PortableHistoryValueV1>;
  progress: Record<string, PortableProgressValueV1>;
  rejected: {
    watched: ViewingStatePreviewRejection[];
    history: ViewingStatePreviewRejection[];
    progress: ViewingStatePreviewRejection[];
  };
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function year(value: unknown): number | null {
  const parsed = Number(String(value ?? '').slice(0, 4));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function positive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function presentationFrom(raw: any): PortableViewingPresentationV1 {
  return {
    posterPath: text(raw?.presentation?.posterPath ?? raw?.poster_path ?? raw?.posterPath),
    backdropPath: text(raw?.presentation?.backdropPath ?? raw?.backdrop_path ?? raw?.backdropPath),
    seriesTitle: text(raw?.presentation?.seriesTitle ?? raw?.series_title ?? raw?.seriesTitle ?? raw?.name),
    episodeTitle: text(raw?.presentation?.episodeTitle ?? raw?.episode_title ?? raw?.episodeTitle ?? raw?.episodeName),
  };
}

function movieIdentity(raw: any): PortableViewingIdentityV1 | null {
  const id = raw?.id;
  if (id == null) return null;
  return {
    mediaType: 'movie',
    id,
    season: null,
    episode: null,
    title: text(raw?.title ?? raw?.name),
    year: year(raw?.year ?? raw?.release_date),
  };
}

function episodeIdentity(raw: any): PortableViewingIdentityV1 | null {
  const id = raw?.series_id ?? raw?.seriesId ?? raw?.mediaIdentity?.id ?? raw?.media?.id;
  const season = positive(raw?.season_number ?? raw?.season ?? raw?.mediaIdentity?.season ?? raw?.media?.season);
  const episode = positive(raw?.episode_number ?? raw?.episode ?? raw?.mediaIdentity?.episode ?? raw?.media?.episode);
  if (id == null || season == null || episode == null) return null;
  return {
    mediaType: 'tv',
    id,
    season,
    episode,
    title: text(raw?.series_title ?? raw?.seriesTitle ?? raw?.name ?? raw?.mediaIdentity?.title ?? raw?.media?.title),
    year: year(raw?.year ?? raw?.first_air_date ?? raw?.mediaIdentity?.year ?? raw?.media?.year),
  };
}

function historyIdentity(raw: any): PortableViewingIdentityV1 | null {
  const mediaType = raw?.media_type ?? raw?.mediaType;
  if (mediaType === 'movie') return movieIdentity(raw);
  if (mediaType === 'tv') {
    const id = raw?.id;
    const season = positive(raw?.season);
    const episode = positive(raw?.episode);
    if (id == null || season == null || episode == null) return null;
    return {
      mediaType: 'tv',
      id,
      season,
      episode,
      title: text(raw?.name ?? raw?.title),
      year: year(raw?.year ?? raw?.first_air_date),
    };
  }
  return null;
}

function watchedPreview(watched: Record<string, any>) {
  const accepted: Record<string, PortableWatchedValueV1> = {};
  const rejected: ViewingStatePreviewRejection[] = [];

  for (const [localKey, raw] of Object.entries(watched || {})) {
    if (!raw || typeof raw !== 'object') {
      rejected.push({ key: localKey, reason: 'malformed-watched-record' });
      continue;
    }
    if (raw.is_series_summary || raw.derived_from_episodes) {
      // Whole-series summaries are derived local cache, not portable Watched
      // truth. Ignore them at the portability boundary without treating them
      // as unsafe data or allowing them to influence sync signatures.
      continue;
    }

    const episode = Boolean(raw.is_episode)
      || raw.series_id != null
      || raw.seriesId != null
      || (raw.season != null && raw.episode != null);
    const media = episode ? episodeIdentity(raw) : movieIdentity(raw);
    if (!media || (!episode && (raw.media_type ?? raw.mediaType) === 'tv')) {
      rejected.push({ key: localKey, reason: 'non-portable-watched-identity' });
      continue;
    }

    const key = portableViewingKey(media.mediaType, media.id, media.season, media.episode);
    accepted[key] = {
      schemaVersion: PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
      kind: media.mediaType === 'movie' ? 'movie' : 'episode',
      media,
    };
  }

  return { accepted, rejected };
}

export function buildMobilePortableWatchedPreviewV1(
  watched: Record<string, any>,
): PortableWatchedPreviewV1 {
  const preview = watchedPreview(watched || {});
  return {
    records: preview.accepted,
    rejectedKeys: preview.rejected.map((entry) => entry.key).sort(),
  };
}

function historyPreview(history: any[]) {
  const accepted: Record<string, PortableHistoryValueV1> = {};
  const rejected: ViewingStatePreviewRejection[] = [];

  for (const [index, raw] of (Array.isArray(history) ? history : []).entries()) {
    const fallbackKey = `history_${index}`;
    const media = historyIdentity(raw);
    if (!media) {
      rejected.push({ key: fallbackKey, reason: 'non-portable-history-identity' });
      continue;
    }
    const key = portableViewingKey(media.mediaType, media.id, media.season, media.episode);
    const portableVerified = raw?.portableVerified === true;
    if ((!isVerifiedPlaybackEvidence(raw?.evidence) || !text(raw?.sessionId)) && !portableVerified) {
      rejected.push({ key, reason: 'unverified-history' });
      continue;
    }
    const lastPlayedAt = Number(raw?.lastPlayedAt ?? raw?.updatedAt);
    if (!Number.isFinite(lastPlayedAt) || lastPlayedAt <= 0) {
      rejected.push({ key, reason: 'invalid-history-time' });
      continue;
    }

    const value: PortableHistoryValueV1 = {
      schemaVersion: PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
      media,
      presentation: presentationFrom(raw),
      lastPlayedAt,
      verified: true,
    };
    const prior = accepted[key];
    if (!prior || prior.lastPlayedAt <= value.lastPlayedAt) accepted[key] = value;
  }

  return { accepted, rejected };
}

function progressPreview(progress: Record<string, any>, watched: Record<string, PortableWatchedValueV1>) {
  const accepted: Record<string, PortableProgressValueV1> = {};
  const rejected: ViewingStatePreviewRejection[] = [];

  for (const [localKey, raw] of Object.entries(progress || {})) {
    const normalized = normalizePlaybackProgress(localKey, raw);
    if (!normalized) {
      rejected.push({ key: localKey, reason: 'malformed-progress' });
      continue;
    }
    const { mediaIdentity } = normalized;
    if (mediaIdentity.mediaType === 'tv' && (mediaIdentity.season == null || mediaIdentity.episode == null)) {
      rejected.push({ key: localKey, reason: 'non-portable-progress-identity' });
      continue;
    }
    const key = portableViewingKey(
      mediaIdentity.mediaType,
      mediaIdentity.id,
      mediaIdentity.season,
      mediaIdentity.episode,
    );
    const locallyVerified = isVerifiedPlaybackEvidence(normalized.evidence) && Boolean(text(normalized.sessionId));
    if (!locallyVerified && normalized.portableVerified !== true) {
      rejected.push({ key, reason: 'unverified-progress' });
      continue;
    }
    if (watched[key]) {
      rejected.push({ key, reason: 'watched-truth-supersedes-progress' });
      continue;
    }
    if (!Number.isFinite(normalized.lastPlayedAt) || normalized.lastPlayedAt <= 0) {
      rejected.push({ key, reason: 'invalid-progress-time' });
      continue;
    }

    accepted[key] = {
      schemaVersion: PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
      media: {
        mediaType: mediaIdentity.mediaType,
        id: mediaIdentity.id,
        season: mediaIdentity.mediaType === 'tv' ? positive(mediaIdentity.season) : null,
        episode: mediaIdentity.mediaType === 'tv' ? positive(mediaIdentity.episode) : null,
        title: text(mediaIdentity.title),
        year: year(mediaIdentity.year),
      },
      presentation: presentationFrom(normalized),
      currentTime: Math.max(0, normalized.currentTime),
      duration: Math.max(0, normalized.duration),
      percent: normalized.duration > 0
        ? Math.min(100, Math.max(0, (normalized.currentTime / normalized.duration) * 100))
        : null,
      startedAt: normalized.startedAt > 0 ? normalized.startedAt : normalized.lastPlayedAt,
      lastPlayedAt: normalized.lastPlayedAt,
      verified: true,
    };
  }

  return { accepted, rejected };
}

export function buildMobilePortableViewingStatePreview(input: {
  watched: Record<string, any>;
  history: any[];
  progress: Record<string, any>;
}): PortableViewingStatePreviewV1 {
  const watched = watchedPreview(input.watched || {});
  const history = historyPreview(input.history || []);
  const progress = progressPreview(input.progress || {}, watched.accepted);
  return {
    watched: watched.accepted,
    history: history.accepted,
    progress: progress.accepted,
    rejected: {
      watched: watched.rejected,
      history: history.rejected,
      progress: progress.rejected,
    },
  };
}

export interface MobileViewingActivitySnapshotV1 {
  history: any[];
  progress: Record<string, PlaybackProgressV3>;
}

function mobileHistoryFromPortable(
  value: PortableHistoryValueV1,
  progress: PortableProgressValueV1 | null,
) {
  const { media, presentation } = value;
  return {
    id: media.id,
    media_type: media.mediaType,
    title: media.title || presentation.seriesTitle || 'Untitled',
    ...(media.mediaType === 'tv' ? { name: presentation.seriesTitle || media.title || 'Untitled' } : {}),
    poster_path: presentation.posterPath,
    backdrop_path: presentation.backdropPath,
    year: media.year ? String(media.year) : '',
    season: media.season,
    episode: media.episode,
    episode_title: presentation.episodeTitle,
    currentTime: progress?.currentTime ?? null,
    duration: progress?.duration ?? null,
    sourceId: null,
    evidence: null,
    sessionId: null,
    portableVerified: true,
    lastPlayedAt: value.lastPlayedAt,
    updatedAt: value.lastPlayedAt,
  };
}

function mobileProgressFromPortable(key: string, value: PortableProgressValueV1): PlaybackProgressV3 {
  const { media, presentation } = value;
  return {
    schemaVersion: 3,
    key,
    mediaIdentity: {
      id: media.id,
      mediaType: media.mediaType,
      title: media.title || presentation.seriesTitle || 'Untitled',
      year: media.year,
      season: media.season,
      episode: media.episode,
    },
    presentation: { ...presentation },
    currentTime: value.currentTime,
    duration: value.duration,
    percent: value.percent,
    sourceId: null,
    evidence: null,
    portableVerified: true,
    sessionId: null,
    startedAt: value.startedAt,
    lastPlayedAt: value.lastPlayedAt,
    completed: value.percent != null && value.percent >= 90,
  };
}

/**
 * Pure apply adapter for future Viewing Activity sync. It preserves unrelated
 * local entries while replacing only canonical portable History/Progress keys.
 * Portable truth is marked explicitly and never receives fake source/session
 * telemetry from the receiving device.
 */
export function buildLocalMobileViewingActivitySnapshotV1(
  state: PortableViewingActivityStateV1,
  existing: { history?: any[]; progress?: Record<string, any> } = {},
): MobileViewingActivitySnapshotV1 {
  const historyKeys = new Set([
    ...Object.keys(state.history),
    ...state.tombstones.history,
  ]);
  const progressKeys = new Set([
    ...Object.keys(state.progress),
    ...state.tombstones.progress,
  ]);

  const preservedHistory = (Array.isArray(existing.history) ? existing.history : [])
    .filter((entry) => {
      const key = historyEntryKey(entry);
      return !key || !historyKeys.has(key);
    });
  const portableHistory = Object.entries(state.history)
    .map(([key, value]) => mobileHistoryFromPortable(value, state.progress[key] || null));
  const history = [...portableHistory, ...preservedHistory]
    .sort((a, b) => Number(b.lastPlayedAt || 0) - Number(a.lastPlayedAt || 0))
    .slice(0, 250);

  const progress: Record<string, PlaybackProgressV3> = {};
  for (const [key, raw] of Object.entries(existing.progress || {})) {
    if (progressKeys.has(key)) continue;
    const normalized = normalizePlaybackProgress(key, raw);
    if (normalized) progress[key] = normalized;
  }
  for (const [key, value] of Object.entries(state.progress)) {
    progress[key] = mobileProgressFromPortable(key, value);
  }

  return { history, progress };
}
