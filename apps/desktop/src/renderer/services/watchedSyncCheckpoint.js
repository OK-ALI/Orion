import { PORTABLE_WATCHED_SYNC_CHECKPOINT_SCHEMA_VERSION } from "@orion/shared/types";
import { storage } from "./settingsStore";

const KEY_PREFIX = "p8.watchedSyncCheckpoint.v1:";

function keyFor(profileId) {
  const normalized = String(profileId || "").trim();
  if (!normalized) throw new Error("Watched sync checkpoint profile id is required.");
  return `${KEY_PREFIX}${encodeURIComponent(normalized)}`;
}

function normalizeCheckpoint(value, profileId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (
    value.schemaVersion !== PORTABLE_WATCHED_SYNC_CHECKPOINT_SCHEMA_VERSION
    || value.profileId !== profileId
    || typeof value.localTruthSignature !== "string"
    || typeof value.cloudNamespaceSignature !== "string"
    || !Number.isFinite(value.verifiedAt)
    || value.verifiedAt < 0
  ) return null;
  return {
    schemaVersion: PORTABLE_WATCHED_SYNC_CHECKPOINT_SCHEMA_VERSION,
    profileId,
    localTruthSignature: value.localTruthSignature,
    cloudNamespaceSignature: value.cloudNamespaceSignature,
    verifiedAt: value.verifiedAt,
  };
}

export function loadDesktopWatchedSyncCheckpointV1(profileId) {
  const normalized = String(profileId || "").trim();
  if (!normalized) return null;
  return normalizeCheckpoint(storage.get(keyFor(normalized)), normalized);
}

export function saveDesktopWatchedSyncCheckpointV1(checkpoint) {
  const normalized = normalizeCheckpoint(checkpoint, String(checkpoint?.profileId || "").trim());
  if (!normalized) throw new Error("Watched sync checkpoint is invalid.");
  storage.set(keyFor(normalized.profileId), normalized);
  return normalized;
}
