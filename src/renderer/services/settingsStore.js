// ── Orion — localStorage & secureStorage wrappers ─────────────────────────────
// Type-safe wrapper around localStorage with JSON serialization.
// Plus secureStorage utilizing Electron's safeStorage IPC handlers.

const PREFIX = "orion_";

export const STORAGE_KEYS = {
  API_KEY: "apikey",
  PLAYER_SOURCE: "playerSource",
  ALLMANGA_DUB_MODE: "allmangaDubMode",
  WATCH_PROGRESS: "progress",
  PROGRESS_DETAILS: "progressDetails",
  WATCHED: "watched",
  HISTORY: "history",
  SAVED: "saved",
  SAVED_ORDER: "savedOrder",
  LOCAL_FILES: "localFiles",
  DOWNLOAD_PATH: "downloadPath",
  DOWNLOAD_QUALITY: "downloadQuality",
  DOWNLOAD_CONCURRENCY: "downloadConcurrency",
  DOWNLOAD_FRAGMENT_CONCURRENCY: "downloadFragmentConcurrency",
  DOWNLOADER_FOLDER: "downloaderFolder",
  START_PAGE: "startPage",
  AGE_LIMIT: "ageLimit",
  RATING_COUNTRY: "ratingCountry",
  WATCHED_THRESHOLD: "watchedThreshold",
  HOME_ROW_ORDER: "homeRowOrder",
  HOME_ROW_VISIBLE: "homeRowVisible",
  HOME_VIEW_MODE: "homeViewMode",
  AUTO_CHECK_UPDATES: "autoCheckUpdates",
  INVIDIOUS_BASE: "invidiousBase",
  // Subtitle settings
  SUBTITLE_ENABLED: "subtitleDownload",
  SUBTITLE_LANG: "subtitleLang",
  // Encrypted via secureStorage
  SUBDL_API_KEY: "subdlApiKey",
  WYZIE_API_KEY: "wyzieApiKey",
  // Appearance & behaviour
  ACCENT_COLOR: "accentColor",
  ACCENT_IN_PLAYER: "accentInPlayer",
  THEME: "theme",
  CUSTOM_THEME_VARS: "customThemeVars",
  FONT_PRESET: "fontPreset",
  FONT_SIZE: "fontSize",
  COMPACT_MODE: "compactMode",
  REDUCE_ANIMATIONS: "reduceAnimations",
  LIBRARY_SORT: "librarySort",
  LIBRARY_TAB: "libraryTab",
  LIBRARY_HISTORY_FILTER: "libraryHistoryFilter",
  LIBRARY_HISTORY_VISIBLE: "libraryHistoryVisible",
  HISTORY_ENABLED: "historyEnabled",
  HIDDEN_TITLES: "hiddenTitles",
  NOT_INTERESTED: "notInterested",
  TITLE_SIGNALS: "titleSignals",
  // Notification preferences
  NOTIFY_DOWNLOAD_COMPLETE: "notifyDownloadComplete",
  NOTIFY_NEW_EPISODE: "notifyNewEpisode",
  // TMDB metadata lang (BCP-47 locale, e.g. "en-US")
  TMDB_LANG: "tmdbLang",
  // Intro skip (anime only, allmanga source)
  INTRO_SKIP_MODE: "introSkipMode",
  // Autoplay next preferences
  AUTOPLAY_NEXT_ENABLED: "autoplayNextEnabled",
  AUTOPLAY_NEXT_DURATION: "autoplayNextDuration",
  AUTOPLAY_NEXT_LAYOUT: "autoplayNextLayout",
  // Download page UI preferences
  DL_SORT_BY: "dlSortBy",
  DL_SORT_DIR: "dlSortDir",
  DL_SHOW_UNTRACKED: "dlShowUntracked",
  DOWNLOADER_ENGINE: "downloaderEngine",
  DOWNLOADER_HELPER_FOLDER: "downloaderHelperFolder",
  // Cache for new-episode startup check
  EPISODE_RELEASE_CACHE: "episodeReleaseCache",
  // Failover cache
  SOURCE_FAILOVER_CACHE: "sourceFailoverCache",
  // Sidebar collapsed/expanded state
  SIDEBAR_EXPANDED: "sidebarExpanded",
  CLOSE_TO_TRAY: "closeToTray",
  AMBIENT_GLOW: "ambientGlow",
  AMBIENT_PROFILE: "ambientProfile",
  MINI_PLAYER_BEHAVIOR: "miniPlayerBehavior",
  MOTION_PRESET: "motionPreset",
  BACKGROUND_SCENE: "backgroundScene",
  DISCOVERY_REGION: "discoveryRegion",
};

export const storage = {
  get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch {
      return localStorage.getItem(PREFIX + key);
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {}
  },

  remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {}
  },

  clearAll() {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {}
  },
};

export const getApiKey = () => storage.get(STORAGE_KEYS.API_KEY);

// ── Source failover cache ────────────────────────────────────────────────────
const FAILOVER_CACHE_MAX = 200;

export const getFailoverSource = (epKey) => {
  const cache = storage.get(STORAGE_KEYS.SOURCE_FAILOVER_CACHE) || {};
  return cache[epKey]?.sourceId || null;
};

export const setFailoverSource = (epKey, sourceId) => {
  const cache = storage.get(STORAGE_KEYS.SOURCE_FAILOVER_CACHE) || {};
  const keys = Object.keys(cache);
  if (keys.length >= FAILOVER_CACHE_MAX) {
    const evict = keys.slice(0, keys.length - FAILOVER_CACHE_MAX + 1);
    evict.forEach((k) => delete cache[k]);
  }
  cache[epKey] = { sourceId, ts: Date.now() };
  storage.set(STORAGE_KEYS.SOURCE_FAILOVER_CACHE, cache);
};

export const clearFailoverSource = (epKey) => {
  const cache = storage.get(STORAGE_KEYS.SOURCE_FAILOVER_CACHE) || {};
  if (cache[epKey] !== undefined) {
    delete cache[epKey];
    storage.set(STORAGE_KEYS.SOURCE_FAILOVER_CACHE, cache);
  }
};

// ── Shared helpers ────────────────────────────────────────────────────────────
export const isElectron = typeof window !== "undefined" && !!window.electron;

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return "…";
  if (bytes === -1) return null;
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

// ── Secure storage ────────────────────────────────────────────────────────────
const _isElectronSecure =
  typeof window !== "undefined" && !!window.electron?.secureGet;

export const secureStorage = {
  async get(key) {
    if (!_isElectronSecure) return null;
    return window.electron.secureGet(key);
  },
  async set(key, value) {
    if (!_isElectronSecure) return;
    return window.electron.secureSet(key, value ?? "");
  },
};

export async function clearAppCaches() {
  if (isElectron) {
    try {
      await window.electron.clearAppCache();
    } catch {}
  }
  localStorage.removeItem("orion_anilistCache");
  localStorage.removeItem("orion_episodeGroupCache");
  localStorage.removeItem("orion_aniskipCache");
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("dlDur_")) localStorage.removeItem(key);
  }
}
