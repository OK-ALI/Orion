export type CelestialAnimationMode =
  | 'instant'
  | 'crossfade'
  | 'celestial'
  | 'layered';

export function celestialDuration(
  mode: CelestialAnimationMode,
  distance = 1,
): number {
  if (mode === 'instant') return 0;

  const base =
    mode === 'layered' ? 2400 :
    mode === 'celestial' ? 1500 : 800;

  if (!Number.isFinite(distance)) return base;

  const remaining = Math.min(1, Math.abs(distance));

  return remaining === 0
    ? 0
    : Math.max(180, Math.round(base * remaining));
}

export function celestialFrame(progress: number) {
  'worklet';

  const p = Number.isFinite(progress)
    ? Math.max(0, Math.min(1, progress))
    : 0;

  return {
    progress: p,
    nightOpacity: p,
    twilightOpacity: Math.sin(Math.PI * p),
    sunOpacity: Math.max(0, 1 - p * 2),
    moonOpacity: Math.max(0, (p - 0.5) * 2),
    sunX: 22 * p,
    sunY: 54 * p,
    moonX: -22 * (1 - p),
    moonY: 54 * (1 - p),
    starsOpacity: Math.max(0, (p - 0.55) / 0.45),
    sunGlow: 0.48 * (1 - p),
    moonGlow: 0.40 * p,
  };
}