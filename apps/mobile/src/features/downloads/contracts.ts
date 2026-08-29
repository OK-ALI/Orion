import type {
  MobileDownloadFinalizationStageV1,
  MobileDownloadArtifactAvailabilityV1,
  MobileDownloadOwnedArtifactV1,
  MobileDownloadManagementResultV1,
  MobileDownloadJobStateV1,
  MobileDownloadJobV1,
  MobileDownloadProgressV1,
  MobileDownloadStorageTargetV1,
} from '@orion/shared/types';

export type {
  MobileDownloadAssetV1,
  MobileDownloadCandidatePreflightV1,
  MobileDownloadCandidateV1,
  MobileDownloadDestinationModeV1,
  MobileDownloadFinalizationStageV1,
  MobileDownloadArtifactAvailabilityV1,
  MobileDownloadOwnedArtifactV1,
  MobileDownloadManagementDispositionV1,
  MobileDownloadManagementOutcomeV1,
  MobileDownloadManagementResultV1,
  MobileDownloadJobStateV1,
  MobileDownloadJobV1,
  MobileDownloadMediaIdentityV1,
  MobileDownloadPreferencesV1,
  MobileDownloadPreflightStateV1,
  MobileDownloadReachabilityV1,
  MobileDownloadProgressV1,
  MobileDownloadQualityV1,
  MobileDownloadStorageRequirementV1,
  MobileDownloadStorageTargetV1,
  OfflineMediaEntryV1,
} from '@orion/shared/types';

export const MOBILE_DOWNLOAD_JOB_STATES_V1: readonly MobileDownloadJobStateV1[] = Object.freeze([
  'queued',
  'preflighting',
  'downloading',
  'paused',
  'recovering',
  'verifying',
  'finalizing',
  'completed',
  'failed',
  'unsupported',
  'protected',
  'expired',
  'cancelled',
  'storage-blocked',
  'action-required',
]);

const MOBILE_DOWNLOAD_JOB_STATE_SET_V1 = new Set<MobileDownloadJobStateV1>(MOBILE_DOWNLOAD_JOB_STATES_V1);


function transitions(...states: MobileDownloadJobStateV1[]): readonly MobileDownloadJobStateV1[] {
  return Object.freeze(states);
}
export const MOBILE_DOWNLOAD_ALLOWED_TRANSITIONS_V1: Readonly<
  Record<MobileDownloadJobStateV1, readonly MobileDownloadJobStateV1[]>
> = Object.freeze({
  queued: transitions('preflighting', 'paused', 'cancelled'),
  preflighting: transitions(
    'downloading',
    'paused',
    'failed',
    'unsupported',
    'protected',
    'expired',
    'storage-blocked',
    'action-required',
    'cancelled',
  ),
  downloading: transitions(
    'paused',
    'recovering',
    'verifying',
    'failed',
    'expired',
    'storage-blocked',
    'action-required',
    'cancelled',
  ),
  paused: transitions('queued', 'preflighting', 'downloading', 'recovering', 'cancelled'),
  recovering: transitions(
    'queued',
    'preflighting',
    'downloading',
    'paused',
    'failed',
    'expired',
    'storage-blocked',
    'action-required',
    'cancelled',
  ),
  verifying: transitions('finalizing', 'failed', 'action-required', 'cancelled'),
  finalizing: transitions('completed', 'failed', 'action-required', 'cancelled'),
  completed: transitions(),
  failed: transitions('queued', 'preflighting', 'recovering', 'cancelled'),
  unsupported: transitions('preflighting', 'cancelled'),
  protected: transitions('preflighting', 'cancelled'),
  expired: transitions('preflighting', 'cancelled'),
  cancelled: transitions(),
  'storage-blocked': transitions('queued', 'preflighting', 'cancelled'),
  'action-required': transitions('queued', 'preflighting', 'recovering', 'cancelled'),
});

export function isMobileDownloadJobStateV1(value: unknown): value is MobileDownloadJobStateV1 {
  return typeof value === 'string' && MOBILE_DOWNLOAD_JOB_STATE_SET_V1.has(value as MobileDownloadJobStateV1);
}

