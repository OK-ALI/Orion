import type { MusicAlbum, MusicArtist } from '../../domain/music';
import { readWavenPresentation, seedWavenPresentation } from './wavenCanonicalPresentation';
import {
  wavenDiscoveryRuntime,
  type WavenAlbumDetailResponse,
  type WavenArtistDetailResponse,
} from './wavenDiscoveryRuntime';

interface PrefetchEntry<T> {
  createdAt: number;
  promise: Promise<T>;
  value: T | null;
}

// Phase 6 session cache only. Nothing here survives an app process restart.
const PREFETCH_TTL_MS = 10 * 60_000;
const artistPrefetch = new Map<string, PrefetchEntry<WavenArtistDetailResponse>>();
const albumPrefetch = new Map<string, PrefetchEntry<WavenAlbumDetailResponse>>();

function keyFor(provider: string, id: string): string {
  return `${provider}\0${id}`;
}

function readFreshEntry<T>(
  cache: Map<string, PrefetchEntry<T>>,
  key: string,
): PrefetchEntry<T> | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > PREFETCH_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function primeEntry<T extends { detail: unknown; cancelled: boolean }>(
  cache: Map<string, PrefetchEntry<T>>,
  key: string,
  request: () => Promise<T>,
  fallback: () => T,
): Promise<T> {
  const existing = readFreshEntry(cache, key);
  if (existing) return existing.promise;

  const entry: PrefetchEntry<T> = {
    createdAt: Date.now(),
    promise: Promise.resolve(null as unknown as T),
    value: null,
  };

  entry.promise = request()
    .then((value) => {
      // A miss or cancellation must not poison a later reconnect.
      if (value.detail && !value.cancelled) entry.value = value;
      else cache.delete(key);
      return value;
    })
    .catch(() => {
      cache.delete(key);
      return fallback();
    });

  cache.set(key, entry);
  return entry.promise;
}

export function primeWavenArtistDetail(artist: MusicArtist): Promise<WavenArtistDetailResponse> {
  const presented = readWavenPresentation(seedWavenPresentation(artist, 'artist'), 'artist');
  const key = keyFor(presented.source.provider, presented.source.id);
  return primeEntry(
    artistPrefetch,
    key,
    () => wavenDiscoveryRuntime.getArtist(presented),
    () => ({
      detail: null,
      errors: ['Artist details are unavailable right now.'],
      cancelled: false,
    }),
  );
}

export function primeWavenAlbumDetail(album: MusicAlbum): Promise<WavenAlbumDetailResponse> {
  const presented = readWavenPresentation(seedWavenPresentation(album, 'album'), 'album');
  const key = keyFor(presented.source.provider, presented.source.id);
  return primeEntry(
    albumPrefetch,
    key,
    () => wavenDiscoveryRuntime.getAlbum(presented),
    () => ({
      detail: null,
      errors: ['Album details are unavailable right now.'],
      cancelled: false,
    }),
  );
}

export function readWavenArtistDetailPrefetch(
  artist: MusicArtist,
): Promise<WavenArtistDetailResponse> | null {
  return readFreshEntry(
    artistPrefetch,
    keyFor(artist.source.provider, artist.source.id),
  )?.promise ?? null;
}

export function readWavenAlbumDetailPrefetch(
  album: MusicAlbum,
): Promise<WavenAlbumDetailResponse> | null {
  return readFreshEntry(
    albumPrefetch,
    keyFor(album.source.provider, album.source.id),
  )?.promise ?? null;
}

export function readWavenArtistDetailSnapshot(
  artist: MusicArtist,
): WavenArtistDetailResponse | null {
  return readFreshEntry(
    artistPrefetch,
    keyFor(artist.source.provider, artist.source.id),
  )?.value ?? null;
}

export function readWavenAlbumDetailSnapshot(
  album: MusicAlbum,
): WavenAlbumDetailResponse | null {
  return readFreshEntry(
    albumPrefetch,
    keyFor(album.source.provider, album.source.id),
  )?.value ?? null;
}
