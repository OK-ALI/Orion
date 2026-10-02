import type { MobileDownloadJobV1 } from '@orion/shared/types';

export function mediaPrimaryTitle(media: MobileDownloadJobV1['media']): string {
  return media.mediaType === 'tv' ? media.seriesTitle || media.title : media.title;
}

export function mediaSecondaryTitle(media: MobileDownloadJobV1['media']): string | null {
  if (media.mediaType === 'tv' && media.season !== null && media.episode !== null) {
    const episode = `S${media.season} E${media.episode}`;
    return media.episodeTitle ? `${episode} · ${media.episodeTitle}` : episode;
  }
  return media.year ? String(media.year) : null;
}

export function formatBytes(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  if (value < 1024) return `${Math.round(value)} B`;
  const kib = value / 1024;
  if (kib < 1024) return `${kib.toFixed(kib >= 100 ? 0 : 1)} KB`;
  const mib = kib / 1024;
  if (mib < 1024) return `${mib.toFixed(mib >= 100 ? 0 : 1)} MB`;
  const gib = mib / 1024;
  return `${gib.toFixed(gib >= 10 ? 1 : 2)} GB`;
}

export function formatDurationSeconds(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  const seconds = Math.max(0, Math.round(value));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
