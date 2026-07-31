import type { VerifiedPlaybackSnapshot } from './playerTypes';

export function verifiedResumeSeconds(
  snapshot: VerifiedPlaybackSnapshot | null | undefined,
): number {
  if (!snapshot || !Number.isFinite(snapshot.currentTime) || snapshot.currentTime <= 0) return 0;
  if (!Number.isFinite(snapshot.observedAt) || snapshot.observedAt <= 0) return 0;
  return Math.max(0, snapshot.currentTime);
}
