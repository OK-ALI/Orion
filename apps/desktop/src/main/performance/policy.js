const TIERS = Object.freeze({
  EFFICIENCY: "efficiency",
  BALANCED: "balanced",
  QUALITY: "quality",
});

const SELECTIONS = Object.freeze({
  AUTOMATIC: "automatic",
  EFFICIENCY: TIERS.EFFICIENCY,
  BALANCED: TIERS.BALANCED,
  QUALITY: TIERS.QUALITY,
});

const TIER_RANK = Object.freeze({
  [TIERS.EFFICIENCY]: 0,
  [TIERS.BALANCED]: 1,
  [TIERS.QUALITY]: 2,
});

function normalizePerformanceSelection(value) {
  return Object.values(SELECTIONS).includes(value) ? value : SELECTIONS.AUTOMATIC;
}

function deriveGraphicsCapabilityTier(snapshot = {}) {
  const capability = String(snapshot.graphicsCapability || "unknown").toLowerCase();
  if (["software", "limited", "unavailable"].includes(capability)) {
    return TIERS.BALANCED;
  }
  return TIERS.QUALITY;
}

function resolveAutomaticPerformanceTier(snapshot = {}) {
  const totalMemoryMb = Number(snapshot.totalMemoryMb);
  const cpuCount = Number(snapshot.cpuCount);
  const cpuSpeedMhz = Number(snapshot.cpuSpeedMhz);
  const hasMemory = Number.isFinite(totalMemoryMb) && totalMemoryMb > 0;
  const hasCpuCount = Number.isFinite(cpuCount) && cpuCount > 0;
  const hasCpuSpeed = Number.isFinite(cpuSpeedMhz) && cpuSpeedMhz > 0;

  // Desktop Automatic starts from stable CPU/RAM capacity. Graphics capability
  // then acts as a stable ceiling: software or reduced Chromium acceleration
  // cannot enter Quality, while unknown GPU data does not punish a machine
  // before Electron has finished its gpu-info-update probe.
  let baseline = TIERS.BALANCED;
  if (hasMemory && totalMemoryMb < 6144) {
    baseline = TIERS.EFFICIENCY;
  } else if (hasCpuCount && cpuCount <= 4 && hasCpuSpeed && cpuSpeedMhz < 2200) {
    baseline = TIERS.EFFICIENCY;
  } else {
    const qualityMemory = hasMemory && totalMemoryMb >= 12288;
    const qualityCpu = hasCpuCount && cpuCount >= 8;
    const qualityClock = !hasCpuSpeed || cpuSpeedMhz >= 1800;
    baseline = qualityMemory && qualityCpu && qualityClock ? TIERS.QUALITY : TIERS.BALANCED;
  }

  return clampTierToPressure(baseline, deriveGraphicsCapabilityTier(snapshot));
}

function derivePlaybackPressure(snapshot = {}) {
  if (!snapshot.playbackActive) return "none";

  const bufferingEvents = Math.max(0, Number(snapshot.bufferingEvents) || 0);
  const readyState = Math.max(0, Number(snapshot.readyState) || 0);
  const bufferedAhead = Math.max(0, Number(snapshot.bufferedAhead) || 0);
  const droppedFrames = Math.max(0, Number(snapshot.droppedFrames) || 0);

  if (bufferingEvents >= 2 || readyState <= 2 || droppedFrames >= 8) {
    return "severe";
  }

  if (
    bufferingEvents >= 1 ||
    droppedFrames >= 3 ||
    (readyState === 3 && bufferedAhead < 1.5)
  ) {
    return "moderate";
  }

  return "none";
}

function deriveMemoryPressure(snapshot = {}) {
  const freeMemoryMb = Number(snapshot.freeMemoryMb);
  const totalMemoryMb = Number(snapshot.totalMemoryMb);
  if (!Number.isFinite(freeMemoryMb) || freeMemoryMb < 0) return "none";

  const hasTotalMemory = Number.isFinite(totalMemoryMb) && totalMemoryMb > 0;
  if (!hasTotalMemory) {
    if (freeMemoryMb < 768) return "severe";
    if (freeMemoryMb < 1536) return "moderate";
    return "none";
  }

  const freeRatio = freeMemoryMb / totalMemoryMb;

  // Desktop memory pressure must scale with the machine. Windows can keep
  // several gigabytes committed to caches on healthy high-RAM systems, so a
  // fixed free-MB threshold can incorrectly deny Quality on capable PCs.
  if (freeMemoryMb < 512 || (freeMemoryMb < 1024 && freeRatio < 0.06)) {
    return "severe";
  }
  if (freeMemoryMb < 1536 && freeRatio < 0.10) {
    return "moderate";
  }

  return "none";
}

