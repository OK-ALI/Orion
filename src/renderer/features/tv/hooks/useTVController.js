import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import {
  EPISODE_GROUP_IDS,
  applyEpisodeMapping,
  buildEpisodeGroupMap,
} from "../../../shared/utils/episodeMappings";
import {
  tmdbFetch,
  imgUrl,
  PLAYER_SOURCES,
  getSourceUrl,
  sourceSupportsProgress,
  sourceProgressViaFrames,
  sourceIsAsync,
  fetchAnilistData,
  fetchEpisodeGroup,
  buildAnilistSeasons,
  cleanAnilistDescription,
  isAnimeContent,
  ANIME_DEFAULT_SOURCE,
  NON_ANIME_DEFAULT_SOURCE,
  NEEDS_INTERCEPT,
  getNextNonAsyncSource,
  getNextHealthyNonAsyncSource,
} from "../../../services/tmdb";
import {
  BookmarkIcon,
  BookmarkFillIcon,
  BackIcon,
  StarIcon,
  PlayIcon,
  TVIcon,
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
import { setupAmbientGlow } from "../../../shared/utils/playerAmbient";
import DownloadModal from "../../../components/DownloadModal";
import TrailerModal from "../../../components/TrailerModal";
import BlockedStatsModal from "../../../components/BlockedStatsModal";
import { formatDate } from "../../../shared/utils/date";
import { useBlockedStats } from "../../../shared/utils/useBlockedStats";
import {
  storage,
  STORAGE_KEYS,
  getFailoverSource,
  setFailoverSource,
  clearFailoverSource,
} from "../../../services/settingsStore";
import { useAutoplay } from "../../../shared/utils/useAutoplay";
import { fetchAniSkipTimings } from "../../../shared/utils/aniSkip";
import {
  fetchTVRating,
  isRestricted,
  getAgeLimitSetting,
  getRatingCountry,
} from "../../../shared/utils/ageRating";
import { useTVEpisodeCatalog } from "./useTVEpisodeCatalog";
import { useTVWebview } from "./useTVWebview";
import { useTVEpisodeActions } from "./useTVEpisodeActions";
import { getReadyWebContentsId } from "../../player/services/webviewLifecycle";
import { useTitleCredits } from "../../../shared/hooks/useTitleCredits";

export function useTVController({
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
  onOpenMiniPlayer,
  onPlay,
  onPlaybackSession,
  onSelect,
}) {
const [details, setDetails] = useState(null);
  const { cast, keyCrew, loading: creditsLoading } = useTitleCredits({ mediaType: "tv", mediaId: item.id, apiKey, creators: details?.created_by || [] });
  const [seasonData, setSeasonData] = useState(null);
  const [failedSeasons, setFailedSeasons] = useState(() => new Set()); // season numbers which give 404 on TMDB
  const [selectedSeason, setSelectedSeason] = useState(() =>
    item.season != null ? Number(item.season) : 1,
  );
  const [selectedEp, setSelectedEp] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [ambientColor, setAmbientColor] = useState("");
  const [ambientGlowEnabled, setAmbientGlowEnabled] = useState(
    () => (storage.get(STORAGE_KEYS.AMBIENT_PROFILE) || (storage.get(STORAGE_KEYS.AMBIENT_GLOW) === false ? "off" : "balanced")) !== "off",
  );
  const autoplayDoneRef = useRef(false);

  // Resume playback & auto-failover states
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeTime, setResumeTime] = useState(0);
  const [pendingEpToPlay, setPendingEpToPlay] = useState(null);
  const initialSeekDoneRef = useRef(false);
  const [showFailoverPrompt, setShowFailoverPrompt] = useState(false);
  const failoverTimeoutRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loadingSeason, setLoadingSeason] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [m3u8Url, setM3u8Url] = useState(null);
  const [m3u8Context, setM3u8Context] = useState(null);
  const [captureSessionId, setCaptureSessionId] = useState(null);
  const [interceptedSubs, setInterceptedSubs] = useState([]);
  const [playerSource, setPlayerSource] = useState(
    () => storage.get("playerSource") || NON_ANIME_DEFAULT_SOURCE,
  );
  useEffect(() => {
    let disposed = false;
    let openedSessionId = null;
    setM3u8Url(null);
    setM3u8Context(null);
    window.electron?.beginStreamCapture?.({
      mediaIdentity: {
        mediaType: "tv",
        mediaId: item.id,
        season: selectedSeason,
        episode: selectedEp?.episode_number,
      },
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
  }, [item.id, playerSource, selectedSeason, selectedEp?.episode_number]);
  // Accent colour + subtitle lang come from App-level state (via props),
  // so they are always fresh after Settings save without any extra storage reads.
  const playerAccentColor = playerSettings?.accentColor ?? null;
  const playerSubLang = playerSettings?.subtitleLang ?? null;
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  // Derived from playerSource, computed once per render instead of 5-6× inline
  const isAsync = useMemo(() => sourceIsAsync(playerSource), [playerSource]);
  const supportsProgress = useMemo(
    () => sourceSupportsProgress(playerSource),
    [playerSource],
  );
  const progressViaFrames = useMemo(
    () => sourceProgressViaFrames(playerSource),
    [playerSource],
  );
  const [dubMode, setDubMode] = useState(
    () => storage.get(STORAGE_KEYS.ALLMANGA_DUB_MODE) || "sub",
  );
  // async URL resolution
  const [resolvedPlayerUrl, setResolvedPlayerUrl] = useState(null);
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [resolveError, setResolveError] = useState(null);
  // Refs mirror the above so the resolve-effect can guard without stale closures
  const resolvingUrlRef = useRef(false);
  const resolvedPlayerUrlRef = useRef(null);
  const [anilistData, setAnilistData] = useState(null);
  const [anilistSeasons, setAnilistSeasons] = useState(null); // [{seasonNum, title, episodes, year}]
  const [anilistLoading, setAnilistLoading] = useState(false);
  const [episodeGroupData, setEpisodeGroupData] = useState(null); // Raw TMDB episode group response
  const [episodeGroupMap, setEpisodeGroupMap] = useState(null); // Map built from TMDB episode group
  // Webview loading overlay
  const [webviewLoading, setWebviewLoading] = useState(false);
  const [playerFullscreen, setPlayerFullscreen] = useState(false);
  const [playerControlsVisible, setPlayerControlsVisible] = useState(true);
  const playerIdleTimerRef = useRef(null);
  const [pipOpen, setPipOpen] = useState(false);
  const pipUrlRef = useRef(null);
  const pipWebContentsIdRef = useRef(null); // cached WebContents ID of the pop-out window
  const [menuPos, setMenuPos] = useState(null);
  // AniSkip
  const [skipTimings, setSkipTimings] = useState(null); // { intro?, outro? }
  const [skipPrompt, setSkipPrompt] = useState(null); // "intro" | "outro" | null
  const [introSkipMode] = useState(
    () => storage.get(STORAGE_KEYS.INTRO_SKIP_MODE) || "off",
  );
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
  const watchedRef = useRef(watched);
  watchedRef.current = watched;

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
  const [epMenu, setEpMenu] = useState(null); // { x, y, pk }

  // Blocked request stats, reset key includes season+episode so counter resets on each ep
  const blockedResetKey = `${item.id}_s${selectedSeason}_e${selectedEp?.episode_number ?? 0}`;
  const {
    sessionTotal: blockedSession,
    alltimeTotal: blockedAlltime,
    showModal: showBlockedModal,
    setShowModal: setShowBlockedModal,
    getSessionDomains: getBlockedDomains,
  } = useBlockedStats(blockedResetKey);

  // Age rating
  const [rating, setRating] = useState({ cert: null, minAge: null });
  const ageLimitSetting = useMemo(() => getAgeLimitSetting(storage), []);
  const ratingCountry = useMemo(() => getRatingCountry(storage), []);
  const restricted = isRestricted(rating.minAge, ageLimitSetting);
  const [seasonMenu, setSeasonMenu] = useState(null); // { x, y, seasonNum }

  const resetAutoplayRef = useRef(() => {});
  const triggerAutoplayRef = useRef(() => {});
  const setCountdownStartedRef = useRef(() => {});
  const localCountdownStartedRef = useRef(false);

  // Read threshold from settings (default 20s), stable across renders
  const [watchedThreshold] = useState(
    () => storage.get("watchedThreshold") ?? 20,
  );
  const autoMarkedRef = useRef(false);
  const lastKnownTimeRef = useRef(0);
  const durationRef = useRef(0); // tracked for AniSkip progress bar markers
  const seekBackCooldownRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    tmdbFetch(`/tv/${item.id}`, apiKey)
      .then((d) => {
        if (!mounted) return;
        setDetails(d);
        // Only fall back when no specific season was requested
        if (item.season == null) {
          const validSeasons = (d.seasons || []).filter(
            (s) => s.season_number > 0,
          );
          // Find the lowest season that isn't fully watched
          const incomplete = validSeasons.find((s) => {
            const count = s.episode_count || 0;
            if (!count) return false;
            for (let i = 1; i <= count; i++) {
              if (
                !watchedRef.current?.[`tv_${item.id}_s${s.season_number}e${i}`]
              )
                return true;
            }
            return false;
          });
          const target = incomplete || validSeasons[0] || d.seasons?.[0];
          if (target) setSelectedSeason(target.season_number);
        }
      })
      .catch(() => {
        if (mounted) setDetails(item);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [item.id, apiKey]);

  // ── Fetch episode group mapping if this show has one ─────────────────────
  useEffect(() => {
    const groupId = EPISODE_GROUP_IDS[Number(item.id)];
    if (!groupId || !apiKey) {
      setEpisodeGroupData(null);
      setEpisodeGroupMap(null);
      return;
    }
    let mounted = true;
    fetchEpisodeGroup(groupId, apiKey)
      .then((data) => {
        if (!mounted) return;
        setEpisodeGroupData(data);
        setEpisodeGroupMap(buildEpisodeGroupMap(data));
      })
      .catch(() => {
        if (mounted) {
          setEpisodeGroupData(null);
          setEpisodeGroupMap(null);
        }
      });
    return () => {
      mounted = false;
    };
  }, [item.id, apiKey]);

  useEffect(() => {
    let mounted = true;
    tmdbFetch(`/tv/${item.id}/videos`, apiKey)
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

  useEffect(() => {
    let mounted = true;
    fetchTVRating(item.id, apiKey, ratingCountry).then((r) => {
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
  }, [playing, resolvedPlayerUrl, playerSource, selectedEp?.episode_number, selectedSeason, ambientGlowEnabled, playerFullscreen]);

  useEffect(() => {
    if (!apiKey || !item.id) return;
    // Episode group data already contains all episodes -> no TMDB season fetch
    if (episodeGroupData) {
      setSelectedEp(null);
      setPlaying(false);
      setSeasonData(null);
      setLoadingSeason(false);
      return;
    }
    setLoadingSeason(true);
    setSelectedEp(null);
    setPlaying(false);
    setSeasonData(null); // clear stale episodes immediately
    // AniList virtual seasons on a single-season show: always fetch TMDB S1.
    const tmdbSeasonToFetch =
      isAnime && anilistSeasons?.length > 0 && tmdbSeasons.length <= 1
        ? 1
        : selectedSeason;
    let mounted = true;
    tmdbFetch(`/tv/${item.id}/season/${tmdbSeasonToFetch}`, apiKey)
      .then((d) => {
        if (mounted) setSeasonData(d);
      })
      .catch(() => {
        if (mounted) {
          setSeasonData(null);
          // Record this season as unavailable (e.g. TMDB has no episode data for it)
          if (selectedSeason === 0) {
            setFailedSeasons((prev) => new Set([...prev, selectedSeason]));
          }
        }
      })
      .finally(() => {
        if (mounted) setLoadingSeason(false);
      });
    return () => {
      mounted = false;
    };
  }, [item.id, selectedSeason, apiKey, anilistSeasons]);

  // Reset m3u8 URL, subtitle URL and source menu whenever the series, episode, or source changes
  useEffect(() => {
    setM3u8Url(null);
    setInterceptedSubs([]);
    setShowSourceMenu(false);
    resolvedPlayerUrlRef.current = null;
    setResolvedPlayerUrl(null);
    resolvingUrlRef.current = false;
    setResolvingUrl(false);
    setResolveError(null);
    setWebviewLoading(true); // instantly blank the player on every source/episode switch
  }, [
    item.id,
    selectedEp?.episode_number,
    selectedSeason,
    playerSource,
    dubMode,
  ]);

  // Fetch AniList metadata + auto-set anime source
  useEffect(() => {
    let mounted = true;
    setAnilistData(null);
    setAnilistSeasons(null);
    if (isAnime) {
      setAnilistLoading(true);
      fetchAnilistData(item.name || item.title, "ANIME", item.id)
        .then((data) => {
          if (!mounted) return;
          if (data) {
            setAnilistData(data);
            const seasons = buildAnilistSeasons(data);
            if (seasons?.length) setAnilistSeasons(seasons);
          }
          if (mounted) setAnilistLoading(false);
        })
        .catch(() => {
          if (mounted) setAnilistLoading(false);
        });
      // Switch to anime source if current source is not an anime source
      const currentSrc = PLAYER_SOURCES.find((s) => s.id === playerSource);
      if (!currentSrc?.tag) {
        const saved = storage.get("playerSource");
        const savedSrc = PLAYER_SOURCES.find((s) => s.id === saved);
        setPlayerSource(savedSrc?.tag ? saved : ANIME_DEFAULT_SOURCE);
      }
    } else {
      setAnilistLoading(false);
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

  // Resolve allmanga episode URL via main-process IPC (GraphQL, no CORS)
  useEffect(() => {
    if (!playing || !selectedEp) return;
    const epNum = selectedEp.episode_number;
    const epKey = `tv_${item.id}_s${selectedSeason}_e${epNum}_${dubMode}`;

    // Auto-failover: if a previous attempt taught us AllManga doesn't have
    // this episode, skip straight to the cached fallback source.
    if (isAsync) {
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

    if (!isAsync) return;
    if (!window.electron?.resolveAllManga) {
      setResolveError("Orion's desktop bridge is unavailable. Restart Orion and try again.");
      return;
    }
    // Use refs as guards
    if (resolvedPlayerUrlRef.current || resolvingUrlRef.current) return;
    resolvingUrlRef.current = true;
    setResolvingUrl(true);
    setResolveError(null);
    const progressKey = `tv_${item.id}_s${selectedSeason}e${epNum}`;
    const startTime = storage.get("dlTime_" + progressKey) || 0;
    let mounted = true;
    window.electron
      .resolveAllManga({
        title,
        seasonNumber: selectedSeason,
        episodeNumber: epNum,
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
                // Also expose raw url so download button can use it
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
          // AllManga doesn't have this episode → switch to the next source
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
            setResolveError(res?.error || "Episode not found on AllManga");
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
  }, [playing, selectedEp, playerSource, selectedSeason, dubMode]);

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
    const handler = window.electron.onSubtitleFound(({ url, lang }) => {
      if (!url || !url.toLowerCase().includes(".vtt")) return;
      setInterceptedSubs((prev) => {
        const filtered = prev.filter((s) => s.lang !== lang);
        return [...filtered, { url, lang: lang || "unknown" }];
      });
    });
    return () => window.electron.offSubtitleFound(handler);
  }, []);

  const d = details || item;
  const title = d.name || d.title;
  const handleLibrarySave = useCallback(() => {
    onSave?.({ ...item, ...d, media_type: "tv" });
  }, [d, item, onSave]);
  const year = (d.first_air_date || "").slice(0, 4);

  // ── Season list: prefer episode-group > AniList > TMDB ──────────────────
  // tmdbSeasons excludes specials (season 0) (only for AniList)
    const { currentSeasonEpisodes, displayEpisodeCount, displayGenres, displayOverview, displayScore, displaySeasonCount, downloadsByEpisodeKey, episodeGroupCurrentEpisodes, isSeasonWatched, markSeasonUnwatched, markSeasonWatched, playerEp, seasonWatchedMap, seasons, tmdbSeasons } = useTVEpisodeCatalog({
    anilistData, anilistLoading, anilistSeasons, d, downloads, episodeGroupData, episodeGroupMap, failedSeasons, isAnime, item, onMarkUnwatched, onMarkWatched, seasonData, selectedEp, selectedSeason, setSelectedEp, watched
  });

    const { currentEpDownload, currentProgressKey, handleFailoverNextSource, handleManualSkip, startPlayingEp } = useTVWebview({
    anilistData, autoMarkedRef, d, downloadsByEpisodeKey, dubMode, durationRef, failoverTimeoutRef, initialSeekDoneRef, introSkipMode, isAnime, isAsync, item, lastKnownTimeRef, localCountdownStartedRef, onHistory, onMarkWatchedRef, onPlay, pipWebContentsIdRef, playerSource, playerWrapRef, playing, progressViaFrames, resetAutoplayRef, resolvedPlayerUrlRef, resolvingUrlRef, saveProgressRef, seekBackCooldownRef, selectedEp, selectedSeason, setCountdownStartedRef, setInterceptedSubs, setM3u8Url, setPlayerSource, setPlaying, setResolveError, setResolvedPlayerUrl, setResolvingUrl, setSelectedEp, setShowFailoverPrompt, setShowResumePrompt, setSkipPrompt, setSkipTimings, setWebviewLoading, skipPrompt, skipTimings, switchingToMiniPlayerRef, triggerAutoplayRef, voiceBoost, watchedThreshold, webviewLoading, webviewRef
  });



    const { autoplayCountdown, autoplayNextLayout, cancelAutoplay, nextEp, playEpisode, playNow, prevEp, sourceHealth, startEpisodeDownload, startSeasonDownload } = useTVEpisodeActions({
    autoplayDoneRef, currentSeasonEpisodes, d, downloadsByEpisodeKey, item, localCountdownStartedRef, onGoToDownloads, onHistory, playing, resetAutoplayRef, resolveError, resolvingUrl, restricted, selectedEp, selectedSeason, setCountdownStartedRef, setPendingEpToPlay, setResumeTime, setShowDownload, setShowResumePrompt, showFailoverPrompt, startPlayingEp, triggerAutoplayRef, webviewLoading
  });

  const handleSetDownloaderFolder = useCallback((folder) => {
    setDownloaderFolder(folder);
    storage.set("downloaderFolder", folder);
  }, []);

  // Intercept fullscreen requests from embedded players (vidsrc / 2embed use
  // the native Fullscreen API which would otherwise fullscreen the entire app).
  // Videasy and AllManga handle fullscreen internally via CSS, skip those.
  useEffect(() => {
    if (!playing) return;
    if (!NEEDS_INTERCEPT.includes(playerSource)) return;
    const enterH = window.electron?.onWebviewEnterFullscreen?.(() => {
      // requestFullscreen() is rejected when Electron is already in fullscreen -> use css overlay
      setPlayerFullscreen(true);
      document.documentElement.setAttribute("data-player-fullscreen", "1");
    });
    const leaveH = window.electron?.onWebviewLeaveFullscreen?.(() => {
      setPlayerFullscreen(false);
      document.documentElement.removeAttribute("data-player-fullscreen");
      if (document.fullscreenElement) document.exitFullscreen?.();
    });
    return () => {
      if (enterH) window.electron?.offWebviewEnterFullscreen?.(enterH);
      if (leaveH) window.electron?.offWebviewLeaveFullscreen?.(leaveH);
      // Clean up attribute if component unmounts while fullscreen
      document.documentElement.removeAttribute("data-player-fullscreen");
    };
  }, [playing, playerSource]);

  // ── PiP pop-out: navigate main webview away so only one stream is active ──
  useEffect(() => {
    if (!playing) return;
    const openH = window.electron?.onPipOpened?.(async () => {
      setPipOpen(true);
      pipWebContentsIdRef.current =
        (await window.electron.getPipWebContentsId?.()) ?? null;
    });
    const closeH = window.electron?.onPipClosed?.(() => {
      pipUrlRef.current = null;
      pipWebContentsIdRef.current = null;
      setPipOpen(false);
    });
    return () => {
      if (openH) window.electron?.offPipOpened?.(openH);
      if (closeH) window.electron?.offPipClosed?.(closeH);
    };
  }, [playing]);

  const effectiveYear =
    year ||
    (isAnime && anilistData?.startDate?.year
      ? String(anilistData.startDate.year)
      : "");
  const mediaName = selectedEp
    ? `${title}${effectiveYear ? ` (${effectiveYear})` : ""} S${String(selectedSeason).padStart(2, "0")} E${String(selectedEp.episode_number).padStart(2, "0")}`
    : title;

  useEffect(() => {
    if (!playing || !selectedEp || pipOpen) return;
    const episode = selectedEp.episode_number;
    const url = isAsync
      ? resolvedPlayerUrl
      : getSourceUrl(playerSource, "tv", { tmdbId: item.id, imdbId: d?.external_ids?.imdb_id || d?.imdb_id }, selectedSeason, episode, {}, playerAccentColor, playerSubLang);
    if (!url) return;
    const progressKey = `tv_${item.id}_s${selectedSeason}e${episode}`;
    const playerRect = playerWrapRef.current?.getBoundingClientRect?.();
    onPlaybackSession?.({
      id: `tv:${item.id}:${selectedSeason}:${episode}:${playerSource}`,
      mediaType: "tv",
      mediaId: item.id,
      mediaIdentity: { mediaType: "tv", mediaId: item.id, season: selectedSeason, episode },
      sourceId: playerSource,
      url,
      playbackUrl: url,
      title: `${title} — S${selectedSeason}E${episode}`,
      context: selectedEp.name || `Season ${selectedSeason}, episode ${episode}`,
      item,
      season: selectedSeason,
      episode,
      webContentsId: getReadyWebContentsId(webviewRef.current),
      playerRect: playerRect ? {
        left: playerRect.left,
        top: playerRect.top,
        width: playerRect.width,
        height: playerRect.height,
      } : null,
      currentTime: Number(storage.get("dlTime_" + progressKey)) || 0,
      nextAction: nextEp ? () => playEpisode(nextEp) : null,
      previousAction: prevEp ? () => playEpisode(prevEp) : null,
      updatedAt: Date.now(),
    });
  }, [playing, selectedEp, selectedSeason, pipOpen, isAsync, resolvedPlayerUrl, playerSource, webviewLoading, item.id, title, onPlaybackSession, nextEp, prevEp, playEpisode]);

  const currentEpWatched = currentProgressKey
    ? !!watched?.[currentProgressKey]
    : false;

    const viewModel = { ambientColor, autoplayCountdown, autoplayNextLayout, blockedAlltime, blockedSession, cancelAutoplay, currentEpDownload, currentEpWatched, currentProgressKey, currentSeasonEpisodes, d, displayEpisodeCount, displayGenres, displayOverview, displayScore, displaySeasonCount, downloaderFolder, downloadsByEpisodeKey, dubMode, durationRef, epMenu, episodeGroupCurrentEpisodes, getBlockedDomains, handleFailoverNextSource, handleManualSkip, handleSetDownloaderFolder, interceptedSubs, isAsync, isSaved, isSeasonWatched, item, loadingSeason, m3u8Context, m3u8Url, markSeasonUnwatched, markSeasonWatched, mediaName, menuPos, nextEp, onBack, onDownloadStarted, onGoToDownloads, onMarkUnwatched, onMarkWatched, onOpenMiniPlayer, onSave: handleLibrarySave, onSettings, pendingEpToPlay, pipOpen, pipUrlRef, playEpisode, playNow, playerAccentColor, playerControlsVisible, playerEp, playerFullscreen, playerSource, playerSubLang, playerWrapRef, playing, prevEp, progress, rating, resolveError, resolvedPlayerUrl, resolvedPlayerUrlRef, resolvingUrl, resolvingUrlRef, restricted, resumeTime, revealPlayerControls, saveProgress, seasonData, seasonMenu, seasonWatchedMap, seasons, selectedEp, selectedSeason, setDubMode, setEpMenu, setInterceptedSubs, setM3u8Url, setMenuPos, setPlayerSource, setResolveError, setResolvedPlayerUrl, setResolvingUrl, setSeasonMenu, setSelectedSeason, setShowBlockedModal, setShowDownload, setShowResumePrompt, setShowSourceMenu, setShowTrailer, setVoiceBoost, showBlockedModal, showDownload, showFailoverPrompt, showResumePrompt, showSourceMenu, showTrailer, skipPrompt, skipTimings, sourceHealth, sourceRef, startEpisodeDownload, startPlayingEp, startSeasonDownload, supportsProgress, switchingToMiniPlayerRef, title, trailerKey, voiceBoost, watched, webviewLoading, webviewRef };
    viewModel.cast = cast;
    viewModel.keyCrew = keyCrew;
    viewModel.creditsLoading = creditsLoading;
    viewModel.onSelect = onSelect;
    viewModel.captureSessionId = captureSessionId;
    return viewModel;
}
