export type ResumePlaybackChoice = 'resume' | 'replay-30' | 'start-over';

export function resolveResumeChoiceTime(
  choice: ResumePlaybackChoice,
  verifiedTime: number,
): number {
  const safeTime = Math.max(0, Number.isFinite(verifiedTime) ? verifiedTime : 0);
  if (choice === 'start-over') return 0;
  if (choice === 'replay-30') return Math.max(0, safeTime - 30);
  return safeTime;
}

export function formatPlaybackTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}
