import type {
  MobileResumeStrategy,
  PlaybackHandoffStatus,
  PlaybackHandoffV1,
} from '@orion/shared/types';
import type { VerifiedPlaybackSnapshot } from './playerTypes';

export const HANDOFF_SNAPSHOT_MAX_AGE_MS = 5_000;
export const HANDOFF_CONFIRMATION_TIMEOUT_MS = 12_000;
export const HANDOFF_POSITION_TOLERANCE_SECONDS = 5;

const finiteNonNegative = (value: unknown): value is number =>
  Number.isFinite(value) && Number(value) >= 0;

export function getFreshVerifiedPosition(
  snapshot: VerifiedPlaybackSnapshot | null | undefined,
  now = Date.now(),
): number | null {
  if (!snapshot || !finiteNonNegative(snapshot.currentTime)) return null;
  if (!Number.isFinite(snapshot.observedAt) || snapshot.observedAt <= 0) return null;
  if (now - snapshot.observedAt > HANDOFF_SNAPSHOT_MAX_AGE_MS) return null;
  return snapshot.currentTime;
}

export function createPlaybackHandoff({
  reason,
  fromSessionId,
  fromSourceId,
  targetSourceId,
  requestedTime,
  strategy,
  attemptedSourceIds = [],
  now = Date.now(),
}: {
  reason: PlaybackHandoffV1['reason'];
  fromSessionId: string | null;
  fromSourceId: string;
  targetSourceId: string;
  requestedTime: number | null;
  strategy: MobileResumeStrategy;
  attemptedSourceIds?: string[];
  now?: number;
}): PlaybackHandoffV1 {
  const suffix = Math.random().toString(36).slice(2, 9);
  return {
    schemaVersion: 1,
    id: `handoff-${now}-${suffix}`,
    reason,
    fromSessionId,
    fromSourceId,
    targetSourceId,
    requestedTime: finiteNonNegative(requestedTime) ? requestedTime : null,
    confirmedTime: null,
    strategy,
    status: 'loading',
    attemptedSourceIds: [...new Set([...attemptedSourceIds, targetSourceId])],
    startedAt: now,
    updatedAt: now,
    failureCode: null,
  };
}

export function updateHandoffStatus(
  handoff: PlaybackHandoffV1,
  status: PlaybackHandoffStatus,
  failureCode: string | null = null,
  now = Date.now(),
): PlaybackHandoffV1 {
  return { ...handoff, status, failureCode, updatedAt: now };
}

export function confirmPlaybackHandoff(
  handoff: PlaybackHandoffV1,
  snapshot: VerifiedPlaybackSnapshot | null | undefined,
  now = Date.now(),
): PlaybackHandoffV1 | null {
  if (!['loading', 'seeking', 'preparing'].includes(handoff.status)) return null;
  if (!finiteNonNegative(handoff.requestedTime) || !snapshot) return null;
  if (snapshot.sourceId !== handoff.targetSourceId) return null;
  if (!finiteNonNegative(snapshot.currentTime)) return null;
  if (!Number.isFinite(snapshot.observedAt) || snapshot.observedAt < handoff.startedAt) return null;
  if (Math.abs(snapshot.currentTime - handoff.requestedTime) > HANDOFF_POSITION_TOLERANCE_SECONDS) {
    return null;
  }
  return {
    ...handoff,
    status: 'confirmed',
    confirmedTime: snapshot.currentTime,
    updatedAt: now,
    failureCode: null,
  };
}

export const handoffIsPending = (handoff: PlaybackHandoffV1 | null | undefined) =>
  Boolean(handoff && ['preparing', 'loading', 'seeking'].includes(handoff.status));

export const handoffCanCarryPosition = (
  strategy: MobileResumeStrategy,
  requestedTime: number | null,
) => strategy !== 'none' && finiteNonNegative(requestedTime) && requestedTime > 0;
