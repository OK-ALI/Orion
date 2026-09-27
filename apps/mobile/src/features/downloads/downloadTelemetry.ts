import type { MobileDownloadJobV1 } from '@orion/shared/types';

/** Pure production timer policy: running work advances live; paused/failed work stays frozen. */
export function downloadElapsedSecondsV1(job: MobileDownloadJobV1, nowMs: number): number | null {
  const finalizing = job.state === 'finalizing';
  const running = job.state === 'downloading' || job.state === 'recovering' || job.state === 'verifying';
  const start = finalizing ? job.progress.finalizationStageStartedAt ?? job.startedAt : job.startedAt;
  if (start === null || start === undefined || !Number.isFinite(start) || !Number.isFinite(nowMs)) return null;
  const end = finalizing ? nowMs : running ? nowMs : job.completedAt ?? job.updatedAt;
  return Math.max(0, end - start) / 1_000;
}
