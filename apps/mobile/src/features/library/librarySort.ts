export type MobileLibrarySort = 'manual' | 'title' | 'rating' | 'year';
export type MobileLibraryMediaFilter = 'all' | 'movie' | 'tv';

export const MOBILE_LIBRARY_SORT_KEY = 'orion.mobile.library.sort.v1';

export const MOBILE_LIBRARY_SORT_OPTIONS: ReadonlyArray<{
  id: MobileLibrarySort;
  label: string;
}> = [
  { id: 'manual', label: 'Custom order' },
  { id: 'title', label: 'A–Z' },
  { id: 'rating', label: 'Top rated' },
  { id: 'year', label: 'Newest first' },
];

export const MOBILE_LIBRARY_SORT_SHORT_LABELS: Readonly<Record<MobileLibrarySort, string>> = {
  manual: 'Custom',
  title: 'A–Z',
  rating: 'Rating',
  year: 'Newest',
};

export const MOBILE_LIBRARY_MEDIA_FILTERS: ReadonlyArray<{
  id: Exclude<MobileLibraryMediaFilter, 'all'>;
  label: string;
}> = [
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'TV & Anime' },
];

export function normalizeMobileLibrarySort(value: unknown): MobileLibrarySort {
  return value === 'title' || value === 'rating' || value === 'year' ? value : 'manual';
}

function itemTitle(item: any): string {
  return String(item?.title || item?.name || '').trim();
}

function itemMediaType(item: any): 'movie' | 'tv' | null {
  if (item?.media_type === 'movie' || item?.media_type === 'tv') return item.media_type;
  if (typeof item?.first_air_date === 'string' || typeof item?.name === 'string') return 'tv';
  if (typeof item?.release_date === 'string' || typeof item?.title === 'string') return 'movie';
  return null;
}

function validFullDate(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return year * 10000 + month * 100 + day;
}

function validYear(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  if (!/^\d{4}$/.test(normalized)) return null;
  const year = Number(normalized);
  return year > 0 ? year : null;
}

function itemDatePrecision(item: any): { year: number | null; fullDate: number | null } {
  const fullDate = validFullDate(item?.release_date) ?? validFullDate(item?.first_air_date);
  if (fullDate != null) return { year: Math.floor(fullDate / 10000), fullDate };
  return { year: validYear(item?.year), fullDate: null };
}

function validRating(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10
    ? value
    : null;
}

function validVoteCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export function countMobileLibraryMediaTypes(items: readonly any[]): { movie: number; tv: number } {
  return items.reduce((counts, item) => {
    const mediaType = itemMediaType(item);
    if (mediaType) counts[mediaType] += 1;
    return counts;
  }, { movie: 0, tv: 0 });
}

export function filterMobileLibraryItems<T>(
  items: readonly T[],
  filter: MobileLibraryMediaFilter,
): T[] {
  if (filter === 'all') return [...items];
  return items.filter((item) => itemMediaType(item) === filter);
}

export function sortMobileLibraryItems<T>(
  items: readonly T[],
  sort: MobileLibrarySort,
): T[] {
  if (sort === 'manual') return [...items];
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftItem = left.item as any;
      const rightItem = right.item as any;
      const titleOrder = itemTitle(leftItem).localeCompare(itemTitle(rightItem), undefined, {
        sensitivity: 'base',
      });
      let order = titleOrder;
      if (sort === 'rating') {
        const leftRating = validRating(leftItem?.vote_average);
        const rightRating = validRating(rightItem?.vote_average);
        if (leftRating == null || rightRating == null) {
          order = leftRating == null && rightRating == null ? titleOrder : leftRating == null ? 1 : -1;
        } else {
          const leftVotes = validVoteCount(leftItem?.vote_count);
          const rightVotes = validVoteCount(rightItem?.vote_count);
          order = rightRating - leftRating
            || (leftVotes != null && rightVotes != null ? rightVotes - leftVotes : 0)
            || titleOrder;
        }
      } else if (sort === 'year') {
        const leftDate = itemDatePrecision(leftItem);
        const rightDate = itemDatePrecision(rightItem);
        if (leftDate.year == null || rightDate.year == null) {
          order = leftDate.year == null && rightDate.year == null ? titleOrder : leftDate.year == null ? 1 : -1;
        } else {
          order = rightDate.year - leftDate.year
            || (leftDate.fullDate != null && rightDate.fullDate != null
              ? rightDate.fullDate - leftDate.fullDate
              : leftDate.fullDate == null && rightDate.fullDate == null ? 0 : leftDate.fullDate == null ? 1 : -1)
            || titleOrder;
        }
      }
      return order || left.index - right.index;
    })
    .map(({ item }) => item);
}