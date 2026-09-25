import type { TmdbMediaItem } from '@orion/shared/types';

type PersonCredit = {
  id?: number;
  media_type?: string;
  title?: string;
  name?: string;
  popularity?: number;
  poster_path?: string | null;
  backdrop_path?: string | null;
  [key: string]: unknown;
};

export function personFilmography(data: {
  combined_credits?: { cast?: unknown; crew?: unknown };
} | null): TmdbMediaItem[] {
  const cast = Array.isArray(data?.combined_credits?.cast) ? data.combined_credits.cast : [];
  const crew = Array.isArray(data?.combined_credits?.crew) ? data.combined_credits.crew : [];
  const seen = new Set<string>();
  return [...cast, ...crew]
    .filter((item): item is PersonCredit => Number.isInteger(item?.id) && item.id > 0)
    .map((item): TmdbMediaItem => ({
      ...item,
      id: item.id as number,
      media_type: item.media_type === 'movie' || item.media_type === 'tv'
        ? item.media_type : item.name ? 'tv' : 'movie',
      poster_path: item.poster_path || null,
      backdrop_path: item.backdrop_path || null,
    }))
    .filter((item) => {
      const key = `${item.media_type}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (Number(b.popularity) || 0) - (Number(a.popularity) || 0));
}
