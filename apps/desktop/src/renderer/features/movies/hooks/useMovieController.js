import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  memo,
  useCallback,
  useMemo,
} from "react";
import {
  tmdbFetch,
  imgUrl,
  PLAYER_SOURCES,
  getSourceUrl,
  sourceSupportsProgress,
  sourceProgressViaFrames,
  sourceIsAsync,
  getSourceResumeParams,
  normalizeSelectableSourceId,
  fetchAnilistData,
  cleanAnilistDescription,
  isAnimeContent,
  ANIME_DEFAULT_SOURCE,
  NON_ANIME_DEFAULT_SOURCE,
  NEEDS_INTERCEPT,
  getNextNonAsyncSource,
  getNextHealthyNonAsyncSource,
} from "../../../services/tmdb";
import {
  PlayIcon,
  BookmarkIcon,
  BookmarkFillIcon,
  BackIcon,
  StarIcon,
  FilmIcon,
  DownloadIcon,
  WatchedIcon,
  TrailerIcon,
  RatingShieldIcon,
  RatingLockIcon,
  SourceIcon,
  ShieldBlockIcon,
  PopOutIcon,
  MiniPlayerIcon,
} from "../../../components/common/Icons";
import DownloadModal from "../../../components/DownloadModal";
import TrailerModal from "../../../components/TrailerModal";
import BlockedStatsModal from "../../../components/BlockedStatsModal";
import { formatDate } from "../../../shared/utils/date";
import { useBlockedStats } from "../../../shared/utils/useBlockedStats";
import MediaCard from "../../../components/media/MediaCard";
import { setupAmbientGlow } from "../../../shared/utils/playerAmbient";
import {
  storage,
  STORAGE_KEYS,
  getFailoverSource,
  setFailoverSource,
  clearFailoverSource,
} from "../../../services/settingsStore";
import {
  fetchMovieRating,
  isRestricted,
  getAgeLimitSetting,
  getRatingCountry,
} from "../../../shared/utils/ageRating";
import { useMovieWebview } from "./useMovieWebview";
import { getReadyWebContentsId } from "../../player/services/webviewLifecycle";
import { useTitleCredits } from "../../../shared/hooks/useTitleCredits";

