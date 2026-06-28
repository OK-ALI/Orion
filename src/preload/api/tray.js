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
    ipcRenderer.removeListener("tray-open-page", handler)
});
