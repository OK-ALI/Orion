import type { GlimpseReel } from './glimpseModel';
import { glimpseSearchRelevance, matchesGlimpseQuery } from './glimpseSearch';
import { GLIMPSE_SOAP_GENRE } from './glimpseSeriesFormat';
import { MOVIE_GENRES, TV_GENRES, REGION_PRESETS, SUBFILTER_PRESETS, MEDIA_FILTERS, RATING_OPTIONS, YEAR_OPTIONS } from '../discover/discoverCatalog';
import type { FilterOption } from '../discover/DiscoverFilterModal';

export interface GlimpseFilters {
  type: 'all' | 'movie' | 'tv' | 'anime'; genre: { type: 'movie' | 'tv'; id: number } | null;
  region: string; subfilter?: string; year: string; rating: string;
}
export type GlimpseFilterCategory = 'type' | 'movieGenre' | 'tvGenre' | 'region' | 'subfilter' | 'year' | 'rating';
export const defaultGlimpseFilters = (): GlimpseFilters => ({ type: 'all', genre: null, region: 'all', subfilter: 'all', year: '', rating: '0' });
export const GLIMPSE_FILTER_CATEGORIES: ReadonlyArray<{ id: GlimpseFilterCategory; label: string }> = [
  { id: 'type', label: 'Media type' }, { id: 'movieGenre', label: 'Movie genre' }, { id: 'tvGenre', label: 'Series genre' },
  { id: 'region', label: 'Region' }, { id: 'subfilter', label: 'Country / language' }, { id: 'year', label: 'Year' }, { id: 'rating', label: 'Rating' },
];
export function glimpseFilterOptions(category: GlimpseFilterCategory, filters: GlimpseFilters = defaultGlimpseFilters()): FilterOption[] {
  if (category === 'subfilter') return (SUBFILTER_PRESETS[filters.region as keyof typeof SUBFILTER_PRESETS] || []).map(value => ({ id: value.id, label: value.name }));
  if (category === 'type') return MEDIA_FILTERS.filter(value => value.id !== 'person').map(value => ({ id: value.id, label: value.name }));
  if (category === 'movieGenre' || category === 'tvGenre') return [{ id: '', label: 'All genres' },
    ...(category === 'movieGenre' ? MOVIE_GENRES : TV_GENRES).map(value => ({ id: String(value.id), label: value.name }))];
  if (category === 'region') return Object.entries(REGION_PRESETS).map(([id, value]) => ({ id, label: value.name }));
  if (category === 'year') return YEAR_OPTIONS.map(value => ({ id: value, label: value || 'All years' }));
  return RATING_OPTIONS.map(value => ({ ...value }));
}
export function selectedGlimpseFilter(filters: GlimpseFilters, category: GlimpseFilterCategory) {
  if (category === 'movieGenre' || category === 'tvGenre') return filters.genre?.type === (category === 'movieGenre' ? 'movie' : 'tv') ? String(filters.genre.id) : '';
  return category === 'subfilter' ? filters.subfilter || 'all' : filters[category];
}
export function updateGlimpseFilter(filters: GlimpseFilters, category: GlimpseFilterCategory, value: string): GlimpseFilters {
  if (!glimpseFilterOptions(category, filters).some(option => option.id === value)) return filters;
  if (category === 'type' && (value === 'movie' || value === 'tv') && filters.genre && filters.genre.type !== value) return { ...filters, type: value, genre: null };
  if (category === 'movieGenre' || category === 'tvGenre') return { ...filters, type: value && filters.type !== 'anime' ? category === 'movieGenre' ? 'movie' : 'tv' : filters.type, genre: value ? { type: category === 'movieGenre' ? 'movie' : 'tv', id: Number(value) } : null };
  return { ...filters, [category]: value, ...(category === 'region' ? { subfilter: 'all' } : {}) };
}
export function filterGlimpseReels(reels: readonly GlimpseReel[], filters: GlimpseFilters, query: string) {
  const sub = (SUBFILTER_PRESETS[filters.region as keyof typeof SUBFILTER_PRESETS] || []).find(value => value.id === (filters.subfilter || 'all'));
  const countries = (sub?.countries || REGION_PRESETS[filters.region as keyof typeof REGION_PRESETS]?.countries || '').split('|').filter(Boolean);
  const language = sub && 'language' in sub ? sub.language : null;
  return reels.filter(reel => {
    if (filters.region === 'bollywood' && reel.media.mediaType === 'tv'
      && (reel.catalog?.seriesFormat === 'serial' || reel.catalog?.genreIds.includes(GLIMPSE_SOAP_GENRE))) return false;
    if (filters.type === 'anime' ? !reel.media.isAnime : filters.type !== 'all' && reel.media.mediaType !== filters.type) return false;
    if (filters.genre && (reel.media.mediaType !== filters.genre.type || !reel.catalog?.genreIds.includes(filters.genre.id))) return false;
    if (countries.length && !reel.catalog?.originCountries.some(country => countries.includes(country))) return false;
    if (language && reel.catalog?.originalLanguage !== language) return false;
    if (filters.year && reel.year !== filters.year) return false;
    if (Number(filters.rating) > 0 && (reel.catalog?.rating == null || reel.catalog.rating < Number(filters.rating))) return false;
    return matchesGlimpseQuery(reel, query);
  });
}
/** Strongest matches lead; explicit Library sorting breaks ties within each relevance level. */
export function rankGlimpseSearch(reels: readonly GlimpseReel[], query: string) {
  if (!query.trim()) return [...reels];
  const rank = (reel: GlimpseReel) => glimpseSearchRelevance([reel.title, ...(reel.catalog?.titleAliases || [])], query);
  return [...reels].sort((a, b) => rank(a) - rank(b));
}
