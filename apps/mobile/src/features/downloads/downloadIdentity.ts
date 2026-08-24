import type { MobileDownloadLibraryKindV1, MobileDownloadMediaIdentityV1 } from '@orion/shared/types';

export interface MobileDownloadTargetV1 {
  schemaVersion: 1;
  groupKey: string;
  itemKey: string;
  media: MobileDownloadMediaIdentityV1;
}

export interface CreateMobileDownloadTargetInputV1 {
  id: string | number;
  mediaType: 'movie' | 'tv';
  title: string;
  year?: number | string | null;
  libraryKind?: MobileDownloadLibraryKindV1;
  seriesTitle?: string | null;
  season?: number | null;
  episode?: number | null;
  episodeTitle?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
}

function normalizeYear(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createMobileDownloadTargetV1(input: CreateMobileDownloadTargetInputV1): MobileDownloadTargetV1 {
  const id = String(input.id);
  const season = typeof input.season === 'number' && Number.isFinite(input.season)
    ? Math.max(0, Math.trunc(input.season))
    : null;
  const episode = typeof input.episode === 'number' && Number.isFinite(input.episode)
    ? Math.max(0, Math.trunc(input.episode))
    : null;
  const libraryKind = input.libraryKind || (input.mediaType === 'movie' ? 'movie' : 'series');
  const groupKey = `${libraryKind}:${id}`;
  const itemKey = input.mediaType === 'tv' && season !== null && episode !== null
    ? `${groupKey}:s${season}:e${episode}`
    : groupKey;

  return {
    schemaVersion: 1,
    groupKey,
    itemKey,
    media: {
      schemaVersion: 1,
      id: input.id,
      mediaType: input.mediaType,
      title: input.title,
      year: normalizeYear(input.year),
      season,
      episode,
      libraryKind,
      seriesTitle: input.seriesTitle || (input.mediaType === 'tv' ? input.title : null),
      episodeTitle: input.episodeTitle || null,
      posterPath: input.posterPath || null,
      backdropPath: input.backdropPath || null,
    },
  };
}
