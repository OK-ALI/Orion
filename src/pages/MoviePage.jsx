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
  fetchAnilistData,
  cleanAnilistDescription,
  isAnimeContent,
  ANIME_DEFAULT_SOURCE,
  NON_ANIME_DEFAULT_SOURCE,
  NEEDS_INTERCEPT,
  getNextNonAsyncSource,
} from "../utils/api";
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
} from "../components/common/Icons";
import DownloadModal from "../components/DownloadModal";
import TrailerModal from "../components/TrailerModal";
import BlockedStatsModal from "../components/BlockedStatsModal";
import { formatDate } from "../utils/date";
import { useBlockedStats } from "../utils/useBlockedStats";
import MediaCard from "../components/media/MediaCard";
import {
  storage,
  STORAGE_KEYS,
  getFailoverSource,
  setFailoverSource,
  clearFailoverSource,
} from "../utils/storage";
import {
  fetchMovieRating,
  isRestricted,
  getAgeLimitSetting,
  getRatingCountry,
} from "../utils/ageRating";const VoiceBoostIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 2v20" />
    <path d="M17 5v14" />
    <path d="M22 9v6" />
    <path d="M7 9v6" />
    <path d="M2 11v2" />
  </svg>
);


// Injected into the webview DOM
const INJECT_SKIP_CONTROLS = `
(function() {
  if (window.__skipControlsInjected) return;
  var style = document.createElement('style');
  style.innerHTML =
    '*:focus, *:focus-visible {' +
    'outline: none !important;' +
    'box-shadow: none !important;' +
    '}' +
    'video:focus, video:focus-visible {' +
    'outline: none !important;' +
    'box-shadow: none !important;' +
    '}';
  document.head.appendChild(style);
  window.__skipControlsInjected = true;

  var BACK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:26px;height:26px"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.53"/><text x="13.5" y="15.5" text-anchor="middle" font-size="6.5" fill="currentColor" stroke="none" font-weight="800" font-family="system-ui,sans-serif">15</text></svg>';
  var FWD_SVG  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:26px;height:26px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-4.53"/><text x="10.5" y="15.5" text-anchor="middle" font-size="6.5" fill="currentColor" stroke="none" font-weight="800" font-family="system-ui,sans-serif">15</text></svg>';

  var wrap = document.createElement('div');
  wrap.id = '__skip-ui';
  wrap.style.cssText = [
    'position:fixed',
    'top:0','left:0','right:0','bottom:0',
    'pointer-events:none',
    'z-index:2147483647',
    'opacity:0',
    'transition:opacity 0.25s ease',
  ].join(';');

  function makeBtn(seconds, svg, label, side) {
    var btn = document.createElement('button');
    btn.innerHTML = svg + '<span style="font-size:11px;font-family:system-ui,sans-serif">' + label + '</span>';
    btn.setAttribute('tabindex', '-1');
    btn.title = label;
    btn.style.cssText = [
      'pointer-events:auto',
      'background:rgba(0,0,0,0.72)',
      'border:1px solid rgba(255,255,255,0.18)',
      'border-radius:8px',
      'color:white',
      'cursor:pointer',
      'padding:10px 18px',
      'display:flex',
      'align-items:center',
      'gap:7px',
      'backdrop-filter:blur(6px)',
      '-webkit-backdrop-filter:blur(6px)',
      'transition:background 0.15s',
      'font-size:12px',
    ].join(';');
    btn.style.position = 'absolute';
    btn.style.top = '50%';
    btn.style.transform = 'translateY(-50%)';

    if (side === 'left') {
      btn.style.left = '24px';
    } else {
      btn.style.right = '24px';
    }
    btn.onmouseenter = function() { btn.style.background = 'rgba(229,9,20,0.85)'; btn.style.borderColor = '#e5091466'; };
    btn.onmouseleave = function() { btn.style.background = 'rgba(0,0,0,0.72)'; btn.style.borderColor = 'rgba(255,255,255,0.18)'; };
    btn.onclick = function(e) {
      e.stopPropagation();
      var v = document.querySelector('video');
      if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + seconds));
      show();
    };
    return btn;
  }

  wrap.appendChild(makeBtn(-15, BACK_SVG, '−15s', 'left'));
  wrap.appendChild(makeBtn(15,  FWD_SVG,  '+15s', 'right'));
  document.documentElement.appendChild(wrap);

  var idleTimer;
  function show() {
    wrap.style.opacity = '1';
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function() { wrap.style.opacity = '0'; }, 2500);
  }
  document.addEventListener('mousemove', show, true);

  // Keyboard shortcut listener
  document.addEventListener('keydown', function(e) {
    const active = document.activeElement;

    // Skip shortcuts if user is typing in inputs/textareas
    if (
      active &&
      active.matches('input, textarea, [contenteditable="true"]')
    ) {
      return;
    }

    if (e.repeat) return;

    const v = document.querySelector('video');
    if (!v) return;

    // Throttle (max 1 action per 150ms to keep it snappy but prevent issues)
    const now = Date.now();
    if (window.__skipKeyCooldown && now < window.__skipKeyCooldown) return;
    window.__skipKeyCooldown = now + 150;

    if (e.code === 'Space') {
      e.preventDefault();
      if (v.paused) v.play().catch(function(){});
      else v.pause();
      show();
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      v.currentTime = Math.max(0, v.currentTime - 10);
      show();
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
      show();
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      v.volume = Math.min(1, v.volume + 0.1);
      show();
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      v.volume = Math.max(0, v.volume - 0.1);
      show();
    }

    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      if (!document.fullscreenElement) {
        v.requestFullscreen().catch(function() {
          document.documentElement.requestFullscreen().catch(function(){});
        });
      } else {
        document.exitFullscreen().catch(function(){});
      }
      show();
    }

    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      v.muted = !v.muted;
      show();
    }
  }, true);

  // Double click to toggle fullscreen
  document.addEventListener('dblclick', function(e) {
    if (e.target.tagName === 'VIDEO') {
      e.preventDefault();
      if (!document.fullscreenElement) {
        e.target.requestFullscreen().catch(function() {
          document.documentElement.requestFullscreen().catch(function(){});
        });
      } else {
        document.exitFullscreen().catch(function(){});
      }
    }
  }, true);
})();
`;

