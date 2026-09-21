const { BrowserWindow } = require("electron");
const { secureStoreSet } = require("./storageIpc");

function clearGoogleSessionAndReload() {
  ["google_access_token", "google_refresh_token", "google_profile"].forEach(
    (key) => secureStoreSet(key, null),
  );

  setTimeout(() => {
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed() && !window.webContents?.isDestroyed()) {
        window.webContents.reload();
      }
    });
  }, 0);
}

module.exports = { clearGoogleSessionAndReload };
