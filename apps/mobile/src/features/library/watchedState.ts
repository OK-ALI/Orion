export type WatchedCollection = Record<string, any>;

function positiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function episodeWatchedKey(seriesId: string | number, episodeId: string | number) {
  return `tv_${seriesId}_episode_${episodeId}`;
}

export function seriesWatchedKey(seriesId: string | number) {
  return `tv_${seriesId}`;
}

function episodeIdentity(item: any = {}, fallbackSeason?: number | null) {
  return {
    season: positiveNumber(item.season_number ?? item.season ?? fallbackSeason),
    episode: positiveNumber(item.episode_number ?? item.episode),
  };
}

function watchedRecordMatchesEpisode(
  record: any,
  seriesId: string | number,
  season: number | null,
  episode: number | null,
) {
  if (!record || season == null || episode == null) return false;
  const recordSeries = String(record.series_id ?? record.seriesId ?? '');
  const recordSeason = positiveNumber(record.season_number ?? record.season);
  const recordEpisode = positiveNumber(record.episode_number ?? record.episode);
  return recordSeries === String(seriesId)
    && recordSeason === season
    && recordEpisode === episode;
}

export function isEpisodeWatchedRecord(
  watched: WatchedCollection,
  seriesId: string | number,
  item: any,
  fallbackSeason?: number | null,
) {
  if (!item || item.id == null) return false;
  if (watched[episodeWatchedKey(seriesId, item.id)]) return true;
  const { season, episode } = episodeIdentity(item, fallbackSeason);
  return Object.values(watched).some((record) => watchedRecordMatchesEpisode(record, seriesId, season, episode));
}

export function withEpisodeWatched(
  watched: WatchedCollection,
  series: any,
  fallbackSeason: number | null | undefined,
  item: any,
  now = Date.now(),
): WatchedCollection {
  if (!series || series.id == null || !item || item.id == null) return watched;
  const { season, episode } = episodeIdentity(item, fallbackSeason);
  const episodeTitle = item.name || item.title || (episode ? `Episode ${episode}` : 'Episode');
  const seriesTitle = series.name || series.title || item.series_title || item.seriesTitle || null;
  const record = {
    ...item,
    id: item.id,
    media_type: 'tv',
    title: episode ? `E${episode} - ${episodeTitle}` : episodeTitle,
    name: seriesTitle || item.name || item.title,
    series_title: seriesTitle,
    poster_path: series.poster_path ?? item.poster_path ?? null,
    backdrop_path: item.still_path ?? series.backdrop_path ?? item.backdrop_path ?? null,
    is_episode: true,
    series_id: series.id,
    season_number: season,
    episode_number: episode,
    season,
    episode,
    timestamp: now,
  };
  return {
    ...watched,
    [episodeWatchedKey(series.id, item.id)]: record,
  };
}

function isDerivedSeriesSummary(record: any) {
  return Boolean(record?.is_series_summary && record?.derived_from_episodes);
}

function withoutSeriesWatchedMarker(watched: WatchedCollection, seriesId: string | number) {
  const key = seriesWatchedKey(seriesId);
  if (!watched[key]) return watched;
  const next = { ...watched };
  delete next[key];
  return next;
}

export function withoutEpisodeWatched(
  watched: WatchedCollection,
  seriesId: string | number,
  item: any,
  fallbackSeason?: number | null,
): WatchedCollection {
  if (!item || item.id == null) return watched;
  const exactKey = episodeWatchedKey(seriesId, item.id);
  const { season, episode } = episodeIdentity(item, fallbackSeason);
  let changed = false;
  const next: WatchedCollection = {};
  for (const [key, record] of Object.entries(watched)) {
    const remove = key === exactKey || watchedRecordMatchesEpisode(record, seriesId, season, episode);
    if (remove) changed = true;
    else next[key] = record;
  }
  if (!changed) return watched;
  return withoutSeriesWatchedMarker(next, seriesId);
}

export function isSeasonWatchedCollection(
  watched: WatchedCollection,
  seriesId: string | number,
  seasonNumber: number,
  episodes: any[],
) {
  return episodes.length > 0
    && episodes.every((episode) => isEpisodeWatchedRecord(watched, seriesId, episode, seasonNumber));
}

function watchedEpisodeIdentity(record: any) {
  const seriesId = record?.series_id ?? record?.seriesId;
  const season = positiveNumber(record?.season_number ?? record?.season);
  const episode = positiveNumber(record?.episode_number ?? record?.episode);
  if (seriesId == null || season == null || episode == null) return null;
  return { seriesId: String(seriesId), season, episode };
}

function countWatchedEpisodesForSeason(
  watched: WatchedCollection,
  seriesId: string | number,
  seasonNumber: number,
) {
  const identities = new Set<string>();
  for (const record of Object.values(watched)) {
    const identity = watchedEpisodeIdentity(record);
    if (!identity) continue;
    if (identity.seriesId !== String(seriesId) || identity.season !== seasonNumber) continue;
    identities.add(`${identity.season}:${identity.episode}`);
  }
  return identities.size;
}

function releasedEpisodeTarget(item: any, season: any) {
  const seasonNumber = positiveNumber(season?.season_number ?? season?.season);
  const episodeCount = positiveNumber(season?.episode_count);
  if (seasonNumber == null || episodeCount == null) return null;

  const airDate = season?.air_date ? Date.parse(season.air_date) : Number.NaN;
  if (Number.isFinite(airDate) && airDate > Date.now()) return 0;

  const nextEpisode = item?.next_episode_to_air;
  if (positiveNumber(nextEpisode?.season_number) === seasonNumber) {
    const nextNumber = positiveNumber(nextEpisode?.episode_number);
    if (nextNumber != null) return Math.max(0, Math.min(episodeCount, nextNumber - 1));
  }

  const lastEpisode = item?.last_episode_to_air;
  if (positiveNumber(lastEpisode?.season_number) === seasonNumber) {
    const lastNumber = positiveNumber(lastEpisode?.episode_number);
    const status = String(item?.status || '').toLowerCase();
    if (lastNumber != null && status !== 'ended' && status !== 'canceled') {
      return Math.max(0, Math.min(episodeCount, lastNumber));
    }
  }

  return episodeCount;
}

