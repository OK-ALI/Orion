import type { IStorageAdapter } from '@orion/shared/api';

export const LIBRARY_PROFILE_STORAGE_SCHEMA_VERSION = 1 as const;
export const LEGACY_LIBRARY_KEYS = ['saved', 'savedOrder', 'history', 'watched', 'progress'] as const;

export type LibraryProfileDataKey = (typeof LEGACY_LIBRARY_KEYS)[number];
export type LibraryProfileKind = 'local' | 'google';

export interface LibraryProfileScopeV1 {
  kind: LibraryProfileKind;
  scopeId: string;
  profileId: string | null;
}

interface LibraryProfileManifestV1 {
  schemaVersion: typeof LIBRARY_PROFILE_STORAGE_SCHEMA_VERSION;
  kind: LibraryProfileKind;
  scopeId: string;
  profileId: string | null;
  state: 'staging' | 'ready';
  sourceScopeId: string | null;
  createdAt: number;
  updatedAt: number;
}

type ManifestReadResult =
  | { state: 'missing' }
  | { state: 'invalid' }
  | { state: 'found'; manifest: LibraryProfileManifestV1 };

export interface PreparedLibraryProfileV1 {
  scope: LibraryProfileScopeV1;
  storage: IStorageAdapter;
  needsFinalization: boolean;
}

const DATA_PREFIX = 'p8.libraryProfile.v1:data:';
const MANIFEST_PREFIX = 'p8.libraryProfile.v1:manifest:';
const LOCAL_SCOPE_ID = 'local';

function normalizedProfileId(profileId: string): string {
  const normalized = profileId.trim();
  if (!normalized) throw new Error('Library profile id is required.');
  return normalized;
}

export function localLibraryProfileScopeV1(): LibraryProfileScopeV1 {
  return { kind: 'local', scopeId: LOCAL_SCOPE_ID, profileId: null };
}

export function googleLibraryProfileScopeV1(profileId: string): LibraryProfileScopeV1 {
  const normalized = normalizedProfileId(profileId);
  return {
    kind: 'google',
    scopeId: `google:${encodeURIComponent(normalized)}`,
    profileId: normalized,
  };
}

function dataPrefix(scope: LibraryProfileScopeV1): string {
  return `${DATA_PREFIX}${scope.scopeId}:`;
}

function manifestKey(scope: LibraryProfileScopeV1): string {
  return `${MANIFEST_PREFIX}${scope.scopeId}`;
}

function scopedKey(scope: LibraryProfileScopeV1, key: string): string {
  return `${dataPrefix(scope)}${key}`;
}

function readManifest(storage: IStorageAdapter, scope: LibraryProfileScopeV1): ManifestReadResult {
  const raw = storage.get(manifestKey(scope));
  if (!raw) return { state: 'missing' };
  try {
    const parsed = JSON.parse(raw) as Partial<LibraryProfileManifestV1>;
    if (
      parsed.schemaVersion !== LIBRARY_PROFILE_STORAGE_SCHEMA_VERSION
      || parsed.kind !== scope.kind
      || parsed.scopeId !== scope.scopeId
      || parsed.profileId !== scope.profileId
      || (parsed.state !== 'staging' && parsed.state !== 'ready')
      || (parsed.sourceScopeId !== null && typeof parsed.sourceScopeId !== 'string')
      || (scope.kind === 'local' && (parsed.state !== 'ready' || parsed.sourceScopeId !== null))
      || (scope.kind === 'google' && parsed.sourceScopeId !== LOCAL_SCOPE_ID)
      || typeof parsed.createdAt !== 'number'
      || !Number.isFinite(parsed.createdAt)
      || parsed.createdAt < 0
      || typeof parsed.updatedAt !== 'number'
      || !Number.isFinite(parsed.updatedAt)
      || parsed.updatedAt < parsed.createdAt
    ) {
      return { state: 'invalid' };
    }
    return { state: 'found', manifest: parsed as LibraryProfileManifestV1 };
  } catch {
    return { state: 'invalid' };
  }
}

function requireUsableManifest(result: ManifestReadResult): LibraryProfileManifestV1 | null {
  if (result.state === 'invalid') throw new Error('LIBRARY_PROFILE_MANIFEST_INVALID');
  return result.state === 'found' ? result.manifest : null;
}

function writeManifest(
  storage: IStorageAdapter,
  scope: LibraryProfileScopeV1,
  state: LibraryProfileManifestV1['state'],
  sourceScopeId: string | null,
  createdAt: number,
): void {
  storage.set(manifestKey(scope), JSON.stringify({
    schemaVersion: LIBRARY_PROFILE_STORAGE_SCHEMA_VERSION,
    kind: scope.kind,
    scopeId: scope.scopeId,
    profileId: scope.profileId,
    state,
    sourceScopeId,
    createdAt,
    updatedAt: Date.now(),
  } satisfies LibraryProfileManifestV1));
}

function captureLibrarySnapshot(
  storage: IStorageAdapter,
  resolveKey: (key: LibraryProfileDataKey) => string,
): Record<LibraryProfileDataKey, string | null> {
  return Object.fromEntries(
    LEGACY_LIBRARY_KEYS.map((key) => [key, storage.get(resolveKey(key))]),
  ) as Record<LibraryProfileDataKey, string | null>;
}

