const test = require("node:test");
const assert = require("node:assert/strict");
const {
  deriveGraphicsCapabilityTier,
  resolveAutomaticPerformanceTier,
  resolvePerformanceTier,
  derivePerformanceTier,
  nextStableTier,
  derivePlaybackPressure,
  deriveMemoryPressure,
} = require("../../../src/main/performance/policy");

test("Automatic uses stable Desktop capability instead of currently-free RAM", () => {
  assert.equal(resolveAutomaticPerformanceTier({ totalMemoryMb: 4096, cpuCount: 8, cpuSpeedMhz: 3000 }), "efficiency");
  assert.equal(resolveAutomaticPerformanceTier({ totalMemoryMb: 8192, cpuCount: 8, cpuSpeedMhz: 3000 }), "balanced");
  assert.equal(resolveAutomaticPerformanceTier({ totalMemoryMb: 16384, cpuCount: 12, cpuSpeedMhz: 3000 }), "quality");
  assert.equal(resolveAutomaticPerformanceTier({ totalMemoryMb: 16384, cpuCount: 12, cpuSpeedMhz: 3000, freeMemoryMb: 600 }), "quality");
});

test("Desktop memory pressure scales with installed RAM instead of a fixed free-MB cutoff", () => {
  const qualityMachine = {
    totalMemoryMb: 16384, cpuCount: 16, cpuSpeedMhz: 3000, freeMemoryMb: 3202,
    cpuPercent: 3.9, eventLoopLagMs: 5, bufferingEvents: 0, droppedFrames: 0,
    cpuSpeedLimit: 100, onBattery: false,
  };

  assert.equal(deriveMemoryPressure(qualityMachine), "none");
  assert.equal(resolvePerformanceTier(qualityMachine, "automatic").tier, "quality");
  assert.equal(resolvePerformanceTier(qualityMachine, "quality").tier, "quality");

  assert.equal(deriveMemoryPressure({ ...qualityMachine, freeMemoryMb: 1400 }), "moderate");
  assert.equal(resolvePerformanceTier({ ...qualityMachine, freeMemoryMb: 1400 }, "quality").tier, "balanced");

  assert.equal(deriveMemoryPressure({ ...qualityMachine, freeMemoryMb: 700 }), "severe");
  assert.equal(resolvePerformanceTier({ ...qualityMachine, freeMemoryMb: 700 }, "quality").tier, "efficiency");

  assert.equal(deriveMemoryPressure({ freeMemoryMb: 1200 }), "moderate");
  assert.equal(deriveMemoryPressure({ freeMemoryMb: 700 }), "severe");
});


test("Desktop graphics capability is a stable ceiling without vendor guessing", () => {
  const capable = {
    totalMemoryMb: 16384, cpuCount: 12, cpuSpeedMhz: 3000, freeMemoryMb: 6000,
    cpuPercent: 10, eventLoopLagMs: 5, bufferingEvents: 0, droppedFrames: 0,
    cpuSpeedLimit: 100, onBattery: false,
  };

  assert.equal(deriveGraphicsCapabilityTier({ graphicsCapability: "hardware" }), "quality");
  assert.equal(deriveGraphicsCapabilityTier({ graphicsCapability: "unknown" }), "quality");
  assert.equal(deriveGraphicsCapabilityTier({ graphicsCapability: "limited" }), "balanced");
  assert.equal(deriveGraphicsCapabilityTier({ graphicsCapability: "software" }), "balanced");

  assert.equal(resolveAutomaticPerformanceTier({ ...capable, graphicsCapability: "hardware" }), "quality");
  assert.equal(resolveAutomaticPerformanceTier({ ...capable, graphicsCapability: "unknown" }), "quality");
  assert.equal(resolveAutomaticPerformanceTier({ ...capable, graphicsCapability: "software" }), "balanced");
  assert.equal(resolvePerformanceTier({ ...capable, graphicsCapability: "limited" }, "quality").tier, "balanced");
});

test("Automatic and manual profiles remain bounded by live safety pressure", () => {
  const healthy = {
    totalMemoryMb: 16384, cpuCount: 12, cpuSpeedMhz: 3000, freeMemoryMb: 8000,
    cpuPercent: 20, eventLoopLagMs: 10, bufferingEvents: 0, droppedFrames: 0,
    cpuSpeedLimit: 100, onBattery: false,
  };
  assert.equal(derivePerformanceTier(healthy, "automatic"), "quality");
  assert.equal(derivePerformanceTier(healthy, "balanced"), "balanced");
  assert.equal(derivePerformanceTier(healthy, "efficiency"), "efficiency");

  const moderate = { ...healthy, onBattery: true };
  assert.equal(resolvePerformanceTier(moderate, "quality").tier, "balanced");

  const severe = { ...healthy, bufferingEvents: 2 };
  assert.equal(resolvePerformanceTier(severe, "quality").tier, "efficiency");
});

test("low-end Automatic stays Efficiency even when the current sample is otherwise quiet", () => {
  assert.equal(derivePerformanceTier({
    totalMemoryMb: 4096, cpuCount: 4, cpuSpeedMhz: 1800, freeMemoryMb: 3000,
    cpuPercent: 10, eventLoopLagMs: 5, bufferingEvents: 0, droppedFrames: 0,
    cpuSpeedLimit: 100, onBattery: false,
  }, "automatic"), "efficiency");
});

test("recovery tiers require a stable window", () => {
  const pending = nextStableTier("efficiency", "balanced", { candidate: null, since: 0, now: 1000 });
  assert.equal(pending.tier, "efficiency");
  assert.equal(nextStableTier("efficiency", "balanced", { ...pending, now: 32000 }).tier, "balanced");
});


test("playback pressure reacts to current starvation and frame-drop deltas", () => {
  const healthy = { playbackActive: true, readyState: 4, bufferedAhead: 12, bufferingEvents: 0, droppedFrames: 0 };
  assert.equal(derivePlaybackPressure(healthy), "none");
  assert.equal(derivePlaybackPressure({ ...healthy, bufferingEvents: 1 }), "moderate");
  assert.equal(derivePlaybackPressure({ ...healthy, bufferingEvents: 2 }), "severe");
  assert.equal(derivePlaybackPressure({ ...healthy, readyState: 2 }), "severe");
  assert.equal(derivePlaybackPressure({ ...healthy, readyState: 3, bufferedAhead: 0.5 }), "moderate");
  assert.equal(derivePlaybackPressure({ ...healthy, droppedFrames: 3 }), "moderate");
  assert.equal(derivePlaybackPressure({ ...healthy, droppedFrames: 8 }), "severe");
  assert.equal(derivePlaybackPressure({ ...healthy, playbackActive: false, readyState: 0 }), "none");
});
