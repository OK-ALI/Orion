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
import { INJECT_SKIP_CONTROLS } from "../../player/webviewScripts/skipControls";
import { getReadyWebContentsId } from "../../player/services/webviewLifecycle";

export function useMovieWebview(context) {
  const { autoMarkedRef, autoplayDoneRef, d, dubMode, failoverTimeoutRef, initialSeekDoneRef, isWatched, item, lastKnownTimeRef, loading, onHistory, onMarkWatchedRef, onPlay, pipUrlRef, pipWebContentsIdRef, playerSource, playerWrapRef, playing, progressKey, progressViaFrames, resolvedPlayerUrlRef, resolvingUrlRef, saveProgress, saveProgressRef, seekBackCooldownRef, setInterceptedSubs, setM3u8Url, setPipOpen, setPlayerFullscreen, setPlayerSource, setPlaying, setResolveError, setResolvedPlayerUrl, setResolvingUrl, setResumeTime, setShowFailoverPrompt, setShowResumePrompt, setWebviewLoading, switchingToMiniPlayerRef, voiceBoost, watchedThreshold, webviewLoading, webviewRef } = context;
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
            const webContentsId = getReadyWebContentsId(wv);
            if (!webContentsId) return;
            result = await window.electron.queryVideoProgress(webContentsId);
          } else {
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

          if (result && result.duration > 0 && result.duration !== Infinity) {
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
            const progressDetails = storage.get(STORAGE_KEYS.PROGRESS_DETAILS) || {};
            progressDetails[progressKey] = { currentTime: ct, duration: result.duration, percent: Math.min(p, 100), updatedAt: Date.now() };
            storage.set(STORAGE_KEYS.PROGRESS_DETAILS, progressDetails);

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

  useEffect(() => {
    if (item.autoplay && !loading && !autoplayDoneRef.current) {
      autoplayDoneRef.current = true;
      if (Number(item.handoffTime) > 0) startMoviePlayback(item.handoffTime);
      else handlePlay();
    }
  }, [item.autoplay, item.handoffTime, loading, handlePlay, startMoviePlayback]);

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
  return { handleFailoverNextSource, handlePlay, startMoviePlayback };
}
