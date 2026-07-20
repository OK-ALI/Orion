const finiteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/**
 * Normalize a sanitized webview PLAYER_EVENT into Orion's progress shape.
 * Raw provider messages never cross this boundary.
 */
export function normalizePlayerEventProgress(payload, now = Date.now()) {
  if (!payload || typeof payload !== "object") return null;
  const currentTime = finiteNumber(payload.currentTime);
  const duration = finiteNumber(payload.duration);
  const capturedAt = finiteNumber(payload.capturedAt) ?? now;
  if (currentTime == null && duration == null) return null;
  if (now - capturedAt > 12_000) return null;

  return {
    currentTime: Math.max(0, currentTime ?? 0),
    duration: Math.max(0, duration ?? 0),
    paused: payload.paused === true,
    buffering: payload.buffering === true,
    recentUserSeek: false,
    lastUserSeekTo: null,
    capturedAt,
  };
}

export function isAdvancingPlayback(previousTime, progress, minimumAdvance = 0.2) {
  if (!progress || progress.paused || progress.buffering) return false;
  if (!Number.isFinite(previousTime)) return false;
  return progress.currentTime > previousTime + minimumAdvance;
}
