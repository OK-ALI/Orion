/** Stored Orion preference and live platform accessibility input stay independent. */
export function resolveMotionPolicy(orionReducedMotion: boolean, systemReducedMotion: boolean | null = false) {
  // Avoid decorative/spatial motion before the first platform query resolves.
  const reduceMotion = orionReducedMotion || systemReducedMotion !== false;
  return {
    reduceMotion,
    allowSpatialMotion: !reduceMotion,
    allowDecorativeMotion: !reduceMotion,
    duration: (normalDuration: number) => reduceMotion ? 0 : normalDuration,
    screenAnimation: reduceMotion ? 'none' as const : undefined,
  };
}
