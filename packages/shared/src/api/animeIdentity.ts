/** Provider lookup evidence only. TMDb remains the catalog/history identity. */
export interface AnimeCatalogEvidence {
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  titles: string[];
  year: number;
  season: number | null;
  episode: number;
  episodeCount: number;
  seasonYear: number;
  seasonTitles: string[];
  seasonAirDate?: string;
}

export interface AnimeLookupEntry {
  id: number;
  titles: string[];
  format: string;
  year: number;
  episodes: number;
  sequels: AnimeLookupEntry[];
  releaseDate?: string;
}

export type AnimeIdentityResult =
  | { state: 'verified'; tmdbId: string; anilistId: number; episode: number; season: number | null }
  | { state: 'blocked'; reason: 'insufficient-evidence' | 'ambiguous-identity' | 'no-exact-match' | 'unsupported-numbering' };

const exactTitles = (titles: string[]) => new Set(titles.map((title) => title.normalize('NFKC')
  .toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()).filter(Boolean));
const overlaps = (left: string[], right: string[]) => {
  const normalized = exactTitles(left);
  return [...exactTitles(right)].some((title) => normalized.has(title));
};
const positive = (value: number) => Number.isSafeInteger(value) && value > 0;
const validYear = (value: number) => Number.isInteger(value) && value >= 1900 && value <= 2200;
const tvFormat = (entry: AnimeLookupEntry) => ['TV', 'TV_SHORT', 'ONA'].includes(entry.format);
const matchingDate = (left?: string, right?: string) => Boolean(left && right && /^\d{4}-\d{2}-\d{2}$/.test(left)
  && /^\d{4}-\d{2}-\d{2}$/.test(right) && Math.abs(Date.parse(left) - Date.parse(right)) <= 86_400_000);

/** No fuzzy title ranking, season-index guesses, offsets or first-result fallback. */
export function verifyAnimeIdentity(
  catalog: AnimeCatalogEvidence,
  entries: AnimeLookupEntry[],
): AnimeIdentityResult {
  const blocked = (reason: Extract<AnimeIdentityResult, { state: 'blocked' }>['reason']): AnimeIdentityResult => ({ state: 'blocked', reason });
  if (!/^\d+$/.test(catalog.tmdbId) || !positive(Number(catalog.tmdbId)) || !catalog.titles.length
    || !validYear(catalog.year) || !validYear(catalog.seasonYear) || !positive(catalog.episodeCount)) {
    return blocked('insufficient-evidence');
  }
  if (!positive(catalog.episode) || catalog.episode > catalog.episodeCount
    || (catalog.mediaType === 'tv' && (!positive(catalog.season ?? 0)))) return blocked('unsupported-numbering');
  if (catalog.mediaType === 'movie' && (catalog.episode !== 1 || catalog.episodeCount !== 1 || catalog.season !== null)) {
    return blocked('unsupported-numbering');
  }
  const unique = [...new Map(entries.filter((entry) => positive(entry.id)).map((entry) => [entry.id, entry])).values()];
  const bases = unique.filter((entry) => overlaps(catalog.titles, entry.titles) && entry.year === catalog.year
    && (catalog.mediaType === 'movie' ? entry.format === 'MOVIE' : tvFormat(entry)));
  if (bases.length > 1) return blocked('ambiguous-identity');
  if (bases.length !== 1) return blocked('no-exact-match');
  let matches: AnimeLookupEntry[];
  if (catalog.mediaType === 'movie' || catalog.season === 1) {
    matches = bases.filter((entry) => entry.year === catalog.seasonYear && entry.episodes === catalog.episodeCount);
  } else {
    // A sequel must be linked to the verified original entry, independently
    // match the selected TMDb season's year/count and exact title alias or full
    // premiere date. Never infer a relation index from a TMDb season number.
    const candidates: AnimeLookupEntry[] = [];
    const seen = new Set<number>([bases[0].id]);
    const visit = (entry: AnimeLookupEntry, depth: number) => {
      if (depth > 8 || seen.has(entry.id)) return;
      seen.add(entry.id);
      candidates.push(entry);
      entry.sequels.forEach((next) => visit(next, depth + 1));
    };
    bases[0].sequels.forEach((entry) => visit(entry, 1));
    matches = candidates.filter((entry) => tvFormat(entry) && entry.year === catalog.seasonYear
      && entry.episodes === catalog.episodeCount && (overlaps([...catalog.titles, ...catalog.seasonTitles], entry.titles)
        || matchingDate(catalog.seasonAirDate, entry.releaseDate)));
  }
  if (matches.length > 1) return blocked('ambiguous-identity');
  if (matches.length !== 1) return blocked('no-exact-match');
  return { state: 'verified', tmdbId: catalog.tmdbId, anilistId: matches[0].id,
    episode: catalog.episode, season: catalog.season };
}
