const test = require("node:test");
const assert = require("node:assert/strict");
const { derivePerformanceTier, nextStableTier } = require("../../../src/main/performance/policy");

test("performance policy prioritizes playback and battery pressure", () => {
  assert.equal(derivePerformanceTier({ onBattery: true, batteryLevel: 0.19, freeMemoryMb: 5000, cpuCount: 8 }), "efficiency");
  assert.equal(derivePerformanceTier({ bufferingEvents: 2, freeMemoryMb: 5000, cpuCount: 8 }), "efficiency");
});

test("performance policy uses quality only when resources are comfortably available", () => {
  assert.equal(derivePerformanceTier({ onBattery: false, cpuCount: 8, freeMemoryMb: 5000, cpuPercent: 20, eventLoopLagMs: 10, bufferingEvents: 0, cpuSpeedLimit: 100 }), "quality");
  assert.equal(derivePerformanceTier({ onBattery: false, cpuCount: 4, freeMemoryMb: 2400, cpuPercent: 35, eventLoopLagMs: 20, bufferingEvents: 0, cpuSpeedLimit: 100 }), "balanced");
});

test("recovery tiers require a stable window", () => {
  const pending = nextStableTier("efficiency", "balanced", { candidate: null, since: 0, now: 1000 });
  assert.equal(pending.tier, "efficiency");
  assert.equal(nextStableTier("efficiency", "balanced", { ...pending, now: 32000 }).tier, "balanced");
});
