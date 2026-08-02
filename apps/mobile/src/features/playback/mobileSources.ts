import {
  PLAYER_SOURCES,
  getNextHealthyNonAsyncSource,
  getSource,
} from '@orion/shared/sources';

export const MOBILE_PLAYER_SOURCES = PLAYER_SOURCES.filter(
  (source) => !source.async && !source.animeOnly,
);

/**
 * VidKing remains a selectable playback source, but its embedded player does
 * not currently apply a carried timestamp without a startup audio/time glitch.
 * Do not advertise it as a continuity target until that provider behavior is
 * verified again on a physical Android device.
 */
export const MOBILE_CONTINUITY_DEFERRED_SOURCE_IDS = new Set(['vidking']);

export function mobileSourceSupportsContinuity(sourceId: string): boolean {
  if (MOBILE_CONTINUITY_DEFERRED_SOURCE_IDS.has(sourceId)) return false;
  return getSource(sourceId).resumeStrategy !== 'none';
}

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
    if (supportsMedia && mobileSourceSupportsContinuity(candidateId)) return candidateId;
  }
  return null;
}
