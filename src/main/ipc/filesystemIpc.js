const { app, dialog, ipcMain, session, shell } = require("electron");
const fs = require("fs");
const path = require("path");

function register({ getMainWindow, resetAppData }) {
  ipcMain.handle("file-exists", (_, filePath) => {
    try { return fs.existsSync(filePath); } catch { return false; }
  });

  ipcMain.handle("pick-folder", async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "Select Folder",
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("open-external", (_, url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") shell.openExternal(url);
    } catch {}
  });

  ipcMain.handle("open-path", (_, filePath) => {
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) shell.openPath(filePath);
      else shell.showItemInFolder(filePath);
    } catch {
      shell.openPath(filePath);
    }
  });

  ipcMain.handle("get-install-path", () => {
    if (process.env.APPIMAGE) return path.dirname(process.env.APPIMAGE);
    if (app.isPackaged) return path.dirname(process.execPath);
    return app.getAppPath();
  });

  ipcMain.handle("scan-directory", (_, folderPath) => {
    try {
      if (!folderPath || !fs.existsSync(folderPath)) return [];
      const videoExtensions = new Set([".mp4", ".mkv", ".webm", ".avi", ".mov", ".m4v", ".ts"]);
      const results = [];
      const scan = (directory, depth = 0) => {
        if (depth > 3) return;
        let entries;
        try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
          const filePath = path.join(directory, entry.name);
          if (entry.isDirectory()) scan(filePath, depth + 1);
          else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!videoExtensions.has(ext)) continue;
            let size = "";
            try {
              const bytes = fs.statSync(filePath).size;
              size = bytes > 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : bytes > 1e3 ? `${(bytes / 1e3).toFixed(1)} KB` : `${bytes} B`;
            } catch {}
            results.push({ filePath, name: path.basename(entry.name, ext), size, ext });
          }
        }
      };
      scan(folderPath);
      return results;
    } catch {
      return [];
    }
  });

  ipcMain.handle("clear-app-cache", async () => {
    try {
      const sessions = [session.defaultSession, session.fromPartition("persist:player"), session.fromPartition("persist:trailer")];
      await Promise.all(sessions.map((item) => item.clearCache()));
      await Promise.all(sessions.map((item) => item.clearStorageData({ storages: ["shadercache", "serviceworkers", "cachestorage"] })));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle("clear-watch-data", async () => {
    try {
      const playerSession = session.fromPartition("persist:player");
      await playerSession.clearStorageData();
      await playerSession.clearCache();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle("get-cache-size", async () => {
    try {
      const sessions = [session.defaultSession, session.fromPartition("persist:player"), session.fromPartition("persist:trailer")];
      const sizes = await Promise.all(sessions.map((item) => item.getCacheSize()));
      return { bytes: sizes.reduce((total, size) => total + size, 0) };
    } catch {
      return { bytes: 0 };
    }
  });

  ipcMain.handle("reset-app", async () => {
    try {
      const sessions = [session.defaultSession, session.fromPartition("persist:player"), session.fromPartition("persist:trailer")];
      await Promise.all(sessions.map((item) => item.clearStorageData()));
      await Promise.all(sessions.map((item) => item.clearCache()));
      await resetAppData();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
}

module.exports = { register };
