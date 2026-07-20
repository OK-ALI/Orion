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
import { INJECT_SKIP_CONTROLS } from "../../player/webviewScripts/skipControls";
import { getReadyWebContentsId } from "../../player/services/webviewLifecycle";
import { normalizePlayerEventProgress } from "../../player/services/playerEventProgress";
import { useCinemaPlaybackEvidence } from "../../player/hooks/useCinemaPlaybackEvidence";

export function useTVWebview(context) {
  const { anilistData, autoMarkedRef, d, downloadsByEpisodeKey, dubMode, durationRef, failoverTimeoutRef, initialSeekDoneRef, introSkipMode, isAnime, isAsync, item, lastKnownTimeRef, localCountdownStartedRef, onHistory, onMarkWatchedRef, onPlay, pipWebContentsIdRef, playerSource, playerWrapRef, playing, progressViaFrames, resetAutoplayRef, resolvedPlayerUrlRef, resolvingUrlRef, saveProgressRef, seekBackCooldownRef, selectedEp, selectedSeason, setCountdownStartedRef, setInterceptedSubs, setM3u8Url, setPlayerSource, setPlaying, setResolveError, setResolvedPlayerUrl, setResolvingUrl, setSelectedEp, setShowFailoverPrompt, setShowResumePrompt, setSkipPrompt, setSkipTimings, setWebviewLoading, skipPrompt, skipTimings, switchingToMiniPlayerRef, triggerAutoplayRef, voiceBoost, watchedThreshold, webviewLoading, webviewRef } = context;
  const currentProgressKey = selectedEp
    ? `tv_${item.id}_s${selectedSeason}e${selectedEp.episode_number}`
    : null;
  const { healthEvidenceRef, playerEventProgressRef, attemptedSourcesRef, reportSourceHealth } = useCinemaPlaybackEvidence({
    playing, sourceId: playerSource, mediaType: isAnime ? "anime" : "tv", resetKey: currentProgressKey,
    webviewRef, durationRef, lastKnownTimeRef, setWebviewLoading, setShowFailoverPrompt,
  });

  // Check if currently-playing episode is already downloaded or downloading
  const currentEpDownload = selectedEp
    ? (downloadsByEpisodeKey.get(
        `s${selectedSeason}e${selectedEp.episode_number}`,
      ) ?? null)
    : null;

  // Reset auto-mark guard and autoplay when episode changes
  useEffect(() => {
    autoMarkedRef.current = false;
    lastKnownTimeRef.current = 0;
    seekBackCooldownRef.current = 0;
    durationRef.current = 0;
    localCountdownStartedRef.current = false;
    initialSeekDoneRef.current = false; // Reset initial seek!
    resetAutoplayRef.current?.();
  }, [currentProgressKey]);

  // Auto-failover detection effect
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
        reportSourceHealth("slow", "startup-timeout", "Playback has not advanced after 15 seconds.");
      }
    }, 15000);

    return () => clearTimeout(failoverTimeoutRef.current);
  }, [playing, playerSource, selectedEp?.episode_number, reportSourceHealth]);

  const handleFailoverNextSource = useCallback(() => {
    reportSourceHealth("degraded", "playback-stalled", "The user switched after playback stalled.");
    attemptedSourcesRef.current = [...new Set([...attemptedSourcesRef.current, playerSource])];
    const next = getNextHealthyNonAsyncSource(playerSource, {
      mediaType: isAnime ? "anime" : "tv",
      attempted: attemptedSourcesRef.current,
    });
    if (next) {
      clearFailoverSource(`tv_${item.id}_s${selectedSeason}_e${selectedEp?.episode_number}_${dubMode}`);
      setPlayerSource(next);
      storage.set(STORAGE_KEYS.PLAYER_SOURCE, next);
      setShowFailoverPrompt(false);
    }
  }, [playerSource, item.id, selectedSeason, selectedEp, dubMode, isAnime, reportSourceHealth]);

  // Show loader instantly when playback starts
  useEffect(() => {
    if (playing) setWebviewLoading(true);
  }, [playing]);

  // ── Webview memory cleanup ────────────────────────────────────────────────
  // useLayoutEffect fires synchronously BEFORE React mutates the DOM, so the
  // webview is still attached when we navigate it to about:blank.
  // This lets Chromium unload the streaming page.
  useLayoutEffect(() => {
    if (playing) return; // only act when playing stops
    const wv = webviewRef.current;
    if (wv) {
      try {
        wv.src = "about:blank";
      } catch {}
    }
  }, [playing]);

  // Removing the webview from the DOM disposes its guest WebContents. A global
  // cleanup here can race an automatic handoff and destroy the new mini-player.

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
              const { source, highpass, peaking, highshelf, compressor, gain, dest } = window.__orionAudioNodes;
              source.disconnect();
              highpass.disconnect();
              peaking.disconnect();
              if (highshelf) highshelf.disconnect();
              compressor.disconnect();
              if (gain) gain.disconnect();
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
          highpass.frequency.value = 150;
          
          const peaking = ctx.createBiquadFilter();
          peaking.type = 'peaking';
          peaking.frequency.value = 2500;
          peaking.Q.value = 0.8;
          peaking.gain.value = 12;

          const highshelf = ctx.createBiquadFilter();
          highshelf.type = 'highshelf';
          highshelf.frequency.value = 6000;
          highshelf.gain.value = -6;
          
          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.value = -24;
          compressor.knee.value = 30;
          compressor.ratio.value = 4;
          compressor.attack.value = 0.003;
          compressor.release.value = 0.25;

          const gain = ctx.createGain();
          gain.gain.value = 1.4;
          
          sourceNode.disconnect();
          sourceNode.connect(highpass);
          highpass.connect(peaking);
          peaking.connect(highshelf);
          highshelf.connect(compressor);
          compressor.connect(gain);
          gain.connect(ctx.destination);
          
          window.__orionAudioNodes = {
            source: sourceNode,
            highpass,
            peaking,
            highshelf,
            compressor,
            gain,
            dest: ctx.destination
          };
          window.__orionVoiceBoostActive = true;
        } catch (e) {
          console.error("Voice Boost injection failed:", e);
        }
      })()
    `;
    try {
      wv.executeJavaScript(js).catch(() => {});
    } catch (e) {
      console.warn("Voice boost injection failed (webview not ready):", e);
    }
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

  // Attach webview load events so we know when the new source has painted.
  // Also poll for video duration so AniSkip markers appear without waiting for the 5s progress tick.
  useEffect(() => {
    if (!playing) return;
    const wv = webviewRef.current;
    if (!wv) return;
    const done = () => setWebviewLoading(false);
    const failed = (event) => {
      if (event?.isMainFrame === false) return;
      setWebviewLoading(false);
      setShowFailoverPrompt(true);
      reportSourceHealth(
        "failed",
        "main-frame-failed",
        event?.errorDescription || "The provider frame failed to load.",
      );
    };

    const handleWillNavigate = (event) => {
      const url = event.url;
      if (url && (url.includes("/tv/") || url.includes("/movie/")) && url.includes("2embed")) {
        console.log("[Orion] Cancelled 2Embed redirect will-navigate to:", url);
        event.preventDefault();
      }
    };

    wv.addEventListener("did-finish-load", done);
    wv.addEventListener("did-fail-load", failed);
    wv.addEventListener("will-navigate", handleWillNavigate);

    // Poll up to 30s for video duration (metadata may load after buffering starts)
    let attempts = 0;
    const pollDuration = setInterval(async () => {
      if (durationRef.current > 0 || attempts++ > 30) {
        clearInterval(pollDuration);
        return;
      }
      try {
        const dur = await wv.executeJavaScript(
          `(() => { const v = document.querySelector('video'); return (v && v.duration > 0 && isFinite(v.duration)) ? v.duration : null; })()`,
        );
        if (dur) {
          durationRef.current = dur;
          // let markers re-render
          setSkipTimings((t) => (t ? { ...t } : t));
          clearInterval(pollDuration);
        }
      } catch {}
    }, 1000);

    return () => {
      wv.removeEventListener("did-finish-load", done);
      wv.removeEventListener("did-fail-load", failed);
      wv.removeEventListener("will-navigate", handleWillNavigate);
      clearInterval(pollDuration);
    };
  }, [playing, playerSource, item.id, selectedEp?.episode_number, reportSourceHealth]);

  // ── AniSkip: fetch timings when episode changes ───────────────────────────
  useEffect(() => {
    setSkipTimings(null);
    setSkipPrompt(null);
    if (introSkipMode === "off" || !isAsync || !isAnime) return;
    const anilistId = anilistData?.idMal;
    const epNum = selectedEp?.episode_number;
    if (!anilistId || !epNum) return;

    let cancelled = false;
    fetchAniSkipTimings(anilistId, epNum).then((timings) => {
      if (!cancelled) setSkipTimings(timings);
    });
    return () => {
      cancelled = true;
    };
  }, [
    anilistData?.idMal,
    selectedEp?.episode_number,
    playerSource,
    isAnime,
    introSkipMode,
  ]);

  // ── AniSkip: auto-skip or show manual prompt ─────────────────
  // ── AniSkip: manual skip handler ─────────────────────────────────────────
  const handleManualSkip = useCallback(async () => {
    if (!skipPrompt || !skipTimings?.[skipPrompt]) return;
    const rawEnd = skipTimings[skipPrompt].endTime;
    const endTime = Number(rawEnd);
    if (!Number.isFinite(endTime)) return;
    const wv = webviewRef.current;
    if (!wv) return;
    try {
      await wv.executeJavaScript(
        `(() => { const v = document.querySelector('video'); if (v) v.currentTime = ${endTime}; })()`,
      );
    } catch {}
    setSkipPrompt(null);
  }, [skipPrompt, skipTimings]);

  // Use webview before-input-event so Enter reaches main-ui before the webview
  // handles it (avoids the webview's Space/Enter play-pause intercepting it).
  useEffect(() => {
    if (!skipPrompt) return;
    const wv = webviewRef.current;
    if (!wv) return;
    const handler = (e) => {
      if (e.key === "Return" && e.type === "keyDown") {
        handleManualSkip();
      }
    };
    wv.addEventListener("before-input-event", handler);
    return () => wv.removeEventListener("before-input-event", handler);
  }, [skipPrompt, handleManualSkip]);

  // Unified progress/skip timing tick for Allmanga and other sources.
  // Skip detection runs every tick, progress is saved every 5th tick (5s).
  useEffect(() => {
    const aniSkipActive =
      introSkipMode !== "off" && playing && !!skipTimings && isAsync;

    if (!aniSkipActive) setSkipPrompt(null);
    if (!playing || !currentProgressKey) return;

    const TICK = aniSkipActive ? 1000 : 5000;
    let tickCount = 0;
    let interval = null;

    const timer = setTimeout(() => {
      interval = setInterval(async () => {
        try {
          const wv = webviewRef.current;
          if (!wv) return;

          let result = normalizePlayerEventProgress(playerEventProgressRef.current);
          // When the pop-out window is open the main webview shows about:blank
          // -> query the pip window's webContents directly.
          if (!result &&
            pipWebContentsIdRef.current != null &&
            window.electron?.queryVideoProgress
          ) {
            result = await window.electron.queryVideoProgress(
              pipWebContentsIdRef.current,
            );
          } else if (!result && progressViaFrames && window.electron?.queryVideoProgress) {
            const webContentsId = getReadyWebContentsId(wv);
            if (!webContentsId) return;
            result = await window.electron.queryVideoProgress(webContentsId);
          } else if (!result) {
            result = await wv.executeJavaScript(`
              (() => {
                const v = document.querySelector('video')
                if (!v) return null
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
                  duration: v.duration || 0,
                  paused: v.paused,
                  recentUserSeek: v._lastUserSeek ? (Date.now() - v._lastUserSeek < 6000) : false,
                  lastUserSeekTo: v._lastUserSeekTo ?? null,
                }
              })()
            `);
          }



          // ── AniSkip logic: runs every tick (only when aniSkipActive) ────
          if (aniSkipActive && result?.currentTime != null) {
            const ct = result.currentTime;
            const { intro, outro } = skipTimings;
            const inIntro =
              intro && ct >= intro.startTime && ct < intro.endTime - 1;
            const inOutro =
              outro && ct >= outro.startTime && ct < outro.endTime - 1;
            const activeSegment = inIntro ? "intro" : inOutro ? "outro" : null;
            if (!activeSegment) {
              setSkipPrompt(null);
            } else if (introSkipMode === "auto") {
              setSkipPrompt(null);
              const endTime = Number(skipTimings[activeSegment].endTime);
              if (Number.isFinite(endTime)) {
                try {
                  await wv.executeJavaScript(
                    `(() => { const v = document.querySelector('video'); if (v) v.currentTime = ${endTime}; })()`,
                  );
                } catch {}
              }
            } else {
              setSkipPrompt(activeSegment);
            }
          }

          // ── Progress logic: every 5s regardless of tick rate ────────────
          tickCount++;
          if (aniSkipActive && tickCount % 5 !== 0) return;

          if (result && result.duration > 0 && result.duration !== Infinity) {
            durationRef.current = result.duration;
            const ct = result.currentTime;
            const evidence = healthEvidenceRef.current;
            if (!evidence.ready) {
              const current = Number(ct) || 0;
              if (evidence.lastTime != null && current > evidence.lastTime + 0.2 && !result.paused) evidence.advances += 1;
              else if (evidence.lastTime != null && current <= evidence.lastTime && !result.paused) evidence.advances = 0;
              evidence.lastTime = current;
              if (evidence.advances >= 2) {
                evidence.ready = true;
                reportSourceHealth("ready");
              }
            }

            // Clear failover prompt since video is playing
            setShowFailoverPrompt(false);
            clearTimeout(failoverTimeoutRef.current);

            // Initial seek to resume playback time on load
            if (!initialSeekDoneRef.current) {
              initialSeekDoneRef.current = true;
              const startTime = storage.get("dlTime_" + currentProgressKey) || 0;
              if (startTime > 10 && Math.abs(ct - startTime) > 5) {
                try {
                  await wv.executeJavaScript(`
                    (() => {
                      const v = document.querySelector('video');
                      if (v) v.currentTime = ${startTime};
                    })()
                  `);
                } catch {}
                return;
              }
            }

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
            saveProgressRef.current(currentProgressKey, Math.min(p, 100));
            const progressDetails = storage.get(STORAGE_KEYS.PROGRESS_DETAILS) || {};
            progressDetails[currentProgressKey] = { currentTime: ct, duration: result.duration, percent: Math.min(p, 100), updatedAt: Date.now() };
            storage.set(STORAGE_KEYS.PROGRESS_DETAILS, progressDetails);
            // Also persist actual seconds so DownloadsPage can show resume position
            storage.set("dlTime_" + currentProgressKey, Math.floor(ct));

            // Auto-mark watched when remaining time ≤ threshold
            const remaining = result.duration - ct;
            if (
              !autoMarkedRef.current &&
              remaining <= watchedThreshold &&
              remaining >= 0
            ) {
              autoMarkedRef.current = true;
              onMarkWatchedRef.current?.(currentProgressKey);
            }

            // Autoplay trigger
            if (
              remaining <= watchedThreshold &&
              !localCountdownStartedRef.current
            ) {
              localCountdownStartedRef.current = true;
              setCountdownStartedRef.current?.(true);
              triggerAutoplayRef.current?.();
            }
          }
        } catch {}
      }, TICK);
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      setSkipPrompt(null);
    };
  }, [
    playing,
    skipTimings,
    playerSource,
    introSkipMode,
    currentProgressKey,
    watchedThreshold,
    progressViaFrames,
    reportSourceHealth,
  ]);

  // Skip backward/forward by N seconds via webview JS injection
  const seekBy = useCallback(async (seconds) => {
    try {
      const wv = webviewRef.current;
      if (!wv) return;
      await wv.executeJavaScript(`
        (() => {
          const v = document.querySelector('video');
          if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + ${seconds}));
        })()
      `);
    } catch {}
  }, []);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv || !playing) return;

    const inject = () => {
      wv.executeJavaScript(INJECT_SKIP_CONTROLS).catch(() => {});
      
      const css = `
        video::cue {
          background: color-mix(in srgb, black 75%, transparent) !important;
          color: white !important;
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

  const startPlayingEp = (ep, time) => {
    setShowResumePrompt(false);
    setM3u8Url(null);
    setInterceptedSubs([]);
    resolvedPlayerUrlRef.current = null;
    setResolvedPlayerUrl(null);
    resolvingUrlRef.current = false;
    setResolvingUrl(false);
    setResolveError(null);
    
    const epProgressKey = `tv_${item.id}_s${selectedSeason}e${ep.episode_number}`;
    storage.set("dlTime_" + epProgressKey, time);
    
    setSelectedEp(ep);
    setPlaying(true);
    onPlay?.();
    setTimeout(() => {
      playerWrapRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
    onHistory({
      ...d,
      media_type: "tv",
      season: selectedSeason,
      episode: ep.episode_number,
      episodeName: ep.name,
    });
  };
  return { currentEpDownload, currentProgressKey, handleFailoverNextSource, handleManualSkip, startPlayingEp };
}
