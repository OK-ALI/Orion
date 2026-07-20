// Sandboxed preload for player webview (cross-origin guest pages).
// No Electron API is exposed to guest scripts. The only bridge is a narrow,
// sanitized PLAYER_EVENT relay to Orion's host renderer.

const { ipcRenderer } = require("electron");

const finiteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const sanitizePlayerEvent = (value) => {
  if (typeof value === "string" && value.length <= 4_096) {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!value || typeof value !== "object") return null;
  const payload = value.type === "PLAYER_EVENT"
    ? (value.data && typeof value.data === "object" ? value.data : value)
    : null;
  if (!payload) return null;

  const event = String(payload.event || payload.action || payload.type || "").slice(0, 48);
  const currentTime = finiteNumber(payload.currentTime ?? payload.time ?? payload.position);
  const duration = finiteNumber(payload.duration ?? payload.totalTime ?? payload.length);
  const volume = finiteNumber(payload.volume);
  const paused = typeof payload.paused === "boolean"
    ? payload.paused
    : event === "pause"
      ? true
      : event === "play" || event === "playing" || event === "timeupdate"
        ? false
        : null;

  if (!event && currentTime == null && duration == null) return null;
  return {
    event,
    currentTime,
    duration,
    paused,
    volume,
    buffering: Boolean(payload.buffering || event === "waiting" || event === "buffering"),
    capturedAt: Date.now(),
  };
};

const PLAYER_EVENT_ORIGINS = new Set([
  "https://www.vidking.net",
  "https://vidlink.pro",
  "https://vidsrc.cc",
  "https://vixsrc.to",
  "https://vsembed.su",
]);

globalThis.addEventListener("message", (event) => {
  try {
    if (!PLAYER_EVENT_ORIGINS.has(event?.origin)) return;
    const payload = sanitizePlayerEvent(event?.data);
    if (payload) ipcRenderer.sendToHost("orion-player-event", payload);
  } catch {}
});

const removeConservativeAdNodes = (root = document) => {
  const selectors = [
    // iframe-based ads
    "iframe[src*='doubleclick.net']",
    "iframe[src*='googlesyndication.com']",
    "iframe[src*='profitableratecpm.com']",
    "iframe[src*='adexchangeclear.com']",
    "iframe[src*='asokapygmoid.com']",
    "ins.adsbygoogle",
    "[id^='google_ads_']",
    // VidSrc / VsEmbed div-based click-hijack overlays
    "div[style*='z-index'][style*='position: fixed'][style*='pointer-events']",
    "div[style*='z-index: 2147483647']",
    "div[class*='overlay'][style*='position: absolute'][style*='cursor: pointer']",
    // Transparent full-page anchor overlays used for ad redirects
    "a[target='_blank'][style*='position: fixed'][style*='z-index']",
    "a[target='_blank'][style*='position: absolute'][style*='inset']",
    // Common ad container class patterns
    "[class*='ad-overlay']",
    "[class*='popunder']",
    "[class*='adblock-detector']",
    "[id*='popover-ad']",
  ];
  for (const node of root.querySelectorAll?.(selectors.join(",")) || []) node.remove();
};

globalThis.addEventListener("DOMContentLoaded", () => {
  removeConservativeAdNodes();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes || []) {
        if (node?.nodeType === 1) removeConservativeAdNodes(node);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Provider controls are not ordinary external anchors. Suppress click-through
  // overlays that try to leave the embedded player; Electron also denies the
  // resulting popup at the webContents boundary.
  document.addEventListener("click", (event) => {
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) return;
    try {
      const target = new URL(anchor.href, window.location.href);
      const leavesPlayer = target.protocol.startsWith("http") && target.origin !== window.location.origin;
      if (leavesPlayer || anchor.target === "_blank") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    } catch {}
  }, true);
}, { once: true });
