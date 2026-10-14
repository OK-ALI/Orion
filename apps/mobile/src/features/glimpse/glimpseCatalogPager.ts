import type { TmdbMediaItem, TmdbPaginatedResponse } from '@orion/shared/types';
import type { GlimpseCatalog } from './glimpseModel';

type MediaType = 'movie' | 'tv';
/** Each source retains its own page. A failed source cannot consume a successful source's next page. */
export function createGlimpseCatalogPager(types: MediaType[], request: (type: MediaType, page: number, signal: AbortSignal) => Promise<TmdbPaginatedResponse>,
  compare: (a: TmdbMediaItem, b: TmdbMediaItem) => number): GlimpseCatalog {
  const cursors = new Map<MediaType, { page: number; more: boolean }>();
  let cached: { page: number; value: { items: TmdbMediaItem[]; hasMore: boolean } } | null = null;
  return { async page(page, signal) {
    if (signal.aborted) throw new Error('Glimpse request cancelled');
    // The engine may roll back after a later title fetch is cancelled. Replay that catalog batch.
    if (cached?.page === page) return cached.value;
    const active = types.filter(type => cursors.get(type)?.more !== false);
    const responses = await Promise.allSettled(active.map(type => request(type, cursors.get(type)?.page || page, signal)));
    if (signal.aborted) throw new Error('Glimpse request cancelled');
    if (responses.length && responses.every(response => response.status === 'rejected')) {
      throw (responses[0] as PromiseRejectedResult).reason;
    }
    const items: TmdbMediaItem[] = [];
    responses.forEach((response, index) => {
      const type = active[index], sourcePage = cursors.get(type)?.page || page;
      if (response.status === 'rejected') { cursors.set(type, { page: sourcePage, more: true }); return; }
      cursors.set(type, { page: sourcePage + 1, more: sourcePage < Math.min(500, response.value.total_pages || 0) });
      for (const item of response.value.results || []) {
        if (Number.isSafeInteger(item.id) && item.id > 0) items.push({ ...item, media_type: type });
      }
    });
    const value = { items: items.sort(compare), hasMore: types.some(type => cursors.get(type)?.more !== false) };
    cached = { page, value }; return value;
  } };
}
