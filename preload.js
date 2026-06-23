// ── Orion — Preload Script ────────────────────────────────────────────────────
// Exposes a safe, typed API to the renderer via contextBridge.
// The renderer accesses these via `window.electron.*`

const { contextBridge, ipcRenderer, webFrame } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  // ── Window controls ────────────────────────────────────────────────────────
  minimize: () => ipcRenderer.invoke("window-minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window-toggle-maximize"),
  close: () => ipcRenderer.invoke("window-close"),
  isMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  getPlatform: () => ipcRenderer.invoke("get-platform"),

  // Backward compatibility alias mapped to window controls
  windowMinimize: () => ipcRenderer.invoke("window-minimize"),
  windowToggleMaximize: () => ipcRenderer.invoke("window-toggle-maximize"),
  windowClose: () => ipcRenderer.invoke("window-close"),
  windowIsMaximized: () => ipcRenderer.invoke("window-is-maximized"),

  onMaximizedChange: (cb) => {
    const handler = (_, v) => cb(v);
    ipcRenderer.on("window-maximized", handler);
    return handler;
  },
  offMaximizedChange: (handler) =>
    ipcRenderer.removeListener("window-maximized", handler),

  onWindowMaximize: (cb) => {
    const handler = (_, v) => cb(v);
    ipcRenderer.on("window-maximized", handler);
    return handler;
  },
  offWindowMaximize: (handler) =>
    ipcRenderer.removeListener("window-maximized", handler),

  // ── Blocked stats ──────────────────────────────────────────────────────────
  getBlockedStats: () => ipcRenderer.invoke("get-blocked-stats"),
  getBlockStats: () => ipcRenderer.invoke("get-blocked-stats"), // alias

  onBlockedUpdate: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("blocked-stats-update", handler);
    return handler;
  },
  offBlockedUpdate: (handler) =>
    ipcRenderer.removeListener("blocked-stats-update", handler),

  // ── Media interception ─────────────────────────────────────────────────────
  onM3u8Found: (cb) => {
    const handler = (_, url) => cb(url);
    ipcRenderer.on("m3u8-found", handler);
    return handler;
  },
  offM3u8Found: (handler) =>
    ipcRenderer.removeListener("m3u8-found", handler),

  onSubtitleFound: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("subtitle-found", handler);
    return handler;
  },
  offSubtitleFound: (handler) =>
    ipcRenderer.removeListener("subtitle-found", handler),

  // ── Downloads progress and queue ──────────────────────────────────────────
  onDownloadProgress: (cb) => {
    const handler = (_, d) => cb(d);
    ipcRenderer.on("download-progress", handler);
    return handler;
  },
  offDownloadProgress: (handler) =>
    ipcRenderer.removeListener("download-progress", handler),

  checkDownloader: (folder) => ipcRenderer.invoke("check-downloader", folder),
  checkHelperDownloader: (folder) =>
    ipcRenderer.invoke("check-helper-downloader", folder),
  getDownloaderStatus: () => ipcRenderer.invoke("get-downloader-status"),
  installDownloaderTools: () => ipcRenderer.invoke("install-downloader-tools"),
  openDownloaderToolsFolder: () =>
    ipcRenderer.invoke("open-downloader-tools-folder"),
  onDownloaderToolsProgress: (cb) => {
    const handler = (_, d) => cb(d);
    ipcRenderer.on("downloader-tools-progress", handler);
    return handler;
  },
  offDownloaderToolsProgress: (handler) =>
    ipcRenderer.removeListener("downloader-tools-progress", handler),
  runDownload: (args) => ipcRenderer.invoke("run-download", args),
  pauseDownload: (id) => ipcRenderer.invoke("pause-download", id),
  resumeDownload: (args) => ipcRenderer.invoke("resume-download", args),
  getDownloads: () => ipcRenderer.invoke("get-downloads"),
  deleteDownload: (args) => ipcRenderer.invoke("delete-download", args),
  showInFolder: (path) => ipcRenderer.invoke("show-in-folder", path),
  fileExists: (path) => ipcRenderer.invoke("file-exists", path),
  scanDirectory: (path) => ipcRenderer.invoke("scan-directory", path),
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  openPath: (filePath) => ipcRenderer.invoke("open-path", filePath),
  getInstallPath: () => ipcRenderer.invoke("get-install-path"),
  openPathAtTime: (filePath, seconds, subtitlePaths) =>
    ipcRenderer.invoke("open-path-at-time", {
      filePath,
      seconds,
      subtitlePaths,
    }),
  pruneSubtitlePaths: (downloadId) =>
    ipcRenderer.invoke("prune-subtitle-paths", { downloadId }),

  // ── Close confirmation ─────────────────────────────────────────────────────
  onConfirmClose: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("confirm-close", handler);
    return handler;
  },
  offConfirmClose: (handler) => ipcRenderer.removeListener("confirm-close", handler),
  respondClose: (confirm) => ipcRenderer.send("close-response", confirm),

  // ── Anime resolver (AllManga) ──────────────────────────────────────────────
  resolveAllManga: (args) => ipcRenderer.invoke("resolve-allmanga", args),
  setPlayerVideo: (args) => ipcRenderer.invoke("set-player-video", args),
  debugAllManga: (args) => ipcRenderer.invoke("debug-allmanga", args),

  // ── App metadata ───────────────────────────────────────────────────────────
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  // ── Webview fullscreen ─────────────────────────────────────────────────────
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

  // ── OS notifications ───────────────────────────────────────────────────────
  showNotification: ({ title, body, silent }) =>
    ipcRenderer.invoke("show-notification", { title, body, silent }),

  // ── App control / memory ───────────────────────────────────────────────────
  quitApp: () => ipcRenderer.invoke("quit-app"),
  playerStopped: () => ipcRenderer.send("player-stopped"),

  // ── Cache operations ───────────────────────────────────────────────────────
  getCacheSize: () => ipcRenderer.invoke("get-cache-size"),
  getDownloadsSize: () => ipcRenderer.invoke("get-downloads-size"),
  getBackendStatus: (args) => ipcRenderer.invoke("get-backend-status", args),
  clearAppCache: () => ipcRenderer.invoke("clear-app-cache"),
  queryVideoProgress: (webContentsId) =>
    ipcRenderer.invoke("query-video-progress", webContentsId),
  clearWatchData: () => ipcRenderer.invoke("clear-watch-data"),
  deleteAllDownloads: () => ipcRenderer.invoke("delete-all-downloads"),
  resetApp: () => ipcRenderer.invoke("reset-app"),

  // ── Subtitles ──────────────────────────────────────────────────────────────
  searchSubtitles: (args) => ipcRenderer.invoke("search-subtitles", args),
  getSubtitleUrl: (args) => ipcRenderer.invoke("get-subtitle-url", args),
  downloadSubtitlesForFile: (args) =>
    ipcRenderer.invoke("download-subtitles-for-file", args),
  deleteSubtitleFile: (args) =>
    ipcRenderer.invoke("delete-subtitle-file", args),
  wyzieOpenRedeem: () => ipcRenderer.invoke("wyzie-open-redeem"),
  wyzieValidateKey: (key) => ipcRenderer.invoke("wyzie-validate-key", key),

  // ── Secure storage ─────────────────────────────────────────────────────────
  secureGet: (key) =>
    ipcRenderer.invoke("secure-store-get", key).then((r) => r.value ?? null),
  secureSet: (key, value) =>
    ipcRenderer.invoke("secure-store-set", { key, value }),

  // ── PiP Window ─────────────────────────────────────────────────────────────
  openPipWindow: (url, title) =>
    ipcRenderer.invoke("open-pip-window", { url, title }),
  closePipWindow: () => ipcRenderer.invoke("close-pip-window"),
  getPipWebContentsId: () => ipcRenderer.invoke("get-pip-webcontents-id"),
  onPipOpened: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("pip-window-opened", handler);
    return handler;
  },
  offPipOpened: (handler) => ipcRenderer.removeListener("pip-window-opened", handler),
  onPipClosed: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("pip-window-closed", handler);
    return handler;
  },
  offPipClosed: (handler) => ipcRenderer.removeListener("pip-window-closed", handler),

  getVideoDuration: (filePath) =>
    ipcRenderer.invoke("get-video-duration", filePath),
  setZoomFactor: (factor) => webFrame.setZoomFactor(factor),

  // ── Auto-updater ──────────────────────────────────────────────────────────
  detectUpdateFormat: () => ipcRenderer.invoke("detect-update-format"),
  downloadAndInstallUpdate: (args) =>
    ipcRenderer.invoke("download-and-install-update", args),
  cancelUpdate: () => ipcRenderer.invoke("cancel-update"),
  onUpdateProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("update-progress", handler);
    return handler;
  },
  offUpdateProgress: (handler) => ipcRenderer.removeListener("update-progress", handler),

  // ── Scheduled backups ──────────────────────────────────────────────────────
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

  // ── Mini-Player and Tray IPC ───────────────────────────────────────────────
  setMiniPlayerStatus: (active, title) =>
    ipcRenderer.send("mini-player-status", { active, title }),
  onStopMiniPlayer: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("stop-mini-player", handler);
    return handler;
  },
  offStopMiniPlayer: (handler) =>
    ipcRenderer.removeListener("stop-mini-player", handler),
  onTrayRestore: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("tray-restore-window", handler);
    return handler;
  },
  offTrayRestore: (handler) =>
    ipcRenderer.removeListener("tray-restore-window", handler),
  onUpdateCloseBehavior: (cb) => {
    const handler = (_, behavior) => cb(behavior);
    ipcRenderer.on("update-close-behavior", handler);
    return handler;
  },
  offUpdateCloseBehavior: (handler) =>
    ipcRenderer.removeListener("update-close-behavior", handler),
});

