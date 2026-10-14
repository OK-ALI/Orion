import type { GlimpseReel } from './glimpseModel';

/** Match supplied title/clip metadata; never manufacture franchise or spoiler identities. */
export function normalizeGlimpseSearch(value: string) {
  return value.normalize('NFKD').replace(/([a-zA-Z])\p{M}+/gu, '$1').normalize('NFC').toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
export function glimpseTitleRank(titles: readonly string[], query: string) {
  const search = normalizeGlimpseSearch(query);
  if (!search) return 0;
  const terms = search.split(' ');
  return Math.min(...titles.map(title => {
    const value = normalizeGlimpseSearch(title);
    return value === search ? 0 : value.startsWith(search + ' ') ? 1 : value.includes(search) ? 2
      : terms.every(term => value.split(' ').some(word => word.startsWith(term))) ? 3 : 4;
  }), 4);
}
/** Direct exact/prefix title matches lead before a competing title's alternate name. */
export function glimpseSearchRelevance(titles: readonly string[], query: string) {
  const primary = glimpseTitleRank(titles.slice(0, 1), query);
  if (primary <= 1) return primary;
  return Math.min(primary + 2, glimpseTitleRank(titles.slice(1), query) + 2);
}
export function matchesGlimpseQuery(reel: GlimpseReel, query: string) {
  const terms = normalizeGlimpseSearch(query).split(' ').filter(Boolean);
  const words = normalizeGlimpseSearch([reel.title, ...(reel.catalog?.titleAliases || []), reel.clipTitle,
    reel.video.type, reel.year || ''].join(' ')).split(' ');
  return terms.every(term => words.some(word => word.startsWith(term)));
}
