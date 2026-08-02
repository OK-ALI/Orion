export type MobileMediaType = 'movie' | 'tv';

export interface VerifiedPlaybackSnapshot {
  sessionId: string;
  sourceId: string;
  currentTime: number;
  duration: number | null;
  evidence: string | null;
  observedAt: number;
}

export interface PlaybackSurfaceProps {
  title?: string;
  sourceId: string;
  id: string;
  type: MobileMediaType;
  season?: string;
  episode?: string;
  initialResumeTime?: number;
  onSourceChange: (
    sourceId: string,
    verifiedSnapshot: VerifiedPlaybackSnapshot | null,
    reason: 'manual' | 'automatic',
    requestedTimeOverride?: number | null,
  ) => boolean;
  onAutomaticFailover: (verifiedSnapshot: VerifiedPlaybackSnapshot | null) => boolean;
  onPlaybackSnapshot?: (snapshot: VerifiedPlaybackSnapshot) => void;
  activeHandoffId?: string | null;
}
