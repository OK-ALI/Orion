export const MUSIC_PLAYER_MIN_WIDTH = 720;
export const MUSIC_PLAYER_MIN_HEIGHT = 128;

/**
 * Keeps a floating Music dock visible and clear of Orion's sidebar.
 * @param {{ x?: number, y?: number, width?: number, height?: number }} value
 * @param {{ viewportWidth: number, viewportHeight: number, sidebarRight?: number }} bounds
 */
export function constrainMusicPlayerGeometry(value, bounds) {
  const viewportWidth = Math.max(0, Number(bounds?.viewportWidth) || 0);
  const viewportHeight = Math.max(0, Number(bounds?.viewportHeight) || 0);
  const minX = Math.ceil(Number(bounds?.sidebarRight) || 0) + 16;
  const maxWidth = Math.max(360, viewportWidth - minX - 20);
  const effectiveMinWidth = Math.min(MUSIC_PLAYER_MIN_WIDTH, maxWidth);
  const maxHeight = Math.max(MUSIC_PLAYER_MIN_HEIGHT, viewportHeight - 84);
  const clamp = (number, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(number) || minimum));
  const width = clamp(value?.width, effectiveMinWidth, maxWidth);
  const height = clamp(value?.height, MUSIC_PLAYER_MIN_HEIGHT, maxHeight);
  return {
    width,
    height,
    x: clamp(value?.x, minX, Math.max(minX, viewportWidth - width - 12)),
    y: clamp(value?.y, 58, Math.max(58, viewportHeight - height - 12)),
  };
}

/**
 * Snaps a floating Music dock to nearby safe viewport edges. The caller still
 * constrains the result, so the dock can never cross the sidebar boundary.
 * @param {{ x?: number, y?: number, width?: number, height?: number }} value
 * @param {{ viewportWidth: number, viewportHeight: number, sidebarRight?: number }} bounds
 * @param {{ threshold?: number }} options
 */
export function snapMusicPlayerGeometry(value, bounds, { threshold = 28 } = {}) {
  const geometry = constrainMusicPlayerGeometry(value, bounds);
  const viewportWidth = Math.max(0, Number(bounds?.viewportWidth) || 0);
  const viewportHeight = Math.max(0, Number(bounds?.viewportHeight) || 0);
  const minX = Math.ceil(Number(bounds?.sidebarRight) || 0) + 16;
  const maxX = Math.max(minX, viewportWidth - geometry.width - 12);
  const minY = 58;
  const maxY = Math.max(minY, viewportHeight - geometry.height - 12);
  const distance = Math.max(0, Number(threshold) || 0);
  const snap = (current, start, end) => {
    if (Math.abs(current - start) <= distance) return start;
    if (Math.abs(current - end) <= distance) return end;
    return current;
  };
  return { ...geometry, x: snap(geometry.x, minX, maxX), y: snap(geometry.y, minY, maxY) };
}

export function chooseMusicOverlayPlacement(rect, bounds, { panelWidth = 400, panelHeight = 420, gap = 12, titlebar = 56 } = {}) {
  if (!rect) return "above";
  const viewportWidth = Math.max(0, Number(bounds?.viewportWidth) || 0);
  const viewportHeight = Math.max(0, Number(bounds?.viewportHeight) || 0);
  if (rect.top - titlebar >= panelHeight + gap) return "above";
  if (viewportHeight - rect.bottom >= panelHeight + gap) return "below";
  if (viewportWidth - rect.right >= panelWidth + gap) return "right";
  return "left";
}
