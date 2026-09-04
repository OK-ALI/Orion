export type MobileLibrarySort = 'manual' | 'title' | 'rating' | 'year';

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

export function normalizeMobileLibrarySort(value: unknown): MobileLibrarySort {
  return value === 'title' || value === 'rating' || value === 'year' ? value : 'manual';
}

function itemTitle(item: any): string {
  return String(item?.title || item?.name || '').trim();
}

function itemYear(item: any): number {
  const value = item?.release_date || item?.first_air_date || item?.year || '';
  const parsed = Number.parseInt(String(value).slice(0, 4), 10);
  return Number.isFinite(parsed) ? parsed : 0;
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
        order = (Number(rightItem?.vote_average) || 0) - (Number(leftItem?.vote_average) || 0)
          || titleOrder;
      } else if (sort === 'year') {
        order = itemYear(rightItem) - itemYear(leftItem) || titleOrder;
      }
      return order || left.index - right.index;
    })
    .map(({ item }) => item);
}