export function canTransitionMobileDownloadJobStateV1(
  from: MobileDownloadJobStateV1,
  to: MobileDownloadJobStateV1,
): boolean {
  if (from === to) return true;
  return MOBILE_DOWNLOAD_ALLOWED_TRANSITIONS_V1[from].includes(to);
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

const FINALIZATION_STAGES_V1 = new Set<MobileDownloadFinalizationStageV1>([
  'preparing',
  'remuxing',
  'verifying-output',
  'publishing-media',
  'confirming-publication',
  'publishing-subtitles',
]);

function finalizationStage(value: unknown): MobileDownloadFinalizationStageV1 | null {
  return typeof value === 'string' && FINALIZATION_STAGES_V1.has(value as MobileDownloadFinalizationStageV1)
    ? value as MobileDownloadFinalizationStageV1
    : null;
}

export function normalizeMobileDownloadStorageTargetV1(value: unknown): MobileDownloadStorageTargetV1 | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Partial<MobileDownloadStorageTargetV1>;
  if (input.mode !== 'orion-library' && input.mode !== 'device-storage' && input.mode !== 'user-folder') return null;
  if (typeof input.displayName !== 'string' || !input.displayName.trim()) return null;
  const targetId = input.targetId === null || typeof input.targetId === 'string' ? input.targetId : null;
  return {
    mode: input.mode,
    targetId,
    displayName: input.displayName.trim(),
    writable: input.writable === true,
    persistedPermission: input.persistedPermission === true,
  };
}

export function normalizeMobileDownloadProgressV1(value: unknown): MobileDownloadProgressV1 {
  const input = value && typeof value === 'object' ? value as Partial<MobileDownloadProgressV1> : {};
  const bytesDownloaded = finiteNonNegative(input.bytesDownloaded) ?? 0;
  const totalBytes = finiteNonNegative(input.totalBytes);
  const completedFragments = finiteNonNegative(input.completedFragments);
  const totalFragments = finiteNonNegative(input.totalFragments);
  const percent = finiteNonNegative(input.percent);
  return {
    bytesDownloaded,
    totalBytes,
    completedFragments: completedFragments === null ? null : Math.trunc(completedFragments),
    totalFragments: totalFragments === null ? null : Math.trunc(totalFragments),
    percent: percent === null ? null : Math.min(100, percent),
    bytesPerSecond: finiteNonNegative(input.bytesPerSecond),
    etaSeconds: finiteNonNegative(input.etaSeconds),
    finalizationStage: finalizationStage(input.finalizationStage),
    finalizationStageStartedAt: finiteNonNegative(input.finalizationStageStartedAt),
  };
}

export interface MobileDownloadProgressSnapshotV1 {
  schemaVersion: 1;
  jobId: string;
  state: MobileDownloadJobStateV1;
  statusLabel: string;
  percent: number | null;
  bytesDownloaded: number;
  totalBytes: number | null;
  completedFragments: number | null;
  totalFragments: number | null;
  bytesPerSecond: number | null;
  etaSeconds: number | null;
  finalizationStage: MobileDownloadFinalizationStageV1 | null;
  finalizationStageStartedAt: number | null;
  isComplete: boolean;
  isTerminal: boolean;
}

const JOB_STATE_LABELS_V1: Readonly<Record<MobileDownloadJobStateV1, string>> = Object.freeze({
  queued: 'Queued',
  preflighting: 'Checking download',
  downloading: 'Downloading',
  paused: 'Paused',
  recovering: 'Waiting to retry',
  verifying: 'Checking download',
  finalizing: 'Finalizing',
  completed: 'Completed',
  failed: 'Download interrupted',
  unsupported: 'Source not supported',
  protected: 'Protected source',
  expired: 'Source expired',
  cancelled: 'Cancelled',
  'storage-blocked': 'Storage space needed',
  'action-required': 'Needs your attention',
});

const TERMINAL_JOB_STATES_V1 = new Set<MobileDownloadJobStateV1>([
  'completed',
  'cancelled',
  'unsupported',
  'protected',
]);

/**
 * Presentation-only progress truth.
 *
 * This intentionally copies only safe display fields from the durable job. It
 * does not expose candidate/request-context state, storage locators, provider
 * request material or any future native broker internals.
 *
 * Integrity rule: only a verified `completed` job may display 100%.
 */
export function createMobileDownloadProgressSnapshotV1(job: MobileDownloadJobV1): MobileDownloadProgressSnapshotV1 {
  const progress = normalizeMobileDownloadProgressV1(job.progress);
  const isComplete = job.state === 'completed';
  const percent = isComplete
    ? 100
    : progress.percent === null
      ? null
      : Math.min(99, progress.percent);

  return {
    schemaVersion: 1,
    jobId: job.jobId,
    state: job.state,
    statusLabel: JOB_STATE_LABELS_V1[job.state],
    percent,
    bytesDownloaded: progress.bytesDownloaded,
    totalBytes: progress.totalBytes,
    completedFragments: progress.completedFragments,
    totalFragments: progress.totalFragments,
    bytesPerSecond: progress.bytesPerSecond,
    etaSeconds: progress.etaSeconds,
    finalizationStage: progress.finalizationStage ?? null,
    finalizationStageStartedAt: progress.finalizationStageStartedAt ?? null,
    isComplete,
    isTerminal: TERMINAL_JOB_STATES_V1.has(job.state),
  };
}
