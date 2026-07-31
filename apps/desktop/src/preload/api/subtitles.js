module.exports = ({ ipcRenderer, webFrame }) => ({
  onSubtitleFound: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("subtitle-found", handler);
    return handler;
  },
  offSubtitleFound: (handler) =>
    ipcRenderer.removeListener("subtitle-found", handler),
  pruneSubtitlePaths: (downloadId) =>
    ipcRenderer.invoke("prune-subtitle-paths", { downloadId }),
  searchSubtitles: (args) => ipcRenderer.invoke("search-subtitles", args),
  getSubtitleUrl: (args) => ipcRenderer.invoke("get-subtitle-url", args),
  deleteSubtitleFile: (args) =>
    ipcRenderer.invoke("delete-subtitle-file", args),
  wyzieOpenRedeem: () => ipcRenderer.invoke("wyzie-open-redeem"),
  wyzieValidateKey: (key) => ipcRenderer.invoke("wyzie-validate-key", key)
});
