const { contextBridge, ipcRenderer, webFrame } = require("electron");

const dependencies = { ipcRenderer, webFrame };
const electronApi = {
  ...require("./api/window")(dependencies),
  ...require("./api/downloads")(dependencies),
  ...require("./api/player")(dependencies),
  ...require("./api/subtitles")(dependencies),
  ...require("./api/storage")(dependencies),
  ...require("./api/updates")(dependencies),
  ...require("./api/tray")(dependencies),
  ...require("./api/music")(dependencies),
};

contextBridge.exposeInMainWorld("electron", electronApi);
