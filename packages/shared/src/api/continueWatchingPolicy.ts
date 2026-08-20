export const CONTINUE_MINIMUM_SECONDS = 30;
export const PLAYBACK_COMPLETION_PERCENT = 90;

export interface ContinueWatchingProgressLike {
  currentTime?: unknown;
  percent?: unknown;
  completed?: unknown;
}

export function isContinueWatchingProgressEligible(
  progress: ContinueWatchingProgressLike | null | undefined,
): boolean {
  if (!progress) return false;

  const currentTime = Number(progress.currentTime);
  if (!Number.isFinite(currentTime) || currentTime < CONTINUE_MINIMUM_SECONDS) {
    return false;
  }

  if (progress.completed === true) return false;

  if (progress.percent != null) {
    const percent = Number(progress.percent);
    if (!Number.isFinite(percent) || percent >= PLAYBACK_COMPLETION_PERCENT) {
      return false;
    }
  }

  return true;
}
