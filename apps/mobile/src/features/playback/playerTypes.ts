export type MobileMediaType = 'movie' | 'tv';

export interface VerifiedPlaybackSnapshot {
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
  ) => void;
}
