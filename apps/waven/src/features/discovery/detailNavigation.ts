import type { MusicAlbum, MusicArtist } from '../../domain/music';

export interface WavenArtistDetailRoute {
  pathname: '/artist/[provider]/[id]';
  params: {
    provider: string;
    id: string;
    name: string;
    artworkUrl?: string;
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
  };
}

export function artistDetailRoute(
  artist: MusicArtist,
): WavenArtistDetailRoute {
  const artworkUrl = artist.artworkUrl || artist.profileImageUrl || undefined;

  return {
    pathname: '/artist/[provider]/[id]',
    params: {
      provider: artist.source.provider,
      id: artist.source.id,
      name: artist.name,
      ...(artworkUrl ? { artworkUrl } : {}),
    },
  };
}

export function albumDetailRoute(
  album: MusicAlbum,
): WavenAlbumDetailRoute {
  return {
    pathname: '/album/[provider]/[id]',
    params: {
      provider: album.source.provider,
      id: album.source.id,
      title: album.title,
      ...(album.artistName ? { artistName: album.artistName } : {}),
      ...(album.artworkUrl ? { artworkUrl: album.artworkUrl } : {}),
    },
  };
}
