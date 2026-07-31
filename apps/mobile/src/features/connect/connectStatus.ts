export interface SmartConnectPlaybackStatus {
  title: string;
  type: string;
  progress: string;
  currentTime: number;
  duration: number;
  paused: boolean;
  hasMedia: boolean;
}

export const IDLE_CONNECT_STATUS: SmartConnectPlaybackStatus = {
  title: 'Desktop Connected',
  type: 'System',
  progress: 'Idle / Browsing',
  currentTime: 0,
  duration: 0,
  paused: false,
  hasMedia: false,
};

export function formatConnectTime(seconds: number): string {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${remainingMinutes < 10 ? '0' : ''}${remainingMinutes}:${remainder < 10 ? '0' : ''}${remainder}`;
  }
  return `${minutes}:${remainder < 10 ? '0' : ''}${remainder}`;
}

