export const OFFLINE_ARTWORK_SCHEMA_VERSION = 1 as const;
export const OFFLINE_ARTWORK_MAX_FILES = 128;
export const OFFLINE_ARTWORK_MAX_BYTES = 32 * 1024 * 1024;

export interface OfflineArtworkManifestEntry {
  identityKey: string;
  sourcePath: string;
  uri: string;
  sizeBytes: number;
  lastUsedAt: number;
}

export interface OfflineArtworkManifest {
  schemaVersion: typeof OFFLINE_ARTWORK_SCHEMA_VERSION;
  entries: Record<string, OfflineArtworkManifestEntry>;
}

export function emptyOfflineArtworkManifest(): OfflineArtworkManifest {
  return { schemaVersion: OFFLINE_ARTWORK_SCHEMA_VERSION, entries: {} };
}

export function validTmdbArtworkPath(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 1
    && value.length <= 512
    && value.startsWith('/')
    && !value.includes('..')
    && /^\/[A-Za-z0-9._/-]+$/.test(value);
}

export function selectTmdbArtworkSource(
  backdropPath: unknown,
  posterPath: unknown,
): string | null {
  if (validTmdbArtworkPath(backdropPath)) return backdropPath;
  return validTmdbArtworkPath(posterPath) ? posterPath : null;
}
export function artworkIdentityKey(media: {
  id?: string | number | null;
  mediaType?: string | null;
  media_type?: string | null;
  season?: number | null;
  episode?: number | null;
}): string | null {
  if (media.id == null) return null;
  const mediaType = media.mediaType ?? media.media_type;
  if (mediaType !== 'movie' && mediaType !== 'tv') return null;
  const base = mediaType + ':' + String(media.id);
  if (mediaType !== 'tv' || !Number(media.season) || !Number(media.episode)) return base;
  return base + ':s' + Number(media.season) + ':e' + Number(media.episode);
}

export function normalizeOfflineArtworkManifest(
  value: unknown,
  ownedUriPrefix: string,
): OfflineArtworkManifest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as any;
  if (input.schemaVersion !== OFFLINE_ARTWORK_SCHEMA_VERSION
      || !input.entries
      || typeof input.entries !== 'object'
      || Array.isArray(input.entries)) return null;

  const entries: Record<string, OfflineArtworkManifestEntry> = {};
  for (const [identityKey, raw] of Object.entries(input.entries)) {
    const entry = raw as any;
    if (!entry || typeof entry !== 'object') continue;
    if (entry.identityKey !== identityKey
        || !validTmdbArtworkPath(entry.sourcePath)
        || typeof entry.uri !== 'string'
        || !entry.uri.startsWith(ownedUriPrefix)
        || !Number.isFinite(entry.sizeBytes)
        || entry.sizeBytes <= 0
        || !Number.isFinite(entry.lastUsedAt)
        || entry.lastUsedAt < 0) continue;
    entries[identityKey] = {
      identityKey,
      sourcePath: entry.sourcePath,
      uri: entry.uri,
      sizeBytes: entry.sizeBytes,
      lastUsedAt: entry.lastUsedAt,
    };
  }
  return { schemaVersion: OFFLINE_ARTWORK_SCHEMA_VERSION, entries };
}

export function upsertOfflineArtworkManifestEntry(
  manifest: OfflineArtworkManifest,
  entry: OfflineArtworkManifestEntry,
): OfflineArtworkManifestEntry | null {
  const previous = manifest.entries[entry.identityKey] || null;
  manifest.entries[entry.identityKey] = entry;
  return previous;
}
export function selectOfflineArtworkEvictions(
  entries: OfflineArtworkManifestEntry[],
  maxFiles = OFFLINE_ARTWORK_MAX_FILES,
  maxBytes = OFFLINE_ARTWORK_MAX_BYTES,
): OfflineArtworkManifestEntry[] {
  const newestFirst = [...entries].sort((left, right) => (
    right.lastUsedAt - left.lastUsedAt || left.identityKey.localeCompare(right.identityKey)
  ));
  let retainedBytes = 0;
  const retained = new Set<string>();
  for (const entry of newestFirst) {
    if (retained.size >= maxFiles || retainedBytes + entry.sizeBytes > maxBytes) continue;
    retained.add(entry.identityKey);
    retainedBytes += entry.sizeBytes;
  }
  return entries.filter((entry) => !retained.has(entry.identityKey));
}