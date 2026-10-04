import type { TrailerCandidateV1 } from '@orion/shared/types';

export interface TrailerSearchMetadata {
  title: string;
  originalTitle?: string | null;
  year?: string | null;
}

export function trailerSearchQuery(metadata: TrailerSearchMetadata): string | null {
  const title = (metadata.title?.trim() || metadata.originalTitle?.trim() || '').replace(/\s+/g, ' ');
  if (!title) return null;
  const year = /^\d{4}$/.test(metadata.year || '') && Number(metadata.year) >= 1888 ? metadata.year : null;
  const includeYear = year && !new RegExp(`\\b${year}\\b`).test(title);
  return `${title}${includeYear ? ` ${year}` : ''} official trailer`;
}

export function exactTrailerUrl(candidate: TrailerCandidateV1): string {
  return candidate.site === 'Vimeo'
    ? `https://vimeo.com/${candidate.providerKey}`
    : `https://www.youtube.com/watch?v=${candidate.providerKey}`;
}

export function trailerExternalTarget(candidate: TrailerCandidateV1 | null, metadata: TrailerSearchMetadata, exhausted: boolean) {
  if (candidate) return { kind: 'video' as const, url: exactTrailerUrl(candidate), candidate };
  const query = exhausted ? trailerSearchQuery(metadata) : null;
  return query ? { kind: 'search' as const, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, candidate: null } : null;
}
