export const REMOTE_POINTER_VISUAL_SETTLE_PX = 0.35;

const MAX_FRAME_DELTA_MS = 34;
const SMALL_MOTION_TAU_MS = 6;
const MEDIUM_MOTION_TAU_MS = 5;
const FAST_MOTION_TAU_MS = 4;

export function clampRemotePointerRatio(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

export function createRemotePointerTarget(pointer, width, height, receivedAt = 0) {
  const xRatio = clampRemotePointerRatio(pointer?.x ?? pointer?.xRatio);
  const yRatio = clampRemotePointerRatio(pointer?.y ?? pointer?.yRatio);
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeHeight = Math.max(0, Number(height) || 0);

  return {
    x: Math.round(xRatio * safeWidth),
    y: Math.round(yRatio * safeHeight),
    xRatio,
    yRatio,
    receivedAt: Number.isFinite(Number(receivedAt)) ? Number(receivedAt) : 0,
  };
}

function resolveTauMs(distance) {
  if (distance >= 180) return FAST_MOTION_TAU_MS;
  if (distance >= 72) return MEDIUM_MOTION_TAU_MS;
  return SMALL_MOTION_TAU_MS;
}

export function stepRemotePointerVisual(
  current,
  target,
  deltaMs,
  { reducedMotion = false } = {},
) {
  if (!target) {
    return {
      position: current || null,
      settled: true,
      snapped: false,
      distance: 0,
    };
  }

  if (!current || reducedMotion) {
    return {
      position: { x: target.x, y: target.y },
      settled: true,
      snapped: true,
      distance: current
        ? Math.hypot(target.x - current.x, target.y - current.y)
        : 0,
    };
  }

  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= REMOTE_POINTER_VISUAL_SETTLE_PX) {
    return {
      position: { x: target.x, y: target.y },
      settled: true,
      snapped: false,
      distance,
    };
  }

  const boundedDelta = Math.max(
    1,
    Math.min(MAX_FRAME_DELTA_MS, Number(deltaMs) || 16.67),
  );
  const tauMs = resolveTauMs(distance);
  const alpha = 1 - Math.exp(-boundedDelta / tauMs);

  const x = current.x + dx * alpha;
  const y = current.y + dy * alpha;
  const remaining = Math.hypot(target.x - x, target.y - y);

  if (remaining <= REMOTE_POINTER_VISUAL_SETTLE_PX) {
    return {
      position: { x: target.x, y: target.y },
      settled: true,
      snapped: false,
      distance,
    };
  }

  return {
    position: { x, y },
    settled: false,
    snapped: false,
    distance,
  };
}
