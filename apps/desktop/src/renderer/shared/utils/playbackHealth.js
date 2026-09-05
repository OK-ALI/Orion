export function samplePlaybackHealth(state, previousDroppedFrames = 0, eventLoopLagMs = 0) {
  const active = Boolean(state && !state.paused);
  const cumulativeDroppedFrames = Math.max(0, Number(state?.droppedFrames) || 0);
  const previous = Math.max(0, Number(previousDroppedFrames) || 0);
  const droppedFrames = cumulativeDroppedFrames >= previous
    ? cumulativeDroppedFrames - previous
    : 0;

  return {
    nextDroppedFrames: state ? cumulativeDroppedFrames : 0,
    report: {
      eventLoopLagMs: Math.max(0, Number(eventLoopLagMs) || 0),
      bufferingEvents: active && Number(state?.readyState) < 3 ? 1 : 0,
      droppedFrames,
      bufferedAhead: Math.max(0, Number(state?.bufferedAhead) || 0),
      readyState: Math.max(0, Number(state?.readyState) || 0),
      playbackActive: active,
    },
  };
}
