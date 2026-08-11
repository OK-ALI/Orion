import {
  DEFAULT_CINEMA_SOURCE_ID,
  PLAYER_SOURCES,
  getSource,
} from '@orion/shared/sources';
import { getMobileSourceHealth, getMobileSourceHealthV2 } from '../../services/sourceHealth';

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

export function getPreferredMobileResumeSource(
  sourceId: string | null | undefined,
  mediaType: 'movie' | 'tv',
): string {
  if (!sourceId || !mobileSourceSupportsContinuity(sourceId)) return DEFAULT_CINEMA_SOURCE_ID;
  const source = MOBILE_PLAYER_SOURCES.find((entry) => entry.id === sourceId);
  const supportsMedia = mediaType === 'movie' ? source?.media.movie : source?.media.tv;
  if (!source || !supportsMedia) return DEFAULT_CINEMA_SOURCE_ID;
  const health = getMobileSourceHealth(sourceId, mediaType);
  if (health?.state === 'failed' && health.cooldownUntil > Date.now()) return DEFAULT_CINEMA_SOURCE_ID;
  return sourceId;
}

export function getNextMobileContinuitySource(
  currentSourceId: string,
  mediaType: 'movie' | 'tv',
  attemptedSourceIds: string[] = [],
): string | null {
  const attempted = new Set([currentSourceId, ...attemptedSourceIds]);
  const now = Date.now();
  const stateScore: Record<string, number> = {
    ready: 0,
    slow: 1,
    limited: 2,
    unknown: 3,
    failed: 9,
  };
  const releaseScore: Record<string, number> = { primary: 0, candidate: 1, experimental: 2 };
  const eligible = MOBILE_PLAYER_SOURCES.filter((candidate) => {
    const candidateId = candidate.id;
    const supportsMedia = mediaType === 'movie' ? candidate.media.movie : candidate.media.tv;
    const health = getMobileSourceHealthV2(candidateId, mediaType);
    return supportsMedia
      && mobileSourceSupportsContinuity(candidateId)
      && !attempted.has(candidateId)
      && !(health?.cooldownUntil && health.cooldownUntil > now);
  });
  if (!eligible.length) return null;
  return [...eligible].sort((a, b) => {
    const aHealth = getMobileSourceHealthV2(a.id, mediaType);
    const bHealth = getMobileSourceHealthV2(b.id, mediaType);
    const aScore = stateScore[aHealth?.state || 'unknown'] ?? 3;
    const bScore = stateScore[bHealth?.state || 'unknown'] ?? 3;
    if (aScore !== bScore) return aScore - bScore;
    const aRatio = aHealth?.successRatio ?? 0;
    const bRatio = bHealth?.successRatio ?? 0;
    if (aRatio !== bRatio) return bRatio - aRatio;
    const aRelease = releaseScore[a.releaseStatus] ?? 3;
    const bRelease = releaseScore[b.releaseStatus] ?? 3;
    if (aRelease !== bRelease) return aRelease - bRelease;
    const aStartup = aHealth?.startupMs ?? Number.MAX_SAFE_INTEGER;
    const bStartup = bHealth?.startupMs ?? Number.MAX_SAFE_INTEGER;
    return aStartup - bStartup;
  })[0].id;
}
