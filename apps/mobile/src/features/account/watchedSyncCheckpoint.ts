import { mmkvStorageAdapter } from '../../services/storageAdapter';
import {
  PORTABLE_WATCHED_SYNC_CHECKPOINT_SCHEMA_VERSION,
  type PortableWatchedSyncCheckpointV1,
} from '@orion/shared/types';

const KEY_PREFIX = 'p8.watchedSyncCheckpoint.v1:';

function keyFor(profileId: string): string {
  const normalized = profileId.trim();
  if (!normalized) throw new Error('Watched sync checkpoint profile id is required.');
  return `${KEY_PREFIX}${encodeURIComponent(normalized)}`;
}

function isCheckpoint(value: unknown, profileId: string): value is PortableWatchedSyncCheckpointV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const checkpoint = value as Partial<PortableWatchedSyncCheckpointV1>;
  return checkpoint.schemaVersion === PORTABLE_WATCHED_SYNC_CHECKPOINT_SCHEMA_VERSION
    && checkpoint.profileId === profileId
    && typeof checkpoint.localTruthSignature === 'string'
    && typeof checkpoint.cloudNamespaceSignature === 'string'
    && typeof checkpoint.verifiedAt === 'number'
    && Number.isFinite(checkpoint.verifiedAt)
    && checkpoint.verifiedAt >= 0;
}

export function loadWatchedSyncCheckpointV1(profileId: string): PortableWatchedSyncCheckpointV1 | null {
  const normalized = profileId.trim();
  if (!normalized) return null;
  const raw = mmkvStorageAdapter.get(keyFor(normalized));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isCheckpoint(parsed, normalized) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveWatchedSyncCheckpointV1(
  checkpoint: PortableWatchedSyncCheckpointV1,
): PortableWatchedSyncCheckpointV1 {
  const normalized: PortableWatchedSyncCheckpointV1 = {
    schemaVersion: PORTABLE_WATCHED_SYNC_CHECKPOINT_SCHEMA_VERSION,
    profileId: checkpoint.profileId.trim(),
    localTruthSignature: checkpoint.localTruthSignature,
    cloudNamespaceSignature: checkpoint.cloudNamespaceSignature,
    verifiedAt: checkpoint.verifiedAt,
  };
  if (
    !normalized.profileId
    || !normalized.localTruthSignature
    || !normalized.cloudNamespaceSignature
    || !Number.isFinite(normalized.verifiedAt)
    || normalized.verifiedAt < 0
  ) {
    throw new Error('Watched sync checkpoint is invalid.');
  }
  mmkvStorageAdapter.set(keyFor(normalized.profileId), JSON.stringify(normalized));
  return normalized;
}

export function clearWatchedSyncCheckpointV1(profileId: string): void {
  const normalized = profileId.trim();
  if (!normalized) return;
  mmkvStorageAdapter.remove(keyFor(normalized));
}
