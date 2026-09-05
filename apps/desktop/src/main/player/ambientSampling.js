const AMBIENT_PROFILES = Object.freeze({
  LOW: "low",
  BALANCED: "balanced",
  VIVID: "vivid",
});

function normalizeAmbientProfile(profile) {
  return Object.values(AMBIENT_PROFILES).includes(profile) ? profile : AMBIENT_PROFILES.BALANCED;
}

function capAmbientProfile(profile, performanceTier = "balanced") {
  const normalized = normalizeAmbientProfile(profile);
  if (performanceTier === "efficiency") return AMBIENT_PROFILES.LOW;
  if (performanceTier === "balanced" && normalized === AMBIENT_PROFILES.VIVID) {
    return AMBIENT_PROFILES.BALANCED;
  }
  return normalized;
}

function ambientCaptureSize(performanceTier = "balanced") {
  if (performanceTier === "efficiency") return { width: 160, height: 90 };
  if (performanceTier === "balanced") return { width: 240, height: 135 };
  return { width: 320, height: 180 };
}

function samplingInterval(profile, onBattery = false) {
  const normalized = normalizeAmbientProfile(profile);
  const ac = normalized === "low" ? 1800 : normalized === "vivid" ? 750 : 1100;
  if (!onBattery) return ac;
  return normalized === "low" ? 3600 : normalized === "vivid" ? 1800 : 2600;
}

function boundedSampleRect(rect, maxWidth = 320, maxHeight = 180) {
  const source = rect || {};
  const sourceWidth = Math.max(1, Math.round(Number(source.width) || maxWidth));
  const sourceHeight = Math.max(1, Math.round(Number(source.height) || maxHeight));
  const width = Math.min(sourceWidth, maxWidth);
  const height = Math.min(sourceHeight, maxHeight);
  return {
    x: Math.max(0, Math.round((Number(source.x) || 0) + (sourceWidth - width) / 2)),
    y: Math.max(0, Math.round((Number(source.y) || 0) + (sourceHeight - height) / 2)),
    width,
    height,
  };
}

module.exports = {
  AMBIENT_PROFILES,
  ambientCaptureSize,
  boundedSampleRect,
  capAmbientProfile,
  normalizeAmbientProfile,
  samplingInterval,
};
