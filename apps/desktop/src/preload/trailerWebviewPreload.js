// Sandboxed preload for Orion's trailer webview. Provider documents receive no
// Electron API; the host only receives a bounded, validated playback event.

const { ipcRenderer } = require("electron");

const ALLOWED_TYPES = new Set([
  "ready",
  "playing",
  "paused",
  "buffering",
  "ended",
  "autoplay-blocked",
  "timeout",
  "network-error",
  "provider-error",
]);

function sanitizeTrailerEvent(value) {
  if (!value || typeof value !== "object") return null;
  const candidateId = String(value.candidateId || "");
  const type = String(value.type || "");
  if (!/^[A-Za-z0-9:_-]{1,180}$/.test(candidateId) || !ALLOWED_TYPES.has(type)) return null;
  const rawCode = value.detail?.code;
  const code = typeof rawCode === "number" && Number.isFinite(rawCode)
    ? rawCode
    : typeof rawCode === "string"
      ? rawCode.slice(0, 80)
      : null;
  return { candidateId, type, detail: code == null ? null : { code } };
}

globalThis.addEventListener("orion-trailer-event", (event) => {
  try {
    if (globalThis.location?.protocol !== "orion-trailer:") return;
    const payload = sanitizeTrailerEvent(event?.detail);
    if (payload) ipcRenderer.sendToHost("orion-trailer-event", payload);
  } catch {}
});

module.exports = { sanitizeTrailerEvent };
