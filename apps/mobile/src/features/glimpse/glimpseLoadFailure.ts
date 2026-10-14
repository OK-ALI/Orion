export type GlimpseLoadFailure = { kind: 'timeout' | 'network' | 'catalog' | 'source' | 'rateLimit' | 'authorization'; retryable: boolean };
export function classifyGlimpseLoadFailure(error: unknown): GlimpseLoadFailure {
  const message = error instanceof Error ? error.message + (error.cause instanceof Error ? ' ' + error.cause.message : '') : '';
  if (/TMDB (401|403)/.test(message)) return { kind: 'authorization', retryable: false };
  if (/TMDB 429/.test(message)) return { kind: 'rateLimit', retryable: true };
  if (/unreachable|network|offline/i.test(message)) return { kind: 'network', retryable: true };
  if (/sources unavailable/.test(message)) return { kind: 'source', retryable: true };
  return { kind: 'catalog', retryable: true };
}
export function glimpseLoadFailureCopy(failure?: GlimpseLoadFailure | null) {
  if (failure?.kind === 'timeout') return 'Loading more clips took too long. Try again.';
  if (failure?.kind === 'rateLimit') return 'Clips are taking a little longer. Please retry shortly.';
  if (failure?.kind === 'authorization') return 'Clips are temporarily unavailable. Please try again later.';
  if (failure?.kind === 'source') return 'Clips could not load. Try again.';
  return 'More clips could not load. Try again.';
}
