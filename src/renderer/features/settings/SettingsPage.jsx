import { useState, useEffect, useRef, useCallback } from "react";
import UpdateModal from "../../components/UpdateModal";
import {
  storage,
  STORAGE_KEYS,
  secureStorage,
  isElectron,
  clearAppCaches,
} from "../../services/settingsStore";
import { clearTmdbCache } from "../../services/tmdb";
import {
  ACCENT_PRESETS,
  applyAccentColor,
  THEME_PRESETS,
  applyTheme,
  DEFAULT_CUSTOM_VARS,
} from "../../shared/utils/appearance";
import { SUBTITLE_LANGUAGES } from "../../shared/utils/subtitles";
import { DEFAULT_INVIDIOUS_BASE } from "../../components/TrailerModal";
import { RATING_COUNTRIES } from "../../shared/utils/ageRating";
import { WarningIcon } from "../../components/common/Icons";
import { checkForUpdates } from "../../shared/utils/updates";
import {
  HOME_ROWS,
  loadHomeLayout,
  loadHomeViewMode,
  saveHomeViewMode,
} from "../../shared/utils/homeLayout";
import { collectBackupData, restoreBackupData } from "../../services/backup";
import { formatBytes } from "../../services/settingsStore";
import { ResetConfirmDialog, ConfirmDialog, CleanRow } from "./components/SettingsControls";
import { VersionSection, HomeLayoutSection, ScheduledBackupSection, BackupRestoreSection } from "./sections/GeneralSettings";
import { AppearanceSection } from "./sections/InterfaceSettings";
import { LibraryPrivacySection, StartPageSection, CloseBehaviorSection, TmdbLanguageSection } from "./sections/LibrarySettings";
import { SubtitleSettingsSection, NotificationsSection } from "./sections/SubtitleSettings";
import { SectionGroupHeader, Divider, SystemCheckSection, DownloaderToolsSection } from "./sections/SystemSettings";
import { SettingsTopBar } from "./SettingsTopBar";
import { AGE_LIMIT_OPTIONS } from "./settingsConstants";
import SettingsContent from "./SettingsContent";

// ── Custom Select ─────────────────────────────────────────────────────────────


// ── Start page config ─────────────────────────────────────────────────────────

// Age limit options: null = none, or specific ages


// ── Confirmation Dialog ───────────────────────────────────────────────────────


// ── Generic Confirm Dialog ───────────────────────────────────────────────────


// ── Toggle Switch ─────────────────────────────────────────────────────────────


// ── Status Badge ──────────────────────────────────────────────────────────────


// ── Clean Row ─────────────────────────────────────────────────────────────────


// ── Version & Update Section ──────────────────────────────────────────────────


// ── Home Layout Section ───────────────────────────────────────────────────────


// ── Scheduled Backup Section ──────────────────────────────────────────────────




// ── Backup & Restore ─────────────────────────────────────────────────────────


// ── Start Page Section ────────────────────────────────────────────────────────
// ── Appearance Section ────────────────────────────────────────────────────────


// ── Library & Privacy Section ─────────────────────────────────────────────────






// ── TMDB Metadata Language ────────────────────────────────────────────────────




// ── Subtitle Settings ─────────────────────────────────────────────────────────


// ── Notifications Section ─────────────────────────────────────────────────────


// ── Section Group Header ──────────────────────────────────────────────────────


// ── Section divider ───────────────────────────────────────────────────────────


// ── Search & Nav Bar ──────────────────────────────────────────────────────────











