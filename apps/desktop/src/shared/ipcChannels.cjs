module.exports = Object.freeze({
  downloads: Object.freeze({
    list: "get-downloads",
    start: "start-download",
    pause: "pause-download",
    resume: "resume-download",
    remove: "delete-download",
    progress: "download-progress",
    candidates: "downloads:list-candidates",
    preflight: "downloads:preflight",
  }),
  player: Object.freeze({
    openPip: "open-pip-window",
    closePip: "close-pip-window",
    stopped: "player-stopped",
  }),
  storage: Object.freeze({
    secureGet: "secure-get",
    secureSet: "secure-set",
    reset: "reset-app",
  }),
  window: Object.freeze({
    minimize: "window-minimize",
    maximize: "window-toggle-maximize",
    close: "window-close",
  }),
});
