import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import ErrorBoundary from "../components/common/ErrorBoundary";
import WindowTitlebar from "../components/layout/WindowTitlebar";
import { storage, STORAGE_KEYS } from "../services/settingsStore";
import {
  applyAccentColor,
  applyFontPreset,
  applyInteractionAppearance,
  applyTheme,
  ACCENT_PRESETS,
} from "../shared/utils/appearance";
import { collectBackupData } from "../services/backup";
import { tmdbFetch } from "../services/tmdb";
import { clearAppCaches } from "../services/settingsStore";

import Sidebar from "../components/layout/Sidebar";
import SetupScreen from "../components/setup/SetupScreen";
import "../styles/mini-player.css";

import { checkForUpdates } from "../shared/utils/updates";
import { useNavigation } from "./hooks/useNavigation";
import { useLibraryState } from "./hooks/useLibraryState";
import { useDownloads } from "./hooks/useDownloads";
import { useEpisodeNotifications } from "./hooks/useEpisodeNotifications";
import { useApiSession } from "./hooks/useApiSession";
import AppRoutes from "./AppRoutes";
import AppOverlays from "./AppOverlays";
import {
  buildPlaybackHandoff,
  settlePlaybackStateWithin,
} from "../features/player/services/playbackSession";
import { getMiniPlayerBounds } from "../shared/utils/miniPlayerGeometry";
import { useSystemIntegration } from "./hooks/useSystemIntegration";

