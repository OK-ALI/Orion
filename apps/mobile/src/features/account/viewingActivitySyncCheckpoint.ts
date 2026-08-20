import {
  PORTABLE_VIEWING_ACTIVITY_SYNC_CHECKPOINT_SCHEMA_VERSION,
  type PortableViewingActivitySyncCheckpointV1,
} from '@orion/shared/types';
import { mmkvStorageAdapter } from '../../services/storageAdapter';

const KEY_PREFIX = 'p8.viewingActivitySyncCheckpoint.v1:';

function keyFor(profileId: string): string {
  const normalized = profileId.trim();
  if (!normalized) throw new Error('Viewing Activity sync checkpoint profile id is required.');
  return `${KEY_PREFIX}${encodeURIComponent(normalized)}`;
}

function normalizeCheckpoint(
  value: unknown,
  profileId: string,
): PortableViewingActivitySyncCheckpointV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const checkpoint = value as Partial<PortableViewingActivitySyncCheckpointV1>;
  if (
    checkpoint.schemaVersion !== PORTABLE_VIEWING_ACTIVITY_SYNC_CHECKPOINT_SCHEMA_VERSION
    || checkpoint.profileId !== profileId
    || typeof checkpoint.localTruthSignature !== 'string'
    || !checkpoint.localTruthSignature
    || typeof checkpoint.cloudNamespaceSignature !== 'string'
    || !checkpoint.cloudNamespaceSignature
    || !Number.isFinite(checkpoint.verifiedAt)
    || Number(checkpoint.verifiedAt) < 0
  ) return null;
  return {
    schemaVersion: PORTABLE_VIEWING_ACTIVITY_SYNC_CHECKPOINT_SCHEMA_VERSION,
    profileId,
    localTruthSignature: checkpoint.localTruthSignature,
    cloudNamespaceSignature: checkpoint.cloudNamespaceSignature,
    verifiedAt: Number(checkpoint.verifiedAt),
  };
}

export function loadViewingActivitySyncCheckpointV1(
  profileId: string,
): PortableViewingActivitySyncCheckpointV1 | null {
  const normalized = profileId.trim();
  if (!normalized) return null;
  const raw = mmkvStorageAdapter.get(keyFor(normalized));
  if (!raw) return null;
  try {
    return normalizeCheckpoint(JSON.parse(raw), normalized);
  } catch {
    return null;
  }
}

export function saveViewingActivitySyncCheckpointV1(
  checkpoint: PortableViewingActivitySyncCheckpointV1,
): PortableViewingActivitySyncCheckpointV1 {
  const profileId = checkpoint.profileId.trim();
  const normalized = normalizeCheckpoint({ ...checkpoint, profileId }, profileId);
  if (!normalized) throw new Error('Viewing Activity sync checkpoint is invalid.');
  mmkvStorageAdapter.set(keyFor(profileId), JSON.stringify(normalized));
  return normalized;
}

export function clearViewingActivitySyncCheckpointV1(profileId: string): void {
  const normalized = profileId.trim();
  if (!normalized) return;
  mmkvStorageAdapter.remove(keyFor(normalized));
}
