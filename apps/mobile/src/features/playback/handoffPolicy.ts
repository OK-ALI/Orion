import type {
  MobileResumeStrategy,
  PlaybackHandoffStatus,
  PlaybackHandoffV1,
} from '@orion/shared/types';
import type { VerifiedPlaybackSnapshot } from './playerTypes';

export const HANDOFF_SNAPSHOT_MAX_AGE_MS = 5_000;
export const HANDOFF_CONFIRMATION_TIMEOUT_MS = 12_000;
// The deadline still presents recovery. A live provisional handoff can reconcile
// when fresh proof arrives; target/forward observations share one bounded window.
export const HANDOFF_LATE_CONFIRMATION_WINDOW_MS = 12_000;
export const HANDOFF_POSITION_TOLERANCE_SECONDS = 5;
export const HANDOFF_TARGET_SETTLE_MS = 4_000;

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

export function evaluatePlaybackHandoff(
  handoff: PlaybackHandoffV1,
  snapshot: VerifiedPlaybackSnapshot | null | undefined,
  now = Date.now(),
): { handoff: PlaybackHandoffV1 | null; reason: string } {
  const reject = (reason: string) => ({ handoff: null, reason });
  const late = handoff.status === 'unconfirmed' && ['TARGET_NOT_CONFIRMED', 'POSITION_NOT_RESTORED'].includes(handoff.failureCode || '')
    && handoff.reason !== 'automatic';
  if (!handoffIsPending(handoff) && !late) return reject('inactive-or-terminal');
  if (!finiteNonNegative(handoff.requestedTime) || !snapshot) return reject('missing-target-or-snapshot');
  if (snapshot.sourceId !== handoff.targetSourceId) return reject('source-mismatch');
  if (typeof snapshot.sessionId !== 'string' || !snapshot.sessionId.trim()) return reject('missing-session');
  if (!finiteNonNegative(snapshot.currentTime)) return reject('invalid-position');
  if (!Number.isFinite(snapshot.observedAt) || snapshot.observedAt < handoff.startedAt) return reject('pre-attempt-observation');
  if (now - snapshot.observedAt > HANDOFF_SNAPSHOT_MAX_AGE_MS) return reject('stale-observation');
  if (snapshot.observedAt > now + 1000) return reject('future-observation');
  if (handoff.targetSessionId && handoff.targetSessionId !== snapshot.sessionId) return reject('session-mismatch');
  const proofExpired = late && handoff.targetReachedAt != null && handoff.confirmedTime != null
    && snapshot.observedAt - handoff.targetReachedAt > HANDOFF_LATE_CONFIRMATION_WINDOW_MS;
  if (handoff.targetReachedAt == null || handoff.confirmedTime == null || proofExpired) {
    if (proofExpired) {
      const elapsedSeconds = (snapshot.observedAt - handoff.targetReachedAt!) / 1000;
      if (snapshot.currentTime < handoff.confirmedTime!
        || snapshot.currentTime > handoff.confirmedTime! + elapsedSeconds + HANDOFF_POSITION_TOLERANCE_SECONDS) return reject('implausible-forward-position');
    } else if (Math.abs(snapshot.currentTime - handoff.requestedTime) > HANDOFF_POSITION_TOLERANCE_SECONDS) {
      // Coarse provider cadence may verify playback only after the playhead has
      // left the target tolerance. Retain accepted timing from this exact attempt,
      // then still require a subsequent verified, advancing playing snapshot.
      const target = snapshot.targetObservation;
      if (handoff.reason === 'automatic' || handoff.strategy !== 'url-param' || !target) return reject('target-outside-tolerance');
      if (target.attemptId !== handoff.id) return reject('target-attempt-mismatch');
      if (target.sourceId !== snapshot.sourceId || target.sessionId !== snapshot.sessionId) return reject('target-identity-mismatch');
      const elapsed = snapshot.observedAt - target.observedAt;
      if (!Number.isFinite(target.observedAt) || target.observedAt < handoff.startedAt || elapsed <= 0
        || elapsed > HANDOFF_LATE_CONFIRMATION_WINDOW_MS) return reject('target-observation-expired');
      if (!finiteNonNegative(target.currentTime) || Math.abs(target.currentTime - handoff.requestedTime) > HANDOFF_POSITION_TOLERANCE_SECONDS) return reject('target-observation-missed');
      if (snapshot.state !== 'playing' || snapshot.currentTime < target.currentTime + 1
        || snapshot.currentTime > target.currentTime + elapsed / 1000 + HANDOFF_POSITION_TOLERANCE_SECONDS) return reject('target-forward-proof-insufficient');
      return { reason: 'target-observation-retained', handoff: { ...handoff, status: late ? 'unconfirmed' : 'seeking',
        confirmedTime: target.currentTime, targetReachedAt: target.observedAt, targetSessionId: snapshot.sessionId, updatedAt: now } };
    }
    return { reason: 'target-reached', handoff: { ...handoff, status: late ? 'unconfirmed' : 'seeking', confirmedTime: snapshot.currentTime,
      targetReachedAt: snapshot.observedAt, targetSessionId: snapshot.sessionId, updatedAt: now } };
  }
  // A seek/paused timestamp is not playback success. Once reached, never pin the target.
  if (snapshot.state !== 'playing') return reject('not-playing');
  if (snapshot.observedAt <= handoff.targetReachedAt) return reject('non-advancing-observation');
  if (snapshot.currentTime < handoff.confirmedTime + 1) return reject('non-advancing-position');
  return { reason: 'settled', handoff: {
    ...handoff,
    status: 'confirmed',
    confirmedTime: snapshot.currentTime,
    updatedAt: now,
    failureCode: null,
  } };
}

export function confirmPlaybackHandoff(handoff: PlaybackHandoffV1, snapshot: VerifiedPlaybackSnapshot | null | undefined, now = Date.now()) {
  return evaluatePlaybackHandoff(handoff, snapshot, now).handoff;
}

export function handoffTargetMissedPosition(
  handoff: PlaybackHandoffV1,
  snapshot: VerifiedPlaybackSnapshot | null | undefined,
  now = Date.now(),
): boolean {
  if (!handoffIsPending(handoff) || !snapshot || handoff.targetReachedAt != null) return false;
  if (handoff.strategy === 'verified-seek' && handoff.status !== 'seeking') return false;
  if (!finiteNonNegative(handoff.requestedTime)) return false;
  if (snapshot.sourceId !== handoff.targetSourceId) return false;
  if (!finiteNonNegative(snapshot.currentTime)) return false;
  if (!Number.isFinite(snapshot.observedAt) || snapshot.observedAt < handoff.startedAt) return false;
  if (now - handoff.startedAt < HANDOFF_TARGET_SETTLE_MS) return false;
  return Math.abs(snapshot.currentTime - handoff.requestedTime) > HANDOFF_POSITION_TOLERANCE_SECONDS;
}

export function handoffContinueRequiresCleanRestart(
  handoff: PlaybackHandoffV1 | null | undefined,
  activeSourceId: string,
): boolean {
  return Boolean(
    handoff
      && handoff.status === 'unconfirmed'
      && handoff.strategy === 'url-param'
      && handoff.targetSourceId === activeSourceId
      && Number(handoff.requestedTime) > 0,
  );
}

export const handoffIsPending = (handoff: PlaybackHandoffV1 | null | undefined) =>
  Boolean(handoff && ['preparing', 'loading', 'seeking'].includes(handoff.status));

export const handoffCanCarryPosition = (
  strategy: MobileResumeStrategy,
  requestedTime: number | null,
) => strategy !== 'none' && finiteNonNegative(requestedTime) && requestedTime > 0;
