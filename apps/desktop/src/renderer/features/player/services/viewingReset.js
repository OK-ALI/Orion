import {
  storage,
  STORAGE_KEYS,
  requestPlaybackReset,
} from "../../../services/settingsStore";

export function resetViewingToNotStarted(
  key,
  { saveProgress, markUnwatched } = {},
) {
  if (!key) return false;

  markUnwatched?.(key);
  saveProgress?.(key, null);
  storage.remove("dlTime_" + key);

  const details = storage.get(STORAGE_KEYS.PROGRESS_DETAILS) || {};
  if (details[key] !== undefined) {
    const next = { ...details };
    delete next[key];
    storage.set(STORAGE_KEYS.PROGRESS_DETAILS, next);
  }

  requestPlaybackReset(key);
  return true;
}

export function clearAllViewingState() {
  storage.remove(STORAGE_KEYS.WATCH_PROGRESS);
  storage.remove(STORAGE_KEYS.PROGRESS_DETAILS);
  storage.remove(STORAGE_KEYS.HISTORY);
  storage.remove(STORAGE_KEYS.WATCHED);
  storage.remove(STORAGE_KEYS.PLAYBACK_RESET_PENDING);

  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("orion_dlTime_")) localStorage.removeItem(key);
    }
  } catch {}

  return true;
}
