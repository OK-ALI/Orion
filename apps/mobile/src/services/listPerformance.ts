import type { PerformanceProfileId } from './performanceProfiles';
import { PERFORMANCE_RENDER_TUNING } from './performanceProfiles';

export interface ListRenderBudget {
  initialNumToRender: number;
  maxToRenderPerBatch: number;
  windowSize: number;
}

/**
 * Profile-aware grid budget for image-heavy browsing lists. Balanced preserves
 * the physically accepted 7.8.5 baseline; Efficiency and Quality only change
 * how much off-screen work stays ready.
 */
export function getGridRenderBudget(
  columns: number,
  profile: PerformanceProfileId = 'balanced',
): ListRenderBudget {
  const safeColumns = Math.max(1, Math.floor(Number.isFinite(columns) ? columns : 1));
  const tuning = PERFORMANCE_RENDER_TUNING[profile];
  return {
    initialNumToRender: safeColumns * tuning.gridInitialRows,
    maxToRenderPerBatch: safeColumns * tuning.gridBatchRows,
    windowSize: tuning.gridWindowSize,
  };
}

/**
 * Responsive, profile-aware budget for horizontal artwork rails. All profiles
 * retain the same items and order while varying how much content stays ready
 * around the visible viewport.
 */
export function getRailRenderBudget(
  viewportWidth: number,
  itemSpan: number,
  profile: PerformanceProfileId = 'balanced',
): ListRenderBudget {
  const safeWidth = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 360;
  const safeSpan = Number.isFinite(itemSpan) && itemSpan > 0 ? itemSpan : 156;
  const visibleItems = Math.max(1, Math.ceil(safeWidth / safeSpan));
  const tuning = PERFORMANCE_RENDER_TUNING[profile];
  return {
    initialNumToRender: Math.max(3, visibleItems + tuning.railReadyAhead),
    maxToRenderPerBatch: Math.max(3, visibleItems + tuning.railBatchAhead),
    windowSize: tuning.railWindowSize,
  };
}

/**
 * Full-width Continue/History rows share the same profile policy without
 * changing the Library pager architecture or collection truth.
 */
export function getStackListRenderBudget(
  profile: PerformanceProfileId = 'balanced',
): ListRenderBudget {
  const tuning = PERFORMANCE_RENDER_TUNING[profile];
  return {
    initialNumToRender: tuning.stackInitialItems,
    maxToRenderPerBatch: tuning.stackBatchItems,
    windowSize: tuning.stackWindowSize,
  };
}
