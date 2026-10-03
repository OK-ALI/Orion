export type MobileMediaType = 'movie' | 'tv';

/** Accepted timing is only a target observation; it does not verify playback. */
export interface PlaybackTargetObservation {
  attemptId: string;
  sessionId: string;
  sourceId: string;
  currentTime: number;
  observedAt: number;
}

export interface VerifiedPlaybackSnapshot {
  sessionId: string;
  sourceId: string;
  currentTime: number;
  duration: number | null;
  evidence: string | null;
  observedAt: number;
  state?: import('@orion/shared/types').MobilePlaybackState;
  targetObservation?: PlaybackTargetObservation;
}

export interface PlaybackSurfaceProps {
  title?: string;
  seriesTitle?: string;
  year?: string;
  posterPath?: string;
  backdropPath?: string;
  episodeTitle?: string;
  sourceId: string;
  id: string;
  type: MobileMediaType;
  season?: string;
  episode?: string;
  initialResumeTime?: number;
  forceStartFromBeginning?: boolean;
  onSourceChange: (
    sourceId: string,
    verifiedSnapshot: VerifiedPlaybackSnapshot | null,
    reason: 'manual' | 'automatic',
    requestedTimeOverride?: number | null,
  ) => boolean;
  canAutomaticFailover?: (snapshot: VerifiedPlaybackSnapshot | null) => boolean;
  onAutomaticFailover: (verifiedSnapshot: VerifiedPlaybackSnapshot | null) => boolean;
  onPlaybackSnapshot?: (snapshot: VerifiedPlaybackSnapshot) => void;
  onVerifiedPlaybackCompletion?: (snapshot: VerifiedPlaybackSnapshot) => void;
  activeHandoffId?: string | null;
  continuityAttemptId?: string | null;
  onContinuitySession?: (attemptId: string, sourceId: string, sessionId: string) => void;
  onExit(): void;
  isLandscape?: boolean;
  onToggleOrientation?(): void;
}
