module.exports = ({ ipcRenderer, webFrame }) => ({
  resolveAllManga: (args) => ipcRenderer.invoke("resolve-allmanga", args),
  setPlayerVideo: (args) => ipcRenderer.invoke("set-player-video", args),
  debugAllManga: (args) => ipcRenderer.invoke("debug-allmanga", args),
  onWebviewEnterFullscreen: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("webview-enter-fullscreen", handler);
    return handler;
  },
  offWebviewEnterFullscreen: (handler) =>
    ipcRenderer.removeListener("webview-enter-fullscreen", handler),
  onWebviewLeaveFullscreen: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("webview-leave-fullscreen", handler);
    return handler;
  },
  offWebviewLeaveFullscreen: (handler) =>
    ipcRenderer.removeListener("webview-leave-fullscreen", handler),
  playerStopped: () => ipcRenderer.send("player-stopped"),
  queryVideoProgress: (webContentsId) =>
    ipcRenderer.invoke("query-video-progress", webContentsId),
  controlVideo: (webContentsId, action) =>
    ipcRenderer.invoke("control-video", webContentsId, action),
  setVideoState: (webContentsId, state) =>
    ipcRenderer.invoke("set-video-state", webContentsId, state),
  resumeVideo: (webContentsId) =>
    ipcRenderer.invoke("resume-video", webContentsId),
  openPipWindow: (url, title, state) =>
    ipcRenderer.invoke("open-pip-window", { url, title, state }),
  getPipWebContentsId: () => ipcRenderer.invoke("get-pip-webcontents-id"),
  onPipOpened: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("pip-window-opened", handler);
    return handler;
  },
  offPipOpened: (handler) => ipcRenderer.removeListener("pip-window-opened", handler),
  onPipClosed: (cb) => {
    const handler = (_, payload) => cb(payload);
    ipcRenderer.on("pip-window-closed", handler);
    return handler;
  },
  offPipClosed: (handler) => ipcRenderer.removeListener("pip-window-closed", handler),
  getVideoDuration: (filePath) =>
    ipcRenderer.invoke("get-video-duration", filePath),
  getRendererWebContentsId: () => ipcRenderer.invoke("player:renderer-webcontents-id"),
  openLocalMedia: (downloadId) =>
    ipcRenderer.invoke("local-media:open", downloadId),
  offloadFile: (downloadId) =>
    ipcRenderer.invoke("local-media:offload-file", downloadId),
  updateDownloadRecord: (downloadId, updates) =>
    ipcRenderer.invoke("local-media:update-record", downloadId, updates),
  repairLocalMedia: (downloadId) => ipcRenderer.invoke("local-media:repair", downloadId),
  startAmbientSampling: (options) => ipcRenderer.invoke("ambient:start", options),
  stopAmbientSampling: (targetId) => ipcRenderer.invoke("ambient:stop", targetId),
  onAmbientPalette: (cb) => {
    const handler = (_, payload) => cb(payload);
    ipcRenderer.on("ambient:palette", handler);
    return handler;
  },
  offAmbientPalette: (handler) => ipcRenderer.removeListener("ambient:palette", handler),
  setMiniPlayerStatus: (active, title) =>
    ipcRenderer.send("mini-player-status", { active, title }),
  onStopMiniPlayer: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("stop-mini-player", handler);
    return handler;
  },
  offStopMiniPlayer: (handler) =>
    ipcRenderer.removeListener("stop-mini-player", handler),
  updateSystemMediaSession: (state) =>
    ipcRenderer.invoke("media-control:update-session", state),
  getSystemMediaStatus: () => ipcRenderer.invoke("media-control:get-status"),
  openWindowsSoundSettings: () =>
    ipcRenderer.invoke("media-control:open-sound-settings"),
  onSystemMediaCommand: (cb) => {
    const handler = (_, command) => cb(command);
    ipcRenderer.on("media-control:command", handler);
    return handler;
  },
  offSystemMediaCommand: (handler) =>
    ipcRenderer.removeListener("media-control:command", handler),
  onPlayerShortcut: (cb) => {
    const handler = (_, command) => cb(command);
    ipcRenderer.on("player-shortcut", handler);
    return handler;
  },
  offPlayerShortcut: (handler) => ipcRenderer.removeListener("player-shortcut", handler)
});
