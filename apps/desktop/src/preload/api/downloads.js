module.exports = ({ ipcRenderer, webFrame }) => ({
  onM3u8Found: (cb) => {
    const handler = (_, url) => cb(url);
    ipcRenderer.on("m3u8-found", handler);
    return handler;
  },
  offM3u8Found: (handler) =>
    ipcRenderer.removeListener("m3u8-found", handler),
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
  beginStreamCapture: (details) => ipcRenderer.invoke("downloads:begin-capture", details),
  endStreamCapture: (sessionId) => ipcRenderer.invoke("downloads:end-capture", sessionId),
  listStreamCandidates: (details) => ipcRenderer.invoke("downloads:list-candidates", details),
  clearStreamCandidates: (details) => ipcRenderer.invoke("downloads:clear-candidates", details),
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
  openDownloadLog: (path) => ipcRenderer.invoke("open-download-log", path),
  getDownloadsSize: () => ipcRenderer.invoke("get-downloads-size"),
  deleteAllDownloads: () => ipcRenderer.invoke("delete-all-downloads"),
  downloadSubtitlesForFile: (args) =>
    ipcRenderer.invoke("download-subtitles-for-file", args),
  downloadAndInstallUpdate: (args) =>
    ipcRenderer.invoke("download-and-install-update", args)
});
