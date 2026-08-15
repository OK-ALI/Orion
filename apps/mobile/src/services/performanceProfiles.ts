export type PerformanceProfileId = 'efficiency' | 'balanced' | 'quality';
export type PerformanceProfileSelection = 'automatic' | PerformanceProfileId;

export interface PerformanceProfileOption {
  id: PerformanceProfileSelection;
  label: string;
  description: string;
}

export interface DevicePerformanceSignals {
  totalMemoryBytes: number | null;
  deviceYearClass: number | null;
}

export interface PerformanceRenderTuning {
  gridInitialRows: number;
  gridBatchRows: number;
  gridWindowSize: number;
  railReadyAhead: number;
  railBatchAhead: number;
  railWindowSize: number;
  stackInitialItems: number;
  stackBatchItems: number;
  stackWindowSize: number;
}

export const PERFORMANCE_PROFILE_OPTIONS: readonly PerformanceProfileOption[] = [
  {
    id: 'automatic',
    label: 'Automatic',
    description: 'Orion selects a stable profile for this device.',
  },
  {
    id: 'efficiency',
    label: 'Efficiency',
    description: 'Keeps fewer browsing cells ready to reduce memory and rendering pressure.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: "Orion's tested balance of browsing responsiveness and resource use.",
  },
  {
    id: 'quality',
    label: 'Quality',
    description: 'Keeps more browsing content ready on capable devices.',
  },
] as const;

export const PERFORMANCE_PROFILE_LABELS: Record<PerformanceProfileId, string> = {
  efficiency: 'Efficiency',
  balanced: 'Balanced',
  quality: 'Quality',
};

// Balanced is the physically accepted Phase 7.8.5 baseline. Efficiency trims
// working-set pressure, while Quality spends more memory to keep content ready.
// None of these values alter catalog identity, order, playback, or image source.
export const PERFORMANCE_RENDER_TUNING: Record<PerformanceProfileId, PerformanceRenderTuning> = {
  efficiency: {
    gridInitialRows: 2,
    gridBatchRows: 2,
    gridWindowSize: 5,
    railReadyAhead: 0,
    railBatchAhead: 0,
    railWindowSize: 5,
    stackInitialItems: 4,
    stackBatchItems: 4,
    stackWindowSize: 5,
  },
  balanced: {
    gridInitialRows: 3,
    gridBatchRows: 2,
    gridWindowSize: 7,
    railReadyAhead: 1,
    railBatchAhead: 0,
    railWindowSize: 5,
    stackInitialItems: 5,
    stackBatchItems: 5,
    stackWindowSize: 7,
  },
  quality: {
    gridInitialRows: 4,
    gridBatchRows: 3,
    gridWindowSize: 9,
    railReadyAhead: 2,
    railBatchAhead: 1,
    railWindowSize: 7,
    stackInitialItems: 7,
    stackBatchItems: 7,
    stackWindowSize: 9,
  },
};

const GIB = 1024 ** 3;

/**
 * Resolve Automatic once from stable hardware signals. Missing or conflicting
 * signals fall back to Balanced rather than guessing aggressively.
 */
export function resolveAutomaticPerformanceProfile(
  signals: DevicePerformanceSignals,
): PerformanceProfileId {
  const memory = Number.isFinite(signals.totalMemoryBytes)
    ? Number(signals.totalMemoryBytes)
    : null;
  const yearClass = Number.isFinite(signals.deviceYearClass)
    ? Number(signals.deviceYearClass)
    : null;

  // Prefer measured total RAM whenever it is available. Device.totalMemory
  // reports total memory available to the kernel, not currently-free RAM, so
  // foreground/background usage must not make Automatic bounce profiles.
  //
  // The Quality threshold intentionally starts below a literal 8 GiB because
  // devices marketed with 8 GB expose slightly less after fixed/reserved
  // allocations. This keeps the classifier aligned with practical RAM tiers:
  // ~4 GB-class -> Efficiency, ~6 GB-class -> Balanced, ~8 GB+ -> Quality.
  if (memory !== null) {
    if (memory < 4 * GIB) {
      return 'efficiency';
    }

    if (memory >= 7 * GIB) {
      return 'quality';
    }

    return 'balanced';
  }

  // With no RAM signal, year-class remains a conservative fallback only.
  if (yearClass !== null && yearClass <= 2019) {
    return 'efficiency';
  }

  if (yearClass !== null && yearClass >= 2022) {
    return 'quality';
  }

  return 'balanced';
}
