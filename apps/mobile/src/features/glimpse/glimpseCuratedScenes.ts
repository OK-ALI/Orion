import type { TmdbMediaItem } from '@orion/shared/types';
import type { TmdbTrailerVideo } from '../trailers/trailerCandidateService';
import type { GlimpseCatalog, GlimpseReel } from './glimpseModel';
import { defaultGlimpseFilters, filterGlimpseReels, type GlimpseFilters } from './glimpseBrowse';

/** Public scene links reviewed 2026-10-12; maintenance evidence is in the Glimpse audit. */
export const GLIMPSE_SCENE_COLLECTION_VERSION = 2;
export const GLIMPSE_SCENE_COLLECTION = [
  { tmdbId: 20413, title: 'Dhamaal', year: '2007', language: 'hi', country: 'IN', genres: [35], scenes: [
    { key: 'hL5idAZle5U', name: 'Short comedy scene · Shemaroo', channel: 'Shemaroo' },
    { key: 'Gk8_EJRJwfg', name: 'Comedy scene with Asrani · Shemaroo Comedy', channel: 'Shemaroo Comedy' },
  ] },
  { tmdbId: 329, title: 'Jurassic Park', year: '1993', language: 'en', country: 'US', genres: [12, 878], scenes: [
    { key: 'E8WaFvwtphY', name: 'Welcome to Jurassic Park · Movieclips', channel: 'Movieclips' },
    { key: '3lZy3teNY84', name: 'Chaos theory · Movieclips', channel: 'Movieclips' },
  ] },
  { tmdbId: 105, title: 'Back to the Future', year: '1985', language: 'en', country: 'US', genres: [12, 35, 878], scenes: [
    { key: 'qW2syroSQTs', name: 'The skateboard chase · Movieclips', channel: 'Movieclips' },
  ] },
  { tmdbId: 280, title: 'Terminator 2: Judgment Day', year: '1991', language: 'en', country: 'US', genres: [28, 53, 878], scenes: [
    { key: 'aH94xJtqj5A', name: 'Hospital escape · JoBlo Movie Clips', channel: 'JoBlo Movie Clips' },
  ] },
  { tmdbId: 396535, title: 'Train to Busan', year: '2016', language: 'ko', country: 'KR', genres: [28, 27, 53, 12], scenes: [
    { key: 'tPO9FyK-wr0', name: 'Go, hurry! · Well Go USA', channel: 'Well Go USA Entertainment' },
    { key: 'IA2hiufg3B0', name: 'Train to Busan scene · Well Go USA', channel: 'Well Go USA Entertainment' },
  ] },
  { tmdbId: 14756, title: 'Ip Man', year: '2008', language: 'cn', country: 'HK', genres: [18, 28, 36], scenes: [
    { key: 'Kv9ygN2B8WU', name: 'Ten black belts · Movieclips', channel: 'Movieclips' },
  ] },
  { tmdbId: 508883, title: 'The Boy and the Heron', year: '2023', language: 'ja', country: 'JP', genres: [16, 14, 18], scenes: [
    { key: 'YU5eVD0J3_A', name: 'Flight of the Warawara · GKIDS', channel: 'GKIDS Films', language: 'en' },
  ] },
] as const;

/** Candidates still receive authoritative title metadata from the existing TMDb interface. */
export function curatedGlimpseVideos(item: TmdbMediaItem): TmdbTrailerVideo[] {
  if (item.media_type !== 'movie') return [];
  const entry = GLIMPSE_SCENE_COLLECTION.find(title => title.tmdbId === item.id);
  return entry ? entry.scenes.map(scene => ({ id: 'curated:' + scene.key, site: 'YouTube', key: scene.key,
    name: scene.name, type: 'Clip', iso_639_1: 'language' in scene ? scene.language : entry.language, official: false })) : [];
}

function curatedTitles(filters: GlimpseFilters, query: string): TmdbMediaItem[] {
  // Rating/artwork come from fetched details. Never invent those values in a seed.
  return GLIMPSE_SCENE_COLLECTION.filter(entry => {
    const seed: GlimpseReel = { schemaVersion: 1, id: '', title: entry.title, clipTitle: '',
      media: { tmdbId: entry.tmdbId, mediaType: 'movie', isAnime: entry.language === 'ja' && (entry.genres as readonly number[]).includes(16), season: null, episode: null },
      video: { provider: 'youtube', key: entry.scenes[0].key, type: 'Clip', language: entry.language, durationSeconds: null },
      artworkPath: null, posterPath: null, year: entry.year,
      catalog: { rating: null, voteCount: null, releaseDate: null, genreIds: [...entry.genres], originCountries: [entry.country], originalLanguage: entry.language } };
    return filterGlimpseReels([seed], { ...defaultGlimpseFilters(), ...filters, rating: '0' }, query).length > 0;
  }).map(entry => ({ id: entry.tmdbId, media_type: 'movie', title: entry.title, original_language: entry.language, poster_path: null, backdrop_path: null }));
}

/** Seed once per context and interleave with catalog titles; replay/overflow stay bounded. */
export function withGlimpseCuratedTitles(catalog: GlimpseCatalog, filters: GlimpseFilters, query: string): GlimpseCatalog {
  const seeds = curatedTitles(filters, query);
  let carried: TmdbMediaItem[] = [], remoteMore = true;
  let cached: { page: number; items: TmdbMediaItem[]; hasMore: boolean } | null = null;
  return { async page(page, signal) {
    if (signal.aborted) throw new Error('Glimpse request cancelled');
    if (cached?.page === page) return cached;
    const remote = remoteMore ? await catalog.page(page, signal) : { items: [], hasMore: false };
    if (signal.aborted) throw new Error('Glimpse request cancelled');
    const items = [...carried, ...remote.items];
    if (page === 1) seeds.forEach((seed, index) => {
      if (items.some(item => item.id === seed.id && item.media_type === 'movie')) return;
      // Search relevance is applied by the screen after metadata resolves.
      items.splice(Math.min(items.length, query.trim() ? index : 4 + index * 5), 0, seed);
    });
    const unique = [...new Map(items.map(item => [item.media_type + ':' + item.id, item])).values()];
    carried = unique.slice(40); remoteMore = remote.hasMore;
    cached = { page, items: unique.slice(0, 40), hasMore: remoteMore || carried.length > 0 };
    return cached;
  } };
}
