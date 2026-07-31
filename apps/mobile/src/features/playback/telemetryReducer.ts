import type {
  MobilePlaybackSessionV2,
  MobilePlaybackTelemetryV1,
} from '@orion/shared/types';

export interface PlaybackTelemetryState {
  session: MobilePlaybackSessionV2;
  lastSequence: number;
  lastObservedTime: number | null;
  duration: number | null;
  bufferedPosition: number | null;
  evidence: MobilePlaybackTelemetryV1['evidence'] | null;
  verifiedAt: number | null;
}

export type TelemetryDecision =
  | { accepted: true; state: PlaybackTelemetryState; shouldPersist: boolean }
  | { accepted: false; state: PlaybackTelemetryState; reason: string };

const finiteNonNegative = (value: number | null): value is number =>
  value != null && Number.isFinite(value) && value >= 0;

const isTimingEvidence = (evidence: MobilePlaybackTelemetryV1['evidence']) =>
  evidence === 'native-video-event'
  || evidence === 'provider-video-event'
  || evidence === 'provider-message';

export function createPlaybackTelemetryState(
  session: MobilePlaybackSessionV2,
): PlaybackTelemetryState {
  return {
    session,
    lastSequence: -1,
    lastObservedTime: null,
    duration: null,
    bufferedPosition: null,
    evidence: null,
    verifiedAt: null,
  };
}

export function playbackPercent(
  currentTime: number | null,
  duration: number | null,
): number | null {
  if (!finiteNonNegative(currentTime) || !finiteNonNegative(duration) || duration <= 0) return null;
  return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}

export function reducePlaybackTelemetry(
  previous: PlaybackTelemetryState,
  event: MobilePlaybackTelemetryV1,
): TelemetryDecision {
  if (event.sessionId !== previous.session.id) {
    return { accepted: false, state: previous, reason: 'session-mismatch' };
  }
  if (event.sourceId !== previous.session.sourceId) {
    return { accepted: false, state: previous, reason: 'source-mismatch' };
  }
  if (!Number.isInteger(event.sequence) || event.sequence <= previous.lastSequence) {
    return { accepted: false, state: previous, reason: 'stale-sequence' };
  }
  if (!Number.isFinite(event.observedAt) || event.observedAt <= 0) {
    return { accepted: false, state: previous, reason: 'invalid-observation-time' };
  }
  if (event.observedAt < previous.session.updatedAt) {
    return { accepted: false, state: previous, reason: 'stale-observation-time' };
  }
  for (const [name, value] of [
    ['current-time', event.currentTime],
    ['duration', event.duration],
    ['buffered-position', event.bufferedPosition],
  ] as const) {
    if (value != null && !finiteNonNegative(value)) {
      return { accepted: false, state: previous, reason: `invalid-${name}` };
    }
  }
  if (finiteNonNegative(event.currentTime)
    && finiteNonNegative(event.duration)
    && event.duration > 0
    && event.currentTime > event.duration + 5) {
    return { accepted: false, state: previous, reason: 'position-after-duration' };
  }
  if (finiteNonNegative(event.duration)
    && event.duration > 0
    && finiteNonNegative(previous.duration)
    && previous.duration > 0
    && Math.abs(event.duration - previous.duration) > Math.max(5, previous.duration * 0.05)) {
    return { accepted: false, state: previous, reason: 'impossible-duration-change' };
  }

  const regressed = finiteNonNegative(event.currentTime)
    && finiteNonNegative(previous.lastObservedTime)
    && event.currentTime < previous.lastObservedTime - 2;
  const seekingBoundary = event.state === 'seeking' || previous.session.state === 'seeking';
  if (regressed && !seekingBoundary) {
    return { accepted: false, state: previous, reason: 'unexplained-regression' };
  }

  const advancing = event.state === 'playing'
    && finiteNonNegative(event.currentTime)
    && finiteNonNegative(previous.lastObservedTime)
    && event.currentTime > previous.lastObservedTime + 0.05;
  const verified = previous.session.verified || (isTimingEvidence(event.evidence) && advancing);
  const verifiedAt = verified ? (previous.verifiedAt || event.observedAt) : null;
  const duration = finiteNonNegative(event.duration) && event.duration > 0
    ? event.duration
    : previous.duration;
  const currentTime = finiteNonNegative(event.currentTime)
    ? event.currentTime
    : previous.lastObservedTime;
  const next: PlaybackTelemetryState = {
    session: {
      ...previous.session,
      state: event.state,
      verified,
      lastVerifiedTime: verified && finiteNonNegative(currentTime)
        ? currentTime
        : previous.session.lastVerifiedTime,
      updatedAt: event.observedAt,
    },
    lastSequence: event.sequence,
    lastObservedTime: currentTime,
    duration,
    bufferedPosition: finiteNonNegative(event.bufferedPosition)
      ? event.bufferedPosition
      : previous.bufferedPosition,
    evidence: event.evidence,
    verifiedAt,
  };
  const terminalOrInteraction = ['paused', 'seeking', 'ended', 'error'].includes(event.state);
  return {
    accepted: true,
    state: next,
    shouldPersist: verified && (advancing || terminalOrInteraction),
  };
}
