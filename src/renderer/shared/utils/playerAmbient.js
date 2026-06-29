import { storage, STORAGE_KEYS } from "../../services/settingsStore";
import { getReadyWebContentsId } from "../../features/player/services/webviewLifecycle";

function paletteDataUrl(colors, profile) {
  const opacity = profile === "low" ? 0.5 : profile === "vivid" ? 0.95 : 0.72;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"><defs><radialGradient id="a" cx="18%" cy="48%"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[0]}" stop-opacity="0"/></radialGradient><radialGradient id="b" cx="82%" cy="52%"><stop stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[1]}" stop-opacity="0"/></radialGradient></defs><rect width="32" height="18" fill="#080914"/><rect width="32" height="18" fill="url(#a)" opacity="${opacity}"/><rect width="32" height="18" fill="url(#b)" opacity="${opacity}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function setupAmbientGlow(webview, onColor) {
  const savedProfile = storage.get(STORAGE_KEYS.AMBIENT_PROFILE);
  const profile = savedProfile || (storage.get(STORAGE_KEYS.AMBIENT_GLOW) === false ? "off" : "balanced");
  if (profile === "off" || storage.get(STORAGE_KEYS.REDUCE_ANIMATIONS) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return () => {};
  }
  // A visible, low-cost cinematic fallback prevents the glow from disappearing
  // when Chromium cannot capture a protected guest frame or power-saving pauses
  // dynamic sampling. A real sampled palette replaces it as soon as available.
  onColor(paletteDataUrl(["#4c1d95", "#0e7490"], profile));
  const targetId = `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let active = true;
  const start = () => {
    const webContentsId = getReadyWebContentsId(webview);
    if (!webContentsId || !window.electron?.startAmbientSampling) return;
    window.electron.startAmbientSampling({ targetId, webContentsId, profile }).catch(() => {});
  };
  const paletteHandler = window.electron?.onAmbientPalette?.((payload) => {
    if (!active || payload?.targetId !== targetId || !Array.isArray(payload.colors)) return;
    onColor(paletteDataUrl(payload.colors, profile));
  });
  webview?.addEventListener?.("dom-ready", start);
  try { start(); } catch {}
  return () => {
    active = false;
    webview?.removeEventListener?.("dom-ready", start);
    if (paletteHandler) window.electron?.offAmbientPalette?.(paletteHandler);
    window.electron?.stopAmbientSampling?.(targetId).catch(() => {});
  };
}