export default function MoviePage({
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
}) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [m3u8Url, setM3u8Url] = useState(null);
  const [m3u8Context, setM3u8Context] = useState(null);
  const [interceptedSubs, setInterceptedSubs] = useState([]);
  const [playerSource, setPlayerSource] = useState(
    () => storage.get("playerSource") || NON_ANIME_DEFAULT_SOURCE,
  );

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
          const next = getNextNonAsyncSource(playerSource);
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
      const url = typeof payload === "string" ? payload : payload?.url;
      if (!url) return;
      setM3u8Url((prev) => (prev !== url ? url : prev));
      setM3u8Context(typeof payload === "string" ? { url } : payload);
    });
    return () => window.electron.offM3u8Found(handler);
  }, []);

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
      // Only keep VTT, deduplicate per language (latest wins)
      if (!url || !url.toLowerCase().includes(".vtt")) return;
      setInterceptedSubs((prev) => {
        const filtered = prev.filter((s) => s.lang !== lang);
        return [...filtered, { url, lang: lang || "unknown" }];
      });
    });
    return () => window.electron.offSubtitleFound(handler);
  }, []);

  const applyVoiceBoost = useCallback(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    const js = `
      (function() {
        try {
          const v = document.querySelector('video');
          if (!v) return;
          
          if (!${voiceBoost}) {
            if (window.__orionAudioNodes) {
              const { source, highpass, peaking, compressor, dest } = window.__orionAudioNodes;
              source.disconnect();
              highpass.disconnect();
              peaking.disconnect();
              compressor.disconnect();
              source.connect(dest);
              window.__orionVoiceBoostActive = false;
            }
            return;
          }
          
          if (window.__orionVoiceBoostActive) return;
          
          if (!window.__orionAudioCtx) {
            window.__orionAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
          }
          const ctx = window.__orionAudioCtx;
          
          let sourceNode;
          if (window.__orionAudioNodes) {
            sourceNode = window.__orionAudioNodes.source;
          } else {
            sourceNode = ctx.createMediaElementSource(v);
          }
          
          const highpass = ctx.createBiquadFilter();
          highpass.type = 'highpass';
          highpass.frequency.value = 100;
          
          const peaking = ctx.createBiquadFilter();
          peaking.type = 'peaking';
          peaking.frequency.value = 1500;
          peaking.Q.value = 1.0;
          peaking.gain.value = 8;
          
          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.value = -20;
          compressor.knee.value = 30;
          compressor.ratio.value = 3;
          compressor.attack.value = 0.003;
          compressor.release.value = 0.25;
          
          sourceNode.disconnect();
          sourceNode.connect(highpass);
          highpass.connect(peaking);
          peaking.connect(compressor);
          compressor.connect(ctx.destination);
          
          window.__orionAudioNodes = {
            source: sourceNode,
            highpass,
            peaking,
            compressor,
            dest: ctx.destination
          };
          window.__orionVoiceBoostActive = true;
        } catch (e) {
          console.error("Voice Boost injection failed:", e);
        }
      })()
    `;
    wv.executeJavaScript(js).catch(() => {});
  }, [voiceBoost]);

  useEffect(() => {
    if (!playing || webviewLoading) return;
    applyVoiceBoost();
    const wv = webviewRef.current;
    if (!wv) return;
    const handleDomReady = () => {
      applyVoiceBoost();
    };
    wv.addEventListener("dom-ready", handleDomReady);
    return () => {
      wv.removeEventListener("dom-ready", handleDomReady);
    };
  }, [playing, webviewLoading, applyVoiceBoost]);

  useEffect(() => {
    if (!playing) return;
    const handleGlobalKeyDown = (e) => {
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.contentEditable === "true")
      ) {
        return;
      }
      
      const key = e.key.toLowerCase();
      if (
        key === " " ||
        key === "arrowleft" ||
        key === "arrowright" ||
        key === "arrowup" ||
        key === "arrowdown" ||
        key === "f" ||
        key === "m"
      ) {
        e.preventDefault();
        const wv = webviewRef.current;
        if (!wv) return;
        
        const JS = `
          (() => {
            const v = document.querySelector('video');
            if (!v) return false;
            const key = "${key}";
            if (key === " ") {
              if (v.paused) v.play(); else v.pause();
            } else if (key === "arrowleft") {
              v.currentTime = Math.max(0, v.currentTime - 10);
            } else if (key === "arrowright") {
              v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10);
            } else if (key === "arrowup") {
              v.volume = Math.min(1, v.volume + 0.1);
            } else if (key === "arrowdown") {
              v.volume = Math.max(0, v.volume - 0.1);
            } else if (key === "f") {
              if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
              } else {
                document.documentElement.requestFullscreen().catch(() => {});
              }
            } else if (key === "m") {
              v.muted = !v.muted;
            }
            return true;
          })()
        `;
        wv.executeJavaScript(JS).catch(() => {});
      }
    };
    
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [playing]);

  // Reset auto-mark guard when a new movie loads or watched state resets
  useEffect(() => {
    autoMarkedRef.current = false;
    lastKnownTimeRef.current = 0;
    seekBackCooldownRef.current = 0;
  }, [item.id, isWatched]);

  // Show loader instantly when play starts
  useEffect(() => {
    if (playing) setWebviewLoading(true);
  }, [playing]);

  // If a movie source does not expose playable video quickly, give the user a clear next step.
  useEffect(() => {
    if (!playing) {
      setShowFailoverPrompt(false);
      clearTimeout(failoverTimeoutRef.current);
      return;
    }

    setShowFailoverPrompt(false);
    clearTimeout(failoverTimeoutRef.current);

    failoverTimeoutRef.current = setTimeout(() => {
      if (lastKnownTimeRef.current === 0) {
        setShowFailoverPrompt(true);
      }
    }, 15000);

    return () => clearTimeout(failoverTimeoutRef.current);
  }, [playing, playerSource, item.id]);

  const handleFailoverNextSource = useCallback(() => {
    const next = getNextNonAsyncSource(playerSource);
    if (!next) return;
    clearFailoverSource(`movie_${item.id}_${dubMode}`);
    setPlayerSource(next);
    storage.set(STORAGE_KEYS.PLAYER_SOURCE, next);
    setM3u8Url(null);
    setInterceptedSubs([]);
    resolvedPlayerUrlRef.current = null;
    setResolvedPlayerUrl(null);
    resolvingUrlRef.current = false;
    setResolvingUrl(false);
    setResolveError(null);
    setShowFailoverPrompt(false);
    setWebviewLoading(true);
  }, [playerSource, item.id, dubMode]);

  // ── Webview memory cleanup ────────────────────────────────────────────────
  // useLayoutEffect fires synchronously BEFORE React mutates the DOM, so the
  // webview is still attached when we navigate it to about:blank.
  // This lets Chromium unload.
  useLayoutEffect(() => {
    if (playing) return;
    const wv = webviewRef.current;
    if (wv) {
      try {
        wv.src = "about:blank";
      } catch {}
    }
  }, [playing]);

  // On unmount: signal main process to destroy the player WebContents and flush session cache.
  useEffect(() => {
    return () => {
      if (!switchingToMiniPlayerRef.current) {
        window.electron?.playerStopped?.();
      }
    };
  }, []);

  // Attach webview load events so we know when the new source has painted
  useEffect(() => {
    if (!playing) return;
    const wv = webviewRef.current;
    if (!wv) return;
    const done = async () => {
      setWebviewLoading(false);

      if (initialSeekDoneRef.current) return;
      initialSeekDoneRef.current = true;

      if (sourceIsAsync(playerSource)) return;
      const startTime = Number(storage.get("dlTime_" + progressKey) || 0);
      if (startTime <= 0) return;

      try {
        await wv.executeJavaScript(`
          (() => {
            const seek = () => {
              const video = document.querySelector('video');
              if (!video) return false;
              const target = ${Math.max(0, Math.floor(startTime))};
              const apply = () => {
                try {
                  if (Number.isFinite(video.duration) && video.duration > target) {
                    video.currentTime = target;
                  }
                } catch {}
              };
              if (video.readyState >= 1) apply();
              else video.addEventListener('loadedmetadata', apply, { once: true });
              return true;
            };
            if (seek()) return true;
            let tries = 0;
            const timer = setInterval(() => {
              tries += 1;
              if (seek() || tries > 20) clearInterval(timer);
            }, 500);
            return false;
          })()
        `);
      } catch {}
    };
    wv.addEventListener("did-finish-load", done);
    wv.addEventListener("did-fail-load", done);
    return () => {
      wv.removeEventListener("did-finish-load", done);
      wv.removeEventListener("did-fail-load", done);
    };
  }, [playing, playerSource, item.id, progressKey]);

  // ── Auto-track progress + auto-watched every 5s ──────────────────────────
  useEffect(() => {
    if (!playing || !sourceSupportsProgress(playerSource)) return;
    let interval = null;
    const timer = setTimeout(() => {
      interval = setInterval(async () => {
        try {
          const wv = webviewRef.current;
          if (!wv) return;
          let result;
          // When the pop-out window is open the main webview shows about:blank
          // -> query the pip window's webContents directly.
          if (
            pipWebContentsIdRef.current != null &&
            window.electron?.queryVideoProgress
          ) {
            result = await window.electron.queryVideoProgress(
              pipWebContentsIdRef.current,
            );
          } else if (progressViaFrames && window.electron?.queryVideoProgress) {
            result = await window.electron.queryVideoProgress(
              wv.getWebContentsId(),
            );
          } else {
            result = await wv.executeJavaScript(`
              (() => {
                const v = document.querySelector('video')
                if (!v || !v.duration || v.duration === Infinity || v.paused) return null
                // Re-attach seek tracker if video element was recreated (e.g. quality change)
                if (!v._seekTracked) {
                  v._seekTracked = true
                  v.addEventListener('seeked', () => {
                    v._lastUserSeek = Date.now()
                    v._lastUserSeekTo = v.currentTime
                  })
                }
                return {
                  currentTime: v.currentTime,
                  duration: v.duration,
                  recentUserSeek: v._lastUserSeek ? (Date.now() - v._lastUserSeek < 6000) : false,
                  lastUserSeekTo: v._lastUserSeekTo ?? null,
                }
              })()
            `);
          }
          if (result && result.duration > 0) {
            setShowFailoverPrompt(false);
            clearTimeout(failoverTimeoutRef.current);
            const ct = result.currentTime;

            // ── Resolution-change reset detection ──────────────────────────
            // Videasy resets to 0 on quality change. We only seek back if:
            // - ct is near zero (≤5s)
            // - we were well into the video (>30s)
            // - the user did NOT manually seek in the last 6s
            const now = Date.now();
            if (
              lastKnownTimeRef.current > 30 &&
              ct <= 5 &&
              !result.recentUserSeek
            ) {
              if (now > seekBackCooldownRef.current) {
                // First reset: seek back and start cooldown
                const seekTo = lastKnownTimeRef.current;
                seekBackCooldownRef.current = now + 8000;
                try {
                  await wv.executeJavaScript(`
                    (() => {
                      const v = document.querySelector('video')
                      if (v) v.currentTime = ${seekTo}
                    })()
                  `);
                } catch {}
              }
              // In both cases (first reset or cooldown): skip progress save with wrong position
              return;
            }

            // If user seeked, update ref to their chosen position immediately
            if (result.recentUserSeek && result.lastUserSeekTo !== null) {
              lastKnownTimeRef.current = result.lastUserSeekTo;
            } else {
              lastKnownTimeRef.current = ct;
            }
            const p = Math.floor((ct / result.duration) * 100);
            saveProgressRef.current(progressKey, Math.min(p, 100));
            // Also persist actual seconds so DownloadsPage can show resume position
            storage.set("dlTime_" + progressKey, Math.floor(ct));

            // Auto-mark watched when remaining time ≤ threshold
            const remaining = result.duration - ct;
            if (
              !autoMarkedRef.current &&
              remaining <= watchedThreshold &&
              remaining >= 0
            ) {
              autoMarkedRef.current = true;
              onMarkWatchedRef.current?.(progressKey);
            }
          }
        } catch {}
      }, 5000);
    }, 3000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [playing, progressKey, watchedThreshold, playerSource, progressViaFrames]);

  const startMoviePlayback = useCallback((time = 0) => {
    const safeTime = Math.max(0, Math.floor(Number(time) || 0));
    setShowResumePrompt(false);
    setResumeTime(0);
    setM3u8Url(null);
    setInterceptedSubs([]);
    resolvedPlayerUrlRef.current = null;
    setResolvedPlayerUrl(null);
    resolvingUrlRef.current = false;
    setResolvingUrl(false);
    setResolveError(null);
    initialSeekDoneRef.current = false;
    storage.set("dlTime_" + progressKey, safeTime);
    if (safeTime === 0) saveProgress?.(progressKey, 0);
    setPlaying(true);
    onPlay?.();
    setTimeout(() => {
      playerWrapRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
    onHistory({ ...d, media_type: "movie" });
  }, [d, onHistory, progressKey, saveProgress]);

  const handlePlay = useCallback(() => {
    if (playing) {
      startMoviePlayback(0);
      return;
    }
    const savedTime = Number(storage.get("dlTime_" + progressKey) || 0);
    if (savedTime > 30) {
      setResumeTime(savedTime);
      setShowResumePrompt(true);
      return;
    }
    startMoviePlayback(0);
  }, [playing, progressKey, startMoviePlayback]);

  // Intercept fullscreen requests from embedded players (vidsrc / 2embed use
  // the native Fullscreen API which would otherwise fullscreen the entire app).
  // Videasy and AllManga handle fullscreen internally via CSS, skip those.
  useEffect(() => {
    if (!playing) return;
    if (!NEEDS_INTERCEPT.includes(playerSource)) return;
    const enterH = window.electron?.onWebviewEnterFullscreen?.(() => {
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
      document.documentElement.removeAttribute("data-player-fullscreen");
    };
  }, [playing, playerSource]);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv || !playing) return;

    const inject = () => {
      wv.executeJavaScript(INJECT_SKIP_CONTROLS).catch(() => {});
      
      const css = `
        video::cue {
          background: rgba(0, 0, 0, 0.75) !important;
          color: #ffffff !important;
          font-family: sans-serif !important;
        }
        .jw-captions, .jw-caption-text,
        .vjs-text-track-display, .vjs-text-track-cue,
        .plyr__captions, .plyr__caption,
        .art-subtitles, .art-subtitle,
        .shaka-text-container, .shaka-text-region,
        .dplayer-subtitles, .dplayer-subtitle,
        [class*="caption"], [class*="subtitle"], [class*="cue"] {
          transform: translateY(0) !important;
          margin-bottom: 0 !important;
          display: block !important;
        }
        @media (max-height: 450px) {
          video::cue { font-size: 12px !important; }
          .jw-captions, .jw-caption-text,
          .vjs-text-track-display, .vjs-text-track-cue,
          .plyr__captions, .plyr__caption,
          .art-subtitles, .art-subtitle,
          .shaka-text-container, .shaka-text-region,
          .dplayer-subtitles, .dplayer-subtitle,
          [class*="caption"], [class*="subtitle"], [class*="cue"] {
            bottom: 20px !important;
            font-size: 11px !important;
          }
        }
        @media (min-height: 451px) and (max-height: 750px) {
          video::cue { font-size: 16px !important; }
          .jw-captions, .jw-caption-text,
          .vjs-text-track-display, .vjs-text-track-cue,
          .plyr__captions, .plyr__caption,
          .art-subtitles, .art-subtitle,
          .shaka-text-container, .shaka-text-region,
          .dplayer-subtitles, .dplayer-subtitle,
          [class*="caption"], [class*="subtitle"], [class*="cue"] {
            bottom: 35px !important;
            font-size: 14px !important;
          }
        }
        @media (min-height: 751px) {
          video::cue { font-size: 20px !important; }
          .jw-captions, .jw-caption-text,
          .vjs-text-track-display, .vjs-text-track-cue,
          .plyr__captions, .plyr__caption,
          .art-subtitles, .art-subtitle,
          .shaka-text-container, .shaka-text-region,
          .dplayer-subtitles, .dplayer-subtitle,
          [class*="caption"], [class*="subtitle"], [class*="cue"] {
            bottom: 45px !important;
            font-size: 18px !important;
          }
        }
      `;
      wv.insertCSS(css).catch(() => {});
    };

    wv.addEventListener("dom-ready", inject);

    try {
      inject();
    } catch {}

    return () => {
      wv.removeEventListener("dom-ready", inject);
      try {
        wv.executeJavaScript(`
          (() => {
            const el = document.getElementById('__skip-ui');
            if (el) el.remove();
            window.__skipControlsInjected = false;
          })()
        `);
      } catch {}
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

  return (
    <div className="fade-in">
      {loading && (
        <div className="loader">
          <div className="spinner" />
        </div>
      )}
      {!loading && (
        <>
          <div className="detail-hero">
        <div
          className="detail-bg"
          style={{
            backgroundImage: `url(${imgUrl(d.backdrop_path, "w1280")})`,
          }}
        />
        <div className="detail-gradient" />
        <div className="detail-content">
          <div className="detail-poster" style={{ position: "relative" }}>
            {d.poster_path ? (
              <img src={imgUrl(d.poster_path)} alt={title} loading="lazy" />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text3)",
                }}
              >
                <FilmIcon />
              </div>
            )}
            {isWatched && (
              <div className="detail-watched-badge">
                <WatchedIcon size={36} />
              </div>
            )}
          </div>
          <div className="detail-info">
            <div className="detail-type">Movie</div>
            <div className="detail-title">{title}</div>
            <div className="genres">
              {displayGenres.map((g) => (
                <span key={g.id} className="genre-tag">
                  {g.name}
                </span>
              ))}
            </div>
            <div className="detail-meta">
              {displayScore && (
                <span className="detail-rating">
                  <StarIcon /> {displayScore}
                </span>
              )}
              {d.release_date && <span>{formatDate(d.release_date)}</span>}
              {d.runtime && <span>{d.runtime} min</span>}
              {d.original_language && (
                <span>{d.original_language?.toUpperCase()}</span>
              )}
            </div>
            {rating.cert && (
              <div
                className={`age-rating-pill${restricted ? " age-rating-pill--restricted" : ""}`}
              >
                {restricted ? (
                  <RatingLockIcon size={13} />
                ) : (
                  <RatingShieldIcon size={13} />
                )}
                <span className="age-rating-pill-cert">{rating.cert}</span>
                {restricted && (
                  <span className="age-rating-pill-label">
                    Inappropriate for your age setting
                  </span>
                )}
              </div>
            )}
            <p className="detail-overview">{displayOverview}</p>
            {!isWatched && displayPct > 0 && (
              <div className="progress-bar-row" style={{ marginBottom: 12 }}>
                <div className="progress-bar-outer">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.min(displayPct, 100)}%` }}
                  />
                </div>
                <span style={{ fontSize: 12, color: "var(--text3)" }}>
                  {progressLabel}
                </span>
              </div>
            )}
            <div className="detail-actions">
              {isUnreleased ? (
                <button
                  className="btn btn-primary btn-restricted"
                  disabled
                  title="This movie has not been released yet"
                >
                  🔒 Unreleased
                </button>
              ) : restricted ? (
                <button
                  className="btn btn-primary btn-restricted"
                  disabled
                  title="Inappropriate for your age rating setting"
                >
                  🔒 Restricted
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handlePlay}>
                  <PlayIcon /> {playing ? "Restart" : "Play"}
                </button>
              )}
              {trailerKey &&
                (restricted ? (
                  <button
                    className="btn btn-secondary btn-restricted"
                    disabled
                    title="Inappropriate for your age rating setting"
                  >
                    🔒 Trailer
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowTrailer(true)}
                  >
                    <TrailerIcon /> Trailer
                  </button>
                ))}
              <button className="btn btn-secondary" onClick={onSave}>
                {isSaved ? <BookmarkFillIcon /> : <BookmarkIcon />}
                {isSaved ? "Saved" : "Save"}
              </button>
              {!isUnreleased && !restricted && (
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    movieDownload
                      ? onGoToDownloads?.(movieDownload.id)
                      : setShowDownload(true)
                  }
                  title={
                    movieDownload
                      ? movieDownload.status === "downloading"
                        ? "Downloading - view in Downloads"
                        : "Already downloaded - view in Downloads"
                      : "Download this movie"
                  }
                >
                  <DownloadIcon />
                  {movieDownload
                    ? movieDownload.status === "downloading"
                      ? "Downloading"
                      : "Downloaded"
                    : "Download"}
                </button>
              )}
              {!isUnreleased &&
                (isWatched ? (
                  <button
                    className="btn btn-ghost watched-btn"
                    onClick={() => onMarkUnwatched?.(progressKey)}
                  >
                    <WatchedIcon size={16} /> Watched
                  </button>
                ) : (
                  <>
                    <button
                      className="btn btn-ghost"
                      onClick={() => onMarkWatched?.(progressKey)}
                    >
                      ✓ Mark Watched
                    </button>
                    {hasProgress && (
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 13 }}
                        onClick={() => {
                          saveProgress(progressKey, 0);
                          storage.set("dlTime_" + progressKey, null);
                        }}
                      >
                        ⊘ Not Started
                      </button>
                    )}
                  </>
                ))}
              <button className="btn btn-ghost" onClick={onBack}>
                <BackIcon /> Back
              </button>
            </div>
          </div>
        </div>
      </div>

      {playing && !restricted && !isUnreleased && (
        <div className="section">
          <div
            className={`player-wrap${playerFullscreen ? " player-wrap--fullscreen" : ""}${!playerControlsVisible ? " player-wrap--idle" : ""}`}
            ref={playerWrapRef}
            onMouseMove={revealPlayerControls}
            onMouseEnter={revealPlayerControls}
            onKeyDown={revealPlayerControls}
            tabIndex={-1}
          >
            {/* Universal source-loading overlay, shown instantly on every source/item switch */}
            {webviewLoading && !resolveError && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.92)",
                  gap: 14,
                  borderRadius: "inherit",
                }}
              >
                <div className="spinner" />
                <span style={{ fontSize: 14, color: "var(--text2)" }}>
                  {resolvingUrl
                    ? "Looking up movie on AllManga…"
                    : `Loading ${PLAYER_SOURCES.find((s) => s.id === playerSource)?.label ?? "source"}…`}
                </span>
              </div>
            )}
            {showFailoverPrompt && (
              <div
                style={{
                  position: "absolute",
                  top: 20,
                  right: 20,
                  zIndex: 35,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 16px",
                  background: "rgba(0, 0, 0, 0.85)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                  animation: "fadeIn 0.3s ease",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--text2)" }}>
                  Source taking too long to load.
                </span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleFailoverNextSource}
                  style={{ padding: "4px 10px", fontSize: 12 }}
                >
                  Try Another Source
                </button>
              </div>
            )}
            {/* AllManga: error if lookup failed */}
            {sourceIsAsync(playerSource) && resolveError && !resolvingUrl && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.85)",
                  gap: 10,
                  borderRadius: "inherit",
                }}
              >
                <span style={{ fontSize: 28 }}>⚠️</span>
                <span style={{ fontSize: 14, color: "var(--text2)" }}>
                  Movie not found on AllManga
                </span>
                <span style={{ fontSize: 12, color: "var(--text3)" }}>
                  {resolveError}
                </span>
                <span style={{ fontSize: 12, color: "var(--text3)" }}>
                  Try a different source, or switch sub/dub.
                </span>
              </div>
            )}
            {/* Pop-out active: main stream is paused, pop-out has the real player */}
            {pipOpen && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 20,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.92)",
                  gap: 16,
                  borderRadius: "inherit",
                }}
              >
                <PopOutIcon size={36} />
                <span
                  style={{
                    fontSize: 15,
                    color: "var(--text1)",
                    fontWeight: 600,
                  }}
                >
                  Playing in pop-out window
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text2)",
                    textAlign: "center",
                    maxWidth: 260,
                  }}
                >
                  Closing the pop-out will reload the player here.
                </span>
                <button
                  className="player-overlay-btn"
                  onClick={() => window.electron?.closePipWindow?.()}
                  style={{ marginTop: 4 }}
                >
                  Close pop-out &amp; return
                </button>
              </div>
            )}
            <webview
              ref={webviewRef}
              src={
                pipOpen
                  ? "about:blank"
                  : sourceIsAsync(playerSource)
                    ? resolvedPlayerUrl || "about:blank"
                    : getSourceUrl(
                        playerSource,
                        "movie",
                        item.id,
                        null,
                        null,
                        {},
                        playerAccentColor,
                        playerSubLang,
                      )
              }
              partition="persist:player"
              allowpopups="false"
              sandbox="allow-scripts allow-same-origin allow-forms"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                border: "none",
                visibility:
                  webviewLoading ||
                  (sourceIsAsync(playerSource) && !resolvedPlayerUrl)
                    ? "hidden"
                    : "visible",
              }}
            />
            {/* Unified HUD player header bar */}
            <div className="player-overlay-group">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Media Title (premium look) */}
                <div className="player-overlay-title">
                  {item.title || item.name}
                </div>
                
                {/* Source Selection Button */}
                <button
                  ref={sourceRef}
                  className="player-overlay-btn"
                  onClick={() => {
                    const rect = sourceRef.current?.getBoundingClientRect();
                    if (rect)
                      setMenuPos({ top: rect.bottom + 6, left: rect.left });
                    setShowSourceMenu((v) => !v);
                  }}
                  title="Change source"
                >
                  <SourceIcon />
                  {PLAYER_SOURCES.find((s) => s.id === playerSource)?.label ??
                    "Source"}
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Sub/Dub toggle, only for async (AllManga) sources */}
                {sourceIsAsync(playerSource) && (
                  <button
                    className="player-overlay-btn"
                    onClick={() => {
                      const next = dubMode === "sub" ? "dub" : "sub";
                      setDubMode(next);
                      storage.set(STORAGE_KEYS.ALLMANGA_DUB_MODE, next);
                      setM3u8Url(null);
                      setInterceptedSubs([]);
                      resolvedPlayerUrlRef.current = null;
                      setResolvedPlayerUrl(null);
                      resolvingUrlRef.current = false;
                      setResolvingUrl(false);
                      setResolveError(null);
                    }}
                    title="Toggle Sub/Dub"
                  >
                    {dubMode === "sub" ? "SUB" : "DUB"}
                  </button>
                )}
                
                {/* Blocked ads & trackers button */}
                <button
                  className="player-overlay-btn"
                  onClick={() => {
                    setShowSourceMenu(false);
                    setShowBlockedModal(true);
                  }}
                  title="Blocked ads & trackers"
                >
                  <ShieldBlockIcon />
                  {blockedSession > 0 && (
                    <span className="player-blocked-badge">{blockedSession}</span>
                  )}
                </button>
                
                {/* Voice Boost toggle button */}
                <button
                  className={`player-overlay-btn${voiceBoost ? " active" : ""}`}
                  onClick={() => {
                    const next = !voiceBoost;
                    setVoiceBoost(next);
                    storage.set("voiceBoostEnabled", next ? 1 : 0);
                  }}
                  title="Voice Boost (Dialogue Enhancer)"
                >
                  <VoiceBoostIcon size={14} />
                  Voice Boost
                </button>
                
                {/* Mini-player button */}
                <button
                  className="player-overlay-btn"
                  title="Mini player"
                  disabled={
                    webviewLoading ||
                    !!(sourceIsAsync(playerSource) && !resolvedPlayerUrl)
                  }
                  onClick={() => {
                    const url = sourceIsAsync(playerSource)
                      ? resolvedPlayerUrl
                      : getSourceUrl(
                          playerSource,
                          "movie",
                          item.id,
                          null,
                          null,
                          {},
                          playerAccentColor,
                          playerSubLang,
                        );
                    if (!url) return;
                    switchingToMiniPlayerRef.current = true;
                    onOpenMiniPlayer?.({
                      url,
                      title: item.title,
                      mediaType: "movie",
                      mediaId: item.id,
                      posterPath: item.poster_path,
                      item,
                    });
                    onBack();
                  }}
                >
                  <MiniPlayerIcon />
                </button>
                
                {/* Pop-out button*/}
                <button
                  className="player-overlay-btn"
                  onClick={() => {
                    if (pipOpen) {
                      window.electron?.closePipWindow?.();
                      return;
                    }
                    const url = sourceIsAsync(playerSource)
                      ? resolvedPlayerUrl
                      : getSourceUrl(
                          playerSource,
                          "movie",
                          item.id,
                          null,
                          null,
                          {},
                          playerAccentColor,
                          playerSubLang,
                        );
                    if (!url) return;
                    pipUrlRef.current = url;
                    window.electron?.openPipWindow?.(url, item.title);
                  }}
                  title={pipOpen ? "Close pop-out" : "Pop out player"}
                  disabled={
                    !pipOpen &&
                    (webviewLoading ||
                      !!(sourceIsAsync(playerSource) && !resolvedPlayerUrl))
                  }
                  style={pipOpen ? { color: "var(--red)" } : undefined}
                >
                  <PopOutIcon />
                </button>

                {/* Download button */}
                <button
                  className="player-overlay-btn"
                  onClick={() =>
                    movieDownload
                      ? onGoToDownloads?.(movieDownload.id)
                      : (setShowSourceMenu(false), setShowDownload(true))
                  }
                  title={
                    movieDownload
                      ? movieDownload.status === "downloading"
                        ? "Downloading… - view in Downloads"
                        : "Already downloaded - view in Downloads"
                      : "Download"
                  }
                >
                  {movieDownload ? (
                    <span
                      className="player-downloaded-icon"
                      style={{
                        color:
                          movieDownload.status === "downloading"
                            ? "var(--red)"
                            : "#4caf50",
                      }}
                    >
                      {movieDownload.status === "downloading" ? "↓" : "✓"}
                    </span>
                  ) : (
                    <DownloadIcon />
                  )}
                  {!movieDownload && m3u8Url && (
                    <span className="player-overlay-dot" />
                  )}
                  {!sourceSupportsProgress(playerSource) && (
                    <span
                      className="player-no-progress-hint"
                      title="No automatic progress tracking for this source"
                    >
                      ⚠ no tracking
                    </span>
                  )}
                </button>
              </div>
            </div>
            {showSourceMenu && menuPos && (
              <div
                className="source-dropdown source-dropdown--fixed"
                style={{ top: menuPos.top, left: menuPos.left }}
                onClick={(e) => e.stopPropagation()}
              >
                {PLAYER_SOURCES.map((src) => (
                  <button
                    key={src.id}
                    className={
                      "source-dropdown__item" +
                      (playerSource === src.id
                        ? " source-dropdown__item--active"
                        : "")
                    }
                    onClick={() => {
                      setShowSourceMenu(false);
                      if (src.id === playerSource) return;
                      // Manual selection wins over auto-failover
                      clearFailoverSource(`movie_${item.id}_${dubMode}`);
                      setPlayerSource(src.id);
                      storage.set(STORAGE_KEYS.PLAYER_SOURCE, src.id);
                      setM3u8Url(null);
                      setInterceptedSubs([]);
                      resolvedPlayerUrlRef.current = null;
                      setResolvedPlayerUrl(null);
                      resolvingUrlRef.current = false;
                      setResolvingUrl(false);
                      setResolveError(null);
                    }}
                  >
                    <span>{src.label}</span>
                    {src.tag && (
                      <span className="source-dropdown__tag">{src.tag}</span>
                    )}
                    {src.note && (
                      <span className="source-dropdown__note">{src.note}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {displayPct > 0 && (
            <div className="progress-bar-row">
              <div className="progress-bar-outer">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.min(displayPct, 100)}%` }}
                />
              </div>
              <span style={{ fontSize: 12, color: "var(--text3)" }}>
                {progressLabel}
              </span>
            </div>
          )}
          <div className="progress-mark-row">
            <span
              style={{ fontSize: 12, color: "var(--text3)", marginRight: 4 }}
            >
              Mark progress:
            </span>
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                className="btn btn-ghost"
                style={{ padding: "5px 14px", fontSize: 12 }}
                onClick={() => saveProgress(progressKey, p)}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>
      )}

      {collection && onSelect && (
        <div className="section">
          <div className="section-title">{collection.name}</div>
          <div className="scroll-row">
            {collection.parts.map((part) => {
              const pk = `movie_${part.id}`;
              const isCurrent = part.id === item.id;
              return (
                <CollectionCard
                  key={part.id}
                  part={part}
                  pk={pk}
                  isCurrent={isCurrent}
                  onSelect={onSelect}
                  progress={progress[pk] || 0}
                  watched={watched}
                  onMarkWatched={onMarkWatched}
                  onMarkUnwatched={onMarkUnwatched}
                />
              );
            })}
          </div>
        </div>
      )}

      {showTrailer && trailerKey && (
        <TrailerModal
          trailerKey={trailerKey}
          title={title}
          onClose={() => setShowTrailer(false)}
        />
      )}

      {showResumePrompt && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="resume-prompt-modal">
            <h2>Resume Playback?</h2>
            <p>
              You watched this movie previously. Continue where you left off or
              start from the beginning.
            </p>
            <div className="resume-time-display">
              Resume {title} from {formatResumeTime(resumeTime)}
            </div>
            <div className="resume-prompt-actions">
              <button
                className="btn btn-primary"
                onClick={() => startMoviePlayback(resumeTime)}
              >
                Resume Playback
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => startMoviePlayback(0)}
              >
                Start Over
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowResumePrompt(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showBlockedModal && (
        <BlockedStatsModal
          sessionDomains={getBlockedDomains()}
          sessionTotal={blockedSession}
          alltimeTotal={blockedAlltime}
          onClose={() => setShowBlockedModal(false)}
        />
      )}

      {showDownload && (
        <DownloadModal
          onClose={() => setShowDownload(false)}
          m3u8Url={m3u8Url}
          m3u8Context={m3u8Context}
          subtitles={interceptedSubs}
          mediaName={mediaName}
          downloaderFolder={downloaderFolder}
          setDownloaderFolder={handleSetDownloaderFolder}
          onOpenSettings={onSettings}
          onDownloadStarted={onDownloadStarted}
          mediaId={item.id}
          mediaType="movie"
          posterPath={d.poster_path}
          tmdbId={item.id}
        />
      )}
        </>
      )}
    </div>
  );
}

// ── CollectionCard ─────────────────────────────────────────────────────────
// Isolated memo'd wrapper so the onClick for each collection part is stable
// and doesn't cause MediaCard to re-render on every progress tick.
const CollectionCard = memo(function CollectionCard({
  part,
  isCurrent,
  onSelect,
  progress,
  watched,
  onMarkWatched,
  onMarkUnwatched,
}) {
  const handleClick = useCallback(() => onSelect(part), [onSelect, part]);
  return (
    <div
      style={{
        opacity: isCurrent ? 0.5 : 1,
        pointerEvents: isCurrent ? "none" : "auto",
      }}
    >
      <MediaCard
        item={part}
        onClick={handleClick}
        progress={progress}
        watched={watched}
        onMarkWatched={onMarkWatched}
        onMarkUnwatched={onMarkUnwatched}
      />
    </div>
  );
});
