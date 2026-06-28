import { storage, STORAGE_KEYS } from "../../services/settingsStore";
import { getReadyWebContentsId } from "../../features/player/services/webviewLifecycle";

function paletteDataUrl(colors, profile) {
  const opacity = profile === "low" ? 0.5 : profile === "vivid" ? 0.95 : 0.72;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"><defs><radialGradient id="a" cx="18%" cy="48%"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[0]}" stop-opacity="0"/></radialGradient><radialGradient id="b" cx="82%" cy="52%"><stop stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[1]}" stop-opacity="0"/></radialGradient></defs><rect width="32" height="18" fill="#080914"/><rect width="32" height="18" fill="url(#a)" opacity="${opacity}"/><rect width="32" height="18" fill="url(#b)" opacity="${opacity}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function setupAmbientGlow(webview, onColor) {
  const profile = storage.get(STORAGE_KEYS.AMBIENT_PROFILE) || "balanced";
  if (profile === "off" || storage.get(STORAGE_KEYS.AMBIENT_GLOW) === false || storage.get(STORAGE_KEYS.REDUCE_ANIMATIONS) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return () => {};
  }
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
