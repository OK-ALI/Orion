/**
 * WAVEN Celestial Shift.
 *
 * Pure preview-domain model.
 * No storage writes, playback commands, navigation or rendering.
 * Production theme ownership remains with the appearance store.
 */

export type CelestialTheme = 'hikari' | 'hikari-night';

export type CelestialPerformance =
  | 'battery-saver'
  | 'balanced'
  | 'enhanced';

export type CelestialPerformancePreference =
  | 'auto'
  | CelestialPerformance;

export type CelestialMotion =
  | 'subtle'
  | 'expressive'
  | 'reduced';

export interface CelestialShiftState {
  readonly theme: CelestialTheme;
  readonly progress: number;
  readonly generation: number;
  readonly dragging: boolean;
}

export function celestialEndpoint(theme: CelestialTheme): number {
  if (theme === 'hikari') return 0;
  if (theme === 'hikari-night') return 1;
  throw new Error('Unsupported celestial theme.');
}

export function createCelestialShift(
  theme: CelestialTheme,
): CelestialShiftState {
  return {
    theme,
    progress: celestialEndpoint(theme),
    generation: 0,
    dragging: false,
  };
}

export function beginCelestialDrag(
  state: CelestialShiftState,
): CelestialShiftState {
  return {
    ...state,
    generation: state.generation + 1,
    dragging: true,
  };
}

export function updateCelestialDrag(
  state: CelestialShiftState,
  generation: number,
  progress: number,
): CelestialShiftState {
  if (
    !state.dragging ||
    generation !== state.generation ||
    !Number.isFinite(progress)
  ) {
    return state;
  }

  return {
    ...state,
    progress: Math.max(0, Math.min(1, progress)),
  };
}

/**
 * Local preview selection only.
 * A future production consumer must verify durable persistence
 * before claiming that its selected preference has changed.
 */
export function finishCelestialDrag(
  state: CelestialShiftState,
  generation: number,
): CelestialShiftState {
  if (!state.dragging || generation !== state.generation) {
    return state;
  }

  const theme: CelestialTheme =
    state.progress > 0.5
      ? 'hikari-night'
      : state.progress < 0.5
        ? 'hikari'
        : state.theme;

  return {
    theme,
    progress: celestialEndpoint(theme),
    generation: state.generation,
    dragging: false,
  };
}

export function cancelCelestialDrag(
  state: CelestialShiftState,
  generation: number,
): CelestialShiftState {
  if (!state.dragging || generation !== state.generation) {
    return state;
  }

  return {
    ...state,
    progress: celestialEndpoint(state.theme),
    dragging: false,
  };
}

const TIERS: readonly CelestialPerformance[] = [
  'battery-saver',
  'balanced',
  'enhanced',
];

export interface CelestialPolicyInput {
  readonly preference: CelestialPerformancePreference;
  readonly autoTier?: CelestialPerformance;
  readonly safetyCeiling?: CelestialPerformance;
  readonly motion: CelestialMotion;
  readonly systemReducedMotion: boolean;
}

export interface CelestialPolicy {
  readonly effectiveTier: CelestialPerformance;
  readonly transition:
    | 'instant'
    | 'crossfade'
    | 'celestial'
    | 'layered';
  readonly atmosphericLayers: boolean;
  readonly tapDurationMs: number;
  readonly settleDurationMs: number;
}

export function resolveCelestialPolicy(
  input: CelestialPolicyInput,
): CelestialPolicy {
  // Unknown Auto conditions use the conservative preview tier.
  const requested =
    input.preference === 'auto'
      ? input.autoTier ?? 'battery-saver'
      : input.preference;

  const ceiling = input.safetyCeiling ?? 'enhanced';

  const index = Math.max(
    0,
    Math.min(
      TIERS.indexOf(requested),
      TIERS.indexOf(ceiling),
    ),
  );

  const effectiveTier = TIERS[index]!;

  if (
    input.systemReducedMotion ||
    input.motion === 'reduced'
  ) {
    return {
      effectiveTier,
      transition: 'instant',
      atmosphericLayers: false,
      tapDurationMs: 0,
      settleDurationMs: 0,
    };
  }

  if (effectiveTier === 'battery-saver') {
    return {
      effectiveTier,
      transition: 'crossfade',
      atmosphericLayers: false,
      tapDurationMs: 240,
      settleDurationMs: 180,
    };
  }

  const layered =
    effectiveTier === 'enhanced' &&
    input.motion === 'expressive';

  return {
    effectiveTier,
    transition: layered ? 'layered' : 'celestial',
    atmosphericLayers: layered,
    tapDurationMs: layered ? 1200 : 800,
    settleDurationMs: 260,
  };
}