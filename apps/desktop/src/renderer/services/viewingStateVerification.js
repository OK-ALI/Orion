import { storage, STORAGE_KEYS } from "./settingsStore";

export const VERIFIED_HISTORY_UPDATED_EVENT = "orion:verified-history-updated";

export function isHistoryTrackingEnabled() {
  const enabled = storage.get(STORAGE_KEYS.HISTORY_ENABLED);
  return enabled !== 0 && enabled !== false;
}

function parseViewingKey(key) {
  const movie = /^movie_(.+)$/.exec(String(key || ""));
  if (movie?.[1]) {
    return { mediaType: "movie", id: movie[1], season: null, episode: null };
  }
  const episode = /^tv_(.+)_s(\d+)e(\d+)$/.exec(String(key || ""));
  if (!episode) return null;
  return {
    mediaType: "tv",
    id: episode[1],
    season: Number(episode[2]),
    episode: Number(episode[3]),
  };
}

function historyEntryMatches(entry, identity) {
  if (!entry || !identity) return false;
  if (String(entry.id) !== String(identity.id)) return false;
  if (entry.media_type !== identity.mediaType) return false;
  if (identity.mediaType === "movie") return true;
  return Number(entry.season) === identity.season && Number(entry.episode) === identity.episode;
}

export function markHistoryPlaybackVerified(key, verifiedAt = Date.now()) {
  if (!isHistoryTrackingEnabled()) return null;
  const identity = parseViewingKey(key);
  if (!identity) return null;
  const timestamp = Number(verifiedAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;

  const history = storage.get(STORAGE_KEYS.HISTORY) || [];
  let changed = false;
  const next = (Array.isArray(history) ? history : []).map((entry) => {
    if (!historyEntryMatches(entry, identity)) return entry;
    if (entry.playbackVerified === true && entry.lastPlayedAt === timestamp) return entry;
    changed = true;
    return {
      ...entry,
      playbackVerified: true,
      playbackVerifiedAt: timestamp,
      lastPlayedAt: timestamp,
    };
  });

  if (!changed) return null;
  storage.set(STORAGE_KEYS.HISTORY, next);
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(VERIFIED_HISTORY_UPDATED_EVENT, { detail: { history: next } }));
  }
  return next;
}

export function persistPlaybackProgressDetails(key, sample, { verified = false, now = Date.now() } = {}) {
  const currentTime = Number(sample?.currentTime);
  const duration = Number(sample?.duration);
  const percent = Number(sample?.percent);
  const timestamp = Number(now);
  if (!key || !Number.isFinite(currentTime) || currentTime < 0
    || !Number.isFinite(duration) || duration <= 0
    || !Number.isFinite(percent) || percent < 0
    || !Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }

  const all = storage.get(STORAGE_KEYS.PROGRESS_DETAILS) || {};
  const previous = all[key];
  const canVerify = verified === true && isHistoryTrackingEnabled();

  // Never replace a durable verified snapshot with a newer opened/seek-only
  // sample. The legacy percentage and dlTime maps can still update locally;
  // this record remains the last cross-device-safe progress snapshot.
  if (!canVerify && previous?.playbackVerified === true) return previous;

  const next = {
    currentTime,
    duration,
    percent: Math.max(0, Math.min(100, percent)),
    updatedAt: timestamp,
  };

  if (canVerify) {
    next.playbackVerified = true;
    next.playbackVerifiedAt = previous?.playbackVerifiedAt || timestamp;
    next.startedAt = previous?.startedAt || previous?.playbackVerifiedAt || timestamp;
  }

  all[key] = next;
  storage.set(STORAGE_KEYS.PROGRESS_DETAILS, all);
  return next;
}
