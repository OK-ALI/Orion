import type { GlimpseReel } from './glimpseModel';
import type { GlimpseSeriesFormat } from './glimpseSeriesFormat';
import { sortMobileLibraryItems, type MobileLibrarySort } from '../library/librarySort';

export interface GlimpseTitleMetadata {
  rating: number | null; voteCount: number | null; releaseDate: string | null;
  genreIds: number[]; originCountries: string[]; originalLanguage: string | null;
  seriesFormat?: GlimpseSeriesFormat;
  titleAliases?: string[];
}
export function normalizeGlimpseTitleMetadata(input: unknown): GlimpseTitleMetadata | undefined {
  if (input === undefined) return undefined; // Existing private Likes remain valid without new optional metadata.
  const value = input as GlimpseTitleMetadata;
  if (!value || (value.titleAliases !== undefined && (!Array.isArray(value.titleAliases) || value.titleAliases.length > 4
      || value.titleAliases.some(title => typeof title !== 'string' || !title.trim() || title.length > 160)))
    || (value.seriesFormat !== undefined && !['seasonal', 'serial', 'unknown'].includes(value.seriesFormat))
    || (value.rating !== null && (!Number.isFinite(value.rating) || value.rating < 0 || value.rating > 10))
    || (value.voteCount !== null && (!Number.isSafeInteger(value.voteCount) || value.voteCount < 0))
    || (value.releaseDate !== null && (typeof value.releaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.releaseDate)))
    || !Array.isArray(value.genreIds) || value.genreIds.length > 64 || value.genreIds.some(id => !Number.isSafeInteger(id) || id < 1)
    || !Array.isArray(value.originCountries) || value.originCountries.length > 32 || value.originCountries.some(id => !/^[A-Z]{2}$/.test(id))
    || (value.originalLanguage !== null && (typeof value.originalLanguage !== 'string' || !/^[a-z]{2,3}$/.test(value.originalLanguage)))) {
    throw new Error('Invalid Glimpse title metadata');
  }
  return { rating: value.rating, voteCount: value.voteCount, releaseDate: value.releaseDate,
    genreIds: [...new Set(value.genreIds)].sort((a, b) => a - b), originCountries: [...new Set(value.originCountries)].sort(), originalLanguage: value.originalLanguage,
    ...(value.seriesFormat !== undefined ? { seriesFormat: value.seriesFormat } : {}),
    ...(value.titleAliases !== undefined ? { titleAliases: [...new Set(value.titleAliases)] } : {}) };
}
export function sortGlimpseReels(reels: readonly GlimpseReel[], sort: MobileLibrarySort) {
  return sortMobileLibraryItems(reels.map(reel => ({ reel, title: reel.title, year: reel.year,
    vote_average: reel.catalog?.rating, vote_count: reel.catalog?.voteCount,
    release_date: reel.media.mediaType === 'movie' ? reel.catalog?.releaseDate : undefined,
    first_air_date: reel.media.mediaType === 'tv' ? reel.catalog?.releaseDate : undefined,
  })), sort).map(item => item.reel);
}