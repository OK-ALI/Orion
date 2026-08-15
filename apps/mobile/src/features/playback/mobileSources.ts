import {
  DEFAULT_CINEMA_SOURCE_ID,
  PLAYER_SOURCES,
  getSource,
} from '@orion/shared/sources';
import { getMobileSourceHealth, getMobileSourceHealthV2 } from '../../services/sourceHealth';

/**
 * Mobile-only quarantine. AutoEmbed remains in the shared registry for future
 * revalidation, but is not selectable on Mobile after repeated physical tests
 * reproduced an external-browser advertising escape.
 */
export const MOBILE_QUARANTINED_SOURCE_IDS: ReadonlySet<string> = new Set(['autoembed']);

export const MOBILE_PLAYER_SOURCES = PLAYER_SOURCES.filter(
  (source) => !source.async
    && !source.animeOnly
    && !MOBILE_QUARANTINED_SOURCE_IDS.has(source.id),
);

export type MobileContinuityMode =
  | 'seamless'
  | 'outgoing-only'
  | 'resume-unverified'
  | 'limited-resume'
  | 'unpredictable'
  | 'start-over-only';

export interface MobileSourceContinuityCapability {
  mode: MobileContinuityMode;
  label: string;
  shortLabel: string;
  description: string;
  canTrackProgress: boolean;
  canTransferOut: boolean;
  canReceivePosition: boolean;
  automaticTarget: boolean;
}

export interface MobileSourceSafetyNotice {
  label: string;
  shortLabel: string;
  description: string;
  selectionMessage: string;
  requiresSelectionConfirmation: boolean;
}

const SAFETY_NOTICES: Readonly<Record<string, MobileSourceSafetyNotice>> = Object.freeze({
  vidsrc: Object.freeze({
    label: 'External browser ads observed',
    shortLabel: 'External Ads',
    description: 'VidSrc currently plays, but an interaction may open advertising in your external browser. Orion Shield cannot fully contain this provider behavior.',
    selectionMessage: 'VidSrc currently plays, but an interaction may open advertising outside Orion in your external browser. Orion Shield cannot fully contain this provider behavior. Do you want to continue?',
    requiresSelectionConfirmation: true,
  }),
});

export function getMobileSourceSafetyNotice(sourceId: string): MobileSourceSafetyNotice | null {
  return SAFETY_NOTICES[sourceId] || null;
}

const CAPABILITIES: Readonly<Record<string, MobileSourceContinuityCapability>> = Object.freeze({
  videasy: Object.freeze({
    mode: 'seamless',
    label: 'Seamless Resume',
    shortLabel: 'Seamless Resume',
    description: 'Your place is saved here, and you can continue smoothly when switching to or from this source.',
    canTrackProgress: true,
    canTransferOut: true,
    canReceivePosition: true,
    automaticTarget: true,
  }),
  vidlink: Object.freeze({
    mode: 'seamless',
    label: 'Seamless Resume',
    shortLabel: 'Seamless Resume',
    description: 'Your place is saved here, and you can continue smoothly when switching to or from this source.',
    canTrackProgress: true,
    canTransferOut: true,
    canReceivePosition: true,
    automaticTarget: true,
  }),
  vixsrc: Object.freeze({
    mode: 'seamless',
    label: 'Seamless Resume',
    shortLabel: 'Seamless Resume',
    description: 'Your place is saved here, and you can continue smoothly when switching to or from this source.',
    canTrackProgress: true,
    canTransferOut: true,
    canReceivePosition: true,
    automaticTarget: true,
  }),
  vidsrc: Object.freeze({
    mode: 'outgoing-only',
    label: 'Tracks Progress',
    shortLabel: 'Tracks Progress',
    description: 'Orion saves where you stop here. You can continue from that point on another compatible source, but this source starts from the beginning when you switch to it.',
    canTrackProgress: true,
    canTransferOut: true,
    canReceivePosition: false,
    automaticTarget: false,
  }),
  vsembed: Object.freeze({
    mode: 'outgoing-only',
    label: 'Tracks Progress',
    shortLabel: 'Tracks Progress',
    description: 'Orion saves where you stop here. You can continue from that point on another compatible source, but this source starts from the beginning when you switch to it.',
    canTrackProgress: true,
    canTransferOut: true,
    canReceivePosition: false,
    automaticTarget: false,
  }),
  vidking: Object.freeze({
    mode: 'limited-resume',
    label: 'Limited Resume',
    shortLabel: 'Limited Resume',
    description: 'VidKing can usually continue near your saved place, but it may briefly jump while loading. Starting over may still use VidKing\'s own saved place.',
    canTrackProgress: true,
    canTransferOut: true,
    canReceivePosition: true,
    automaticTarget: false,
  }),
  '111movies': Object.freeze({
    mode: 'seamless',
    label: 'Seamless Resume',
    shortLabel: 'Seamless Resume',
    description: 'Your place is saved here, and you can continue smoothly when switching to or from this source.',
    canTrackProgress: true,
    canTransferOut: true,
    canReceivePosition: true,
    automaticTarget: true,
  }),
  autoembed: Object.freeze({
    mode: 'unpredictable',
    label: 'Unpredictable',
    shortLabel: 'Unpredictable',
    description: 'This source may be unavailable or fail to load. Resume and saved progress are not guaranteed.',
    canTrackProgress: false,
    canTransferOut: false,
    canReceivePosition: false,
    automaticTarget: false,
  }),
});

const START_OVER_ONLY: MobileSourceContinuityCapability = Object.freeze({
  mode: 'start-over-only',
  label: 'Start Over Only',
  shortLabel: 'Start Over',
  description: 'This source starts from the beginning. Your current place stays saved for other compatible sources.',
  canTrackProgress: false,
  canTransferOut: false,
  canReceivePosition: false,
  automaticTarget: false,
});

export function getMobileSourceContinuityCapability(sourceId: string): MobileSourceContinuityCapability {
  const explicit = CAPABILITIES[sourceId];
  if (explicit) return explicit;
  const source = getSource(sourceId);
  if (source.resumeStrategy === 'none') return START_OVER_ONLY;
  return {
    mode: 'resume-unverified',
    label: 'Resume May Vary',
    shortLabel: 'Resume May Vary',
    description: 'Resume behavior has not been confirmed for this source yet. You can try it, but it may start somewhere else.',
    canTrackProgress: source.progressStrategy !== 'none',
    canTransferOut: source.progressStrategy !== 'none',
    canReceivePosition: true,
    automaticTarget: false,
  };
}

/**
 * True only for sources Orion has physically accepted as automatic continuity
 * targets. Manual source changes use mobileSourceCanReceiveContinuity.
 */
export function mobileSourceSupportsContinuity(sourceId: string): boolean {
  return getMobileSourceContinuityCapability(sourceId).automaticTarget;
}

export function mobileSourceCanReceiveContinuity(sourceId: string): boolean {
  return getMobileSourceContinuityCapability(sourceId).canReceivePosition;
}

export function mobileSourceRequiresStartOver(sourceId: string): boolean {
  return !getMobileSourceContinuityCapability(sourceId).canReceivePosition;
}

export function getPreferredMobileResumeSource(
  sourceId: string | null | undefined,
  mediaType: 'movie' | 'tv',
): string {
  // Continue Watching must land on a physically verified incoming target. An
  // outgoing-only source can still contribute its verified position, but Orion
  // resumes that position through the default seamless source instead.
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
