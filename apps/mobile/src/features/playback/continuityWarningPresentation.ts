import type { PlaybackHandoffV1 } from '@orion/shared/types';

/** Presentation only: provisional transactions still own settlement and persistence. */
export function shouldPresentContinuityWarning(
  sourceId: string,
  handoff: Pick<PlaybackHandoffV1, 'status' | 'failureCode' | 'targetSourceId' | 'reason'> | null | undefined,
): boolean {
  if (!handoff || !['failed', 'unconfirmed'].includes(handoff.status)) return false;
  return !(handoff.status === 'unconfirmed'
    && handoff.targetSourceId === sourceId
    && handoff.reason !== 'automatic'
    && ['vidsrc-ir', 'cinesrc'].includes(sourceId)
    && ['TARGET_NOT_CONFIRMED', 'POSITION_NOT_RESTORED'].includes(handoff.failureCode || ''));
}
