export const SEARCH_ORB_SIZE = 48;
export const SEARCH_ORB_SAFE = Object.freeze({
  left: 68,
  right: 18,
  top: 54,
  bottom: 88,
});
export const DEFAULT_SEARCH_ORB_POSITION = Object.freeze({ x: 0.965, y: 0.12 });

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function getOrbTravelRect(viewport, size = SEARCH_ORB_SIZE) {
  const width = Math.max(1, Number(viewport?.width) || 1);
  const height = Math.max(1, Number(viewport?.height) || 1);
  return {
    minX: SEARCH_ORB_SAFE.left,
    maxX: Math.max(SEARCH_ORB_SAFE.left, width - SEARCH_ORB_SAFE.right - size),
    minY: SEARCH_ORB_SAFE.top,
    maxY: Math.max(SEARCH_ORB_SAFE.top, height - SEARCH_ORB_SAFE.bottom - size),
  };
}

export function normalizedToPixels(normalized, viewport, size = SEARCH_ORB_SIZE) {
  const rect = getOrbTravelRect(viewport, size);
  const x = clamp(Number(normalized?.x ?? DEFAULT_SEARCH_ORB_POSITION.x), 0, 1);
  const y = clamp(Number(normalized?.y ?? DEFAULT_SEARCH_ORB_POSITION.y), 0, 1);
  return {
    left: rect.minX + (rect.maxX - rect.minX) * x,
    top: rect.minY + (rect.maxY - rect.minY) * y,
  };
}

export function pixelsToNormalized(position, viewport, size = SEARCH_ORB_SIZE) {
  const rect = getOrbTravelRect(viewport, size);
  const spanX = Math.max(1, rect.maxX - rect.minX);
  const spanY = Math.max(1, rect.maxY - rect.minY);
  return {
    x: clamp((Number(position?.left) - rect.minX) / spanX, 0, 1),
    y: clamp((Number(position?.top) - rect.minY) / spanY, 0, 1),
  };
}

export function clampOrbPixels(position, viewport, size = SEARCH_ORB_SIZE) {
  const rect = getOrbTravelRect(viewport, size);
  return {
    left: clamp(Number(position?.left) || rect.minX, rect.minX, rect.maxX),
    top: clamp(Number(position?.top) || rect.minY, rect.minY, rect.maxY),
  };
}

export function settleOrbPixels(position, viewport, size = SEARCH_ORB_SIZE, snapDistance = 118) {
  const clamped = clampOrbPixels(position, viewport, size);
  const rect = getOrbTravelRect(viewport, size);
  const leftDistance = Math.abs(clamped.left - rect.minX);
  const rightDistance = Math.abs(rect.maxX - clamped.left);
  if (Math.min(leftDistance, rightDistance) <= snapDistance) {
    return { ...clamped, left: leftDistance <= rightDistance ? rect.minX : rect.maxX };
  }
  return clamped;
}

export function resolveQuickSearchPlacement(anchor, viewport, options = {}) {
  const width = Number(options.width) || 380;
  const maxHeight = Number(options.maxHeight) || 470;
  const gap = Number(options.gap) || 12;
  const margin = Number(options.margin) || 16;
  const vw = Math.max(320, Number(viewport?.width) || 320);
  const vh = Math.max(320, Number(viewport?.height) || 320);
  const panelWidth = Math.min(width, vw - margin * 2);
  const spaceRight = vw - anchor.right - margin;
  const openRight = spaceRight >= panelWidth + gap || anchor.left < vw / 2;

  let left = openRight ? anchor.right + gap : anchor.left - panelWidth - gap;
  left = clamp(left, margin, vw - panelWidth - margin);

  const openDown = anchor.top < vh / 2;
  const availableHeight = openDown
    ? vh - anchor.bottom - gap - margin
    : anchor.top - gap - margin;
  const panelMaxHeight = Math.max(250, Math.min(maxHeight, availableHeight));

  const style = { left, maxHeight: panelMaxHeight };
  if (openDown) style.top = clamp(anchor.top, margin, vh - margin - 240);
  else style.bottom = clamp(vh - anchor.bottom, margin, vh - margin - 240);

  return {
    style,
    horizontal: openRight ? "right" : "left",
    vertical: openDown ? "down" : "up",
    width: panelWidth,
  };
}
