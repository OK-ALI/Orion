import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { imgUrl } from '@orion/shared/api';
import { mmkvStorageAdapter } from '../../services/storageAdapter';
import {
  emptyOfflineArtworkManifest,
  normalizeOfflineArtworkManifest,
  selectOfflineArtworkEvictions,
  upsertOfflineArtworkManifestEntry,
  validTmdbArtworkPath,
  type OfflineArtworkManifest,
} from './offlineArtworkPolicy';

export const OFFLINE_ARTWORK_MANIFEST_KEY = 'orion.mobile.offline-artwork.v1';
const DIRECTORY_NAME = 'orion-offline-artwork-v1';
const listeners = new Set<() => void>();
const inFlight = new Map<string, Promise<string | null>>();
const latestRequestedSource = new Map<string, string>();
const touchedThisSession = new Set<string>();
let manifestWriteQueue: Promise<void> = Promise.resolve();
let cacheDirectoryPrepared = false;

function cacheDirectory(): Directory {
  return new Directory(Paths.document, DIRECTORY_NAME);
}

function ensureDirectory(): Directory {
  const directory = cacheDirectory();
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  if (!cacheDirectoryPrepared) {
    cacheDirectoryPrepared = true;
    try {
      for (const item of directory.list()) {
        if (item instanceof File && item.name.endsWith('.partial') && item.exists) item.delete();
      }
    } catch {
      // A later failed download still performs its own partial-file cleanup.
    }
  }
  return directory;
}

function persistManifest(manifest: OfflineArtworkManifest) {
  mmkvStorageAdapter.set(OFFLINE_ARTWORK_MANIFEST_KEY, JSON.stringify(manifest));
}

function notify() {
  for (const listener of listeners) listener();
}

async function withManifestWriteLock(work: () => void | Promise<void>): Promise<void> {
  const next = manifestWriteQueue.then(work, work);
  manifestWriteQueue = next.then(() => undefined, () => undefined);
  await next;
}

function deleteOwnedFile(uri: string, ownedPrefix: string) {
  if (!uri.startsWith(ownedPrefix)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Presentation cache cleanup is best effort.
  }
}

function resetCorruptCache(directory: Directory): OfflineArtworkManifest {
  try {
    if (directory.exists) {
      for (const item of directory.list()) {
        if (item instanceof File && item.exists) item.delete();
      }
    }
  } catch {
    // A missing or unreadable presentation cache is equivalent to an empty cache.
  }
  try { mmkvStorageAdapter.remove(OFFLINE_ARTWORK_MANIFEST_KEY); } catch {}
  return emptyOfflineArtworkManifest();
}

function readManifest(): OfflineArtworkManifest {
  if (Platform.OS === 'web') return emptyOfflineArtworkManifest();
  const directory = ensureDirectory();
  const raw = mmkvStorageAdapter.get(OFFLINE_ARTWORK_MANIFEST_KEY);
  if (!raw) return emptyOfflineArtworkManifest();
  try {
    const normalized = normalizeOfflineArtworkManifest(JSON.parse(raw), directory.uri);
    return normalized || resetCorruptCache(directory);
  } catch {
    return resetCorruptCache(directory);
  }
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function pruneManifest(manifest: OfflineArtworkManifest, directory: Directory) {
  const evictions = selectOfflineArtworkEvictions(Object.values(manifest.entries));
  for (const entry of evictions) {
    delete manifest.entries[entry.identityKey];
    deleteOwnedFile(entry.uri, directory.uri);
  }
}

export function subscribeOfflineArtworkCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOfflineArtworkUri(identityKey: string, sourcePath: string): string | null {
  if (Platform.OS === 'web' || !validTmdbArtworkPath(sourcePath)) return null;
  const manifest = readManifest();
  const entry = manifest.entries[identityKey];
  if (!entry || entry.sourcePath !== sourcePath) return null;
  try {
    const file = new File(entry.uri);
    if (!file.exists || file.size <= 0) {
      delete manifest.entries[identityKey];
      persistManifest(manifest);
      return null;
    }
  } catch {
    delete manifest.entries[identityKey];
    persistManifest(manifest);
    return null;
  }

  if (!touchedThisSession.has(identityKey)) {
    touchedThisSession.add(identityKey);
    entry.lastUsedAt = Date.now();
    persistManifest(manifest);
  }
  return entry.uri;
}

export function cacheOfflineArtwork(
  identityKey: string,
  sourcePath: string,
): Promise<string | null> {
  if (Platform.OS === 'web' || !identityKey || !validTmdbArtworkPath(sourcePath)) {
    return Promise.resolve(null);
  }
  const requestKey = identityKey + '|' + sourcePath;
  latestRequestedSource.set(identityKey, sourcePath);
  const current = inFlight.get(requestKey);
  if (current) return current;

  const request = (async () => {
    const directory = ensureDirectory();
    const manifest = readManifest();
    const existing = manifest.entries[identityKey];
    if (existing?.sourcePath === sourcePath) {
      const uri = getOfflineArtworkUri(identityKey, sourcePath);
      if (uri) return uri;
    }

    const fileStem = stableHash(requestKey);
    const partial = new File(directory, fileStem + '.partial');
    const destination = new File(directory, fileStem + '.img');
    try {
      if (partial.exists) partial.delete();
      await File.downloadFileAsync(imgUrl(sourcePath, 'w780')!, partial, { idempotent: true });
      if (!partial.exists || partial.size <= 0) throw new Error('empty-artwork-download');
      if (partial.size > 32 * 1024 * 1024) throw new Error('artwork-file-too-large');
      await partial.move(destination, { overwrite: true });
      if (latestRequestedSource.get(identityKey) !== sourcePath) {
        try { if (destination.exists) destination.delete(); } catch {}
        return null;
      }

      await withManifestWriteLock(() => {
        const latestManifest = readManifest();
        const latestExisting = latestManifest.entries[identityKey];
        if (latestExisting && latestExisting.uri !== destination.uri) {
          deleteOwnedFile(latestExisting.uri, directory.uri);
        }
        upsertOfflineArtworkManifestEntry(latestManifest, {
          identityKey,
          sourcePath,
          uri: destination.uri,
          sizeBytes: destination.size,
          lastUsedAt: Date.now(),
        });
        pruneManifest(latestManifest, directory);
        persistManifest(latestManifest);
      });
      notify();
      return destination.uri;
    } catch {
      try { if (partial.exists) partial.delete(); } catch {}
      return null;
    }
  })().finally(() => {
    inFlight.delete(requestKey);
  });

  inFlight.set(requestKey, request);
  return request;
}