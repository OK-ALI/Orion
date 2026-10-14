import { mmkvStorageAdapter } from '../../services/storageAdapter';
import { isAnimeContent, tmdbFetch } from '@orion/shared/api';
import type { TmdbMediaItem, TmdbPaginatedResponse } from '@orion/shared/types';
import { normalizeTrailerCandidates, type TmdbTrailerVideo } from '../trailers/trailerCandidateService';
import { getRegionQueryParams } from '../discover/discoverCatalog';
import { type GlimpseFilters } from './glimpseBrowse';
import { classifyGlimpseSeries, GLIMPSE_SOAP_GENRE, type GlimpseSeriesDetails } from './glimpseSeriesFormat';
import { glimpseReelId, type GlimpseCatalog, type GlimpseReel, type GlimpseVideoSource } from './glimpseModel';

import { createGlimpseCatalogPager } from './glimpseCatalogPager';
import { glimpseSearchRelevance } from './glimpseSearch';
import { curatedGlimpseVideos, withGlimpseCuratedTitles } from './glimpseCuratedScenes';

/** Fresh per-screen pagination consumes the existing catalog request interface. */
export function createGlimpseCatalog(filters: GlimpseFilters, query: string): GlimpseCatalog {
  const search = query.trim().slice(0, 120);
  const filtered = filters.type !== 'all' || filters.genre || filters.region !== 'all' || filters.year || filters.rating !== '0';
  const types: Array<'movie' | 'tv'> = filters.genre ? [filters.genre.type]
    : filters.type === 'movie' ? ['movie'] : filters.type === 'tv' ? ['tv'] : ['movie', 'tv'];
  const { countryParam, languageParam } = getRegionQueryParams(filters.region, filters.subfilter || 'all');
  const catalog = createGlimpseCatalogPager(types, (type, page, signal) => {
    const genre = filters.type === 'anime' ? '&with_genres=16' + (filters.region === 'all' ? '&with_origin_country=JP' : '') : filters.genre ? '&with_genres=' + filters.genre.id : '';
    const year = filters.year ? '&' + (type === 'movie' ? 'primary_release_year' : 'first_air_date_year') + '=' + filters.year : '';
    const url = search ? '/search/' + type + '?query=' + encodeURIComponent(search) + '&include_adult=false&page=' + page
      : !filtered ? '/trending/' + type + '/week?page=' + page
      : '/discover/' + type + '?sort_by=popularity.desc&include_adult=false' + countryParam + languageParam + genre + year
        + (type === 'tv' && filters.region === 'bollywood' ? '&without_genres=' + GLIMPSE_SOAP_GENRE : '')
        + '&vote_average.gte=' + filters.rating + '&page=' + page;
    return tmdbFetch<TmdbPaginatedResponse>(url, { signal });
  }, (a, b) => (search ? glimpseSearchRelevance([a.title || a.name || '', a.original_title || a.original_name || ''], search)
    - glimpseSearchRelevance([b.title || b.name || '', b.original_title || b.original_name || ''], search) : 0)
    || (b.popularity || 0) - (a.popularity || 0));
  return withGlimpseCuratedTitles(catalog, filters, search);
}
/** Compatibility interface; screen-owned contexts use the factory above. */
export const glimpseDiscoveryCatalog: GlimpseCatalog = {
  page: (page, signal) => createGlimpseCatalog({ type: 'all', genre: null, region: 'all', year: '', rating: '0' }, '').page(page, signal),
};

function typePriority(type: string, name: string) {
  const label = type.trim().toLowerCase();
  if (label === 'clip') return 0;
  if (label === 'teaser') return 1;
  if (label === 'promo' || /\b(promo|tv spot)\b/i.test(name)) return 2;
  if (label === 'featurette' || label === 'behind the scenes' || /\b(behind the scenes|making of)\b/i.test(name)) return 3;
  if (label === 'trailer') return 4;
  return 5;
}

