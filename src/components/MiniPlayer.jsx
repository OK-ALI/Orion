import React, { useState, useEffect, useRef } from "react";
import { setupAmbientGlow } from "../utils/playerAmbient";
import { storage, STORAGE_KEYS } from "../utils/storage";

export default function MiniPlayer({ url, title, onClose, onExpand }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 360, height: 202 }); // 16:9 aspect ratio
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const playerRef = useRef(null);
  const webviewRef = useRef(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const playerStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const [ambientColor, setAmbientColor] = useState("");
  const [ambientGlowEnabled, setAmbientGlowEnabled] = useState(
    () => storage.get(STORAGE_KEYS.AMBIENT_GLOW) !== false,
  );

  // Inject CSS to scale down subtitles for the mini-player
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    const injectStyles = () => {
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
    };
    wv.addEventListener("dom-ready", injectStyles);
    return () => wv.removeEventListener("dom-ready", injectStyles);
  }, []);

  // Ambient glow settings sync
  useEffect(() => {
    const handler = () => {
      setAmbientGlowEnabled(storage.get(STORAGE_KEYS.AMBIENT_GLOW) !== false);
    };
    window.addEventListener("orion:player-settings-changed", handler);
    return () => {
      window.removeEventListener("orion:player-settings-changed", handler);
    };
  }, []);

  // Ambient glow hook
  useEffect(() => {
    if (!ambientGlowEnabled) {
      setAmbientColor("");
      return;
    }
    const wv = webviewRef.current;
    if (!wv) return;

    const cleanup = setupAmbientGlow(wv, (colorDataUrl) => {
      setAmbientColor(colorDataUrl);
    });

    return () => {
      cleanup();
    };
  }, [url, ambientGlowEnabled]);

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
    <>
      {ambientColor && (
        <div
          className="player-ambient-glow"
          style={{
            backgroundImage: `url(${ambientColor})`,
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
            position: "fixed",
            zIndex: 9998,
          }}
        />
      )}
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
        }}
      >
        {/* Drag Handle & Header */}
        <div className="orion-mini-player-drag-handle" onMouseDown={handleDragStart}>
          <div className="orion-mini-player-title" title={title}>
            {title || "Now Playing"}
          </div>
          <div className="orion-mini-player-actions">
            {/* Expand Button */}
            <button
              className="orion-mini-player-btn expand"
              onClick={onExpand}
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
          <webview
            ref={webviewRef}
            className="orion-mini-player-webview"
            src={url}
            partition="persist:player"
            allowpopups="false"
            sandbox="allow-scripts allow-same-origin allow-forms"
            webpreferences="webSecurity=no"
            style={{ width: "100%", height: "100%", border: "none", position: "relative", zIndex: 2 }}
          />
          {/* Resize Grip (visible in bottom right) */}
          <div
            className="orion-mini-player-resize-handle"
            onMouseDown={handleResizeStart}
          />
        </div>
      </div>
    </>
  );
}