export default function App() {
  const {
    apiKey,
    apiKeyLoaded,
    apiKeySource,
    apiKeyStatus,
    changeApiKey,
    saveApiKey,
    setApiKeyStatus,
    skipApiKey,
    skipped,
  } = useApiSession();
  const [page, setPage] = useState(() => {
    const start = storage.get("startPage") || "home";
    return start === "history" ? "library" : start;
  });
  const [selected, setSelected] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [dlSearchOpen, setDlSearchOpen] = useState(false);
  const [librarySort, setLibrarySort] = useState(
    () => storage.get(STORAGE_KEYS.LIBRARY_SORT) || "manual",
  );
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [platform, setPlatform] = useState(() => {
    const userAgent = navigator.userAgent || "";
    if (userAgent.includes("Windows")) return "win32";
    if (userAgent.includes("Linux")) return "linux";
    if (userAgent.includes("Mac")) return "darwin";
    return null;
  });

  // Navigation history stack for Ctrl+Z back navigation
  const [navStack, setNavStack] = useState([]);

  const [toast, setToast] = useState(null);
  const {
    addHistory, clearHistory, getMediaType, handleReorderSaved, history,
    inProgress, isSaved, markUnwatched, markWatched, progress, removeHistory,
    saved, savedList, saveProgress, showToast, toggleSave, watched,
  } = useLibraryState({ librarySort, setToast });
  const [updateBanner, setUpdateBanner] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const [trending, setTrending] = useState([]);
  const [trendingTV, setTrendingTV] = useState([]);
  const [loadingHome, setLoadingHome] = useState(false);
  const [offline, setOffline] = useState(() => !navigator.onLine);

  // ── Player accent + subtitle lang ─────────────────────────────────────────
  // Computed once here and passed as a prop to MoviePage / TVPage so neither
  // page needs to touch storage.  Refreshed via "orion:player-settings-changed".
  const readPlayerSettings = () => {
    const accentId = storage.get(STORAGE_KEYS.ACCENT_COLOR) || "orion";
    const inPlayer = storage.get(STORAGE_KEYS.ACCENT_IN_PLAYER) !== false; // default true
    const accentHex = inPlayer
      ? (ACCENT_PRESETS.find((p) => p.id === accentId)?.color ?? null)
      : null;
    const subtitleLang = storage.get(STORAGE_KEYS.SUBTITLE_LANG) || null;
    return { accentColor: accentHex, subtitleLang };
  };
  const [playerSettings, setPlayerSettings] = useState(readPlayerSettings);
  const [miniPlayer, setMiniPlayer] = useState(null);
  const [playbackSession, setPlaybackSession] = useState(null);
  const [miniTransition, setMiniTransition] = useState(null);
  const [expandedLocalDownload, setExpandedLocalDownload] = useState(null);
  const miniReadyResolverRef = useRef(null);
  const miniTransitionTimerRef = useRef(null);
  const manualMiniRequestRef = useRef(false);
  const manualMiniResetTimerRef = useRef(null);

  // ── Scheduled backup: run on startup if due ─────────────────────────────────
  useEffect(() => {
    if (!window.electron?.onScheduledBackupRequested) return;
    const handler = window.electron.onScheduledBackupRequested(async () => {
      try {
        const settings = await window.electron.getScheduledBackupSettings();
        if (!settings?.enabled || !settings?.path) return;
        const data = collectBackupData();
        await window.electron.performScheduledBackup({ data, settings });
      } catch {
        // silently ignore errors on scheduled backup
      }
    });
    return () => window.electron.offScheduledBackupRequested(handler);
  }, []);

  // ── Post-update cache flush ───────────────────────────────────────────────
  // On every start, compare the running version against the last-seen version.
  // If they differ the app was just updated -> clear all caches to prevent problems
  useEffect(() => {
    if (!window.electron?.getAppVersion) return;
    window.electron.getAppVersion().then((version) => {
      const lastVersion = localStorage.getItem("orion_lastVersion");
      if (lastVersion && lastVersion !== version) {
        clearAppCaches();
      }
      localStorage.setItem("orion_lastVersion", version);
    });
  }, []);

  // ── Startup update check ─────────────────────────────────────────────────
  useEffect(() => {
    const autoCheck = storage.get("autoCheckUpdates");
    if (autoCheck === false || autoCheck === 0) return;
    checkForUpdates()
      .then((r) => {
        if (r.hasUpdate) setUpdateBanner(r);
      })
      .catch(() => {}); // silently ignore network errors on startup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    episodeCheckStatus,
    episodeDismissTimerRef,
    setEpisodeCheckStatus,
  } = useEpisodeNotifications({ apiKey, apiKeyLoaded, saved });
  // ── Downloads state ──────────────────────────────────────────────────────
  const {
    activeDownloadCount, downloads, handleDeleteDownload, handleDownloadStarted,
    highlightDownload, setDownloads, setHighlightDownload,
  } = useDownloads();

  // ── Detect platform for Windows titlebar ──────────────────────────────────
  useEffect(() => {
    if (!window.electron?.getPlatform) return;
    let mounted = true;
    window.electron.getPlatform().then((p) => {
      if (!mounted) return;
      setPlatform(p);
      if (p === "win32" || p === "linux") {
        document.documentElement.setAttribute("data-win-titlebar", "1");
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Trending media is loaded below.
  const fetchTrending = useCallback(() => {
    if (!apiKey) return;
    const cached = storage.get("trendingCache");
    const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
    const currentLang = storage.get(STORAGE_KEYS.TMDB_LANG) || "en-US";
    if (
      cached &&
      cached.ts &&
      cached.lang === currentLang &&
      Date.now() - cached.ts < CACHE_TTL
    ) {
      setTrending(cached.movies || []);
      setTrendingTV(cached.tv || []);
      return;
    }
    setLoadingHome(true);
    Promise.all([
      tmdbFetch("/trending/movie/week", apiKey),
      tmdbFetch("/trending/tv/week", apiKey),
    ])
      .then(([m, t]) => {
        const movies = m.results || [];
        const tv = t.results || [];
        setTrending(movies);
        setTrendingTV(tv);
        storage.set("trendingCache", {
          movies,
          tv,
          ts: Date.now(),
          lang: currentLang,
        });
      })
      .catch(() => {})
      .finally(() => setLoadingHome(false));
  }, [apiKey]);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  const retryHome = useCallback(() => {
    if (offline) return;
    fetchTrending();
  }, [offline, fetchTrending]);

  // ── Sync librarySort when changed from Settings ───────────────────────────
  useEffect(() => {
    const handler = (e) => setLibrarySort(e.detail);
    window.addEventListener("orion:library-sort-changed", handler);
    return () =>
      window.removeEventListener("orion:library-sort-changed", handler);
  }, []);

  // ── Re-fetch trending immediately when metadata language changes ──────────
  useEffect(() => {
    const handler = () => fetchTrending();
    window.addEventListener("orion:tmdb-lang-changed", handler);
    return () =>
      window.removeEventListener("orion:tmdb-lang-changed", handler);
  }, [fetchTrending]);

  // ── Refresh player settings (accent + subtitle lang) after save ───────────
  useEffect(() => {
    const handler = () => setPlayerSettings(readPlayerSettings());
    window.addEventListener("orion:player-settings-changed", handler);
    return () =>
      window.removeEventListener("orion:player-settings-changed", handler);
  }, []);
  useEffect(() => {
    // Accent colour
    const accent = storage.get(STORAGE_KEYS.ACCENT_COLOR) || "orion";
    applyAccentColor(accent);
    applyFontPreset(storage.get(STORAGE_KEYS.FONT_PRESET) || "orion");
    // Theme
    const theme = storage.get(STORAGE_KEYS.THEME) || "dark";
    const customVars = storage.get(STORAGE_KEYS.CUSTOM_THEME_VARS) || null;
    applyTheme(theme, customVars);
    applyInteractionAppearance({
      preset: storage.get(STORAGE_KEYS.INTERACTION_HOVER_PRESET) || "balanced",
      override: storage.get(STORAGE_KEYS.INTERACTION_HOVER_COLOR) || "",
      strength: storage.get(STORAGE_KEYS.INTERACTION_GLOW_STRENGTH) ?? 50,
      accentId: accent,
      themeId: theme,
    });
    // Font size
    const font = storage.get(STORAGE_KEYS.FONT_SIZE) || "normal";
    const zoomMap = { sm: 0.85, normal: 1, lg: 1.15 };
    const factor = zoomMap[font] ?? 1;
    if (window.electron?.setZoomFactor) window.electron.setZoomFactor(factor);
    // Compact mode
    const compact = !!storage.get(STORAGE_KEYS.COMPACT_MODE);
    document.body.classList.toggle("compact-mode", compact);
    // Reduce animations
    const noAnim = !!storage.get(STORAGE_KEYS.REDUCE_ANIMATIONS);
    document.body.classList.toggle("no-anim", noAnim);
    const motion = noAnim
      ? "calm"
      : storage.get(STORAGE_KEYS.MOTION_PRESET) || "balanced";
    document.body.dataset.motion = motion;
    document.documentElement.dataset.motion = motion;
    document.body.dataset.background = storage.get(STORAGE_KEYS.BACKGROUND_SCENE) || "orbit";
  }, []);
  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────
  const { navigate: baseNavigate, navigateBack: baseNavigateBack, pageRef } = useNavigation({
    page, selected, setPage, setSelected, setNavStack, setShowSearch,
  });

  const normalizeRect = useCallback((rect) => {
    if (!rect) return null;
    const left = Number.isFinite(Number(rect.left)) ? Number(rect.left) : Number(rect.x);
    const top = Number.isFinite(Number(rect.top)) ? Number(rect.top) : Number(rect.y);
    const width = Number(rect.width);
    const height = Number(rect.height);
    if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
    return { left, top, width, height };
  }, []);

  const beginMiniTransition = useCallback((payload) => {
    const sourceRect = normalizeRect(payload?.sourceRect || playbackSession?.playerRect);
    if (!sourceRect) return;
    const bounds = getMiniPlayerBounds(window);
    const targetRect = {
      left: bounds.x,
      top: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
    const transition = {
      id: Date.now(),
      sourceRect,
      targetRect,
      title: payload?.title || playbackSession?.title || "Now Playing",
      posterPath: payload?.posterPath || payload?.item?.poster_path || playbackSession?.posterPath || playbackSession?.item?.poster_path || null,
      backdropPath: payload?.backdropPath || payload?.item?.backdrop_path || playbackSession?.backdropPath || playbackSession?.item?.backdrop_path || null,
    };
    window.clearTimeout(miniTransitionTimerRef.current);
    setMiniTransition(transition);
    miniTransitionTimerRef.current = window.setTimeout(() => {
      setMiniTransition((current) => current?.id === transition.id ? null : current);
    }, 430);
  }, [normalizeRect, playbackSession]);

  useEffect(() => () => window.clearTimeout(miniTransitionTimerRef.current), []);
  useEffect(() => () => window.clearTimeout(manualMiniResetTimerRef.current), []);

  const handleOpenMiniPlayer = useCallback((payload) => {
    manualMiniRequestRef.current = true;
    window.clearTimeout(manualMiniResetTimerRef.current);
    manualMiniResetTimerRef.current = window.setTimeout(() => {
      manualMiniRequestRef.current = false;
    }, 700);
    beginMiniTransition(payload);
    const next = payload ? { ...payload, mode: "mini", handoffPending: true } : null;
    setMiniPlayer(next);
    setPlaybackSession(next);
    window.setTimeout(() => {
      setMiniPlayer((current) => current ? { ...current, handoffPending: false } : current);
    }, 360);
  }, [beginMiniTransition]);

  const createMiniHandoff = useCallback(async () => {
    const session = playbackSession;
    if (!session?.url) return false;
    const behavior = storage.get(STORAGE_KEYS.MINI_PLAYER_BEHAVIOR) || "auto";
    if (behavior === "manual") return false;
    if (behavior === "ask" && !window.confirm("Continue playing in the mini-player?")) return false;
    let playbackState = session.playbackState || {};
    if (session.webContentsId && window.electron?.queryVideoProgress) {
      playbackState = await settlePlaybackStateWithin(
        window.electron.queryVideoProgress(session.webContentsId),
        160,
        null,
      ) || playbackState;
    }
    const handoff = {
      ...buildPlaybackHandoff(session, playbackState, "mini"),
      handoffPending: true,
      shouldResume: !playbackState.paused,
    };
    beginMiniTransition(handoff);
    setMiniPlayer(handoff);
    setPlaybackSession(handoff);
    window.setTimeout(() => {
      setMiniPlayer((current) => current?.id === handoff.id ? {
        ...current,
        handoffPending: false,
      } : current);
    }, 280);
    return true;
  }, [beginMiniTransition, playbackSession]);

  const handleMiniReady = useCallback((owner) => {
    miniReadyResolverRef.current?.();
    miniReadyResolverRef.current = null;
    if (owner) {
      setPlaybackSession((current) => current ? { ...current, ...owner, mode: "mini" } : current);
    }
  }, []);

  const handleSystemMediaCommand = useCallback(async (command) => {
    const session = playbackSession;
    if (!session) return;
    if (command === "next") {
      session.nextAction?.();
      return;
    }
    if (command === "previous") {
      const state = session.webContentsId
        ? await window.electron?.queryVideoProgress?.(session.webContentsId).catch(() => null)
        : null;
      if (Number(state?.currentTime) > 5 || session.mediaType !== "tv") {
        if (session.webContentsId) window.electron?.controlVideo?.(session.webContentsId, "restart");
        else window.dispatchEvent(new CustomEvent("orion:media-command", { detail: "restart" }));
      } else session.previousAction?.();
      return;
    }
    if (command === "stop") {
      if (session.webContentsId) await window.electron?.controlVideo?.(session.webContentsId, "pause");
      if (session.mode === "popout") window.electron?.closePipWindow?.();
      window.dispatchEvent(new CustomEvent("orion:media-command", { detail: "stop" }));
      setMiniPlayer(null);
      setPlaybackSession(null);
      return;
    }
    if (session.webContentsId) window.electron?.controlVideo?.(session.webContentsId, command);
    else window.dispatchEvent(new CustomEvent("orion:media-command", { detail: command }));
  }, [playbackSession]);

  useSystemIntegration({ playbackSession, onMediaCommand: handleSystemMediaCommand, setToast });

  useEffect(() => {
    if (!window.electron?.onPlayerShortcut) return undefined;
    const handler = window.electron.onPlayerShortcut((command) => {
      if (command === "mini") {
        if (playbackSession?.mode === "embedded") createMiniHandoff();
        return;
      }
      handleSystemMediaCommand(command);
    });
    return () => window.electron.offPlayerShortcut?.(handler);
  }, [createMiniHandoff, handleSystemMediaCommand, playbackSession?.mode]);

  useEffect(() => {
    if (!window.electron?.onPipOpened) return undefined;
    const handler = window.electron.onPipOpened(async () => {
      const webContentsId = await window.electron.getPipWebContentsId?.().catch(() => null);
      setPlaybackSession((current) => current ? { ...current, mode: "popout", webContentsId } : current);
    });
    return () => window.electron.offPipOpened?.(handler);
  }, []);

  const transitionNavigation = useCallback((action) => {
    const reduced = storage.get(STORAGE_KEYS.REDUCE_ANIMATIONS) ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (!reduced && document.startViewTransition) document.startViewTransition(action);
    else action();
  }, []);

  const navigate = useCallback(async (nextPage, data = null) => {
    const beginsAnotherTitle = (nextPage === "movie" || nextPage === "tv") &&
      (!playbackSession || nextPage !== playbackSession.mediaType || Number(data?.id) !== Number(playbackSession.mediaId));
    if (playbackSession?.mode === "embedded" && !beginsAnotherTitle) await createMiniHandoff();
    if (beginsAnotherTitle) {
      if (playbackSession?.webContentsId) window.electron?.controlVideo?.(playbackSession.webContentsId, "pause");
      setMiniPlayer(null);
      setPlaybackSession(null);
    }
    transitionNavigation(() => baseNavigate(nextPage, data));
  }, [baseNavigate, createMiniHandoff, playbackSession, transitionNavigation]);

  const navigateBack = useCallback(async () => {
    if (manualMiniRequestRef.current) {
      manualMiniRequestRef.current = false;
      transitionNavigation(baseNavigateBack);
      return;
    }
    if (playbackSession?.mode === "embedded") await createMiniHandoff();
    transitionNavigation(baseNavigateBack);
  }, [baseNavigateBack, createMiniHandoff, playbackSession, transitionNavigation]);

  const handlePlaybackSession = useCallback((session) => {
    if (session) setPlaybackSession({ ...session, mode: "embedded" });
  }, []);

  const handleExpandMiniPlayer = useCallback((playbackState) => {
    setMiniPlayer((current) => {
      if (!current) return null;
      if (current.local && current.download) {
        setExpandedLocalDownload(current.download);
        setPlaybackSession(null);
        return null;
      }
      const safeTime = Math.max(0, Number(playbackState?.currentTime) || 0);
      const targetItem = { ...current.item, autoplay: true, handoffTime: safeTime };
      if (current.mediaType === "tv") {
        targetItem.season = current.season;
        targetItem.episode = current.episode;
      }
      const progressKey = current.mediaType === "tv"
        ? `tv_${current.mediaId}_s${current.season}e${current.episode}`
        : `movie_${current.mediaId}`;
      storage.set("dlTime_" + progressKey, safeTime);
      setPlaybackSession(null);
      baseNavigate(current.mediaType, targetItem);
      return null;
    });
  }, [baseNavigate]);

  // Sync Mini-Player state to Electron main process
  useEffect(() => {
    if (!window.electron) return;
    if (miniPlayer) {
      window.electron.setMiniPlayerStatus(true, miniPlayer.title);
    } else {
      window.electron.setMiniPlayerStatus(false, null);
    }
  }, [miniPlayer]);

  // Listen for Electron tray commands
  useEffect(() => {
    if (!window.electron?.onStopMiniPlayer) return;

    const stopHandler = window.electron.onStopMiniPlayer(() => {
      setMiniPlayer(null);
    });

    return () => {
      window.electron.offStopMiniPlayer(stopHandler);
    };
  }, []);

  useEffect(() => {
    if (!window.electron?.onPipClosed) return;
    const handler = window.electron.onPipClosed((payload) => {
      const context = payload?.state?.orionContext;
      if (!payload?.url || !context) return;
      const playbackState = { ...payload.state };
      delete playbackState.orionContext;
      const mini = { ...context, url: payload.url, title: context.title || payload.title, playbackState, mode: "mini" };
      setMiniPlayer(mini);
      setPlaybackSession(mini);
      if (pageRef.current === "movie" || pageRef.current === "tv") baseNavigateBack();
    });
    return () => window.electron.offPipClosed?.(handler);
  }, [baseNavigateBack, pageRef]);

  useEffect(() => {
    if (!window.electron) return;
    window.electron.setCloseBehavior?.(
      storage.get(STORAGE_KEYS.CLOSE_TO_TRAY) || "ask",
    );
    if (!window.electron.onTrayOpenPage) return;
    const handler = window.electron.onTrayOpenPage((targetPage) => {
      if (["home", "library", "downloads", "settings"].includes(targetPage)) {
        navigate(targetPage);
      }
    });
    return () => window.electron.offTrayOpenPage?.(handler);
  }, [navigate]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        if (pageRef.current === "downloads") {
          e.preventDefault();
          setDlSearchOpen(true);
        }
      }
      if (e.key === "Escape") {
        setShowSearch(false);
        setShowShortcuts(false);
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target?.tagName || "").toUpperCase();
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          setShowShortcuts((v) => !v);
        }
      }
      // Ctrl+Z / Cmd+Z → navigate back
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        navigateBack();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault();
        window.location.reload();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigateBack]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleSelectResult = useCallback(
    (item) => {
      const target = item.media_type === "person"
        ? "person"
        : item.media_type === "tv" ? "tv" : "movie";
      navigate(target, item);
    },
    [navigate],
  );

  // Stable handler
  const handleGoToDownloads = useCallback(
    (id) => {
      setHighlightDownload(id || null);
      navigate("downloads");
    },
    [navigate],
  );

  const hasCustomTitlebar = platform === "win32" || platform === "linux";
  const standaloneShell = (content) => (
    <ErrorBoundary>
      <div className="app-shell">
        {hasCustomTitlebar && <WindowTitlebar />}
        <div className="app-body">{content}</div>
      </div>
    </ErrorBoundary>
  );

  if (!apiKeyLoaded) return standaloneShell(null);
  if (!apiKey && !skipped)
    return standaloneShell(
      <SetupScreen
        onSave={saveApiKey}
        onSkip={skipApiKey}
      />,
    );

  return (
    <ErrorBoundary>
      <div className="app-shell">
        {hasCustomTitlebar && <WindowTitlebar />}
        <div className="app-body">
        <Sidebar
          activePage={page}
          page={page}
          onNavigate={navigate}
          onSearch={() => setShowSearch(true)}
          downloadCount={activeDownloadCount}
          activeDownloads={activeDownloadCount}
          onReorderSaved={handleReorderSaved}
          onRemoveSaved={toggleSave}
          canGoBack={navStack.length > 0}
          onBack={navigateBack}
          onShowShortcuts={() => setShowShortcuts(true)}
        />

        <main className="app-content">
          {/* ── API key status banner ── */}
          {/* Suspense boundary: lazy page chunks are fetched on first visit */}
          {apiKeyStatus === "invalid_token" && (
            <div className="api-status-banner api-status-error">
              <span>
                ⚠ Your TMDB token is invalid, not set or has been revoked.
                Movies and shows won't load.
              </span>
              <button className="api-status-btn" onClick={changeApiKey}>
                Update Token
              </button>
            </div>
          )}
          {apiKeyStatus === "unreachable" && (
            <div className="api-status-banner api-status-warn">
              <span>
                ⚠ Cannot reach TMDB, check your internet connection. Content may
                not load.
              </span>
              <button
                className="api-status-btn"
                onClick={() =>
                  setApiKeyStatus("checking") || window.location.reload()
                }
              >
                Retry
              </button>
            </div>
          )}
          <AppRoutes model={{
            addHistory, apiKey, apiKeySource, changeApiKey, clearHistory, dlSearchOpen,
          downloads, handleDeleteDownload, handleDownloadStarted, handleGoToDownloads,
          handleReorderSaved, handleSelectResult, highlightDownload, history, inProgress,
          isSaved, librarySort, loadingHome, markUnwatched, markWatched, navigate, navigateBack,
          offline, page, playerSettings, progress, removeHistory, retryHome, savedList,
          saveProgress, selected, setDlSearchOpen, setDownloads, setHighlightDownload,
          setLibrarySort, setMiniPlayer: handleOpenMiniPlayer, toggleSave, trending, trendingTV, watched,
          onPlaybackSession: handlePlaybackSession,
        }} />
        </main>
        </div>

        <AppOverlays model={{
          activeDownloadCount, apiKey, episodeCheckStatus, episodeDismissTimerRef,
          handleExpandMiniPlayer, handleSelectResult, hasCustomTitlebar, miniPlayer,
          handleMiniReady, miniTransition,
          navigate, offline, openMiniPlayer: handleOpenMiniPlayer, setEpisodeCheckStatus, setMiniPlayer, setShowSearch,
          setShowShortcuts, setShowUpdateModal, setUpdateBanner, showSearch,
          showShortcuts, showUpdateModal, toast, updateBanner,
          saveProgress, markWatched,
          expandedLocalDownload, setExpandedLocalDownload, addHistory,
          handleDeleteDownload,
        }} />
      </div>
    </ErrorBoundary>
  );
}
