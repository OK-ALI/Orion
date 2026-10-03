export type DrawerEdge = 'left' | 'right';
export interface PlayerRect { x: number; y: number; width: number; height: number }
export interface PlayerInsets { top: number; right: number; bottom: number; left: number }
const finite = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
export function intersects(a: PlayerRect, b: PlayerRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Reserve provider top/bottom controls and subtitle space; accept measured exclusion regions. */
export function resolvePlayerDrawerLayout(width: number, height: number, rawInsets: PlayerInsets, occupied: PlayerRect[] = [], contentWidth = 200) {
  width = Math.max(1, finite(width)); height = Math.max(1, finite(height));
  const insets = { top: Math.min(height / 3, finite(rawInsets.top)), bottom: Math.min(height / 3, finite(rawInsets.bottom)),
    left: Math.min(width / 3, finite(rawInsets.left)), right: Math.min(width / 3, finite(rawInsets.right)) };
  const safeWidth = Math.max(1, width - insets.left - insets.right);
  const top = Math.min(height / 3, Math.max(insets.top + 8, height * 0.14));
  const bottom = Math.max(insets.bottom + 8, height * 0.23);
  const bodyHeight = Math.max(44, height - top - bottom);
  // Intrinsic label/icon/padding measurements drive width; viewport only bounds it.
  const maximumWidth = Math.max(1, Math.min(248, safeWidth - 44));
  const minimumWidth = Math.min(160, maximumWidth);
  const bodyWidth = Math.min(maximumWidth, Math.max(minimumWidth, finite(contentWidth)));
  const hitSize = Math.min(44, safeWidth, bodyHeight);
  const candidates = (edge: DrawerEdge) => {
    const x = edge === 'right' ? width - insets.right - hitSize : insets.left;
    return [0.38, 0.52, 0.24, 0.70].map((ratio) => ({ x,
      y: top + Math.max(0, bodyHeight - hitSize) * ratio, width: hitSize, height: hitSize }));
  };
  const preferred: DrawerEdge = insets.right > insets.left + 16 ? 'left' : 'right';
  let edge = preferred;
  let hit = candidates(edge)[0];
  let found = false;
  for (const option of [preferred, preferred === 'right' ? 'left' : 'right'] as DrawerEdge[]) {
    const body = { x: option === 'right' ? width - insets.right - bodyWidth : insets.left,
      y: top, width: bodyWidth, height: bodyHeight };
    const available = candidates(option).find((rect) => {
      const openHit = { ...rect, x: rect.x + (option === 'right' ? -bodyWidth : bodyWidth) };
      return !occupied.some((obstacle) => intersects(rect, obstacle) || intersects(openHit, obstacle) || intersects(body, obstacle));
    });
    if (available) { edge = option; hit = available; found = true; break; }
  }
  return { edge, hit, available: found, body: { x: edge === 'right' ? width - insets.right - bodyWidth : insets.left,
    y: top, width: bodyWidth, height: bodyHeight }, visualWidth: 14, visualHeight: 28,
    safeLeft: insets.left, safeRight: insets.right,
    closedTranslation: edge === 'right' ? bodyWidth : -bodyWidth };
}
