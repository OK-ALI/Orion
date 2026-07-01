// ── Backup & Restore Utilities ────────────────────────────────────────────────
// Single source of truth for which keys are included in backups.

const PREFIX = "orion_";

export const BACKUP_KEYS = [
  "saved",
  "savedOrder",
  "history",
  "progress",
  "progressDetails",
  "watched",
  "homeRowOrder",
  "homeRowVisible",
  "homeViewMode",
  "startPage",
  "playerSource",
  "allmangaDubMode",
  "ambientGlow",
  "ambientProfile",
  "miniPlayerBehavior",
  "motionPreset",
  "backgroundScene",
  "discoveryRegion",
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
  "downloadQuality",
  "downloadConcurrency",
  "downloadFragmentConcurrency",
  "invidiousBase",
  "autoCheckUpdates",
  "searchHistory",
  "accentColor",
  "accentInPlayer",
  "theme",
  "customThemeVars",
  "fontPreset",
  "fontSize",
  "compactMode",
  "reduceAnimations",
  "librarySort",
  "historyEnabled",
  "tmdbLang",
  "notifyDownloadComplete",
  "notifyNewEpisode",
  "showBatteryStatus",
  "batteryAlerts",
  "batteryOptimization",
  "mediaControlsEnabled",
  "mediaMetadataEnabled",
  "mediaBackgroundControls",
  "interactionHoverPreset",
  "interactionHoverColor",
  "interactionGlowStrength",
  "episodeReleaseCache",
  "closeToTray",
  "sidebarExpanded",
  "dlSortBy",
  "dlSortDir",
  "dlShowUntracked",
  "hiddenTitles",
  "notInterested",
  "titleSignals",
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