type SeriesEpisodeEvaluation = {
  complete: boolean;
  releasedEpisodeTarget: number;
} | null;

function evaluateSeriesFromEpisodeTruth(
  watched: WatchedCollection,
  item: any,
): SeriesEpisodeEvaluation {
  if (!item || item.id == null) return null;
  const regularSeasons = Array.isArray(item.seasons)
    ? item.seasons.filter((season: any) => positiveNumber(season?.season_number) != null)
    : [];

  if (regularSeasons.length > 0) {
    const releasedTargets = regularSeasons
      .map((season: any) => ({
        seasonNumber: positiveNumber(season?.season_number),
        target: releasedEpisodeTarget(item, season),
      }))
      .filter((entry: any) => entry.seasonNumber != null && entry.target != null && entry.target > 0);

    if (releasedTargets.length === 0) return { complete: false, releasedEpisodeTarget: 0 };
    const totalTarget = releasedTargets.reduce((total: number, entry: any) => total + entry.target, 0);
    return {
      complete: releasedTargets.every((entry: any) => (
        countWatchedEpisodesForSeason(watched, item.id, entry.seasonNumber) >= entry.target
      )),
      releasedEpisodeTarget: totalTarget,
    };
  }

  const knownEpisodeTotal = positiveNumber(item.number_of_episodes);
  if (knownEpisodeTotal == null) return null;
  const identities = new Set<string>();
  for (const record of Object.values(watched)) {
    const identity = watchedEpisodeIdentity(record);
    if (!identity || identity.seriesId !== String(item.id)) continue;
    identities.add(`${identity.season}:${identity.episode}`);
  }
  return {
    complete: identities.size >= knownEpisodeTotal,
    releasedEpisodeTarget: knownEpisodeTotal,
  };
}

function nextEpisodeValidityBoundary(item: any) {
  const raw = item?.next_episode_to_air?.air_date;
  if (!raw) return null;
  const parsed = Date.parse(`${raw}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function isSeriesSummaryCurrent(record: any, now = Date.now()) {
  if (!record) return false;
  if (!isDerivedSeriesSummary(record)) return true;
  const validUntil = Number(record.valid_until);
  return !Number.isFinite(validUntil) || validUntil <= 0 || now < validUntil;
}

export function withSeriesWatchedSummary(
  watched: WatchedCollection,
  item: any,
  now = Date.now(),
): WatchedCollection {
  if (!item || item.id == null) return watched;
  const evaluation = evaluateSeriesFromEpisodeTruth(watched, item);
  if (evaluation == null) return watched;
  const key = seriesWatchedKey(item.id);
  const existing = watched[key];

  if (!evaluation.complete) {
    return withoutSeriesWatchedMarker(watched, item.id);
  }

  const validUntil = nextEpisodeValidityBoundary(item);
  if (validUntil != null && validUntil <= now) {
    return withoutSeriesWatchedMarker(watched, item.id);
  }

  const title = item.name || item.title || existing?.name || existing?.title || 'TV Series';
  return {
    ...watched,
    [key]: {
      id: item.id,
      media_type: 'tv',
      name: title,
      title,
      poster_path: item.poster_path ?? existing?.poster_path ?? null,
      backdrop_path: item.backdrop_path ?? existing?.backdrop_path ?? null,
      is_series_summary: true,
      derived_from_episodes: true,
      released_episode_target: evaluation.releasedEpisodeTarget,
      valid_until: validUntil,
      timestamp: now,
    },
  };
}

export function withSeasonWatched(
  watched: WatchedCollection,
  series: any,
  seasonNumber: number,
  episodes: any[],
  now = Date.now(),
): WatchedCollection {
  if (!series || series.id == null || episodes.length === 0) return watched;
  const next = episodes.reduce(
    (current, episode) => withEpisodeWatched(current, series, seasonNumber, episode, now),
    watched,
  );
  return withSeriesWatchedSummary(next, series, now);
}

export function withoutSeasonWatched(
  watched: WatchedCollection,
  seriesId: string | number,
  seasonNumber: number,
  episodes: any[],
): WatchedCollection {
  if (episodes.length === 0) return watched;
  return episodes.reduce(
    (current, episode) => withoutEpisodeWatched(current, seriesId, episode, seasonNumber),
    watched,
  );
}

export type SavedItemWatchState = 'watched' | 'unwatched';

export function isSavedItemFullyWatched(
  watched: WatchedCollection,
  item: any,
) {
  if (!item || item.id == null) return false;
  const mediaType = item.media_type || (item.first_air_date || item.name ? 'tv' : 'movie');
  const directRecord = watched[`${mediaType}_${item.id}`];
  if (mediaType !== 'tv') return Boolean(directRecord);

  const evaluation = evaluateSeriesFromEpisodeTruth(watched, item);
  if (evaluation != null) return evaluation.complete;
  return isDerivedSeriesSummary(directRecord) && isSeriesSummaryCurrent(directRecord);
}

export function savedItemWatchState(
  watched: WatchedCollection,
  item: any,
): SavedItemWatchState {
  return isSavedItemFullyWatched(watched, item) ? 'watched' : 'unwatched';
}
