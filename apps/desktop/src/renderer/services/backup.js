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
  "constellationPreferences",
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
  "cinemaGlowStrength",
  "episodeReleaseCache",
  "closeToTray",
  "sidebarExpanded",
  "dlSortBy",
  "dlSortDir",
  "dlShowUntracked",
  "hiddenTitles",
  "notInterested",
  "titleSignals",
  "musicAtmosphere",
  "musicVolume",
  "musicMuted",
  "musicVisualizer",
  "musicVisualIntensity",
  "musicGlowStrength",
  "musicArtworkColor",
  "musicPortalSound",
  "musicPortalVolume",
  "musicLyricsMotion",
  "musicPerformanceAdapt",
  "musicReplayGain",
  "musicCrossfadeDuration",
  "musicLowGpu",
  "musicDisableAudioReactiveBg",
  "musicStaticBg",
  "musicParticleDensity",
  "musicSceneStyle",
  "musicBatterySaver",
  "musicDisplayFont",
  "musicDisplayScale",
  "musicGlassDensity",
  "musicPlayerDockMode",
  "musicSearchHistory",
];

const DIRECT_BACKUP_KEYS = [
  "orion.sidebar.cinema.mode",
  "orion.sidebar.music.mode",
  "orion.sidebar.cinema.openMode",
  "orion.sidebar.music.openMode",
];

export function collectBackupData() {
  const data = {};
  for (const key of BACKUP_KEYS) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw !== null) data[key] = JSON.parse(raw);
    } catch {}
  }
  for (const key of DIRECT_BACKUP_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) data[key] = raw;
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
  for (const key of DIRECT_BACKUP_KEYS) {
    if (typeof data[key] === "string") localStorage.setItem(key, data[key]);
  }
}

export async function collectCompleteBackupData() {
  const data = collectBackupData();
  try {
    const result = await window.electron?.musicExportBackup?.();
    if (result?.ok && result.state) data.musicState = result.state;
  } catch {}
  return data;
}

export async function restoreCompleteBackupData(data) {
  restoreBackupData(data);
  if (!data?.musicState) return { ok: true };
  const result = await window.electron?.musicImportBackup?.(data.musicState);
  if (result?.ok === false) throw new Error(result.error || "Music data could not be restored.");
  // Music stores live in the renderer. Notify them after the main-process import
  // so a cloud restore is visible now, rather than only after an app relaunch.
  window.dispatchEvent(new CustomEvent("orion:music-backup-restored"));
  return result || { ok: true };
}
