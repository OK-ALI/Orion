export const PLAYBACK_INTENT = Object.freeze({
  FRESH: "fresh",
  RESUME: "resume",
  START_FROM_ZERO: "start-from-zero",
});

export function createPlaybackIntent(type, position = 0) {
  const safePosition = Math.max(0, Math.floor(Number(position) || 0));

  if (type === PLAYBACK_INTENT.START_FROM_ZERO) {
    return { type: PLAYBACK_INTENT.START_FROM_ZERO, position: 0 };
  }

  if (type === PLAYBACK_INTENT.RESUME && safePosition > 0) {
    return { type: PLAYBACK_INTENT.RESUME, position: safePosition };
  }

  return { type: PLAYBACK_INTENT.FRESH, position: 0 };
}

export function getPlaybackIntentTarget(intent) {
  if (intent?.type === PLAYBACK_INTENT.START_FROM_ZERO) return 0;
  if (intent?.type === PLAYBACK_INTENT.RESUME) {
    return Math.max(0, Math.floor(Number(intent.position) || 0));
  }
  return null;
}


export function createStartPlaybackIntent({
  time = 0,
  intentType = null,
  forceReset = false,
} = {}) {
  const safeTime = forceReset ? 0 : Math.max(0, Math.floor(Number(time) || 0));
  const resolvedType = forceReset
    ? PLAYBACK_INTENT.START_FROM_ZERO
    : intentType || (safeTime > 0 ? PLAYBACK_INTENT.RESUME : PLAYBACK_INTENT.FRESH);
  return createPlaybackIntent(resolvedType, safeTime);
}
