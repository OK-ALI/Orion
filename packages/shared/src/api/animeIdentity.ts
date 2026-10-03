import { emitAnimeIdentityDiagnostic as emit, normalizeAnimeTitle, type AnimeIdentityDiagnosticSink, type AnimeIdentityReason } from './animeIdentityDiagnostics';

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
  sequelIds?: number[];
}

export type AnimeIdentityResult =
  | { state: 'verified'; tmdbId: string; anilistId: number; episode: number; season: number | null }
  | { state: 'blocked'; reason: 'insufficient-evidence' | 'ambiguous-identity' | 'no-exact-match' | 'unsupported-numbering' };

const exactTitles = (titles: string[]) => new Set(titles.map(normalizeAnimeTitle).filter(Boolean));
const overlaps = (left: string[], right: string[]) => {
  const normalized = exactTitles(left);
  return [...exactTitles(right)].some((title) => normalized.has(title));
};
const positive = (value: number) => Number.isSafeInteger(value) && value > 0;
const validYear = (value: number) => Number.isInteger(value) && value >= 1900 && value <= 2200;
const tvFormat = (entry: AnimeLookupEntry) => ['TV', 'TV_SHORT', 'ONA'].includes(entry.format);
const matchingDate = (left?: string, right?: string) => Boolean(left && right && /^\d{4}-\d{2}-\d{2}$/.test(left)
  && /^\d{4}-\d{2}-\d{2}$/.test(right) && Math.abs(Date.parse(left) - Date.parse(right)) <= 86_400_000);

/** Used only to restrict sequel lookup to the same uniquely verified base. */
export const matchesAnimeBaseEvidence = (catalog: AnimeCatalogEvidence, entry: AnimeLookupEntry): boolean =>
  overlaps(catalog.titles, entry.titles) && entry.year === catalog.year
  && (catalog.mediaType === 'movie' ? entry.format === 'MOVIE' : tvFormat(entry));

/** No fuzzy title ranking, season-index guesses, offsets or first-result fallback. */
export function verifyAnimeIdentity(
  catalog: AnimeCatalogEvidence,
  entries: AnimeLookupEntry[],
  diagnostic?: AnimeIdentityDiagnosticSink,
): AnimeIdentityResult {
  const blocked = (reason: Extract<AnimeIdentityResult, { state: 'blocked' }>['reason'], guard: AnimeIdentityReason): AnimeIdentityResult => {
    emit(diagnostic, { stage: 'decision', outcome: 'rejected', reason: guard });
    return { state: 'blocked', reason };
  };
  if (!/^\d+$/.test(catalog.tmdbId) || !positive(Number(catalog.tmdbId))) return blocked('insufficient-evidence', 'invalid-tmdb-id');
  if (!catalog.titles.length) return blocked('insufficient-evidence', 'missing-titles');
  if (!validYear(catalog.year)) return blocked('insufficient-evidence', 'invalid-catalog-year');
  if (!validYear(catalog.seasonYear)) return blocked('insufficient-evidence', 'invalid-season-year');
  if (!positive(catalog.episodeCount)) return blocked('insufficient-evidence', 'missing-episode-count');
  if (!positive(catalog.episode) || catalog.episode > catalog.episodeCount
    || (catalog.mediaType === 'tv' && (!positive(catalog.season ?? 0)))) return blocked('unsupported-numbering',
      catalog.episode > catalog.episodeCount ? 'episode-out-of-range' : 'unsupported-numbering');
  if (catalog.mediaType === 'movie' && (catalog.episode !== 1 || catalog.episodeCount !== 1 || catalog.season !== null)) {
    return blocked('unsupported-numbering', 'unsupported-numbering');
  }
  const unique = [...new Map(entries.filter((entry) => positive(entry.id)).map((entry) => [entry.id, entry])).values()];
  const candidate = (entry: AnimeLookupEntry, scope: 'base' | 'season') => emit(diagnostic, {
    stage: 'candidate', scope, anilistId: entry.id, format: entry.format, year: entry.year, episodes: entry.episodes,
    titleMatch: overlaps(scope === 'base' ? catalog.titles : [...catalog.titles, ...catalog.seasonTitles], entry.titles),
    yearMatch: entry.year === (scope === 'base' ? catalog.year : catalog.seasonYear),
    formatMatch: catalog.mediaType === 'movie' ? entry.format === 'MOVIE' : tvFormat(entry),
    countMatch: entry.episodes === catalog.episodeCount, dateMatch: matchingDate(catalog.seasonAirDate, entry.releaseDate),
    episodeInRange: positive(entry.episodes) && catalog.episode <= entry.episodes,
  });
  // Only diagnostic ordering/sampling changes: exact relevant evidence first.
  // Verification below still evaluates every returned candidate.
  [...unique.filter((entry) => matchesAnimeBaseEvidence(catalog, entry)),
    ...unique.filter((entry) => !matchesAnimeBaseEvidence(catalog, entry))].slice(0, 12)
    .forEach((entry) => candidate(entry, 'base'));
  if (!unique.length) return blocked('no-exact-match', 'no-candidates');
  const titleMatches = unique.filter((entry) => overlaps(catalog.titles, entry.titles));
  if (!titleMatches.length) return blocked('no-exact-match', 'candidate-title-mismatch');
  const yearMatches = titleMatches.filter((entry) => entry.year === catalog.year);
  if (!yearMatches.length) return blocked('no-exact-match', 'candidate-year-mismatch');
  const bases = unique.filter((entry) => matchesAnimeBaseEvidence(catalog, entry));
  if (bases.length > 1) return blocked('ambiguous-identity', 'ambiguous-base-candidates');
  if (bases.length !== 1) return blocked('no-exact-match', 'candidate-format-mismatch');
  let matches: AnimeLookupEntry[];
  if (catalog.mediaType === 'movie' || catalog.season === 1) {
    matches = bases.filter((entry) => entry.year === catalog.seasonYear && entry.episodes === catalog.episodeCount);
    if (!matches.length) return blocked('no-exact-match', bases[0].year !== catalog.seasonYear
      ? 'candidate-season-year-mismatch' : catalog.episode > bases[0].episodes
        ? 'episode-out-of-range' : 'candidate-episode-count-mismatch');
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
    if (!candidates.length) return blocked('no-exact-match', 'sequel-relation-unresolved');
    matches = candidates.filter((entry) => tvFormat(entry) && entry.year === catalog.seasonYear
      && entry.episodes === catalog.episodeCount && (overlaps([...catalog.titles, ...catalog.seasonTitles], entry.titles)
        || matchingDate(catalog.seasonAirDate, entry.releaseDate)));
    [...matches, ...candidates.filter((entry) => !matches.includes(entry))].slice(0, 12)
      .forEach((entry) => candidate(entry, 'season'));
    if (!matches.length) return blocked('no-exact-match', !candidates.some(tvFormat) ? 'candidate-format-mismatch'
      : !candidates.some((entry) => tvFormat(entry) && entry.year === catalog.seasonYear) ? 'candidate-season-year-mismatch'
        : !candidates.some((entry) => tvFormat(entry) && entry.year === catalog.seasonYear && entry.episodes === catalog.episodeCount)
          ? 'candidate-episode-count-mismatch' : 'season-entry-unresolved');
  }
  if (matches.length > 1) return blocked('ambiguous-identity', 'ambiguous-candidates');
  emit(diagnostic, { stage: 'decision', outcome: 'accepted', reason: 'verified', anilistId: matches[0].id });
  return { state: 'verified', tmdbId: catalog.tmdbId, anilistId: matches[0].id,
    episode: catalog.episode, season: catalog.season };
}
