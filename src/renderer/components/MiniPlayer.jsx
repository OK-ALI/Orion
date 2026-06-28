import React, { useState, useEffect, useRef } from "react";
import { setupAmbientGlow } from "../shared/utils/playerAmbient";
import { getReadyWebContentsId } from "../features/player/services/webviewLifecycle";

export default function MiniPlayer({ url, title, context, initialState, subtitles = [], onClose, onExpand, onPopOut, onProgress }) {
  const isLocal = String(url || "").startsWith("orion-media://");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 360, height: 202 }); // 16:9 aspect ratio
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const playerRef = useRef(null);
  const webviewRef = useRef(null);
  const nativeVideoRef = useRef(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const playerStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const webContentsIdRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(Number(initialState?.currentTime) || 0);
  const [duration, setDuration] = useState(Number(initialState?.duration) || 0);
  const [volume, setVolume] = useState(Number(initialState?.volume ?? 1));
  const restoredRef = useRef(false);
  const ambientCleanupRef = useRef(null);
  const [ambientImage, setAmbientImage] = useState("");
  const lastProgressSavedRef = useRef(0);

  // Inject CSS to scale down subtitles for the mini-player
  useEffect(() => {
    if (isLocal) return undefined;
    const wv = webviewRef.current;
    if (!wv) return;
    const injectStyles = () => {
      webContentsIdRef.current = getReadyWebContentsId(wv);
      setLoading(false);
      setLoadError("");
      const css = `
        video::cue {
          font-size: 13px !important;
          background: rgba(0, 0, 0, 0.75) !important;
        }
        .jw-captions, .jw-caption-text,
        .vjs-text-track-display, .vjs-text-track-cue,
        .plyr__captions, .plyr__caption,
        .art-subtitles, .art-subtitle,
        .shaka-text-container, .shaka-text-region,
        .dplayer-subtitles, .dplayer-subtitle,
        [class*="caption"], [class*="subtitle"], [class*="cue"] {
          font-size: 11px !important;
          line-height: 1.3 !important;
          padding: 2px 4px !important;
          bottom: 12px !important;
          transform: translateY(0) !important;
          margin-bottom: 0 !important;
        }
      `;
      wv.insertCSS(css).catch(() => {});
      ambientCleanupRef.current?.();
      ambientCleanupRef.current = setupAmbientGlow(wv, setAmbientImage);
      if (!restoredRef.current && window.electron?.setVideoState) {
        restoredRef.current = true;
        const restore = () => window.electron.setVideoState(webContentsIdRef.current, {
          currentTime: Number(initialState?.currentTime) || 0,
          paused: Boolean(initialState?.paused),
          muted: Boolean(initialState?.muted),
          volume: Number(initialState?.volume ?? 1),
        }).catch(() => {});
        window.setTimeout(restore, 350);
        window.setTimeout(restore, 1400);
      }
    };
    const handleStart = () => setLoading(true);
    const handleStop = () => setLoading(false);
    const handleFailure = (event) => {
      if (event?.errorCode === -3) return;
      setLoading(false);
      setLoadError(event?.errorDescription || "The mini-player could not load this source.");
    };
    wv.addEventListener("dom-ready", injectStyles);
    wv.addEventListener("did-start-loading", handleStart);
    wv.addEventListener("did-stop-loading", handleStop);
    wv.addEventListener("did-fail-load", handleFailure);
    return () => {
      wv.removeEventListener("dom-ready", injectStyles);
      wv.removeEventListener("did-start-loading", handleStart);
      wv.removeEventListener("did-stop-loading", handleStop);
      wv.removeEventListener("did-fail-load", handleFailure);
      ambientCleanupRef.current?.();
    };
  }, [initialState, isLocal]);

  useEffect(() => {
    if (!isLocal) return;
    const video = nativeVideoRef.current;
    if (!video) return;
    const restore = () => {
      video.currentTime = Math.max(0, Number(initialState?.currentTime) || 0);
      video.volume = Math.max(0, Math.min(1, Number(initialState?.volume ?? 1)));
      video.muted = Boolean(initialState?.muted);
      if (!initialState?.paused) video.play().catch(() => {});
    };
    video.addEventListener("loadedmetadata", restore, { once: true });
    return () => video.removeEventListener("loadedmetadata", restore);
  }, [isLocal, initialState, url]);

  useEffect(() => {
    const updatePlaybackState = async () => {
      if (isLocal) {
        const video = nativeVideoRef.current;
        if (!video) return;
        setPaused(video.paused); setMuted(video.muted); setCurrentTime(video.currentTime || 0);
        setDuration(video.duration || 0); setVolume(video.volume);
        return;
      }
      const id = webContentsIdRef.current;
      if (!id || !window.electron?.queryVideoProgress) return;
      const state = await window.electron.queryVideoProgress(id).catch(() => null);
      if (!state) return;
      setPaused(Boolean(state.paused));
      setMuted(Boolean(state.muted));
      setCurrentTime(Number(state.currentTime) || 0);
      setDuration(Number(state.duration) || 0);
      setVolume(Number(state.volume ?? 1));
      if (state.duration > 0 && Date.now() - lastProgressSavedRef.current > 4500) {
        lastProgressSavedRef.current = Date.now();
        onProgress?.(state);
      }
    };
    const timer = window.setInterval(updatePlaybackState, 1000);
    return () => window.clearInterval(timer);
  }, [url, isLocal, onProgress]);

  const controlVideo = async (action) => {
    if (isLocal) {
      const video = nativeVideoRef.current;
      if (!video) return;
      if (action === "play") video.play().catch(() => {});
      if (action === "pause") video.pause();
      if (action === "mute") video.muted = true;
      if (action === "unmute") video.muted = false;
      setPaused(video.paused); setMuted(video.muted);
      return;
    }
    const id = webContentsIdRef.current;
    if (!id || !window.electron?.controlVideo) {
      setLoadError("Mini-player controls are unavailable. Restart Orion and try again.");
      return;
    }
    const result = await window.electron.controlVideo(id, action);
    if (!result?.ok) {
      setLoadError(result?.error || "The video is still loading.");
      return;
    }
    setLoadError("");
    setPaused(Boolean(result.paused));
    setMuted(Boolean(result.muted));
  };

  const snapshot = async () => {
    if (isLocal && nativeVideoRef.current) {
      const video = nativeVideoRef.current;
      return { currentTime: video.currentTime || 0, duration: video.duration || 0, paused: video.paused, muted: video.muted, volume: video.volume };
    }
    const id = webContentsIdRef.current;
    const state = id && window.electron?.queryVideoProgress
      ? await window.electron.queryVideoProgress(id).catch(() => null)
      : null;
    return state || { currentTime, duration, paused, muted, volume };
  };

  const applyState = async (next) => {
    if (isLocal && nativeVideoRef.current) {
      const video = nativeVideoRef.current;
      if (Number.isFinite(Number(next.currentTime))) video.currentTime = Math.max(0, Number(next.currentTime));
      if (Number.isFinite(Number(next.volume))) video.volume = Math.max(0, Math.min(1, Number(next.volume)));
      if (typeof next.muted === "boolean") video.muted = next.muted;
      if (next.paused === true) video.pause();
      if (next.paused === false) video.play().catch(() => {});
      setCurrentTime(video.currentTime || 0); setDuration(video.duration || 0); setPaused(video.paused); setMuted(video.muted); setVolume(video.volume);
      return;
    }
    const id = webContentsIdRef.current;
    if (!id || !window.electron?.setVideoState) return;
    const result = await window.electron.setVideoState(id, next);
    if (result?.ok) {
      setCurrentTime(Number(result.currentTime) || 0);
      setDuration(Number(result.duration) || duration);
      setPaused(Boolean(result.paused));
      setMuted(Boolean(result.muted));
      setVolume(Number(result.volume ?? volume));
    }
  };

  const handlePopOut = async () => {
    const state = await snapshot();
    await applyState({ ...state, paused: true });
    const result = await onPopOut?.({ ...state, paused: false });
    if (result && !result.ok) {
      setLoadError(result.error || "The pop-out player could not be opened.");
      await applyState({ ...state, paused: false });
    }
  };

  const handleExpand = async () => {
    const state = await snapshot();
    await applyState({ ...state, paused: true });
    onExpand?.({ ...state, paused: false });
  };

  // Load saved position and size on mount
  useEffect(() => {
    const saved = localStorage.getItem("orion-mini-player-settings");
    let initialWidth = 360;
    let initialHeight = 202;
    let initialX = window.innerWidth - initialWidth - 24;
    let initialY = window.innerHeight - initialHeight - 24;

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.width) initialWidth = parsed.width;
        if (parsed.height) initialHeight = parsed.height;
        if (parsed.x !== undefined) initialX = parsed.x;
        if (parsed.y !== undefined) initialY = parsed.y;
      } catch (e) {
        console.error("Error loading mini-player settings:", e);
      }
    }

    // Keep within bounds
    initialX = Math.max(10, Math.min(window.innerWidth - initialWidth - 10, initialX));
    initialY = Math.max(10, Math.min(window.innerHeight - initialHeight - 10, initialY));

    setSize({ width: initialWidth, height: initialHeight });
    setPosition({ x: initialX, y: initialY });
  }, []);

  // Update bounds when window resizes
  useEffect(() => {
    const handleWindowResize = () => {
      setPosition((prev) => {
        const maxX = window.innerWidth - size.width - 10;
        const maxY = window.innerHeight - size.height - 10;
        return {
          x: Math.max(10, Math.min(maxX, prev.x)),
          y: Math.max(10, Math.min(maxY, prev.y)),
        };
      });
    };

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [size]);

  // Dragging logic
  const handleDragStart = (e) => {
    if (e.target.closest(".orion-mini-player-btn")) return; // Don't drag if clicking buttons
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    playerStart.current = { x: position.x, y: position.y };
    e.preventDefault();
  };

  // Resizing logic
  const handleResizeStart = (e) => {
    setIsResizing(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    playerStart.current = { w: size.width, h: size.height, x: position.x, y: position.y };
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        
        let newX = playerStart.current.x + dx;
        let newY = playerStart.current.y + dy;

        // Visual constraints during drag (keep some part of the player visible)
        newX = Math.max(0, Math.min(window.innerWidth - size.width, newX));
        newY = Math.max(0, Math.min(window.innerHeight - size.height, newY));

        setPosition({ x: newX, y: newY });
      } else if (isResizing) {
        const dx = e.clientX - dragStart.current.x;
        
        // Calculate new width
        let newWidth = playerStart.current.w + dx;
        newWidth = Math.max(280, Math.min(640, newWidth)); // constraints: 280 to 640
        const newHeight = Math.round(newWidth * (9 / 16));

        // Constrain so it doesn't expand offscreen to the right/bottom
        if (playerStart.current.x + newWidth > window.innerWidth - 10) {
          newWidth = window.innerWidth - 10 - playerStart.current.x;
        }

        setSize({
          width: newWidth,
          height: Math.round(newWidth * (9 / 16))
        });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        
        // Snap to corners (within 30px edge check)
        let finalX = position.x;
        let finalY = position.y;
        const snapMargin = 30;
        const borderMargin = 20;

        if (finalX < snapMargin) {
          finalX = borderMargin;
        } else if (window.innerWidth - (finalX + size.width) < snapMargin) {
          finalX = window.innerWidth - size.width - borderMargin;
        }

        if (finalY < snapMargin) {
          finalY = borderMargin;
        } else if (window.innerHeight - (finalY + size.height) < snapMargin) {
          finalY = window.innerHeight - size.height - borderMargin;
        }

        setPosition({ x: finalX, y: finalY });
        
        // Persist settings
        localStorage.setItem(
          "orion-mini-player-settings",
          JSON.stringify({ x: finalX, y: finalY, width: size.width, height: size.height })
        );
      }

      if (isResizing) {
        setIsResizing(false);
        localStorage.setItem(
          "orion-mini-player-settings",
          JSON.stringify({ x: position.x, y: position.y, width: size.width, height: size.height })
        );
      }
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, position, size]);

  return (
      <div
        ref={playerRef}
        className={`orion-mini-player ${isDragging ? "is-dragging" : ""}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          position: "fixed",
          zIndex: 9999,
          boxShadow: ambientImage
            ? `0 20px 52px rgba(0,0,0,.72), 0 0 52px color-mix(in srgb, var(--accent) 45%, transparent)`
            : undefined,
          "--mini-ambient": ambientImage ? `url(${ambientImage})` : "none",
        }}
      >
        {/* Drag Handle & Header */}
        <div className="orion-mini-player-drag-handle" onMouseDown={handleDragStart}>
          <div className="orion-mini-player-title" title={title}>
            <span>{title || "Now Playing"}</span>
            {context && <small>{context}</small>}
          </div>
          <div className="orion-mini-player-actions">
            <button
              className="orion-mini-player-btn"
              onClick={() => controlVideo(paused ? "play" : "pause")}
              title={paused ? "Play" : "Pause"}
              aria-label={paused ? "Play" : "Pause"}
            >
              {paused ? "▶" : "Ⅱ"}
            </button>
            <button
              className="orion-mini-player-btn"
              onClick={() => controlVideo(muted ? "unmute" : "mute")}
              title={muted ? "Unmute" : "Mute"}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
            {onPopOut && (
              <button
                className="orion-mini-player-btn"
                onClick={handlePopOut}
                title="Open always-on-top pop-out"
                aria-label="Open always-on-top pop-out"
              >
                ↗
              </button>
            )}
            {/* Expand Button */}
            <button
              className="orion-mini-player-btn expand"
              onClick={handleExpand}
              title="Expand to Full Player"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6" />
                <path d="M9 21H3v-6" />
                <path d="M21 3l-7 7" />
                <path d="M3 21l7-7" />
              </svg>
            </button>
            {/* Close Button */}
            <button
              className="orion-mini-player-btn close"
              onClick={onClose}
              title="Close Player"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Webview Content */}
        <div className="orion-mini-player-content">
          {isLocal ? (
            <video ref={nativeVideoRef} className="orion-mini-player-webview" src={url} playsInline>
              {subtitles.map((subtitle, index) => <track key={subtitle.url} kind="subtitles" src={subtitle.url} srcLang={subtitle.lang || "en"} label={subtitle.lang || `Subtitle ${index + 1}`} default={index === 0} />)}
            </video>
          ) : (
            <webview
              ref={webviewRef}
              className="orion-mini-player-webview"
              src={url}
              partition="persist:player"
              allowpopups="false"
              style={{ width: "100%", height: "100%", border: "none", position: "relative", zIndex: 2 }}
            />
          )}
          <div className="orion-mini-player-transport">
            <button onClick={() => applyState({ currentTime: Math.max(0, currentTime - 10) })} aria-label="Seek back 10 seconds">-10</button>
            <input
              type="range" min="0" max={Math.max(1, duration)} step="1" value={Math.min(currentTime, Math.max(1, duration))}
              onChange={(event) => applyState({ currentTime: Number(event.target.value) })}
              aria-label="Playback position"
            />
            <button onClick={() => applyState({ currentTime: Math.min(duration || currentTime + 10, currentTime + 10) })} aria-label="Seek forward 10 seconds">+10</button>
            <input
              className="orion-mini-player-volume" type="range" min="0" max="1" step="0.05" value={volume}
              onChange={(event) => applyState({ volume: Number(event.target.value), muted: false })}
              aria-label="Volume"
            />
          </div>
          {(loading || loadError) && (
            <div className="orion-mini-player-status" role={loadError ? "alert" : "status"}>
              <div>{loadError || "Loading player…"}</div>
              {loadError && (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setLoadError("");
                    setLoading(true);
                    webviewRef.current?.reload?.();
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          )}
          {/* Resize Grip (visible in bottom right) */}
          <div
            className="orion-mini-player-resize-handle"
            onMouseDown={handleResizeStart}
          />
        </div>
      </div>
  );
}
