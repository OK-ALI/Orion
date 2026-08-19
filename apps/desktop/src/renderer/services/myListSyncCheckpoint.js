import { storage } from "./settingsStore";

const CHECKPOINT_SCHEMA_VERSION = 1;
const KEY_PREFIX = "p8.myListSyncCheckpoint.v1:";

function keyFor(profileId) {
  const normalized = String(profileId || "").trim();
  if (!normalized) throw new Error("My List sync checkpoint profile id is required.");
  return `${KEY_PREFIX}${encodeURIComponent(normalized)}`;
}

function normalizeCheckpoint(value, profileId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (
    value.schemaVersion !== CHECKPOINT_SCHEMA_VERSION
    || value.profileId !== profileId
    || typeof value.localSignature !== "string"
    || typeof value.cloudNamespaceSignature !== "string"
    || !Number.isFinite(value.verifiedAt)
    || value.verifiedAt < 0
  ) return null;
  return {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    profileId,
    localSignature: value.localSignature,
    cloudNamespaceSignature: value.cloudNamespaceSignature,
    verifiedAt: value.verifiedAt,
  };
}

export function loadDesktopMyListSyncCheckpointV1(profileId) {
  const normalized = String(profileId || "").trim();
  if (!normalized) return null;
  return normalizeCheckpoint(storage.get(keyFor(normalized)), normalized);
}

export function saveDesktopMyListSyncCheckpointV1(checkpoint) {
  const profileId = String(checkpoint?.profileId || "").trim();
  const normalized = normalizeCheckpoint({ ...checkpoint, schemaVersion: CHECKPOINT_SCHEMA_VERSION, profileId }, profileId);
  if (!normalized) throw new Error("My List sync checkpoint is invalid.");
  storage.set(keyFor(profileId), normalized);
  return normalized;
}
