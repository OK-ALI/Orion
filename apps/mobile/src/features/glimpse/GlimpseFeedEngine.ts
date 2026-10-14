import type { TmdbMediaItem } from '@orion/shared/types';
import type { GlimpseCatalog, GlimpseReel, GlimpseVideoSource } from './glimpseModel';

export interface GlimpseFeedSnapshot { reels: GlimpseReel[]; exhausted: boolean; failedTitles: number; addedCount: number }
const MAX_REELS = 48;
const MAX_SEEN = 512;
type TitleCursor = { item: TmdbMediaItem; delivered: Set<string> };

/** Screen-owned and transactional. Title search streams associated clips through a bounded window. */
export class GlimpseFeedEngine {
  private reels: GlimpseReel[] = [];
  private titles: TmdbMediaItem[] = [];
  private nextPage = 1;
  private hasMore = true;
  private seen = new Set<string>();
  private seenVideos = new Set<string>();
  private pending = false;
  private titleCursor: TitleCursor | null = null;
  constructor(private catalog: GlimpseCatalog, private source: GlimpseVideoSource, restoredReel: GlimpseReel | null = null,
    private allAssociatedClips = false) {
    if (restoredReel) { this.reels = [restoredReel]; this.seen.add(restoredReel.media.mediaType + ':' + restoredReel.media.tmdbId); this.seenVideos.add(restoredReel.video.key); }
  }

  snapshot(): GlimpseFeedSnapshot {
    return { reels: [...this.reels], exhausted: !this.hasMore && this.titles.length === 0 && !this.titleCursor, failedTitles: 0, addedCount: 0 };
  }

  async extend(signal: AbortSignal, titleBudget: number, protectedId: string | null | (() => string | null) = null, firstViable = false): Promise<GlimpseFeedSnapshot> {
    if (this.pending) return this.snapshot();
    this.pending = true;
    const assertCurrent = () => { if (signal.aborted) throw new Error('Glimpse request cancelled'); };
    try {
      assertCurrent();
      let titles = [...this.titles], nextPage = this.nextPage, hasMore = this.hasMore;
      let cursor = this.titleCursor && { item: this.titleCursor.item, delivered: new Set(this.titleCursor.delivered) };
      const seen = new Set(this.seen), seenVideos = new Set(this.seenVideos), additions: GlimpseReel[] = [];
      const delivered = new Set(this.reels.map(reel => reel.id));
      let failedTitles = 0, requestedTitles = 0;
      let sourceError: unknown;
      const budget = Math.max(1, Math.min(8, Math.floor(titleBudget) || 1));
      // At most one catalog page, eight title requests and eight new reels per extension.
      if (!cursor && titles.length === 0 && hasMore) {
        const page = await this.catalog.page(nextPage, signal);
        assertCurrent(); titles = page.items.slice(0, 40); nextPage++; hasMore = page.hasMore;
      }
      for (let inspected = 0; inspected < budget && additions.length < budget; inspected++) {
        const item = cursor?.item || titles.shift();
        if (!item) break;
        assertCurrent();
        const titleKey = item.media_type + ':' + item.id;
        if (!cursor && seen.has(titleKey)) continue;
        const titleDelivered = cursor?.delivered || new Set<string>();
        let candidates: GlimpseReel[];
        try { requestedTitles++; candidates = await this.source.candidates(item, signal); }
        catch (error) { assertCurrent(); sourceError ||= error; failedTitles++; seen.add(titleKey); cursor = null; continue; }
        assertCurrent();
        const batchVideos = new Set<string>();
        const eligible = candidates.filter(candidate => {
          if (titleDelivered.has(candidate.id) || delivered.has(candidate.id) || seenVideos.has(candidate.video.key) || batchVideos.has(candidate.video.key)) return false;
          // Also suppress repeated IDs in a single source response.
          delivered.add(candidate.id); batchVideos.add(candidate.video.key); return true;
        });
        const selected = eligible.slice(0, this.allAssociatedClips ? budget - additions.length : 1);
        additions.push(...selected); selected.forEach(candidate => { titleDelivered.add(candidate.id); seenVideos.add(candidate.video.key); });
        if (this.allAssociatedClips && selected.length < eligible.length) {
          cursor = { item, delivered: titleDelivered }; break;
        }
        cursor = null; seen.add(titleKey);
        if (firstViable && additions.length > 0) break;
      }
      assertCurrent();
      if (requestedTitles > 0 && failedTitles === requestedTitles) throw new Error('Glimpse sources unavailable', { cause: sourceError });
      let reels = [...this.reels, ...additions];
      const currentProtectedId = typeof protectedId === 'function' ? protectedId() : protectedId;
      let excess = Math.max(0, reels.length - MAX_REELS);
      reels = reels.filter(reel => {
        if (excess > 0 && this.reels.some(old => old.id === reel.id) && reel.id !== currentProtectedId) { excess--; return false; }
        return true;
      });
      const addedCount = reels.filter(reel => !this.reels.some(existing => existing.id === reel.id)).length;
      this.reels = reels; this.titles = titles; this.nextPage = nextPage; this.hasMore = hasMore;
      this.titleCursor = cursor; this.seen = new Set([...seen].slice(-MAX_SEEN));
      this.seenVideos = new Set([...seenVideos].slice(-MAX_SEEN));
      return { reels: [...reels], exhausted: !hasMore && titles.length === 0 && !cursor, failedTitles, addedCount };
    } finally { this.pending = false; }
  }
}