export function useMovieController({
  item,
  apiKey,
  playerSettings,
  onSave,
  isSaved,
  onHistory,
  progress,
  saveProgress,
  onBack,
  onSettings,
  onDownloadStarted,
  watched,
  onMarkWatched,
  onMarkUnwatched,
  downloads,
  onGoToDownloads,
  onSelect,
  onOpenMiniPlayer,
  onPlay,
  onPlaybackSession,
}) {
const [details, setDetails] = useState(null);
  const { cast, keyCrew, loading: creditsLoading } = useTitleCredits({ mediaType: "movie", mediaId: item.id, apiKey });
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [m3u8Url, setM3u8Url] = useState(null);
  const [m3u8Context, setM3u8Context] = useState(null);
  const [captureSessionId, setCaptureSessionId] = useState(null);
  const [interceptedSubs, setInterceptedSubs] = useState([]);
  const [playerSource, setPlayerSource] = useState(
    () => normalizeSelectableSourceId(storage.get("playerSource") || NON_ANIME_DEFAULT_SOURCE),
  );
  const [ambientColor, setAmbientColor] = useState("");
  const [ambientGlowEnabled, setAmbientGlowEnabled] = useState(
    () => (storage.get(STORAGE_KEYS.AMBIENT_PROFILE) || (storage.get(STORAGE_KEYS.AMBIENT_GLOW) === false ? "off" : "balanced")) !== "off",
  );
  const autoplayDoneRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    let openedSessionId = null;
    setM3u8Url(null);
    setM3u8Context(null);
    window.electron?.beginStreamCapture?.({
      mediaIdentity: { mediaType: "movie", mediaId: item.id },
      sourceId: playerSource,
      webContentsId: getReadyWebContentsId(webviewRef.current),
    }).then((session) => {
      if (disposed) {
        if (session?.id) window.electron?.endStreamCapture?.(session.id);
        return;
      }
      openedSessionId = session?.id || null;
      setCaptureSessionId(openedSessionId);
    });
    return () => {
      disposed = true;
      if (openedSessionId) window.electron?.endStreamCapture?.(openedSessionId);
    };
  }, [item.id, playerSource]);

  // Accent colour + subtitle lang come from App-level state (via props),
  // so they are always fresh after Settings save without any extra storage reads.
  const playerAccentColor = playerSettings?.accentColor ?? null;
  const playerSubLang = playerSettings?.subtitleLang ?? null;
  const progressViaFrames = useMemo(
    () => sourceProgressViaFrames(playerSource),
    [playerSource],
  );
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [dubMode, setDubMode] = useState(
    () => storage.get(STORAGE_KEYS.ALLMANGA_DUB_MODE) || "sub",
  );
  const [anilistData, setAnilistData] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const sourceRef = useRef(null);
  const playerWrapRef = useRef(null);
  const webviewRef = useRef(null);
  const switchingToMiniPlayerRef = useRef(false);
  const [voiceBoost, setVoiceBoost] = useState(() => !!storage.get("voiceBoostEnabled"));
  // Always-current refs for interval callbacks, avoids stale closures without restarting the interval
  const saveProgressRef = useRef(saveProgress);
  saveProgressRef.current = saveProgress;
  const onMarkWatchedRef = useRef(onMarkWatched);
  onMarkWatchedRef.current = onMarkWatched;
  // AllManga async URL resolution
  const [resolvedPlayerUrl, setResolvedPlayerUrl] = useState(null);
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [resolveError, setResolveError] = useState(null);
  // Refs mirror the above so the resolve-effect can guard without stale closures
  const resolvingUrlRef = useRef(false);
  const resolvedPlayerUrlRef = useRef(null);
  const [collection, setCollection] = useState(null); // { name, parts }
  // Webview loading overlay
  const [webviewLoading, setWebviewLoading] = useState(false);
  const [playerFullscreen, setPlayerFullscreen] = useState(false);
  const [playerControlsVisible, setPlayerControlsVisible] = useState(true);
  const playerIdleTimerRef = useRef(null);
  // pipOpen=true: main webview shows about:blank, pop-out window has the real player
  const [pipOpen, setPipOpen] = useState(false);
  const pipUrlRef = useRef(null); // URL to restore when pop-out closes
  const pipWebContentsIdRef = useRef(null); // cached WebContents ID of the pop-out window
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeTime, setResumeTime] = useState(0);
  const initialSeekDoneRef = useRef(false);
  const [showFailoverPrompt, setShowFailoverPrompt] = useState(false);
  const failoverTimeoutRef = useRef(null);

  const revealPlayerControls = useCallback(() => {
    setPlayerControlsVisible(true);
    clearTimeout(playerIdleTimerRef.current);
    if (!playing || webviewLoading || showSourceMenu || resolveError || pipOpen) return;
    playerIdleTimerRef.current = setTimeout(() => {
      setPlayerControlsVisible(false);
    }, 2400);
  }, [playing, webviewLoading, showSourceMenu, resolveError, pipOpen]);

  useEffect(() => {
    revealPlayerControls();
    return () => clearTimeout(playerIdleTimerRef.current);
  }, [revealPlayerControls]);

  // Derived: detect anime before any effects so effects can use it
  const isAnime = useMemo(
    () => isAnimeContent(item, details),
    [item.id, details],
  );
  const [downloaderFolder, setDownloaderFolder] = useState(
    () => storage.get("downloaderFolder") || "",
  );

  // Blocked request stats
  const {
    sessionTotal: blockedSession,
    alltimeTotal: blockedAlltime,
    showModal: showBlockedModal,
    setShowModal: setShowBlockedModal,
    getSessionDomains: getBlockedDomains,
  } = useBlockedStats(item.id);

  // Age rating
  const [rating, setRating] = useState({ cert: null, minAge: null });
  const ageLimitSetting = useMemo(() => getAgeLimitSetting(storage), []);
  const ratingCountry = useMemo(() => getRatingCountry(storage), []);
  const restricted = isRestricted(rating.minAge, ageLimitSetting);

  const progressKey = `movie_${item.id}`;
  const pct = progress[progressKey] || 0;
  const isWatched = !!watched?.[progressKey];
  const hasProgress = pct > 0;

  // ── Derived display values (must be declared before any callbacks that use them) ──
  const d = details || item;
  const title = d.title || d.name;
  const year = (d.release_date || "").slice(0, 4);
  const mediaName = `${title}${year ? " (" + year + ")" : ""}`;
  const handleLibrarySave = useCallback(() => {
    onSave?.({ ...item, ...d, media_type: "movie" });
  }, [d, item, onSave]);

  useEffect(() => {
    if (!playing || pipOpen) return;
    const url = sourceIsAsync(playerSource)
      ? resolvedPlayerUrl
      : getSourceUrl(playerSource, "movie", { tmdbId: item.id, imdbId: d.imdb_id }, null, null, getSourceResumeParams(playerSource, storage.get("dlTime_" + progressKey)), playerAccentColor, playerSubLang);
    if (!url) return;
    const playerRect = playerWrapRef.current?.getBoundingClientRect?.();
    onPlaybackSession?.({
      id: `movie:${item.id}:${playerSource}`,
      mediaType: "movie",
      mediaId: item.id,
      mediaIdentity: { mediaType: "movie", mediaId: item.id },
      sourceId: playerSource,
      url,
      playbackUrl: url,
      title,
      item,
      webContentsId: getReadyWebContentsId(webviewRef.current),
      playerRect: playerRect ? {
        left: playerRect.left,
        top: playerRect.top,
        width: playerRect.width,
        height: playerRect.height,
      } : null,
      currentTime: Number(storage.get("dlTime_" + progressKey)) || 0,
      updatedAt: Date.now(),
    });
  }, [playing, pipOpen, resolvedPlayerUrl, playerSource, webviewLoading, item.id, title, onPlaybackSession]);

  const { watchedSecs, totalSecs, displayPct, progressLabel } = useMemo(() => {
    const watchedSecs = storage.get("dlTime_" + progressKey) || 0;
    const totalSecs = d?.runtime ? d.runtime * 60 : 0;
    const derivedPct =
      watchedSecs > 0 && totalSecs > 0
        ? Math.floor((watchedSecs / totalSecs) * 100)
        : 0;
    const displayPct = pct > 0 ? pct : derivedPct;
    const fmt = (s) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = Math.floor(s % 60);
      return h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
        : `${m}:${String(sec).padStart(2, "0")}`;
    };
    const progressLabel =
      watchedSecs > 0 && totalSecs > 0
        ? `${fmt(watchedSecs)} / ${fmt(totalSecs)}`
        : watchedSecs > 0
          ? fmt(watchedSecs)
          : displayPct > 0
            ? `${displayPct}%`
            : null;
    return { watchedSecs, totalSecs, displayPct, progressLabel };
  }, [progressKey, pct, d?.runtime]);

  // Read threshold from settings (default 20s), stable across renders
  const [watchedThreshold] = useState(
    () => storage.get("watchedThreshold") ?? 20,
  );

  // Ref to prevent double-marking
  const autoMarkedRef = useRef(false);
  // Tracks last known playback position, used to detect resolution-change resets
  const lastKnownTimeRef = useRef(0);
  // Timestamp until which we ignore reset detection (post-seekback cooldown)
  const seekBackCooldownRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    tmdbFetch(`/movie/${item.id}`, apiKey)
      .then((d) => {
        if (mounted) {
          setDetails(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setDetails(item);
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [item.id, apiKey]);

  useEffect(() => {
    let mounted = true;
    fetchMovieRating(item.id, apiKey, ratingCountry).then((r) => {
      if (mounted) setRating(r);
    });
    return () => {
      mounted = false;
    };
  }, [item.id, apiKey, ratingCountry]);

  // Autoplay hook
  useEffect(() => {
    autoplayDoneRef.current = false;
  }, [item.id]);


  // Ambient glow settings sync
  useEffect(() => {
    const handler = () => {
      setAmbientGlowEnabled((storage.get(STORAGE_KEYS.AMBIENT_PROFILE) || (storage.get(STORAGE_KEYS.AMBIENT_GLOW) === false ? "off" : "balanced")) !== "off");
    };
    window.addEventListener("orion:player-settings-changed", handler);
    return () => {
      window.removeEventListener("orion:player-settings-changed", handler);
    };
  }, []);

  // Ambient glow hook
  useEffect(() => {
    if (!playing || !ambientGlowEnabled || playerFullscreen) {
      setAmbientColor("");
      return;
    }
    const wv = webviewRef.current;
    const wrap = playerWrapRef.current;
    if (!wv || !wrap) return;

    const cleanup = setupAmbientGlow(wv, (colorDataUrl) => {
      setAmbientColor(colorDataUrl);
    }, { captureElement: wrap });

    return () => {
      cleanup();
    };
  }, [playing, resolvedPlayerUrl, playerSource, ambientGlowEnabled, playerFullscreen]);

  useEffect(() => {
    let mounted = true;
    tmdbFetch(`/movie/${item.id}/videos`, apiKey)
      .then((data) => {
        if (!mounted) return;
        const videos = data.results || [];
        const trailer =
          videos.find((v) => v.type === "Trailer" && v.site === "YouTube") ||
          videos.find((v) => v.site === "YouTube");
        if (trailer) setTrailerKey(trailer.key);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [item.id, apiKey]);

  // Fetch movie collection (sequels/prequels)
  useEffect(() => {
    setCollection(null);
    if (!details?.belongs_to_collection?.id) return;
    let mounted = true;
    tmdbFetch(`/collection/${details.belongs_to_collection.id}`, apiKey)
      .then((data) => {
        if (!mounted) return;
        const parts = (data.parts || [])
          .map((p) => ({ ...p, media_type: "movie" }))
          .sort((a, b) =>
            (a.release_date || "").localeCompare(b.release_date || ""),
          );
        if (parts.length > 1) {
          setCollection({ name: data.name, parts });
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [details?.belongs_to_collection?.id, apiKey]);

  // Reset m3u8 URL, subtitle URL and source menu whenever the movie or source changes
  useEffect(() => {
    setM3u8Url(null);
    setInterceptedSubs([]);
    setShowSourceMenu(false);
    setAnilistData(null);
    resolvedPlayerUrlRef.current = null;
    setResolvedPlayerUrl(null);
    resolvingUrlRef.current = false;
    setResolvingUrl(false);
    setResolveError(null);
    initialSeekDoneRef.current = false;
    setWebviewLoading(true); // instantly blank the player on every source/item switch
  }, [item.id, playerSource, dubMode]);

  // Fetch AniList data + auto-set source for anime/non-anime
  useEffect(() => {
    let mounted = true;
    if (isAnime) {
      fetchAnilistData(item.title || item.name, "ANIME", item.id).then(
        (data) => {
          if (mounted && data) setAnilistData(data);
        },
      );
      // Switch to anime source if current source is not an anime source
      const currentSrc = PLAYER_SOURCES.find((s) => s.id === playerSource);
      if (!currentSrc?.tag) {
        const saved = storage.get("playerSource");
        const savedSrc = PLAYER_SOURCES.find((s) => s.id === saved);
        setPlayerSource(savedSrc?.tag ? saved : ANIME_DEFAULT_SOURCE);
      }
    } else {
      // Switch back to non-anime source if current source is anime-only
      const currentSrc = PLAYER_SOURCES.find((s) => s.id === playerSource);
      if (currentSrc?.tag) {
        const saved = storage.get("playerSource");
        const savedSrc = PLAYER_SOURCES.find((s) => s.id === saved);
        setPlayerSource(!savedSrc?.tag ? saved : NON_ANIME_DEFAULT_SOURCE);
      }
    }
    return () => {
      mounted = false;
    };
  }, [item.id, isAnime]);

  // Resolve AllManga movie URL via main-process IPC
  useEffect(() => {
    if (!playing) return;
    const epKey = `movie_${item.id}_${dubMode}`;

    // Auto-failover: if a previous attempt taught us AllManga doesn't have
    // this title, skip straight to the cached fallback source.
    if (sourceIsAsync(playerSource)) {
      const cached = getFailoverSource(epKey);
      if (cached && cached !== playerSource) {
        setM3u8Url(null);
        setInterceptedSubs([]);
        resolvedPlayerUrlRef.current = null;
        setResolvedPlayerUrl(null);
        resolvingUrlRef.current = false;
        setResolvingUrl(false);
        setResolveError(null);
        setPlayerSource(cached);
        return;
      }
    }

    if (!sourceIsAsync(playerSource)) return;
    if (!window.electron?.resolveAllManga) {
      setResolveError("Orion's desktop bridge is unavailable. Restart Orion and try again.");
      return;
    }
    // Use refs as guards
    if (resolvedPlayerUrlRef.current || resolvingUrlRef.current) return;
    resolvingUrlRef.current = true;
    setResolvingUrl(true);
    setResolveError(null);
    const startTime = storage.get("dlTime_" + progressKey) || 0;
    let mounted = true;
    window.electron
      .resolveAllManga({
        title,
        seasonNumber: 1,
        episodeNumber: 1,
        isMovie: true,
        translationType: dubMode,
      })
      .then((res) => {
        if (!mounted) return;
        if (res?.ok && res.url) {
          clearFailoverSource(epKey);
          if (res.isDirectMp4 !== undefined) {
            window.electron
              .setPlayerVideo({
                url: res.url,
                referer: res.referer || "https://allmanga.to",
                startTime,
              })
              .then((r) => {
                if (!mounted) return;
                resolvedPlayerUrlRef.current = r.playerUrl;
                setResolvedPlayerUrl(r.playerUrl);
                setM3u8Url(res.url);
              })
              .catch(() => {
                if (mounted) setResolveError("Failed to start local player");
              });
          } else {
            resolvedPlayerUrlRef.current = res.url;
            setResolvedPlayerUrl(res.url);
          }
        } else {
          // AllManga doesn't have this title → switch to the next source
          // automatically and remember the choice for next time.
          const next = getNextHealthyNonAsyncSource(playerSource);
          if (next) {
            setFailoverSource(epKey, next);
            setM3u8Url(null);
            setInterceptedSubs([]);
            resolvedPlayerUrlRef.current = null;
            setResolvedPlayerUrl(null);
            setResolveError(null);
            setPlayerSource(next);
          } else {
            setResolveError(res?.error || "Movie not found on AllManga");
          }
        }
      })
      .catch((e) => {
        if (mounted) setResolveError(e.message || "Error");
      })
      .finally(() => {
        if (mounted) {
          resolvingUrlRef.current = false;
          setResolvingUrl(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [playing, playerSource, dubMode]);

  useEffect(() => {
    if (!window.electron) return;
    const handler = window.electron.onM3u8Found((payload) => {
      if (captureSessionId && payload?.sessionId && payload.sessionId !== captureSessionId) return;
      const url = typeof payload === "string" ? payload : payload?.url || payload?.displayUrl;
      if (!url) return;
      setM3u8Url((prev) => (prev !== url ? url : prev));
      setM3u8Context(typeof payload === "string" ? { url } : payload);
    });
    return () => window.electron.offM3u8Found(handler);
  }, [captureSessionId]);

  // Close source dropdown on scroll or click-outside
  useEffect(() => {
    if (!showSourceMenu) return;
    const close = () => setShowSourceMenu(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    const handleClick = (e) => {
      if (
        sourceRef.current?.contains(e.target) ||
        e.target.closest(".source-dropdown")
      )
        return;
      close();
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      document.removeEventListener("mousedown", handleClick);
    };
  }, [showSourceMenu]);

  useEffect(() => {
    if (!window.electron) return;
    const handler = window.electron.onSubtitleFound(({ url, lang, contentType }) => {
      // Main-process MIME classification also supports extensionless WebVTT.
      if (!url || (!url.toLowerCase().includes(".vtt") && !String(contentType).toLowerCase().includes("vtt"))) return;
      setInterceptedSubs((prev) => {
        const filtered = prev.filter((s) => s.lang !== lang);
        return [...filtered, { url, lang: lang || "unknown" }];
      });
    });
    return () => window.electron.offSubtitleFound(handler);
  }, []);

    const { handleFailoverNextSource, handlePlay, startMoviePlayback } = useMovieWebview({
    autoMarkedRef, autoplayDoneRef, d, dubMode, failoverTimeoutRef, initialSeekDoneRef, isWatched, item, lastKnownTimeRef, loading, onHistory, onMarkWatchedRef, onPlay, pipUrlRef, pipWebContentsIdRef, playerSource, playerWrapRef, playing, progressKey, progressViaFrames, resolvedPlayerUrlRef, resolvingUrlRef, saveProgress, saveProgressRef, seekBackCooldownRef, setInterceptedSubs, setM3u8Url, setPipOpen, setPlayerFullscreen, setPlayerSource, setPlaying, setResolveError, setResolvedPlayerUrl, setResolvingUrl, setResumeTime, setShowFailoverPrompt, setShowResumePrompt, setWebviewLoading, switchingToMiniPlayerRef, voiceBoost, watchedThreshold, webviewLoading, webviewRef
  });

  const handleSetDownloaderFolder = useCallback((folder) => {
    setDownloaderFolder(folder);
    storage.set("downloaderFolder", folder);
  }, []);

  // Prefer AniList metadata for anime when available
  const displayOverview =
    isAnime && anilistData?.description
      ? cleanAnilistDescription(anilistData.description)
      : d.overview;
  const displayScore =
    isAnime && anilistData?.averageScore
      ? (anilistData.averageScore / 10).toFixed(1)
      : d.vote_average > 0
        ? d.vote_average.toFixed(1)
        : null;
  const displayGenres =
    isAnime && anilistData?.genres?.length
      ? anilistData.genres.map((g, i) => ({ id: i, name: g }))
      : d.genres || [];

  // Unreleased detection
  const isUnreleased = useMemo(() => {
    if (!d.release_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(d.release_date) > today;
  }, [d.release_date]);

  // Check if this movie is already downloaded or currently downloading
  const movieDownload = (downloads || []).find(
    (dl) =>
      dl.mediaType === "movie" &&
      (dl.tmdbId === item.id || dl.mediaId === item.id) &&
      (dl.status === "completed" ||
        dl.status === "local" ||
        dl.status === "downloading"),
  );

  const formatResumeTime = (seconds) => {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  };

    const viewModel = { ambientColor, blockedAlltime, blockedSession, collection, d, displayGenres, displayOverview, displayPct, displayScore, downloaderFolder, dubMode, formatResumeTime, getBlockedDomains, handleFailoverNextSource, handlePlay, handleSetDownloaderFolder, hasProgress, interceptedSubs, isSaved, isUnreleased, isWatched, item, m3u8Context, m3u8Url, mediaName, menuPos, movieDownload, onBack, onDownloadStarted, onGoToDownloads, onMarkUnwatched, onMarkWatched, onOpenMiniPlayer, onSave: handleLibrarySave, onSelect, onSettings, pipOpen, pipUrlRef, playerAccentColor, playerControlsVisible, playerFullscreen, playerSource, playerSubLang, playerWrapRef, playing, progress, progressKey, progressLabel, rating, resolveError, resolvedPlayerUrl, resolvedPlayerUrlRef, resolvingUrl, resolvingUrlRef, restricted, resumeTime, revealPlayerControls, saveProgress, setDubMode, setInterceptedSubs, setM3u8Url, setMenuPos, setPlayerSource, setResolveError, setResolvedPlayerUrl, setResolvingUrl, setShowBlockedModal, setShowDownload, setShowResumePrompt, setShowSourceMenu, setShowTrailer, setVoiceBoost, showBlockedModal, showDownload, showFailoverPrompt, showResumePrompt, showSourceMenu, showTrailer, sourceRef, startMoviePlayback, switchingToMiniPlayerRef, title, trailerKey, voiceBoost, watched, webviewLoading, webviewRef };
    viewModel.cast = cast;
    viewModel.keyCrew = keyCrew;
    viewModel.creditsLoading = creditsLoading;
    viewModel.captureSessionId = captureSessionId;
    return viewModel;
}
