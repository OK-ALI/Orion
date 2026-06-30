import { storage, STORAGE_KEYS } from "../../services/settingsStore";
import { getReadyWebContentsId } from "../../features/player/services/webviewLifecycle";

function paletteDataUrl(colors, profile) {
  const opacity = profile === "low" ? 0.5 : profile === "vivid" ? 0.95 : 0.72;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"><defs><radialGradient id="a" cx="18%" cy="48%"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[0]}" stop-opacity="0"/></radialGradient><radialGradient id="b" cx="82%" cy="52%"><stop stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[1]}" stop-opacity="0"/></radialGradient></defs><rect width="32" height="18" fill="#080914"/><rect width="32" height="18" fill="url(#a)" opacity="${opacity}"/><rect width="32" height="18" fill="url(#b)" opacity="${opacity}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function setupAmbientGlow(webview, onColor, options = {}) {
  const savedProfile = storage.get(STORAGE_KEYS.AMBIENT_PROFILE);
  const profile = savedProfile || (storage.get(STORAGE_KEYS.AMBIENT_GLOW) === false ? "off" : "balanced");
  if (profile === "off" || storage.get(STORAGE_KEYS.REDUCE_ANIMATIONS) || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    return () => {};
  }
  // A visible, low-cost cinematic fallback prevents the glow from disappearing
  // when Chromium cannot capture a protected guest frame or power-saving pauses
  // dynamic sampling. A real sampled palette replaces it as soon as available.
  const fallback = ["#6d3bd1", "#168aa4"];
  const targetId = `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let active = true;
  let resizeObserver = null;
  let restartTimer = null;
  let lastRectKey = "";
  const captureElement = options.captureElement || webview;
  const applyPalette = (colors) => {
    const safeColors = Array.isArray(colors) && colors.length >= 2 ? colors : fallback;
    if (captureElement?.style) {
      captureElement.style.setProperty("--player-ambient-a", safeColors[0]);
      captureElement.style.setProperty("--player-ambient-b", safeColors[1]);
      captureElement.dataset.ambientActive = "true";
    }
    onColor(paletteDataUrl(safeColors, profile), safeColors);
  };
  applyPalette(fallback);
  const getCropRect = () => {
    if (typeof options.getCropRect === "function") return options.getCropRect();
    const rect = captureElement?.getBoundingClientRect?.();
    if (!rect) return options.cropRect;
    return {
      x: Math.max(0, Math.round(rect.left)),
      y: Math.max(0, Math.round(rect.top)),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    };
  };
  const start = async () => {
    const playbackWebContentsId = getReadyWebContentsId(webview);
    if (!playbackWebContentsId || !window.electron?.startAmbientSampling) return;
    // Electron renders <webview> media in a separate guest surface. Capturing
    // the parent renderer only sees the area around that surface on several
    // Windows/GPU combinations, so online playback must sample the guest
    // webContents itself. The parent crop remains useful only for native/local
    // players, which use their own ambient path.
    const captureWebContentsId = playbackWebContentsId;
    const cropRect = undefined;
    const rectKey = cropRect
      ? `${cropRect.x}:${cropRect.y}:${cropRect.width}:${cropRect.height}`
      : "full";
    if (rectKey === lastRectKey && playbackWebContentsId === start.lastPlaybackId) return;
    lastRectKey = rectKey;
    start.lastPlaybackId = playbackWebContentsId || null;
    window.electron.startAmbientSampling({
      targetId,
      captureWebContentsId,
      playbackWebContentsId: playbackWebContentsId || captureWebContentsId,
      profile,
      cropRect,
    }).catch(() => {});
  };
  start.lastPlaybackId = null;
  const scheduleRestart = () => {
    if (!active) return;
    window.clearTimeout(restartTimer);
    restartTimer = window.setTimeout(() => { start().catch(() => {}); }, 90);
  };
  const paletteHandler = window.electron?.onAmbientPalette?.((payload) => {
    if (!active || payload?.targetId !== targetId || !Array.isArray(payload.colors)) return;
    applyPalette(payload.colors);
  });
  webview?.addEventListener?.("dom-ready", start);
  window.addEventListener("resize", scheduleRestart);
  window.addEventListener("scroll", scheduleRestart, true);
  if (window.ResizeObserver && captureElement?.nodeType === 1) {
    resizeObserver = new ResizeObserver(scheduleRestart);
    resizeObserver.observe(captureElement);
  }
  try { start(); } catch {}
  return () => {
    active = false;
    webview?.removeEventListener?.("dom-ready", start);
    window.removeEventListener("resize", scheduleRestart);
    window.removeEventListener("scroll", scheduleRestart, true);
    resizeObserver?.disconnect?.();
    window.clearTimeout(restartTimer);
    if (captureElement?.style) {
      captureElement.style.removeProperty("--player-ambient-a");
      captureElement.style.removeProperty("--player-ambient-b");
      delete captureElement.dataset.ambientActive;
    }
    if (paletteHandler) window.electron?.offAmbientPalette?.(paletteHandler);
    window.electron?.stopAmbientSampling?.(targetId).catch(() => {});
  };
}
