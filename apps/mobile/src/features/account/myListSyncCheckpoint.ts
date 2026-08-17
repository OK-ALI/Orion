import { mmkvStorageAdapter } from '../../services/storageAdapter';

const CHECKPOINT_SCHEMA_VERSION = 1 as const;
const KEY_PREFIX = 'p8.myListSyncCheckpoint.v1:';

export interface MyListSyncCheckpointV1 {
  schemaVersion: typeof CHECKPOINT_SCHEMA_VERSION;
  profileId: string;
  localSignature: string;
  cloudNamespaceSignature: string;
  verifiedAt: number;
}

function keyFor(profileId: string): string {
  const normalized = profileId.trim();
  if (!normalized) throw new Error('My List sync checkpoint profile id is required.');
  return `${KEY_PREFIX}${encodeURIComponent(normalized)}`;
}

function isCheckpoint(value: unknown, profileId: string): value is MyListSyncCheckpointV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const checkpoint = value as Partial<MyListSyncCheckpointV1>;
  return checkpoint.schemaVersion === CHECKPOINT_SCHEMA_VERSION
    && checkpoint.profileId === profileId
    && typeof checkpoint.localSignature === 'string'
    && typeof checkpoint.cloudNamespaceSignature === 'string'
    && typeof checkpoint.verifiedAt === 'number'
    && Number.isFinite(checkpoint.verifiedAt)
    && checkpoint.verifiedAt >= 0;
}

export function loadMyListSyncCheckpointV1(profileId: string): MyListSyncCheckpointV1 | null {
  const raw = mmkvStorageAdapter.get(keyFor(profileId));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isCheckpoint(parsed, profileId) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveMyListSyncCheckpointV1(
  checkpoint: Omit<MyListSyncCheckpointV1, 'schemaVersion'>,
): MyListSyncCheckpointV1 {
  const normalized: MyListSyncCheckpointV1 = {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    profileId: checkpoint.profileId.trim(),
    localSignature: checkpoint.localSignature,
    cloudNamespaceSignature: checkpoint.cloudNamespaceSignature,
    verifiedAt: checkpoint.verifiedAt,
  };
  if (!normalized.profileId || !Number.isFinite(normalized.verifiedAt) || normalized.verifiedAt < 0) {
    throw new Error('My List sync checkpoint is invalid.');
  }
  mmkvStorageAdapter.set(keyFor(normalized.profileId), JSON.stringify(normalized));
  return normalized;
}

export function clearMyListSyncCheckpointV1(profileId: string): void {
  mmkvStorageAdapter.remove(keyFor(profileId));
}
