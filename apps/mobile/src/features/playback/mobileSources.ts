import {
  PLAYER_SOURCES,
  getNextHealthyNonAsyncSource,
  getSource,
} from '@orion/shared/sources';

export const MOBILE_PLAYER_SOURCES = PLAYER_SOURCES.filter(
  (source) => !source.async && !source.animeOnly,
);

export function getNextMobileContinuitySource(
  currentSourceId: string,
  mediaType: 'movie' | 'tv',
  attemptedSourceIds: string[] = [],
): string | null {
  const attempted = new Set([currentSourceId, ...attemptedSourceIds]);
  for (let index = 0; index < MOBILE_PLAYER_SOURCES.length; index += 1) {
    const candidateId = getNextHealthyNonAsyncSource(currentSourceId, {
      mediaType,
      includeExperimental: true,
      attempted: [...attempted],
    });
    if (!candidateId) return null;
    attempted.add(candidateId);
    const candidate = getSource(candidateId);
    const supportsMedia = mediaType === 'movie' ? candidate.media.movie : candidate.media.tv;
    if (supportsMedia && candidate.resumeStrategy !== 'none') return candidateId;
  }
  return null;
}
