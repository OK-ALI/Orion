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
  onAutomaticFailover: (verifiedSnapshot: VerifiedPlaybackSnapshot | null) => boolean;
  onPlaybackSnapshot?: (snapshot: VerifiedPlaybackSnapshot) => void;
  onVerifiedPlaybackCompletion?: (snapshot: VerifiedPlaybackSnapshot) => void;
  activeHandoffId?: string | null;
}