function snapshotsMatch(
  left: Record<LibraryProfileDataKey, string | null>,
  right: Record<LibraryProfileDataKey, string | null>,
): boolean {
  return LEGACY_LIBRARY_KEYS.every((key) => left[key] === right[key]);
}

function restoreSnapshot(
  storage: IStorageAdapter,
  scope: LibraryProfileScopeV1,
  snapshot: Record<LibraryProfileDataKey, string | null>,
): void {
  for (const key of LEGACY_LIBRARY_KEYS) {
    const value = snapshot[key];
    const targetKey = scopedKey(scope, key);
    if (value == null) storage.remove(targetKey);
    else storage.set(targetKey, value);
  }
}

function copySnapshotIntoScope(
  storage: IStorageAdapter,
  source: Record<LibraryProfileDataKey, string | null>,
  scope: LibraryProfileScopeV1,
): void {
  const previous = captureLibrarySnapshot(storage, (key) => scopedKey(scope, key));
  try {
    restoreSnapshot(storage, scope, source);
    const readBack = captureLibrarySnapshot(storage, (key) => scopedKey(scope, key));
    if (!snapshotsMatch(source, readBack)) {
      throw new Error('LIBRARY_PROFILE_COPY_VERIFY_FAILED');
    }
  } catch (error) {
    try {
      restoreSnapshot(storage, scope, previous);
    } catch {
      // The global storage health boundary will surface persistent backend
      // failure. Never mark this profile ready after an incomplete copy.
    }
    throw error;
  }
}

export function createLibraryProfileStorageAdapterV1(
  storage: IStorageAdapter,
  scope: LibraryProfileScopeV1,
): IStorageAdapter {
  return {
    get: (key: string) => storage.get(scopedKey(scope, key)),
    set: (key: string, value: string) => storage.set(scopedKey(scope, key), value),
    remove: (key: string) => storage.remove(scopedKey(scope, key)),
  };
}

export function ensureLocalLibraryProfileV1(storage: IStorageAdapter): PreparedLibraryProfileV1 {
  const scope = localLibraryProfileScopeV1();
  const existing = requireUsableManifest(readManifest(storage, scope));
  if (existing?.state === 'ready') {
    return {
      scope,
      storage: createLibraryProfileStorageAdapterV1(storage, scope),
      needsFinalization: false,
    };
  }

  // The five legacy keys are a recovery source only. They are copied byte for
  // byte and intentionally never removed or rewritten by this migration.
  const legacySnapshot = captureLibrarySnapshot(storage, (key) => key);
  copySnapshotIntoScope(storage, legacySnapshot, scope);
  const createdAt = existing?.createdAt ?? Date.now();
  writeManifest(storage, scope, 'ready', null, createdAt);

  return {
    scope,
    storage: createLibraryProfileStorageAdapterV1(storage, scope),
    needsFinalization: false,
  };
}

export function prepareGoogleLibraryProfileV1(
  storage: IStorageAdapter,
  profileId: string,
): PreparedLibraryProfileV1 {
  const scope = googleLibraryProfileScopeV1(profileId);
  const existing = requireUsableManifest(readManifest(storage, scope));
  if (existing?.state === 'ready') {
    return {
      scope,
      storage: createLibraryProfileStorageAdapterV1(storage, scope),
      needsFinalization: false,
    };
  }

  const local = ensureLocalLibraryProfileV1(storage);
  const sourceSnapshot = captureLibrarySnapshot(local.storage, (key) => key);
  copySnapshotIntoScope(storage, sourceSnapshot, scope);
  const createdAt = existing?.createdAt ?? Date.now();

  // Staging is written only after the complete account-scoped copy read-backs
  // exactly. Cloud checkpoints are retired by the account orchestration layer
  // before this manifest is allowed to become ready.
  writeManifest(storage, scope, 'staging', local.scope.scopeId, createdAt);

  return {
    scope,
    storage: createLibraryProfileStorageAdapterV1(storage, scope),
    needsFinalization: true,
  };
}

export function finalizeGoogleLibraryProfileV1(storage: IStorageAdapter, profileId: string): void {
  const scope = googleLibraryProfileScopeV1(profileId);
  const manifest = requireUsableManifest(readManifest(storage, scope));
  if (!manifest || manifest.state !== 'staging' || manifest.sourceScopeId !== LOCAL_SCOPE_ID) {
    throw new Error('LIBRARY_PROFILE_NOT_STAGED');
  }

  const local = ensureLocalLibraryProfileV1(storage);
  const sourceSnapshot = captureLibrarySnapshot(local.storage, (key) => key);
  const accountSnapshot = captureLibrarySnapshot(storage, (key) => scopedKey(scope, key));
  if (!snapshotsMatch(sourceSnapshot, accountSnapshot)) {
    throw new Error('LIBRARY_PROFILE_FINAL_VERIFY_FAILED');
  }

  // Commit last. Before this marker exists the account-scoped copy is never
  // treated as active library truth and therefore cannot participate in sync.
  writeManifest(storage, scope, 'ready', local.scope.scopeId, manifest.createdAt);
}
