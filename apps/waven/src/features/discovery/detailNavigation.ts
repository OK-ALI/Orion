import type { MusicAlbum, MusicArtist } from '../../domain/music';
import {
  readWavenPresentation,
  seedWavenPresentation,
  wavenEntityArtworkUrl,
} from './wavenCanonicalPresentation';

export type WavenDetailReturnTarget = 'search';

export interface WavenArtistDetailRoute {
  pathname: '/artist/[provider]/[id]';
  params: {
    provider: string;
    id: string;
    name: string;
    artworkUrl?: string;
    returnTo?: WavenDetailReturnTarget;
  };
}

export interface WavenAlbumDetailRoute {
  pathname: '/album/[provider]/[id]';
  params: {
    provider: string;
    id: string;
    title: string;
    artistName?: string;
    artworkUrl?: string;
    returnTo?: WavenDetailReturnTarget;
  };
}

export function artistDetailRoute(
  artist: MusicArtist,
  options: { returnTo?: WavenDetailReturnTarget } = {},
): WavenArtistDetailRoute {
  const presented = readWavenPresentation(seedWavenPresentation(artist, 'artist'), 'artist');
  const artworkUrl = wavenEntityArtworkUrl(presented) || undefined;

  return {
    pathname: '/artist/[provider]/[id]',
    params: {
      provider: presented.source.provider,
      id: presented.source.id,
      name: presented.name,
      ...(artworkUrl ? { artworkUrl } : {}),
      ...(options.returnTo ? { returnTo: options.returnTo } : {}),
    },
  };
}

export function albumDetailRoute(
  album: MusicAlbum,
  options: { returnTo?: WavenDetailReturnTarget } = {},
): WavenAlbumDetailRoute {
  const presented = readWavenPresentation(seedWavenPresentation(album, 'album'), 'album');
  const artworkUrl = wavenEntityArtworkUrl(presented);
  return {
    pathname: '/album/[provider]/[id]',
    params: {
      provider: presented.source.provider,
      id: presented.source.id,
      title: presented.title,
      ...(presented.artistName ? { artistName: presented.artistName } : {}),
      ...(artworkUrl ? { artworkUrl } : {}),
      ...(options.returnTo ? { returnTo: options.returnTo } : {}),
    },
  };
}
