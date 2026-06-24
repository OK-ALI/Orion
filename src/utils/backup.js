// ── Backup & Restore Utilities ────────────────────────────────────────────────
// Single source of truth for which keys are included in backups.

const PREFIX = "orion_";

export const BACKUP_KEYS = [
  "saved",
  "savedOrder",
  "history",
  "progress",
  "watched",
  "homeRowOrder",
  "homeRowVisible",
  "homeViewMode",
  "startPage",
  "playerSource",
  "allmangaDubMode",
  "ambientGlow",
  "introSkipMode",
  "ageLimit",
  "ratingCountry",
  "watchedThreshold",
  "autoplayNextEnabled",
  "autoplayNextDuration",
  "autoplayNextLayout",
  "subtitleDownload",
  "subtitleLang",
  "downloadPath",
  "downloaderFolder",
  "invidiousBase",
  "autoCheckUpdates",
  "searchHistory",
  "accentColor",
  "fontSize",
  "compactMode",
  "reduceAnimations",
  "librarySort",
  "historyEnabled",
  "tmdbLang",
  "notifyDownloadComplete",
  "notifyNewEpisode",
  "episodeReleaseCache",
];

export function collectBackupData() {
  const data = {};
  for (const key of BACKUP_KEYS) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw !== null) data[key] = JSON.parse(raw);
    } catch {}
  }
  return data;
}

export function restoreBackupData(data) {
  if (!data || typeof data !== "object") throw new Error("Invalid backup data");
  for (const key of BACKUP_KEYS) {
    if (data[key] !== undefined && data[key] !== null) {
      localStorage.setItem(PREFIX + key, JSON.stringify(data[key]));
    }
  }
}
