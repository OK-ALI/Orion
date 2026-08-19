import {
  PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
  portableViewingKey,
  type PortableHistoryValueV1,
  type PortableProgressValueV1,
  type PortableViewingIdentityV1,
  type PortableViewingPresentationV1,
  type PortableWatchedValueV1,
  type PortableWatchedPreviewV1,
} from '@orion/shared/types';
import {
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
      rejected.push({ key: localKey, reason: 'derived-series-summary' });
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
    if (!isVerifiedPlaybackEvidence(raw?.evidence) || !text(raw?.sessionId)) {
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
    if (!isVerifiedPlaybackEvidence(normalized.evidence) || !text(normalized.sessionId)) {
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
