const STORAGE_KEY = "orion-mini-player-settings";
export const MINI_PLAYER_DEFAULT_WIDTH = 400;
// Compatibility export for older callers. Chrome now overlays the video, so it
// no longer contributes to the outer geometry.
export const MINI_PLAYER_CHROME_HEIGHT = 0;

export function getMiniPlayerBounds(viewport = window, fallbackWidth = MINI_PLAYER_DEFAULT_WIDTH) {
  let width = fallbackWidth;
  let x = null;
  let y = null;

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Number.isFinite(parsed?.width)) width = Math.max(320, Math.min(640, parsed.width));
    if (Number.isFinite(parsed?.x)) x = parsed.x;
    if (Number.isFinite(parsed?.y)) y = parsed.y;
    if (parsed && Object.hasOwn(parsed, "height")) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...(Number.isFinite(parsed.x) ? { x: parsed.x } : {}),
        ...(Number.isFinite(parsed.y) ? { y: parsed.y } : {}),
        width,
      }));
    }
  } catch {}

  width = Math.min(width, Math.max(320, viewport.innerWidth - 20));
  const height = Math.round(width * (9 / 16));
  if (!Number.isFinite(x)) x = viewport.innerWidth - width - 24;
  if (!Number.isFinite(y)) y = viewport.innerHeight - height - 24;
  x = Math.max(10, Math.min(viewport.innerWidth - width - 10, x));
  y = Math.max(10, Math.min(viewport.innerHeight - height - 10, y));

  return { width, height, x, y };
}

export function getMiniPlayerStorageKey() {
  return STORAGE_KEY;
}
