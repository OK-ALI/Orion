export function buildPlaybackHandoff(session, playbackState, to) {
  const state = playbackState || {};
  return {
    ...session,
    mode: to,
    playbackState: {
      currentTime: Math.max(0, Number(state.currentTime ?? session.currentTime) || 0),
      duration: Math.max(0, Number(state.duration ?? session.duration) || 0),
      paused: Boolean(state.paused),
      muted: Boolean(state.muted),
      volume: Math.max(0, Math.min(1, Number(state.volume ?? session.volume ?? 1))),
    },
    updatedAt: Date.now(),
  };
}

export function settlePlaybackStateWithin(promise, timeoutMs, fallback = null) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = globalThis.setTimeout(() => finish(fallback), timeoutMs);
    function finish(value) {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      resolve(value);
    }
    Promise.resolve(promise).then(finish, () => finish(fallback));
  });
}
