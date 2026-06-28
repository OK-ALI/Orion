module.exports = ({ ipcRenderer, webFrame }) => ({
  minimize: () => ipcRenderer.invoke("window-minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window-toggle-maximize"),
  close: () => ipcRenderer.invoke("window-close"),
  isMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  getPlatform: () => ipcRenderer.invoke("get-platform"),
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
  closePipWindow: () => ipcRenderer.invoke("close-pip-window")
});
