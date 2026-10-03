/** Public catalog facts only. Never pass responses, errors, URLs or credentials. */
export const ANIME_IDENTITY_REASONS = [
  'verified', 'invalid-tmdb-id', 'missing-metadata', 'metadata-id-mismatch', 'non-anime',
  'unsupported-media', 'missing-season', 'missing-episode',
  'tmdb-season-lookup-failed', 'season-number-mismatch', 'missing-episode-list',
  'episode-not-released', 'noncontiguous-episodes', 'missing-titles', 'invalid-catalog-year',
  'invalid-season-year', 'missing-episode-count', 'unsupported-numbering',
  'episode-out-of-range', 'no-candidates', 'candidate-title-mismatch', 'candidate-year-mismatch',
  'candidate-format-mismatch', 'ambiguous-base-candidates', 'candidate-season-year-mismatch',
  'candidate-episode-count-mismatch', 'sequel-relation-unresolved', 'season-entry-unresolved',
  'ambiguous-candidates', 'lookup-missing-title', 'lookup-network-failed', 'lookup-http-rejected',
  'lookup-graphql-failed', 'lookup-malformed-response', 'lookup-response-too-large',
  'lookup-incomplete-search', 'lookup-cancelled', 'lookup-timeout',
  'lookup-relation-limit', 'lookup-relation-incomplete', 'selection-failed',
] as const;
export type AnimeIdentityReason = typeof ANIME_IDENTITY_REASONS[number];
export interface AnimeIdentityDiagnostic {
  stage: 'request' | 'catalog' | 'lookup' | 'candidate' | 'decision';
  outcome?: 'accepted' | 'rejected';
  reason?: AnimeIdentityReason;
  tmdbId?: string;
  mediaType?: 'movie' | 'tv';
  variant?: 'sub' | 'dub';
  season?: number; episode?: number; year?: number; seasonYear?: number; episodes?: number;
  anilistId?: number; candidates?: number; responseCharacters?: number; depth?: number;
  query?: string;
  scope?: 'search' | 'relation' | 'base' | 'season';
  format?: string;
  cached?: boolean; titleMatch?: boolean; yearMatch?: boolean; formatMatch?: boolean;
  countMatch?: boolean; dateMatch?: boolean; episodeInRange?: boolean;
}
export type AnimeIdentityDiagnosticSink = (event: AnimeIdentityDiagnostic) => void;
export const normalizeAnimeTitle = (title: string): string => title.normalize('NFKC')
  .toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const describeAnimeLookupTitle = (title: string): string =>
  /[:/@=]|\b(?:bearer|cookie|authorization)\b/i.test(title) ? 'redacted' : normalizeAnimeTitle(title).slice(0, 100);
export function emitAnimeIdentityDiagnostic(sink: AnimeIdentityDiagnosticSink | undefined, event: AnimeIdentityDiagnostic): void {
  // Diagnostics never change catalog verification or playback control flow.
  try { sink?.(event); } catch {}
}
export class AnimeLookupError extends Error {
  constructor(readonly reason: AnimeIdentityReason) { super(reason); this.name = 'AnimeLookupError'; }
}
