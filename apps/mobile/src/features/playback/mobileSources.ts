import {
  DEFAULT_CINEMA_SOURCE_ID,
  PLAYER_SOURCES,
  getSource,
} from '@orion/shared/sources';
import { getMobileSourceHealth, getMobileSourceHealthV2 } from '../../services/sourceHealth';

/**
 * Mobile-only provider boundaries. Retired/dead sources stay in the shared
 * registry only so old saved state can migrate safely; they are not user-facing
 * choices. Quarantined sources are also hidden until they are explicitly
 * revalidated because Orion cannot promise its normal in-app protection path.
 */
export const MOBILE_RETIRED_SOURCE_IDS: ReadonlySet<string> = new Set(['videasy', 'vsembed']);
export const MOBILE_QUARANTINED_SOURCE_IDS: ReadonlySet<string> = new Set(['autoembed']);

const MOBILE_VISIBLE_PLAYER_SOURCES = PLAYER_SOURCES.filter(
  (source) => !source.async
    && !source.animeOnly
    && source.releaseStatus !== 'disabled'
    && source.availability !== 'temporarily-unavailable'
    && !source.quarantined
    && !MOBILE_QUARANTINED_SOURCE_IDS.has(source.id)
    && !MOBILE_RETIRED_SOURCE_IDS.has(source.id),
);

// Keep the physically verified automatic source at the top of the Sources UI.
export const MOBILE_PLAYER_SOURCES = Object.freeze([
  ...MOBILE_VISIBLE_PLAYER_SOURCES.filter((source) => source.id === 'vixsrc'),
  ...MOBILE_VISIBLE_PLAYER_SOURCES.filter((source) => source.id !== 'vixsrc'),
]);

/**
 * Download-only qualification order. Playback routing and download routing are
 * intentionally separate: a provider may remain manually playable while being
 * excluded from automatic download resolution until it is physically requalified.
 */
export const MOBILE_AUTOMATIC_DOWNLOAD_SOURCE_IDS = Object.freeze([
  'vixsrc',
  'vidsrc',
  '111movies',
] as const);

const MOBILE_AUTOMATIC_DOWNLOAD_SOURCE_RANK = new Map<string, number>(
  MOBILE_AUTOMATIC_DOWNLOAD_SOURCE_IDS.map((id, index) => [id, index]),
);

export function mobileDownloadSourceRank(sourceId: string): number {
  return MOBILE_AUTOMATIC_DOWNLOAD_SOURCE_RANK.get(sourceId) ?? Number.MAX_SAFE_INTEGER;
}

export function getNextMobileDownloadSource(
  mediaType: 'movie' | 'tv',
  attempted: ReadonlySet<string>,
): (typeof MOBILE_PLAYER_SOURCES)[number] | null {
  const now = Date.now();
  return MOBILE_PLAYER_SOURCES
    .filter((source) => MOBILE_AUTOMATIC_DOWNLOAD_SOURCE_RANK.has(source.id))
    .filter((source) => {
      const health = getMobileSourceHealthV2(source.id, mediaType);
      return source.supportsDownloads === true
        && source.availability !== 'temporarily-unavailable'
        && (mediaType === 'movie' ? source.media.movie : source.media.tv)
        && !attempted.has(source.id)
        && !(health?.cooldownUntil && health.cooldownUntil > now);
    })
    .sort((left, right) => mobileDownloadSourceRank(left.id) - mobileDownloadSourceRank(right.id))[0] || null;
}

export function getMobileDownloadSourceChoices(
  mediaType: 'movie' | 'tv',
): readonly (typeof MOBILE_PLAYER_SOURCES)[number][] {
  const now = Date.now();
  return [...MOBILE_PLAYER_SOURCES]
    .filter((source) => source.supportsDownloads === true)
    .filter((source) => source.availability !== 'temporarily-unavailable')
    .filter((source) => mediaType === 'movie' ? source.media.movie : source.media.tv)
    .filter((source) => {
      const health = getMobileSourceHealthV2(source.id, mediaType);
      return !(health?.cooldownUntil && health.cooldownUntil > now);
    })
    .sort((left, right) => {
      const rank = mobileDownloadSourceRank(left.id) - mobileDownloadSourceRank(right.id);
      if (rank !== 0) return rank;
      return left.label.localeCompare(right.label);
    });
}

