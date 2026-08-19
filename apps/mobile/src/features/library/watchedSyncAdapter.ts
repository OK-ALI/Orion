import {
  portableViewingKey,
  type PortableWatchedPreviewV1,
  type PortableWatchedValueV1,
} from '@orion/shared/types';

function positive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function localPortableKey(raw: any): string | null {
  if (!raw || typeof raw !== 'object' || raw.is_series_summary || raw.derived_from_episodes) return null;
  const episode = Boolean(raw.is_episode)
    || raw.series_id != null
    || raw.seriesId != null
    || (raw.season != null && raw.episode != null);
  if (episode) {
    const seriesId = raw.series_id ?? raw.seriesId;
    const season = positive(raw.season_number ?? raw.season);
    const episodeNumber = positive(raw.episode_number ?? raw.episode);
    if (seriesId == null || season == null || episodeNumber == null) return null;
    return portableViewingKey('tv', seriesId, season, episodeNumber);
  }
  const mediaType = raw.media_type ?? raw.mediaType;
  if (mediaType === 'tv' || raw.id == null) return null;
  return portableViewingKey('movie', raw.id);
}

function findExisting(
  existingWatched: Record<string, any>,
  portableKey: string,
): any | null {
  const direct = existingWatched[portableKey];
  if (direct && typeof direct === 'object') return direct;
  for (const raw of Object.values(existingWatched)) {
    if (localPortableKey(raw) === portableKey) return raw;
  }
  return null;
}

function localRecord(
  value: PortableWatchedValueV1,
  existing: any | null,
): Record<string, any> {
  const media = value.media;
  if (value.kind === 'movie') {
    return {
      ...(existing || {}),
      id: media.id,
      media_type: 'movie',
      title: media.title ?? existing?.title ?? existing?.name ?? null,
      year: media.year == null ? (existing?.year ?? '') : String(media.year),
    };
  }

  return {
    ...(existing || {}),
    id: existing?.id ?? media.id,
    media_type: 'tv',
    name: media.title ?? existing?.name ?? existing?.series_title ?? null,
    series_title: media.title ?? existing?.series_title ?? existing?.name ?? null,
    is_episode: true,
    series_id: media.id,
    season_number: media.season,
    episode_number: media.episode,
    season: media.season,
    episode: media.episode,
    year: media.year == null ? (existing?.year ?? '') : String(media.year),
  };
}

/**
 * Pure Mobile apply adapter. It rebuilds only exact portable Watched truth.
 * Whole-series summaries are intentionally omitted because they remain derived
 * local state. Existing local-only metadata is retained when the same canonical
 * movie/episode already exists on this device.
 */
export function buildLocalMobileWatchedSnapshotV1(
  preview: PortableWatchedPreviewV1,
  existingWatched: Record<string, any> = {},
): Record<string, any> {
  if (preview.rejectedKeys.length > 0) {
    throw new Error('Cannot apply a rejected portable Watched preview.');
  }

  const watched: Record<string, any> = {};
  for (const key of Object.keys(preview.records).sort()) {
    const value = preview.records[key];
    if (!value) throw new Error('Portable Watched preview is inconsistent.');
    const canonicalKey = portableViewingKey(
      value.media.mediaType,
      value.media.id,
      value.media.season,
      value.media.episode,
    );
    if (canonicalKey !== key) throw new Error('Portable Watched preview key is inconsistent.');
    watched[key] = localRecord(value, findExisting(existingWatched, key));
  }
  return watched;
}
