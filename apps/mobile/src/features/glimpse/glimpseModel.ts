import type { GlimpseTitleMetadata } from './glimpseTitleMetadata';
import type { TmdbMediaItem } from '@orion/shared/types';

export interface GlimpseMediaIdentity {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  isAnime: boolean;
  season: number | null;
  episode: number | null;
}
export interface GlimpseVideoDimensions { width: number; height: number }
export interface GlimpseReel {
  schemaVersion: 1;
  id: string;
  media: GlimpseMediaIdentity;
  title: string;
  clipTitle: string;
  video: { provider: 'youtube'; key: string; type: string; language: string | null; durationSeconds: number | null; dimensions?: GlimpseVideoDimensions | null };
  artworkPath: string | null;
  posterPath: string | null;
  year: string | null;
  catalog?: GlimpseTitleMetadata;
}
export interface GlimpseVideoSource {
  candidates(item: TmdbMediaItem, signal: AbortSignal): Promise<GlimpseReel[]>;
}
export interface GlimpseCatalog {
  page(page: number, signal: AbortSignal): Promise<{ items: TmdbMediaItem[]; hasMore: boolean }>;
}

export function glimpseReelId(media: GlimpseMediaIdentity, videoKey: string): string {
  if (!Number.isSafeInteger(media.tmdbId) || media.tmdbId <= 0
    || !['movie', 'tv'].includes(media.mediaType) || !/^[A-Za-z0-9_-]{11}$/.test(videoKey)) {
    throw new Error('Invalid Glimpse identity');
  }
  const episodeSpecific = media.season !== null || media.episode !== null;
  if (episodeSpecific && (media.mediaType !== 'tv'
    || !Number.isInteger(media.season) || Number(media.season) < 1
    || !Number.isInteger(media.episode) || Number(media.episode) < 1)) {
    throw new Error('Glimpse episode identity must be complete');
  }
  const episodeKey = episodeSpecific ? ':s' + media.season + ':e' + media.episode : '';
  return 'tmdb:' + media.mediaType + ':' + media.tmdbId + episodeKey + ':youtube:' + videoKey;
}

/** Anime retains its TMDb movie/TV identity; the qualified destination resolves Anime. */
export function glimpseDestination(reel: GlimpseReel) {
  glimpseReelId(reel.media, reel.video.key);
  const episodeSpecific = reel.media.mediaType === 'tv' && reel.media.episode !== null;
  return {
    pathname: episodeSpecific ? '/player/[id]' as const : '/media/[id]' as const,
    params: {
      id: String(reel.media.tmdbId), type: reel.media.mediaType,
      ...(episodeSpecific ? {
        season: String(reel.media.season), episode: String(reel.media.episode),
        title: reel.title, seriesTitle: reel.title,
        posterPath: reel.posterPath || undefined, backdropPath: reel.artworkPath || undefined,
      } : {}),
    },
  };
}

/** The visible action describes the existing canonical destination. */
export function glimpseActionLabel(reel: GlimpseReel) {
  if (reel.media.season !== null && reel.media.episode !== null) {
    return 'Watch S' + reel.media.season + ' · E' + reel.media.episode;
  }
  return reel.media.isAnime ? 'Anime details' : reel.media.mediaType === 'movie' ? 'Movie details' : 'Series details';
}