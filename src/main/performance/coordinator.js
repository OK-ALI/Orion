const { app, ipcMain, powerMonitor } = require("electron");
const os = require("os");
const { derivePerformanceTier, nextStableTier } = require("./policy");

function createPerformanceCoordinator({ getMainWindow, getBatteryStatus, downloads }) {
  let timer = null;
  let tierState = { tier: "balanced", candidate: null, since: 0 };
  let playback = { bufferingEvents: 0, eventLoopLagMs: 0, droppedFrames: 0 };
  let cpuSpeedLimit = 100;
  let lastSnapshot = null;
  const autoPaused = new Map();
  let stablePlaybackSamples = 0;
  let primaryRestarted = false;

  const send = (channel, payload) => {
    const win = getMainWindow?.();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  const manageDownloadPressure = () => {
    if (!downloads) return;
    const active = downloads.getDownloads().filter((entry) =>
      ["queued", "preflighting", "downloading", "processing"].includes(entry.status),
    );
    if (playback.bufferingEvents >= 2) {
      stablePlaybackSamples = 0;
      for (const entry of active.slice(1)) {
        if (autoPaused.has(entry.id)) continue;
        autoPaused.set(entry.id, Number(entry.fragmentConcurrency) || 6);
        downloads.pauseDownload(entry.id, "Automatically paused to protect streaming");
      }
    } else {
      stablePlaybackSamples += 1;
    }
    if (playback.bufferingEvents >= 4 && active[0] && !primaryRestarted) {
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

  const publish = () => {
    const memory = process.getSystemMemoryInfo();
    const metrics = app.getAppMetrics();
    const cpuPercent = metrics.reduce((sum, item) => sum + Number(item.cpu?.percentCPUUsage || 0), 0);
    const battery = getBatteryStatus?.() || {};
    const snapshot = {
      at: Date.now(),
      cpuPercent: Math.round(cpuPercent * 10) / 10,
      cpuCount: os.cpus()?.length || 0,
      freeMemoryMb: Math.round(Number(memory.free || 0) / 1024),
      eventLoopLagMs: Math.max(0, Number(playback.eventLoopLagMs) || 0),
      bufferingEvents: Math.max(0, Number(playback.bufferingEvents) || 0),
      droppedFrames: Math.max(0, Number(playback.droppedFrames) || 0),
      onBattery: Boolean(battery.onBattery && battery.optimizationEnabled !== false),
      batteryLevel: battery.level,
      cpuSpeedLimit,
    };
    const candidate = derivePerformanceTier(snapshot);
    tierState = nextStableTier(tierState.tier, candidate, { ...tierState, now: snapshot.at });
    lastSnapshot = { ...snapshot, tier: tierState.tier, reason: candidate === "efficiency" ? "resource-pressure" : candidate };
    const win = getMainWindow?.();
    if (win && !win.isDestroyed()) win.webContents.send("performance:snapshot", lastSnapshot);
    manageDownloadPressure();
    playback.bufferingEvents = Math.max(0, playback.bufferingEvents - 1);
  };

  const speedHandler = (_event, details) => {
    cpuSpeedLimit = Math.max(1, Math.min(100, Number(details?.limit) || 100));
    publish();
  };

  function register() {
    ipcMain.handle("performance:get-snapshot", () => lastSnapshot);
    ipcMain.on("performance:report-playback", (_event, report = {}) => {
      playback = {
        bufferingEvents: Number(report.bufferingEvents) > 0
          ? Math.min(20, Number(playback.bufferingEvents || 0) + 1)
          : Math.max(0, Number(playback.bufferingEvents || 0) - 1),
        droppedFrames: Math.max(0, Number(report.droppedFrames) || 0),
        eventLoopLagMs: Math.max(0, Math.min(2000, Number(report.eventLoopLagMs) || 0)),
      };
    });
    powerMonitor.on("speed-limit-change", speedHandler);
    publish();
    timer = setInterval(publish, 5000);
    timer.unref?.();
  }

  function destroy() {
    if (timer) clearInterval(timer);
    timer = null;
    powerMonitor.removeListener("speed-limit-change", speedHandler);
  }

  return { register, destroy, getSnapshot: () => lastSnapshot };
}

module.exports = { createPerformanceCoordinator };