function derivePressureTier(snapshot = {}) {
  const batteryLevel = Number(snapshot.batteryLevel);
  const criticalBattery = snapshot.onBattery && Number.isFinite(batteryLevel) && batteryLevel <= 0.2;
  const playbackPressure = derivePlaybackPressure(snapshot);
  const memoryPressure = deriveMemoryPressure(snapshot);
  const graphicsTier = deriveGraphicsCapabilityTier(snapshot);
  const severePressure =
    playbackPressure === "severe" ||
    memoryPressure === "severe" ||
    criticalBattery ||
    Number(snapshot.cpuPercent) >= 78 ||
    Number(snapshot.eventLoopLagMs) >= 120 ||
    Number(snapshot.bufferingEvents) >= 2 ||
    Number(snapshot.cpuSpeedLimit) < 70;
  if (severePressure) return TIERS.EFFICIENCY;

  const moderatePressure =
    playbackPressure === "moderate" ||
    memoryPressure === "moderate" ||
    Boolean(snapshot.onBattery) ||
    graphicsTier === TIERS.BALANCED ||
    Number(snapshot.cpuPercent) >= 45 ||
    Number(snapshot.eventLoopLagMs) >= 45 ||
    Number(snapshot.bufferingEvents) >= 1 ||
    Number(snapshot.droppedFrames) >= 8 ||
    Number(snapshot.cpuSpeedLimit) < 90;
  return moderatePressure ? TIERS.BALANCED : TIERS.QUALITY;
}

function requestedPerformanceTier(selection, automaticTier) {
  const normalized = normalizePerformanceSelection(selection);
  return normalized === SELECTIONS.AUTOMATIC ? automaticTier : normalized;
}

function clampTierToPressure(requestedTier, pressureTier) {
  const requested = TIER_RANK[requestedTier] == null ? TIERS.BALANCED : requestedTier;
  const pressure = TIER_RANK[pressureTier] == null ? TIERS.BALANCED : pressureTier;
  return TIER_RANK[pressure] < TIER_RANK[requested] ? pressure : requested;
}

function resolvePerformanceTier(snapshot = {}, selection = SELECTIONS.AUTOMATIC) {
  const graphicsTier = deriveGraphicsCapabilityTier(snapshot);
  const automaticTier = resolveAutomaticPerformanceTier(snapshot);
  const requestedTier = requestedPerformanceTier(selection, automaticTier);
  const pressureTier = derivePressureTier(snapshot);
  return {
    selection: normalizePerformanceSelection(selection),
    graphicsTier,
    automaticTier,
    requestedTier,
    pressureTier,
    tier: clampTierToPressure(requestedTier, pressureTier),
  };
}

function derivePerformanceTier(snapshot = {}, selection = SELECTIONS.AUTOMATIC) {
  return resolvePerformanceTier(snapshot, selection).tier;
}

function nextStableTier(current, candidate, state = {}) {
  if (!current || current === candidate) return { tier: candidate, candidate: null, since: 0 };
  const now = Number(state.now) || Date.now();
  if (state.candidate !== candidate) return { tier: current, candidate, since: now };
  const delay = candidate === TIERS.EFFICIENCY ? 5000 : 30000;
  if (now - Number(state.since || 0) < delay) return { tier: current, candidate, since: state.since };
  return { tier: candidate, candidate: null, since: 0 };
}

module.exports = {
  TIERS,
  SELECTIONS,
  normalizePerformanceSelection,
  deriveGraphicsCapabilityTier,
  resolveAutomaticPerformanceTier,
  derivePlaybackPressure,
  deriveMemoryPressure,
  derivePressureTier,
  resolvePerformanceTier,
  derivePerformanceTier,
  nextStableTier,
};