/**
 * VixSrc remains the verified automatic Mobile default. The shared source
 * registry carries the same active default for this release.
 */
export const MOBILE_DEFAULT_CINEMA_SOURCE_ID =
  MOBILE_PLAYER_SOURCES.find((source) => source.id === 'vixsrc' && source.routingMode === 'automatic')?.id
  ?? MOBILE_PLAYER_SOURCES.find((source) => source.routingMode === 'automatic')?.id
  ?? MOBILE_PLAYER_SOURCES[0]?.id
  ?? DEFAULT_CINEMA_SOURCE_ID;

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
    description: 'VidSrc currently plays, but an interaction may open advertising in your external browser. Orion Shield cannot fully contain this behavior.',
    selectionMessage: 'VidSrc currently plays, but an interaction may open advertising outside Orion in your external browser. Orion Shield cannot fully contain this behavior. Do you want to continue?',
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
    mode: 'limited-resume',
    label: 'Limited Resume',
    shortLabel: 'Limited Resume',
    description: 'Orion restores your saved place after the player becomes ready. You can try this source manually.',
    canTrackProgress: true,
    canTransferOut: true,
    canReceivePosition: true,
    automaticTarget: false,
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
  '111movies': Object.freeze({
    mode: 'seamless',
    label: 'Seamless Resume',
    shortLabel: 'Seamless Resume',
    description: 'Your place is saved here, and you can continue smoothly when switching to or from this source.',
    canTrackProgress: true,
    canTransferOut: true,
    canReceivePosition: true,
    automaticTarget: false,
  }),
  vidnest: Object.freeze({
    mode: 'resume-unverified',
    label: 'Resume May Vary',
    shortLabel: 'Resume May Vary',
    description: 'Resume behavior is still being confirmed. You can try this source manually.',
    canTrackProgress: true,
    canTransferOut: true,
    canReceivePosition: true,
    automaticTarget: false,
  }),
  'vidsrc-ir': Object.freeze({
    mode: 'resume-unverified',
    label: 'Resume May Vary',
    shortLabel: 'Resume May Vary',
    description: 'Resume behavior is still being confirmed. You can try this source manually.',
    canTrackProgress: true,
    canTransferOut: true,
    canReceivePosition: true,
    automaticTarget: false,
  }),
  cinesrc: Object.freeze({
    mode: 'limited-resume',
    label: 'Limited Resume',
    shortLabel: 'Limited Resume',
    description: "Orion saves your place and retries CineSrc's own seek control, but some CineSrc streams may still start from the beginning while the provider initializes a server.",
    canTrackProgress: true,
    canTransferOut: true,
    canReceivePosition: true,
    automaticTarget: false,
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
  if (!sourceId || !mobileSourceSupportsContinuity(sourceId)) return MOBILE_DEFAULT_CINEMA_SOURCE_ID;
  const source = MOBILE_PLAYER_SOURCES.find((entry) => entry.id === sourceId);
  const supportsMedia = mediaType === 'movie' ? source?.media.movie : source?.media.tv;
  if (!source || !supportsMedia) return MOBILE_DEFAULT_CINEMA_SOURCE_ID;
  const health = getMobileSourceHealth(sourceId, mediaType);
  if (health?.state === 'failed' && health.cooldownUntil > Date.now()) return MOBILE_DEFAULT_CINEMA_SOURCE_ID;
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
    const effectiveCandidate = getSource(candidateId);
    const supportsMedia = mediaType === 'movie' ? candidate.media.movie : candidate.media.tv;
    const health = getMobileSourceHealthV2(candidateId, mediaType);
    return supportsMedia
      && mobileSourceSupportsContinuity(candidateId)
      && effectiveCandidate.routingMode === 'automatic'
      && !MOBILE_QUARANTINED_SOURCE_IDS.has(candidateId)
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
