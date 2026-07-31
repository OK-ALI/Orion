module.exports = ({ ipcRenderer, webFrame }) => ({
  onWindowMaximize: (cb) => {
    const handler = (_, v) => cb(v);
    ipcRenderer.on("window-maximized", handler);
    return handler;
  },
  offWindowMaximize: (handler) =>
    ipcRenderer.removeListener("window-maximized", handler),
  getBlockedStats: () => ipcRenderer.invoke("get-blocked-stats"),
  getBlockStats: () => ipcRenderer.invoke("get-blocked-stats"),
  preflightStream: (candidateId) =>
    ipcRenderer.invoke("downloads:preflight", { candidateId }),
  showInFolder: (path) => ipcRenderer.invoke("show-in-folder", path),
  fileExists: (path) => ipcRenderer.invoke("file-exists", path),
  scanDirectory: (path) => ipcRenderer.invoke("scan-directory", path),
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
  openPath: (filePath) => ipcRenderer.invoke("open-path", filePath),
  getInstallPath: () => ipcRenderer.invoke("get-install-path"),
  openPathAtTime: (filePath, seconds, subtitlePaths) =>
    ipcRenderer.invoke("open-path-at-time", {
      filePath,
      seconds,
      subtitlePaths,
    }),
  quitApp: () => ipcRenderer.invoke("quit-app"),
  logToTerminal: (msg) => ipcRenderer.send("log-to-terminal", msg),
  getCacheSize: () => ipcRenderer.invoke("get-cache-size"),
  getBackendStatus: (args) => ipcRenderer.invoke("get-backend-status", args),
  clearAppCache: () => ipcRenderer.invoke("clear-app-cache"),
  injectScriptAllFrames: (webContentsId, script) =>
    ipcRenderer.invoke("inject-script-all-frames", webContentsId, script),
  clearWatchData: () => ipcRenderer.invoke("clear-watch-data"),
  resetApp: () => ipcRenderer.invoke("reset-app"),
  secureGet: (key) =>
    ipcRenderer.invoke("secure-store-get", key).then((r) => r.value ?? null),
  secureSet: (key, value) =>
    ipcRenderer.invoke("secure-store-set", { key, value }),
  setZoomFactor: (factor) => webFrame.setZoomFactor(factor)
});
