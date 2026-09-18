import type { MusicAlbum, MusicArtist } from '../../domain/music';
import {
  wavenDiscoveryRuntime,
  type WavenAlbumDetailResponse,
  type WavenArtistDetailResponse,
} from './wavenDiscoveryRuntime';

interface PrefetchEntry<T> {
  createdAt: number;
  promise: Promise<T>;
}

const PREFETCH_TTL_MS = 30_000;
const artistPrefetch = new Map<string, PrefetchEntry<WavenArtistDetailResponse>>();
const albumPrefetch = new Map<string, PrefetchEntry<WavenAlbumDetailResponse>>();

function keyFor(provider: string, id: string): string {
  return `${provider}\0${id}`;
}

function readFresh<T>(
  cache: Map<string, PrefetchEntry<T>>,
  key: string,
): Promise<T> | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > PREFETCH_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.promise;
}

export function primeWavenArtistDetail(artist: MusicArtist): Promise<WavenArtistDetailResponse> {
  const key = keyFor(artist.source.provider, artist.source.id);
  const existing = readFresh(artistPrefetch, key);
  if (existing) return existing;

  const promise = wavenDiscoveryRuntime.getArtist(artist).catch(() => {
    artistPrefetch.delete(key);
    return {
      detail: null,
      errors: ['Artist details are unavailable right now.'],
      cancelled: false,
    };
  });
  artistPrefetch.set(key, { createdAt: Date.now(), promise });
  return promise;
}

export function primeWavenAlbumDetail(album: MusicAlbum): Promise<WavenAlbumDetailResponse> {
  const key = keyFor(album.source.provider, album.source.id);
  const existing = readFresh(albumPrefetch, key);
  if (existing) return existing;

  const promise = wavenDiscoveryRuntime.getAlbum(album).catch(() => {
    albumPrefetch.delete(key);
    return {
      detail: null,
      errors: ['Album details are unavailable right now.'],
      cancelled: false,
    };
  });
  albumPrefetch.set(key, { createdAt: Date.now(), promise });
  return promise;
}

export function readWavenArtistDetailPrefetch(
  artist: MusicArtist,
): Promise<WavenArtistDetailResponse> | null {
  return readFresh(artistPrefetch, keyFor(artist.source.provider, artist.source.id));
}

export function readWavenAlbumDetailPrefetch(
  album: MusicAlbum,
): Promise<WavenAlbumDetailResponse> | null {
  return readFresh(albumPrefetch, keyFor(album.source.provider, album.source.id));
}
