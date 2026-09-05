const { app, ipcMain, powerMonitor } = require("electron");
const os = require("os");
const { createHardwareCapabilityProbe } = require("./hardwareCapability");
const {
  normalizePerformanceSelection,
  resolvePerformanceTier,
  nextStableTier,
  derivePlaybackPressure,
} = require("./policy");

function createPerformanceCoordinator({ getMainWindow, getBatteryStatus, downloads }) {
  let timer = null;
  let tierState = { tier: "balanced", candidate: null, since: 0 };
  let playback = {
    bufferingEvents: 0,
    eventLoopLagMs: 0,
    droppedFrames: 0,
    bufferedAhead: 0,
    readyState: 0,
    playbackActive: false,
  };
  let cpuSpeedLimit = 100;
  let performanceSelection = "automatic";
  let lastSnapshot = null;
  const autoPaused = new Map();
  let stablePlaybackSamples = 0;
  let primaryRestarted = false;
  let registered = false;

  const send = (channel, payload) => {
    const win = getMainWindow?.();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  const manageDownloadPressure = () => {
    if (!downloads) return;
    const active = downloads.getDownloads().filter((entry) =>
      ["queued", "preflighting", "downloading", "processing"].includes(entry.status),
    );
    const playbackPressure = derivePlaybackPressure(playback);
    if (playbackPressure !== "none") {
      stablePlaybackSamples = 0;
      for (const entry of active.slice(1)) {
        if (autoPaused.has(entry.id)) continue;
        autoPaused.set(entry.id, Number(entry.fragmentConcurrency) || 6);
        downloads.pauseDownload(entry.id, "Automatically paused to protect streaming");
      }
    } else {
      stablePlaybackSamples += 1;
    }
    if (playbackPressure === "severe" && active[0] && !primaryRestarted) {
      const primary = active[0];
      primaryRestarted = true;
      const original = Number(primary.fragmentConcurrency) || 6;
      primary.fragmentConcurrency = 2;
      primary.performanceOriginalFragmentConcurrency = original;
      downloads.saveDownloads?.();
      downloads.pauseDownload(primary.id, "Restarting with lower stream pressure");
      setTimeout(() => send("performance:resume-downloads", { ids: [primary.id], restarted: true }), 800).unref?.();
    }
    if (stablePlaybackSamples < 6) return;
    const resumable = [];
    for (const [id, original] of autoPaused) {
      const entry = downloads.getDownloads().find((item) => item.id === id);
      if (entry?.status === "paused" && String(entry.lastMessage || "").startsWith("Automatically paused")) {
        entry.fragmentConcurrency = original;
        resumable.push(id);
      }
    }
    autoPaused.clear();
    primaryRestarted = false;
    downloads.saveDownloads?.();
    if (resumable.length) send("performance:resume-downloads", { ids: resumable, restarted: false });
  };

  const readStableCapability = () => {
    const cpus = os.cpus?.() || [];
    const cpuSpeeds = cpus
      .map((cpu) => Number(cpu?.speed))
      .filter((speed) => Number.isFinite(speed) && speed > 0);
    const cpuSpeedMhz = cpuSpeeds.length
      ? Math.round(cpuSpeeds.reduce((sum, speed) => sum + speed, 0) / cpuSpeeds.length)
      : 0;
    return {
      totalMemoryMb: Math.round(Number(os.totalmem?.() || 0) / (1024 * 1024)),
      cpuCount: cpus.length,
      cpuSpeedMhz,
      ...(hardwareProbe?.getSnapshot?.() || {}),
    };
  };

  const publish = ({ forceTier = false } = {}) => {
    const memory = process.getSystemMemoryInfo();
    const metrics = app.getAppMetrics();
    const cpuPercent = metrics.reduce((sum, item) => sum + Number(item.cpu?.percentCPUUsage || 0), 0);
    const battery = getBatteryStatus?.() || {};
    const capability = readStableCapability();
    const snapshot = {
      at: Date.now(),
      cpuPercent: Math.round(cpuPercent * 10) / 10,
      ...capability,
      freeMemoryMb: Math.round(Number(memory.free || 0) / 1024),
      eventLoopLagMs: Math.max(0, Number(playback.eventLoopLagMs) || 0),
      bufferingEvents: Math.max(0, Number(playback.bufferingEvents) || 0),
      droppedFrames: Math.max(0, Number(playback.droppedFrames) || 0),
      bufferedAhead: Math.max(0, Number(playback.bufferedAhead) || 0),
      readyState: Math.max(0, Number(playback.readyState) || 0),
      playbackActive: Boolean(playback.playbackActive),
      onBattery: Boolean(battery.onBattery && battery.optimizationEnabled !== false),
      batteryLevel: battery.level,
      cpuSpeedLimit,
    };
    const resolution = resolvePerformanceTier(snapshot, performanceSelection);
    if (forceTier) {
      tierState = { tier: resolution.tier, candidate: null, since: 0 };
    } else {
      tierState = nextStableTier(tierState.tier, resolution.tier, { ...tierState, now: snapshot.at });
    }
    const pressureLimited = resolution.tier !== resolution.requestedTier;
    lastSnapshot = {
      ...snapshot,
      ...resolution,
      tier: tierState.tier,
      reason: pressureLimited
        ? (resolution.graphicsTier === "balanced" && resolution.requestedTier === "quality"
            ? "graphics-capability"
            : resolution.pressureTier === "efficiency" ? "resource-pressure" : "adaptive-pressure")
        : resolution.selection === "automatic"
          ? `automatic-${resolution.automaticTier}`
          : `manual-${resolution.selection}`,
    };
    send("performance:snapshot", lastSnapshot);
    return lastSnapshot;
  };

  const hardwareProbe = createHardwareCapabilityProbe({
    app,
    onUpdate: () => {
      if (registered) publish({ forceTier: true });
    },
  });
  hardwareProbe.start();

  const speedHandler = (_event, details) => {
    cpuSpeedLimit = Math.max(1, Math.min(100, Number(details?.limit) || 100));
    publish();
  };

  function register() {
    registered = true;
    ipcMain.handle("performance:get-snapshot", () => lastSnapshot);
    ipcMain.handle("performance:set-selection", (_event, value) => {
      performanceSelection = normalizePerformanceSelection(value);
      return publish({ forceTier: true });
    });
    ipcMain.on("performance:report-playback", (_event, report = {}) => {
      playback = {
        bufferingEvents: Number(report.bufferingEvents) > 0
          ? Math.min(20, Number(playback.bufferingEvents || 0) + 1)
          : 0,
        droppedFrames: Math.max(0, Number(report.droppedFrames) || 0),
        eventLoopLagMs: Math.max(0, Math.min(2000, Number(report.eventLoopLagMs) || 0)),
        bufferedAhead: Math.max(0, Number(report.bufferedAhead) || 0),
        readyState: Math.max(0, Number(report.readyState) || 0),
        playbackActive: Boolean(report.playbackActive),
      };
      if (lastSnapshot) lastSnapshot = { ...lastSnapshot, ...playback };
      manageDownloadPressure();
      if (derivePlaybackPressure(playback) !== "none") publish({ forceTier: true });
    });
    powerMonitor.on("speed-limit-change", speedHandler);
    void hardwareProbe.refresh();
    publish({ forceTier: true });
    timer = setInterval(publish, 5000);
    timer.unref?.();
  }

  function destroy() {
    registered = false;
    if (timer) clearInterval(timer);
    timer = null;
    hardwareProbe.destroy();
    powerMonitor.removeListener("speed-limit-change", speedHandler);
  }

  return { register, destroy, getSnapshot: () => lastSnapshot };
}

module.exports = { createPerformanceCoordinator };
