const LEGACY_CLOUD_VIEWING_FENCE_MARKER = "__orion_preserve_legacy_viewing_state";

const LEGACY_CLOUD_VIEWING_STATE_KEYS = Object.freeze([
  "history",
  "progress",
  "progressDetails",
  "watched",
]);

async function prepareLegacySyncUploadPayload({ fileId, data, loadExisting }) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const next = { ...data };
  const preserveViewingState = next[LEGACY_CLOUD_VIEWING_FENCE_MARKER] === true;
  delete next[LEGACY_CLOUD_VIEWING_FENCE_MARKER];

  if (!preserveViewingState || !fileId) return next;
  if (typeof loadExisting !== "function") {
    throw new Error("Legacy viewing-state preservation requires the existing cloud snapshot.");
  }

  // Freeze the old raw viewing snapshot in place. The legacy sync file can keep
  // its last copy, while the fenced legacy path no longer updates or restores it.
  const existing = await loadExisting(fileId);
  for (const key of LEGACY_CLOUD_VIEWING_STATE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(existing || {}, key)) next[key] = existing[key];
  }
  return next;
}

module.exports = {
  LEGACY_CLOUD_VIEWING_FENCE_MARKER,
  LEGACY_CLOUD_VIEWING_STATE_KEYS,
  prepareLegacySyncUploadPayload,
};
