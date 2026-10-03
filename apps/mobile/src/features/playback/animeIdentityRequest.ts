import { AnimeLookupError, isAnimeContent, verifyAnimeIdentity, type AnimeCatalogEvidence,
  type AnimeIdentityDiagnosticSink, type AnimeIdentityReason, type AnimeIdentityResult,
  type lookupAnimeEntries } from '@orion/shared/api';

export const getAnimeCatalogTitles = (detail: any): string[] => [...new Set<string>([
  detail?.name, detail?.original_name, detail?.title, detail?.original_title,
  ...(detail?.alternative_titles?.results || detail?.alternative_titles?.titles || []).map((entry: any) => entry?.title),
].filter((value) => typeof value === 'string' && value.trim().length > 0))];
const yearOf = (date: unknown): number => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? Number(date.slice(0, 4)) : 0;
type Verified = Extract<AnimeIdentityResult, { state: 'verified' }>;
type Result = Verified | { state: 'blocked'; reason: string };

/** The same canonical request/verification path, with explicit rejection guards. */
export async function resolveAnimeTestIdentity(input: {
  id: string; type: 'movie' | 'tv'; season: number | null; episode: number | null;
  detail: any; variant: 'sub' | 'dub'; signal: AbortSignal;
}, dependencies: {
  fetchSeason(path: string, options: { signal: AbortSignal }): Promise<any>;
  lookup: typeof lookupAnimeEntries;
}, diagnostic: AnimeIdentityDiagnosticSink): Promise<Result> {
  const { id, type, season, episode, detail, signal, variant } = input;
  const emit = (event: Parameters<AnimeIdentityDiagnosticSink>[0]) => { try { diagnostic(event); } catch {} };
  const reject = (reason: AnimeIdentityReason): Result => {
    emit({ stage: 'decision', outcome: 'rejected', reason });
    return { state: 'blocked', reason };
  };
  emit({ stage: 'request', tmdbId: id, mediaType: type, season: season ?? 0,
    episode: episode ?? 0, year: yearOf(detail?.first_air_date), variant });
  if (signal.aborted) return reject('lookup-cancelled');
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return reject('invalid-tmdb-id');
  if (!detail) return reject('missing-metadata');
  if (String(detail.id) !== id) return reject('metadata-id-mismatch');
  if (!isAnimeContent(detail)) return reject('non-anime');
  if (type !== 'tv') return reject('unsupported-media');
  if (!Number.isSafeInteger(season) || (season ?? 0) < 1) return reject('missing-season');
  if (!Number.isSafeInteger(episode) || (episode ?? 0) < 1) return reject('missing-episode');
  let selectedSeason: any;
  try { selectedSeason = await dependencies.fetchSeason(`/tv/${id}/season/${season}`, { signal }); }
  catch { return reject(signal.aborted ? 'lookup-cancelled' : 'tmdb-season-lookup-failed'); }
  if (signal.aborted) return reject('lookup-cancelled');
  if (selectedSeason?.season_number !== season) return reject('season-number-mismatch');
  const episodes = selectedSeason?.episodes;
  if (!Array.isArray(episodes) || !episodes.length) return reject('missing-episode-list');
  if (episodes.some((entry: any, index: number) => entry?.episode_number !== index + 1)) return reject('noncontiguous-episodes');
  const requested = episodes.find((entry: any) => entry.episode_number === episode);
  if (!requested) return reject('episode-out-of-range');
  if (!requested.air_date || !(Date.parse(requested.air_date) <= Date.now())) return reject('episode-not-released');
  const catalog: AnimeCatalogEvidence = { tmdbId: id, mediaType: type, titles: getAnimeCatalogTitles(detail),
    year: yearOf(detail.first_air_date), season, episode: episode!, episodeCount: episodes.length,
    seasonYear: yearOf(selectedSeason.air_date), seasonAirDate: selectedSeason.air_date,
    seasonTitles: getAnimeCatalogTitles({ name: selectedSeason.name }).filter((title) => !/^season\s*\d+$/i.test(title)),
  };
  emit({ stage: 'catalog', tmdbId: id, year: catalog.year, seasonYear: catalog.seasonYear, episodes: catalog.episodeCount });
  try {
    const entries = await dependencies.lookup(catalog.titles, signal, { catalog, diagnostic });
    if (signal.aborted) return reject('lookup-cancelled');
    return verifyAnimeIdentity(catalog, entries, diagnostic);
  } catch (error) { return reject(signal.aborted ? 'lookup-cancelled'
    : error instanceof AnimeLookupError ? error.reason : 'lookup-malformed-response'); }
}
