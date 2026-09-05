export const PERFORMANCE_TIERS = Object.freeze({
  EFFICIENCY: "efficiency",
  BALANCED: "balanced",
  QUALITY: "quality",
});

export function normalizePerformanceTier(value) {
  return Object.values(PERFORMANCE_TIERS).includes(value) ? value : PERFORMANCE_TIERS.BALANCED;
}

export function getHeroReadyIndexes(active, count, tier = PERFORMANCE_TIERS.BALANCED) {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  if (safeCount === 0) return new Set();
  const normalized = normalizePerformanceTier(tier);
  if (normalized === PERFORMANCE_TIERS.QUALITY) {
    return new Set(Array.from({ length: safeCount }, (_, index) => index));
  }

  const safeActive = ((Math.floor(Number(active) || 0) % safeCount) + safeCount) % safeCount;
  const radius = normalized === PERFORMANCE_TIERS.EFFICIENCY ? 1 : 2;
  const ready = new Set();
  for (let offset = -radius; offset <= radius; offset += 1) {
    ready.add(((safeActive + offset) % safeCount + safeCount) % safeCount);
  }
  return ready;
}
