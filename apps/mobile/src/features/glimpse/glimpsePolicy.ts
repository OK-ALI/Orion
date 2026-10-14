import type { PerformanceProfileId } from '../../services/performanceProfiles';
import { PERFORMANCE_RENDER_TUNING } from '../../services/performanceProfiles';

export function glimpseRenderBudget(profile: PerformanceProfileId) {
  const tuning = PERFORMANCE_RENDER_TUNING[profile];
  return { initialNumToRender: 1, maxToRenderPerBatch: 1, windowSize: 3 + Math.min(2, tuning.railReadyAhead),
    titleBatch: 4 + tuning.railReadyAhead, metadataAhead: 1 + tuning.railReadyAhead };
}
export function activeGlimpseReel(input: {
  focused: boolean; foreground: boolean; remoteReady: boolean; discover: boolean; liked?: boolean;
  scrolling: boolean; navigating: boolean; reelId: string | null;
}): string | null {
  return input.focused && input.foreground && input.remoteReady && (input.discover || input.liked)
    && !input.scrolling && !input.navigating ? input.reelId : null;
}
export function settledGlimpseIndex(offset: number, pageHeight: number, count: number) {
  if (!Number.isFinite(offset) || !Number.isFinite(pageHeight) || pageHeight <= 0 || count < 1) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(offset / pageHeight)));
}
