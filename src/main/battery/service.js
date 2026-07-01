const { ipcMain, powerMonitor, Notification } = require("electron");

const DEFAULT_PREFERENCES = Object.freeze({
  showStatus: true,
  alerts: true,
  automaticOptimization: true,
});

function sanitizeStatus(value = {}, detectedOnBattery = null) {
  const level = Number(value.level);
  return {
    available: Boolean(value.available),
    charging: Boolean(value.charging),
    onBattery: typeof detectedOnBattery === "boolean"
      ? detectedOnBattery
      : Boolean(value.onBattery),
    level: Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : null,
    chargingTime: Number.isFinite(Number(value.chargingTime)) ? Number(value.chargingTime) : null,
    dischargingTime: Number.isFinite(Number(value.dischargingTime)) ? Number(value.dischargingTime) : null,
    updatedAt: Date.now(),
  };
}

function createBatteryService({ getMainWindow, downloads, tray }) {
  let status = sanitizeStatus({ charging: true, onBattery: false });
  let preferences = { ...DEFAULT_PREFERENCES };
  let warnedLow = false;
  let warnedCritical = false;
  let autoPausedIds = [];

  const send = (channel, payload) => {
    const win = getMainWindow?.();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  const notify = (title, body) => {
    if (!preferences.alerts || !Notification.isSupported()) return;
    try { new Notification({ title, body, silent: false }).show(); } catch {}
  };

  const publish = () => {
    tray?.setBatteryStatus?.(preferences.showStatus ? status : null);
    send("battery:status", { ...status, visible: preferences.showStatus });
  };

  const applyPolicy = (previous = {}) => {
    if (!status.onBattery || status.charging) {
      warnedLow = false;
      warnedCritical = false;
      if (autoPausedIds.length) {
        send("battery:resume-downloads", { ids: autoPausedIds.slice() });
        autoPausedIds = [];
      }
      return;
    }
    if (!status.available || !Number.isFinite(status.level)) return;
    if (status.level <= 0.2 && !warnedLow) {
      warnedLow = true;
      notify("Orion low battery", `Battery is at ${Math.round(status.level * 100)}%. Orion has reduced background activity.`);
      send("battery:alert", { severity: "low", level: status.level });
    }
    if (status.level <= 0.1 && !warnedCritical) {
      warnedCritical = true;
      notify(
        "Orion critical battery",
        preferences.automaticOptimization
          ? "Downloads were paused to preserve playback and battery life."
          : "Battery has reached 10%.",
      );
      if (preferences.automaticOptimization) {
        const active = downloads.getDownloads().filter((entry) =>
          ["queued", "preflighting", "downloading", "processing"].includes(entry.status),
        );
        autoPausedIds = active.map((entry) => entry.id);
        downloads.pauseAllDownloads("Automatically paused at 10% battery");
      }
      send("battery:alert", {
        severity: "critical",
        level: status.level,
        optimized: preferences.automaticOptimization,
      });
    }
    if (Number(previous.level) < 0.1 && status.level > 0.12) warnedCritical = false;
    if (Number(previous.level) < 0.2 && status.level > 0.22) warnedLow = false;
  };

  const update = (value) => {
    const previous = status;
    status = sanitizeStatus(value, powerMonitor.isOnBatteryPower());
    applyPolicy(previous);
    publish();
    return status;
  };

  const powerChanged = () => update({ ...status, charging: !powerMonitor.isOnBatteryPower() });

  function register() {
    ipcMain.handle("battery:get-status", () => ({ ...status, visible: preferences.showStatus }));
    ipcMain.on("battery:update-status", (_event, value) => update(value));
    ipcMain.handle("battery:update-preferences", (_event, value = {}) => {
      preferences = {
        showStatus: value.showStatus !== false,
        alerts: value.alerts !== false,
        automaticOptimization: value.automaticOptimization !== false,
      };
      publish();
      return preferences;
    });
    powerMonitor.on("on-ac", powerChanged);
    powerMonitor.on("on-battery", powerChanged);
    publish();
  }

  function destroy() {
    powerMonitor.removeListener("on-ac", powerChanged);
    powerMonitor.removeListener("on-battery", powerChanged);
  }

  return { register, destroy, getStatus: () => status, getPreferences: () => preferences };
}

module.exports = { DEFAULT_PREFERENCES, sanitizeStatus, createBatteryService };
