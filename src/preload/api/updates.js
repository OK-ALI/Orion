module.exports = ({ ipcRenderer, webFrame }) => ({
  onBlockedUpdate: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("blocked-stats-update", handler);
    return handler;
  },
  offBlockedUpdate: (handler) =>
    ipcRenderer.removeListener("blocked-stats-update", handler),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  detectUpdateFormat: () => ipcRenderer.invoke("detect-update-format"),
  cancelUpdate: () => ipcRenderer.invoke("cancel-update"),
  onUpdateProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("update-progress", handler);
    return handler;
  },
  offUpdateProgress: (handler) => ipcRenderer.removeListener("update-progress", handler),
  onUpdateCloseBehavior: (cb) => {
    const handler = (_, behavior) => cb(behavior);
    ipcRenderer.on("update-close-behavior", handler);
    return handler;
  },
  offUpdateCloseBehavior: (handler) =>
    ipcRenderer.removeListener("update-close-behavior", handler)
});
