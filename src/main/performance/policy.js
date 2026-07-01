const TIERS = Object.freeze({
  EFFICIENCY: "efficiency",
  BALANCED: "balanced",
  QUALITY: "quality",
});

function derivePerformanceTier(snapshot = {}) {
  const batteryLevel = Number(snapshot.batteryLevel);
  const criticalBattery = snapshot.onBattery && Number.isFinite(batteryLevel) && batteryLevel <= 0.2;
  const pressured =
    criticalBattery ||
    Number(snapshot.freeMemoryMb) < 1400 ||
    Number(snapshot.cpuPercent) >= 78 ||
    Number(snapshot.eventLoopLagMs) >= 120 ||
    Number(snapshot.bufferingEvents) >= 2 ||
    Number(snapshot.cpuSpeedLimit) < 70;
  if (pressured) return TIERS.EFFICIENCY;

  const capable =
    !snapshot.onBattery &&
    Number(snapshot.cpuCount) >= 8 &&
    Number(snapshot.freeMemoryMb) >= 3500 &&
    Number(snapshot.cpuPercent) < 45 &&
    Number(snapshot.eventLoopLagMs) < 45 &&
    Number(snapshot.bufferingEvents) === 0;
  return capable ? TIERS.QUALITY : TIERS.BALANCED;
}

function nextStableTier(current, candidate, state = {}) {
  if (!current || current === candidate) return { tier: candidate, candidate: null, since: 0 };
  const now = Number(state.now) || Date.now();
  if (state.candidate !== candidate) return { tier: current, candidate, since: now };
  const delay = candidate === TIERS.EFFICIENCY ? 5000 : 30000;
  if (now - Number(state.since || 0) < delay) return { tier: current, candidate, since: state.since };
  return { tier: candidate, candidate: null, since: 0 };
}

module.exports = { TIERS, derivePerformanceTier, nextStableTier };
