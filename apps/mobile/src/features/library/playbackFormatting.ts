export function formatPlaybackClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function progressDescription(currentTime: number, duration: number, percent: number | null): string {
  if (duration > 0 && percent != null) {
    const remaining = Math.max(0, duration - currentTime);
    return `${Math.round(percent)}% watched · ${formatPlaybackClock(remaining)} remaining`;
  }
  return `${formatPlaybackClock(currentTime)} watched`;
}