// ── Main ──────────────────────────────────────────────────────────────────────
export default function SettingsPage({
  apiKey,
  apiKeySource = "missing",
  onChangeApiKey,
  initialSection,
}) {
  const [downloadPath, setDownloadPath] = useState(
    () => storage.get(STORAGE_KEYS.DOWNLOAD_PATH) || "",
  );
  const [watchedThreshold, setWatchedThreshold] = useState(
    () => storage.get(STORAGE_KEYS.WATCHED_THRESHOLD) ?? 20,
  );
  const [introSkipMode, setIntroSkipMode] = useState(
    () => storage.get(STORAGE_KEYS.INTRO_SKIP_MODE) || "off",
  );
  const [autoplayNextEnabled, setAutoplayNextEnabled] = useState(
    () => storage.get(STORAGE_KEYS.AUTOPLAY_NEXT_ENABLED) ?? true,
  );
  const [autoplayNextDuration, setAutoplayNextDuration] = useState(
    () => storage.get(STORAGE_KEYS.AUTOPLAY_NEXT_DURATION) ?? 5,
  );
  const [autoplayNextLayout, setAutoplayNextLayout] = useState(
    () => storage.get(STORAGE_KEYS.AUTOPLAY_NEXT_LAYOUT) || "right",
  );
  const [saved, setSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetHovered, setResetHovered] = useState(false);
  const [showProgressConfirm, setShowProgressConfirm] = useState(false);
  const [showDeleteDlConfirm, setShowDeleteDlConfirm] = useState(false);

  // ── Section refs for navigation ────────────────────────────────────────────
  const secUpdates = useRef(null);
  const secContent = useRef(null);
  const secPlayback = useRef(null);
  const secSubtitles = useRef(null);
  const secDownloads = useRef(null);
  const secNotifications = useRef(null);
  const secInterface = useRef(null);
  const secLibrary = useRef(null);
  const secBackup = useRef(null);
  const secStorage = useRef(null);

  const sectionRefs = {
    updates: secUpdates,
    content: secContent,
    playback: secPlayback,
    subtitles: secSubtitles,
    downloads: secDownloads,
    notifications: secNotifications,
    interface: secInterface,
    library: secLibrary,
    backup: secBackup,
    storage: secStorage,
  };

  // Ref for find-in-page search scope
  const contentRef = useRef(null);

  // Scroll to initial section if provided (e.g. when navigating from a modal)
  useEffect(() => {
    if (!initialSection) return;
    const el = sectionRefs[initialSection]?.current;
    if (!el) return;
    // Small delay so layout is complete before scrolling
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => clearTimeout(t);
  }, [initialSection]);

  // Age Rating
  const [ratingCountry, setRatingCountry] = useState(
    () => storage.get(STORAGE_KEYS.RATING_COUNTRY) || "US",
  );
  const [ageLimit, setAgeLimit] = useState(() => {
    const v = storage.get(STORAGE_KEYS.AGE_LIMIT);
    return v === null || v === undefined ? "" : String(v);
  });
  const [ageSaved, setAgeSaved] = useState(false);

  const saveAgeSettings = () => {
    storage.set(STORAGE_KEYS.RATING_COUNTRY, ratingCountry);
    if (ageLimit === "" || ageLimit === null) {
      storage.remove(STORAGE_KEYS.AGE_LIMIT);
    } else {
      storage.set(STORAGE_KEYS.AGE_LIMIT, Number(ageLimit));
    }
    setAgeSaved(true);
    setTimeout(() => setAgeSaved(false), 2000);
  };

  // Invidious
  const [invidiousBase, setInvidiousBase] = useState(
    () => storage.get(STORAGE_KEYS.INVIDIOUS_BASE) || DEFAULT_INVIDIOUS_BASE,
  );
  const [invidiousStatus, setInvidiousStatus] = useState(null); // null | { ok: bool, msg: string }
  const [invidiousChecking, setInvidiousChecking] = useState(false);
  const [invidiousSaved, setInvidiousSaved] = useState(false);

  const checkInvidious = async (baseUrl) => {
    const clean = (baseUrl || "").trim().replace(/\/$/, "");
    if (!clean) {
      setInvidiousStatus({ ok: false, msg: "Please enter a URL first." });
      return;
    }
    setInvidiousChecking(true);
    setInvidiousStatus(null);
    try {
      const url = `${clean}/api/v1/stats`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        setInvidiousStatus({
          ok: true,
          msg: "Instance reachable and responding.",
        });
      } else {
        setInvidiousStatus({
          ok: false,
          msg: `Server responded with status ${res.status}.`,
        });
      }
    } catch (e) {
      setInvidiousStatus({
        ok: false,
        msg: "Could not reach instance. Check the URL or try another.",
      });
    } finally {
      setInvidiousChecking(false);
    }
  };

  const saveInvidiousBase = () => {
    const clean = (invidiousBase || "").trim().replace(/\/$/, "");
    storage.set(STORAGE_KEYS.INVIDIOUS_BASE, clean || DEFAULT_INVIDIOUS_BASE);
    setInvidiousBase(clean || DEFAULT_INVIDIOUS_BASE);
    setInvidiousSaved(true);
    setTimeout(() => setInvidiousSaved(false), 2000);
  };

  // Storage sizes - null = loading, -1 = unavailable, ≥0 = real value
  const [sizes, setSizes] = useState({ cache: null, downloads: null });

  useEffect(() => {
    if (typeof window === "undefined" || !window.electron) {
      setSizes({ cache: -1, downloads: -1 });
      return;
    }
    (async () => {
      try {
        const [cacheRes, downloadsRes] = await Promise.all([
          window.electron.getCacheSize?.() ?? null,
          window.electron.getDownloadsSize?.() ?? null,
        ]);
        setSizes({
          cache: cacheRes?.bytes ?? -1,
          downloads: downloadsRes?.bytes ?? -1,
        });
      } catch {
        setSizes({ cache: -1, downloads: -1 });
      }
    })();
  }, []);

  const pickFolder = async () => {
    if (!isElectron) return;
    const folder = await window.electron.pickFolder();
    if (folder) {
      setDownloadPath(folder);
      storage.set(STORAGE_KEYS.DOWNLOAD_PATH, folder);
      flash();
    }
  };

  const handleSavePath = () => {
    storage.set(STORAGE_KEYS.DOWNLOAD_PATH, downloadPath);
    flash();
  };

  const handleSaveThreshold = () => {
    const val = Math.max(1, Math.min(300, Number(watchedThreshold) || 20));
    setWatchedThreshold(val);
    storage.set(STORAGE_KEYS.WATCHED_THRESHOLD, val);
    flash();
  };

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // ── Clean handlers ─────────────────────────────────────────────────────────

  const handleClearCache = async () => {
    await clearAppCaches();
    setSizes((prev) => ({ ...prev, cache: 0 }));
    return { msg: "✓ Cache cleared successfully" };
  };

  const handleClearWatchProgress = async () => {
    storage.remove(STORAGE_KEYS.WATCH_PROGRESS);
    storage.remove(STORAGE_KEYS.HISTORY);
    storage.remove(STORAGE_KEYS.WATCHED);
    if (isElectron) await window.electron.clearWatchData();
    setTimeout(() => window.location.reload(), 800);
    return { msg: "✓ Watch data cleared" };
  };

  const handleDeleteAllDownloads = async () => {
    let msg = "✓ All downloads removed";
    setSizes((prev) => ({ ...prev, downloads: 0 }));
    if (isElectron) {
      const res = await window.electron.deleteAllDownloads();
      if (res?.deleted != null) {
        msg = `✓ Removed ${res.deleted} file${res.deleted !== 1 ? "s" : ""}`;
        if (res.errors > 0) msg += ` (${res.errors} could not be deleted)`;
      }
    } else {
      storage.remove(STORAGE_KEYS.LOCAL_FILES);
    }
    return { msg };
  };

  const handleResetApp = async () => {
    setShowResetConfirm(false);
    if (isElectron) await window.electron.resetApp();
    storage.clearAll();
    // Clear non-prefixed localStorage caches
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("dlDur_")) localStorage.removeItem(key);
    }
    window.location.reload();
  };

  return (
    <>
      {showProgressConfirm && (
        <ConfirmDialog
          title="CLEAR WATCH PROGRESS?"
          description="This will permanently delete all watch history, continue-watching progress, and watched/completed markings for all movies and series."
          confirmLabel="Yes, Clear Everything"
          onConfirm={async () => {
            setShowProgressConfirm(false);
            await handleClearWatchProgress();
            window.__progressConfirmResolve?.({ msg: "✓ Watch data cleared" });
            window.__progressConfirmResolve = null;
          }}
          onCancel={() => {
            setShowProgressConfirm(false);
            window.__progressConfirmResolve?.({ cancelled: true });
            window.__progressConfirmResolve = null;
          }}
        />
      )}
      {showDeleteDlConfirm && (
        <ConfirmDialog
          title="DELETE ALL DOWNLOADS?"
          description="This will permanently delete all video files downloaded through Orion and remove them from the download list."
          confirmLabel="Yes, Delete All"
          onConfirm={async () => {
            setShowDeleteDlConfirm(false);
            const result = await handleDeleteAllDownloads();
            window.__deleteDlConfirmResolve?.(result);
            window.__deleteDlConfirmResolve = null;
          }}
          onCancel={() => {
            setShowDeleteDlConfirm(false);
            window.__deleteDlConfirmResolve?.({ cancelled: true });
            window.__deleteDlConfirmResolve = null;
          }}
        />
      )}
      {showResetConfirm && (
        <ResetConfirmDialog
          onConfirm={handleResetApp}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      {/* ── Sticky search & navigation bar ── */}
      <SettingsTopBar sectionRefs={sectionRefs} contentRef={contentRef} />

              <SettingsContent model={{
          ageLimit, ageSaved, apiKey, apiKeySource, autoplayNextDuration,
          autoplayNextEnabled, autoplayNextLayout, checkInvidious, contentRef, downloadPath,
          flash, handleClearCache, handleSavePath, handleSaveThreshold, introSkipMode,
          invidiousBase, invidiousChecking, invidiousSaved, invidiousStatus, onChangeApiKey,
          pickFolder, ratingCountry, resetHovered, saveAgeSettings, saveInvidiousBase, saved, secBackup,
          secContent, secDownloads, secInterface, secLibrary, secNotifications,
          secPlayback, secStorage, secSubtitles, secUpdates, setAgeLimit,
          setAutoplayNextDuration, setAutoplayNextEnabled, setAutoplayNextLayout,
          setDownloadPath, setIntroSkipMode, setInvidiousBase, setInvidiousStatus,
          setRatingCountry, setResetHovered, setShowDeleteDlConfirm, setShowProgressConfirm,
          setShowResetConfirm, setWatchedThreshold, sizes, watchedThreshold,
        }} />
    </>
  );
}
