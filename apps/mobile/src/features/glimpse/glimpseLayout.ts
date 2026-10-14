import type { GlimpseVideoDimensions } from './glimpseModel';

/** Fit the complete source inside measured Stage bounds. Unknown dimensions stay provider-owned. */
export function fitGlimpseMedia(bounds: { width: number; height: number }, source?: GlimpseVideoDimensions | null) {
  if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) {
    return { width: 0, height: 0 };
  }
  if (!source || !Number.isFinite(source.width) || !Number.isFinite(source.height) || source.width <= 0 || source.height <= 0) {
    return { width: bounds.width, height: bounds.height };
  }
  const scale = Math.min(bounds.width / source.width, bounds.height / source.height);
  return { width: source.width * scale, height: source.height * scale };
}

/** Constrain the reel shell without assuming any source aspect ratio. */
export function glimpseStageWidth(width: number, height: number, landscape: boolean) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return 0;
  return Math.min(landscape ? 720 : 420, Math.max(0, width - 56));
}