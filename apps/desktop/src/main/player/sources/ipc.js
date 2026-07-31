const path = require("path");
const { app, ipcMain } = require("electron");
const { createSourceHealthStore } = require("./healthStore");

let store = null;

function getStore() {
  if (!store) {
    store = createSourceHealthStore({
      filePath: path.join(app.getPath("userData"), "cinema-source-health.json"),
    });
  }
  return store;
}

function register() {
  ipcMain.handle("cinema-sources:health:list", (_event, mediaType) => getStore().list(mediaType));
  ipcMain.handle("cinema-sources:health:get", (_event, { sourceId, mediaType } = {}) => getStore().get(sourceId, mediaType));
  ipcMain.handle("cinema-sources:health:record", (_event, value = {}) => getStore().record(value));
  ipcMain.handle("cinema-sources:health:clear", () => { getStore().clear(); return { ok: true }; });
}

module.exports = { register, getStore };
