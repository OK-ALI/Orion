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

/**
 * Mutates Orion's small playback-evidence accumulator and reports only the
 * transition into verified playback. Two advancing observations are required,
 * matching the existing Cinema source-health contract.
 */
export function observePlaybackEvidence(evidence, progress, minimumAdvance = 0.2) {
  if (!evidence || !progress || !Number.isFinite(Number(progress.currentTime))) {
    return { ready: Boolean(evidence?.ready), becameReady: false };
  }

  const wasReady = evidence.ready === true;
  if (!wasReady) {
    if (isAdvancingPlayback(evidence.lastTime, progress, minimumAdvance)) {
      evidence.advances = (Number(evidence.advances) || 0) + 1;
    } else if (!progress.paused && !progress.buffering && evidence.lastTime != null) {
      evidence.advances = 0;
    }
  }
  evidence.lastTime = Number(progress.currentTime);

  if (!wasReady && (Number(evidence.advances) || 0) >= 2) {
    evidence.ready = true;
  }

  return {
    ready: evidence.ready === true,
    becameReady: !wasReady && evidence.ready === true,
  };
}
