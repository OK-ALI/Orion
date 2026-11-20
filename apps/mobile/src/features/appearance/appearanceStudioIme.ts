interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StudioKeyboardFrame {
  screenX: number;
  screenY: number;
  width: number;
  height: number;
}

export function studioKeyboardInset(view: Viewport, keyboard: StudioKeyboardFrame | null): number {
  if (!keyboard || keyboard.height <= 0 || keyboard.width <= 0) return 0;
  if (keyboard.screenX >= view.x + view.width || keyboard.screenX + keyboard.width <= view.x) return 0;
  if (keyboard.screenY + keyboard.height <= view.y) return 0;
  return Math.max(0, Math.min(view.height, view.y + view.height - keyboard.screenY));
}

/** Both rectangles are screen-space measurements of the visible scroll view and input/error group. */
export function studioRevealOffset(currentY: number, viewport: Viewport, field: Viewport, gap: number): number {
  const top = viewport.y + gap;
  const bottom = viewport.y + viewport.height - gap;
  if (field.height > bottom - top || field.y < top) return Math.max(0, currentY + field.y - top);
  return Math.max(0, currentY + Math.max(0, field.y + field.height - bottom));
}

export type StudioMeasuredFrame = Viewport;
