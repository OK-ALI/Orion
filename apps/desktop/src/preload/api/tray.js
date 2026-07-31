module.exports = ({ ipcRenderer, webFrame }) => ({
  showNotification: ({ title, body, silent }) =>
    ipcRenderer.invoke("show-notification", { title, body, silent }),
  getScheduledBackupSettings: () =>
    ipcRenderer.invoke("get-scheduled-backup-settings"),
  setScheduledBackupSettings: (settings) =>
    ipcRenderer.invoke("set-scheduled-backup-settings", settings),
  performScheduledBackup: (args) =>
    ipcRenderer.invoke("perform-scheduled-backup", args),
  onScheduledBackupRequested: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("scheduled-backup-requested", handler);
    return handler;
  },
  offScheduledBackupRequested: (handler) =>
    ipcRenderer.removeListener("scheduled-backup-requested", handler),
  onTrayRestore: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("tray-restore-window", handler);
    return handler;
  },
  offTrayRestore: (handler) =>
    ipcRenderer.removeListener("tray-restore-window", handler),
  onTrayOpenPage: (cb) => {
    const handler = (_, page) => cb(page);
    ipcRenderer.on("tray-open-page", handler);
    return handler;
  },
  offTrayOpenPage: (handler) =>
    ipcRenderer.removeListener("tray-open-page", handler),
  getBatteryStatus: () => ipcRenderer.invoke("battery:get-status"),
  updateBatteryStatus: (status) => ipcRenderer.send("battery:update-status", status),
  updateBatteryPreferences: (preferences) =>
    ipcRenderer.invoke("battery:update-preferences", preferences),
  onBatteryStatus: (cb) => {
    const handler = (_, status) => cb(status);
    ipcRenderer.on("battery:status", handler);
    return handler;
  },
  offBatteryStatus: (handler) => ipcRenderer.removeListener("battery:status", handler),
  onBatteryAlert: (cb) => {
    const handler = (_, alert) => cb(alert);
    ipcRenderer.on("battery:alert", handler);
    return handler;
  },
  offBatteryAlert: (handler) => ipcRenderer.removeListener("battery:alert", handler),
  onBatteryAlertCleared: (cb) => {
    const handler = (_, value) => cb(value);
    ipcRenderer.on("battery:alert-cleared", handler);
    return handler;
  },
  offBatteryAlertCleared: (handler) =>
    ipcRenderer.removeListener("battery:alert-cleared", handler),
  onBatteryResumeDownloads: (cb) => {
    const handler = (_, payload) => cb(payload);
    ipcRenderer.on("battery:resume-downloads", handler);
    return handler;
  },
  offBatteryResumeDownloads: (handler) =>
    ipcRenderer.removeListener("battery:resume-downloads", handler),
  getPerformanceSnapshot: () => ipcRenderer.invoke("performance:get-snapshot"),
  reportPlaybackHealth: (report) => ipcRenderer.send("performance:report-playback", report),
  onPerformanceSnapshot: (cb) => {
    const handler = (_, snapshot) => cb(snapshot);
    ipcRenderer.on("performance:snapshot", handler);
    return handler;
  },
  offPerformanceSnapshot: (handler) =>
    ipcRenderer.removeListener("performance:snapshot", handler),
  onPerformanceResumeDownloads: (cb) => {
    const handler = (_, payload) => cb(payload);
    ipcRenderer.on("performance:resume-downloads", handler);
    return handler;
  },
  offPerformanceResumeDownloads: (handler) =>
    ipcRenderer.removeListener("performance:resume-downloads", handler)
});
