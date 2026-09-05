import { PERFORMANCE_TIERS, normalizePerformanceTier } from "../../../shared/utils/performanceBudget";

const TIER_RANK = Object.freeze({
  [PERFORMANCE_TIERS.EFFICIENCY]: 0,
  [PERFORMANCE_TIERS.BALANCED]: 1,
  [PERFORMANCE_TIERS.QUALITY]: 2,
});

export const MUSIC_ORB_PLACEMENT = Object.freeze({
  world: Object.freeze([0, 0, -7]),
  left: "50%",
  top: "48%",
  fov: 60,
});

export const MUSIC_VISUAL_BUDGETS = Object.freeze({
  [PERFORMANCE_TIERS.EFFICIENCY]: Object.freeze({
    tier: PERFORMANCE_TIERS.EFFICIENCY,
    sceneMode: "static",
    sceneLoop: "none",
    sceneFps: 0,
    sceneDpr: 1,
    sphereSegments: 0,
    starCap: 0,
    visualizerDpr: 1,
    visualizerBins: 18,
    compactBins: 12,
  }),
  [PERFORMANCE_TIERS.BALANCED]: Object.freeze({
    tier: PERFORMANCE_TIERS.BALANCED,
    sceneMode: "orb",
    sceneLoop: "signal",
    sceneFps: 30,
    sceneDpr: 1,
    sphereSegments: 0,
    starCap: 0,
    visualizerDpr: 1,
    visualizerBins: 32,
    compactBins: 20,
  }),
  [PERFORMANCE_TIERS.QUALITY]: Object.freeze({
    tier: PERFORMANCE_TIERS.QUALITY,
    sceneMode: "full",
    sceneLoop: "display",
    sceneFps: "display",
    sceneDpr: "native",
    sphereSegments: 128,
    starCap: 5000,
    visualizerDpr: 1.5,
    visualizerBins: 72,
    compactBins: 28,
  }),
});

function lowerTier(left, right) {
  return TIER_RANK[left] <= TIER_RANK[right] ? left : right;
}

export function resolveMusicVisualTier(activeTier, preferences = {}) {
  const ceiling = normalizePerformanceTier(activeTier);
  if (preferences.lowGpu === true) return PERFORMANCE_TIERS.EFFICIENCY;
  if (preferences.adaptPerformance !== false) return ceiling;

  const requested = preferences.atmosphere === "immersive"
    ? PERFORMANCE_TIERS.QUALITY
    : PERFORMANCE_TIERS.BALANCED;
  return lowerTier(requested, ceiling);
}

export function resolveMusicVisualBudget(activeTier, preferences = {}) {
  return MUSIC_VISUAL_BUDGETS[resolveMusicVisualTier(activeTier, preferences)];
}

export function resolveMusicSceneParticleCount(preferences = {}, budget = MUSIC_VISUAL_BUDGETS.balanced) {
  let requested = 2000;
  if (preferences.particleDensity === "low" || preferences.lowGpu === true) requested = 500;
  if (preferences.particleDensity === "high") requested = 5000;

  const sceneStyle = preferences.sceneStyle || "aurora";
  const sceneCap = sceneStyle === "minimal"
    ? 0
    : sceneStyle === "aurora"
      ? 260
      : sceneStyle === "dust"
        ? 720
        : Number.POSITIVE_INFINITY;

  return Math.max(0, Math.min(requested, sceneCap, budget.starCap));
}