export function normalizeGlimpseVideos(item: TmdbMediaItem & GlimpseSeriesDetails, videos: TmdbTrailerVideo[], preferredLanguage = 'en'): GlimpseReel[] {
  if (item.media_type !== 'movie' && item.media_type !== 'tv') return [];
  const media = { tmdbId: Number(item.id), mediaType: item.media_type, isAnime: isAnimeContent(item), season: null, episode: null };
  if (!Number.isSafeInteger(media.tmdbId) || media.tmdbId < 1) return [];
  // Consume only the existing pure normalization interface, never its session or ordering policy.
  return normalizeTrailerCandidates(videos, [], preferredLanguage, item.original_language || preferredLanguage)
    .filter(candidate => candidate.site === 'YouTube')
    .sort((a, b) => typePriority(a.type, a.name) - typePriority(b.type, b.name)
      || Number(b.language === preferredLanguage) - Number(a.language === preferredLanguage)
      || Number(b.official) - Number(a.official) || b.score - a.score || a.id.localeCompare(b.id))
    .map(candidate => ({
      schemaVersion: 1, id: glimpseReelId(media, candidate.providerKey), media,
      title: item.title || item.name || 'Orion media', clipTitle: candidate.name,
      video: { provider: 'youtube', key: candidate.providerKey, type: candidate.type, language: candidate.language, durationSeconds: null, dimensions: null },
      artworkPath: item.backdrop_path || item.poster_path || null, posterPath: item.poster_path || null,
      year: (item.release_date || item.first_air_date || '').slice(0, 4) || null,
      catalog: { rating: typeof item.vote_average === 'number' && Number.isFinite(item.vote_average) && item.vote_average >= 0 && item.vote_average <= 10 ? item.vote_average : null,
        voteCount: typeof item.vote_count === 'number' && Number.isSafeInteger(item.vote_count) && item.vote_count >= 0 ? item.vote_count : null,
        releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(item.release_date || item.first_air_date || '') ? (item.release_date || item.first_air_date)! : null,
        genreIds: (item.genre_ids || []).filter(id => Number.isSafeInteger(id) && id > 0),
        originCountries: (item.origin_country || []).filter(id => /^[A-Z]{2}$/.test(id)),
        originalLanguage: /^[a-z]{2,3}$/.test(item.original_language || '') ? item.original_language! : null,
        ...(item.media_type === 'tv' ? { seriesFormat: classifyGlimpseSeries(item) } : {}),
        titleAliases: [...new Set([item.original_title, item.original_name].filter((title): title is string => typeof title === 'string' && !!title.trim() && title.length <= 160))].slice(0, 4) },
    }));
}

export const tmdbGlimpseVideoSource: GlimpseVideoSource = {
  async candidates(item, signal) {
    if (item.media_type !== 'movie' && item.media_type !== 'tv') return [];
    const path = '/' + item.media_type + '/' + item.id + '/videos';
    const details = await tmdbFetch<TmdbMediaItem & GlimpseSeriesDetails & { genres?: { id: number }[]; production_countries?: { iso_3166_1: string }[]; videos?: { results?: TmdbTrailerVideo[] } }>('/' + item.media_type + '/' + item.id + '?append_to_response=videos', { signal });
    const enriched = { ...item, ...details, id: item.id, media_type: item.media_type,
      genre_ids: details.genres?.map(genre => genre.id) || item.genre_ids,
      origin_country: details.origin_country?.length ? details.origin_country : item.origin_country?.length ? item.origin_country : details.production_countries?.map(country => country.iso_3166_1) || [] };
    const localized = details.videos || { results: [] };
    if (signal.aborted) throw new Error('Glimpse request cancelled');
    const originalLanguage = item.original_language;
    let preferredLanguage = 'en';
    try { preferredLanguage = String(JSON.parse(mmkvStorageAdapter.get('orion_tmdbLang') || '"en-US"')).split('-')[0]; } catch {}
    const original = originalLanguage && originalLanguage !== preferredLanguage
      ? await tmdbFetch<{ results?: TmdbTrailerVideo[] }>(path, { signal, language: originalLanguage }).catch(error => {
        if (signal.aborted) throw error;
        return { results: [] };
      }) : { results: [] };
    return normalizeGlimpseVideos(enriched, [...(localized.results || []), ...(original.results || []), ...curatedGlimpseVideos(enriched)], preferredLanguage);
  },
};
