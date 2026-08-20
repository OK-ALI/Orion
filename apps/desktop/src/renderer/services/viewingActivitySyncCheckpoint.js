import { PORTABLE_VIEWING_ACTIVITY_SYNC_CHECKPOINT_SCHEMA_VERSION } from "@orion/shared/types";
import { storage } from "./settingsStore";

const KEY_PREFIX = "p8.viewingActivitySyncCheckpoint.v1:";

function keyFor(profileId) {
  const normalized = String(profileId || "").trim();
  if (!normalized) throw new Error("Viewing Activity sync checkpoint profile id is required.");
  return `${KEY_PREFIX}${encodeURIComponent(normalized)}`;
}

function normalizeCheckpoint(value, profileId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (
    value.schemaVersion !== PORTABLE_VIEWING_ACTIVITY_SYNC_CHECKPOINT_SCHEMA_VERSION
    || value.profileId !== profileId
    || typeof value.localTruthSignature !== "string"
    || !value.localTruthSignature
    || typeof value.cloudNamespaceSignature !== "string"
    || !value.cloudNamespaceSignature
    || !Number.isFinite(value.verifiedAt)
    || value.verifiedAt < 0
  ) return null;
  return {
    schemaVersion: PORTABLE_VIEWING_ACTIVITY_SYNC_CHECKPOINT_SCHEMA_VERSION,
    profileId,
    localTruthSignature: value.localTruthSignature,
    cloudNamespaceSignature: value.cloudNamespaceSignature,
    verifiedAt: value.verifiedAt,
  };
}

export function loadDesktopViewingActivitySyncCheckpointV1(profileId) {
  const normalized = String(profileId || "").trim();
  if (!normalized) return null;
  return normalizeCheckpoint(storage.get(keyFor(normalized)), normalized);
}

export function saveDesktopViewingActivitySyncCheckpointV1(checkpoint) {
  const profileId = String(checkpoint?.profileId || "").trim();
  const normalized = normalizeCheckpoint({ ...checkpoint, profileId }, profileId);
  if (!normalized) throw new Error("Viewing Activity sync checkpoint is invalid.");
  storage.set(keyFor(profileId), normalized);
  const readBack = normalizeCheckpoint(storage.get(keyFor(profileId)), profileId);
  if (!readBack || JSON.stringify(readBack) !== JSON.stringify(normalized)) {
    throw new Error("Viewing Activity sync checkpoint could not be persisted.");
  }
  return normalized;
}
