// ── Orion — Electron Main Process ─────────────────────────────────────────────
// Responsible for: window creation, session setup, ad-blocking, scheduled
// backup trigger, picture-in-picture, and app lifecycle. All heavy IPC logic
// lives in src/ipc/.

const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  webContents,
  dialog,
} = require("electron");

// Playwright and recovery launches pass this as an application argument (after
// the Electron entry point), so Chromium does not consume it automatically.
// Apply it explicitly before ready to keep headless Windows runs deterministic.
if (process.argv.includes("--disable-gpu")) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("in-process-gpu");
}

/* ORION_PLAYER_RUNTIME_SWITCHES */
try {
  app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
  app.commandLine.appendSwitch("force-webrtc-ip-handling-policy", "disable_non_proxied_udp");
} catch {}
const path = require("path");
const ROOT_DIR = path.join(__dirname, "..", "..");

// ── Performance flags ────────────────────────────────────────────────────────
app.commandLine.appendSwitch(
  "js-flags",
  "--max-old-space-size=256 --expose-gc",
);
app.commandLine.appendSwitch(
  "disable-features",
  "UseSandboxedXdgPortal",
);
app.commandLine.appendSwitch("enable-features", "NetworkServiceInProcess2");
app.commandLine.appendSwitch("disk-cache-size", String(80 * 1024 * 1024));
// Streaming webviews, the app shell, and a pop-out window need independent
// renderers. A limit of three caused the pop-out renderer to fail to launch.
app.commandLine.appendSwitch("renderer-process-limit", "8");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

// ── Sub-modules ──────────────────────────────────────────────────────────────
const blockStats = require("./ipc/blockStatsIpc");
const storageIpc = require("./ipc/storageIpc");
const downloadsIpc = require("./downloader/ipc");
const subtitlesIpc = require("./subtitles/ipc");
const allmangaIpc = require("./player/allmanga/ipc");
const playerIpc = require("./player/ipc");
const diagnosticsIpc = require("./ipc/diagnosticsIpc");
const googleAuthIpc = require("./ipc/googleAuthIpc");
const { createTrayController } = require("./app/tray");
const { registerNotifications } = require("./app/notifications");
const { createPopoutWindowController } = require("./player/popoutWindow");
const localMedia = require("./player/localMedia");
const ambientSampler = require("./player/ambientSampler");
const cinemaSourceHealthIpc = require("./player/sources/ipc");
const { createBatteryService } = require("./battery/service");
const { createPerformanceCoordinator } = require("./performance/coordinator");
const { createMediaControls } = require("./player/mediaControls");
const music = require("./music");
localMedia.registerScheme();
music.registerScheme();

// ── Session Manager ──────────────────────────────────────────────────────────
const { setupSession } = require("./player/sessionManager");
const { bindWebContentsToActive } = require("./downloader/streamCandidates");

// ── Module-level state ────────────────────────────────────────────────────────
let mainWindow = null;
const getMainWindow = () => mainWindow;

let closeBehavior = "ask"; // "ask" | "tray" | "quit"

const playerWcIds = new Set();
let sessionsConfigured = false;

const trayController = createTrayController({
  rootDir: ROOT_DIR,
  downloads: downloadsIpc,
  getMainWindow,
});

const batteryService = createBatteryService({
  getMainWindow,
  downloads: downloadsIpc,
  tray: trayController,
});
const performanceCoordinator = createPerformanceCoordinator({
  getMainWindow,
  getBatteryStatus: () => ({
    ...batteryService.getStatus(),
    optimizationEnabled: batteryService.getPreferences().automaticOptimization,
  }),
  downloads: downloadsIpc,
});
const mediaControls = createMediaControls({
  getMainWindow,
  getPopoutController: () => popoutController,
});

function ensurePlayerSessions() {
  if (sessionsConfigured) return;
  sessionsConfigured = true;
  const playerSession = session.fromPartition("persist:player");
  const trailerSession = session.fromPartition("persist:trailer");
  setupSession(playerSession, trailerSession, getMainWindow);
}

const popoutController = createPopoutWindowController({
  rootDir: ROOT_DIR,
  getMainWindow,
  ensurePlayerSessions,
  setMiniPlayerStatus: trayController.setMiniPlayerStatus,
  getPerformanceTier: () => performanceCoordinator.getSnapshot()?.tier || "balanced",
});

if (process.platform === "win32") {
  app.setAppUserModelId("com.orion.multiverse");
}

function createWindow() {
  storageIpc.applySecretMigrationIfNeeded();
  downloadsIpc.loadDownloads();
  blockStats.loadBlockStats();
  trayController.create();
  trayController.startDownloadMonitor();



  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 940,
    minHeight: 560,
    backgroundColor: "#0a0a0f",
    icon: app.isPackaged
  ? path.join(process.resourcesPath, "icon.png")
  : path.join(ROOT_DIR, "public", "icon.png"),
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    frame: process.platform !== "win32",
    webPreferences: {
      preload: path.join(ROOT_DIR, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // The preload is intentionally split across local CommonJS modules. Electron's
      // sandboxed preload loader cannot require those modules, which leaves
      // `window.electron` undefined. The renderer remains isolated and has no Node
      // access; disabling only the preload sandbox restores the typed IPC bridge.
      sandbox: false,
      webviewTag: true,
      backgroundThrottling: true,
      spellcheck: false,
      additionalArguments: ["--js-flags=--max-old-space-size=256 --expose-gc"],
    },
  });

  const publishMaximizedState = (maximized) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("window-maximized", maximized);
    }
  };
  mainWindow.on("maximize", () => publishMaximizedState(true));
  mainWindow.on("unmaximize", () => publishMaximizedState(false));
  mainWindow.on("enter-full-screen", () => publishMaximizedState(true));
  mainWindow.on("leave-full-screen", () => publishMaximizedState(false));

  // Force long-lived disk caching for TMDB images in the default session.
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["*://image.tmdb.org/*"] },
    (details, callback) => {
      const headers = { ...details.responseHeaders };
      headers["cache-control"] = ["public, max-age=604800, immutable"]; // 7 days
      delete headers["pragma"];
      delete headers["expires"];
      callback({ responseHeaders: headers });
    },
  );

  // Block popups from webviews, intercept fullscreen, lazy-init sessions
  mainWindow.webContents.on("did-attach-webview", (_, wc) => {


    ensurePlayerSessions();

    try {
      if (wc.session === session.fromPartition("persist:player")) {
        bindWebContentsToActive(wc.id);
        playerWcIds.add(wc.id);
        wc.once("destroyed", () => playerWcIds.delete(wc.id));

        // Consistent YouTube-style keyboard controls inside sandboxed player webviews.
        wc.on("before-input-event", async (event, input) => {
          if (input.type === "keyDown") {
            const key = input.key.toLowerCase();
            const hostCommand = input.shift && key === "n"
              ? "next"
              : input.shift && key === "p"
                ? "previous"
                : key === "i"
                  ? "mini"
                  : null;
            if (hostCommand) {
              event.preventDefault();
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("player-shortcut", hostCommand);
              }
              return;
            }
            if (
              key === " " ||
              key === "k" ||
              key === "j" ||
              key === "l" ||
              key === "arrowleft" ||
              key === "arrowright" ||
              key === "arrowup" ||
              key === "arrowdown" ||
              key === "home" ||
              key === "end" ||
              /^[0-9]$/.test(key) ||
              key === "c" ||
              key === ">" ||
              key === "<" ||
              key === "f" ||
              key === "m"
            ) {
              event.preventDefault();
              const JS = `
                (() => {
                  const v = document.querySelector('video');
                  if (!v) return false;
                  const key = "${key}";
                  if (key === " " || key === "k") {
                    if (v.paused) v.play(); else v.pause();
                  } else if (key === "arrowleft" || key === "j") {
                    v.currentTime = Math.max(0, v.currentTime - 10);
                  } else if (key === "arrowright" || key === "l") {
                    v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10);
                  } else if (key === "arrowup") {
                    v.volume = Math.min(1, v.volume + 0.1);
                  } else if (key === "arrowdown") {
                    v.volume = Math.max(0, v.volume - 0.1);
                  } else if (key === "home" || key === "0") {
                    v.currentTime = 0;
                  } else if (key === "end") {
                    v.currentTime = Math.max(0, (v.duration || 0) - 0.25);
                  } else if (/^[1-9]$/.test(key) && Number.isFinite(v.duration)) {
                    v.currentTime = v.duration * (Number(key) / 10);
                  } else if (key === ">") {
                    v.playbackRate = Math.min(2, Math.round((v.playbackRate + 0.25) * 4) / 4);
                  } else if (key === "<") {
                    v.playbackRate = Math.max(0.25, Math.round((v.playbackRate - 0.25) * 4) / 4);
                  } else if (key === "c") {
                    const tracks = Array.from(v.textTracks || []);
                    const showing = tracks.some((track) => track.mode === "showing");
                    tracks.forEach((track, index) => { track.mode = !showing && index === 0 ? "showing" : "disabled"; });
                  } else if (key === "f") {
                    if (document.fullscreenElement) {
                      document.exitFullscreen().catch(() => {});
                    } else {
                      document.documentElement.requestFullscreen().catch(() => {});
                    }
                  } else if (key === "m") {
                    v.muted = !v.muted;
                  }
                  return true;
                })()
              `;

              const allFrames = [];
              const collect = (frame) => {
                allFrames.push(frame);
                for (const child of frame.frames || []) collect(child);
              };
              collect(wc.mainFrame);

              for (const frame of allFrames) {
                try {
                  const handled = await frame.executeJavaScript(JS);
                  if (handled) break;
                } catch {}
              }
            }
          }
        });
      }
    } catch {}

    wc.setWindowOpenHandler(() => ({ action: "deny" }));
    wc.on("enter-html-full-screen", () =>
      mainWindow.webContents.send("webview-enter-fullscreen"),
    );
    wc.on("leave-html-full-screen", () =>
      mainWindow.webContents.send("webview-leave-fullscreen"),
    );
  });

  // Load the Vite build output
  mainWindow.loadFile(path.join(ROOT_DIR, "dist", "index.html"));

  // Trigger scheduled backup after load
  mainWindow.webContents.once("did-finish-load", () => {
    const sbSettings = storageIpc.loadScheduledBackupSettings();
    if (storageIpc.shouldRunScheduledBackup(sbSettings)) {
      mainWindow.webContents.send("scheduled-backup-requested");
    }
  });

  // Intercept close if downloads or mini-player are active
  mainWindow.on("close", (e) => {
    if (app.isQuiting) return;

    const running = downloadsIpc
      .getDownloads()
      .filter((d) => ["queued", "preflighting", "downloading", "processing"].includes(d.status));

    // Case 1: Active downloads running
    if (running.length > 0) {
      e.preventDefault();
      mainWindow.hide();
      trayController.updateDownloadSurfaces(true);
      trayController.showBalloonOnce(
        "Downloads continue in the background",
        `${running.length} download${running.length === 1 ? " is" : "s are"} still active. Hover or right-click the Orion tray icon for progress and controls.`,
      );
      return;
    }

    // Case 2: Mini-player is active (background tray streaming)
    if (trayController.isMiniPlayerActive()) {
      if (closeBehavior === "tray") {
        e.preventDefault();
        mainWindow.hide();
        trayController.showBalloonOnce();
        return;
      }

      if (closeBehavior === "quit") {
        // Let normal quit happen
        app.isQuiting = true;
        downloadsIpc.killAllDownloads();
        popoutController.close();
        app.quit();
        return;
      }

      // closeBehavior === "ask"
      e.preventDefault();
      const isPopout = popoutController.isOpen();
      dialog.showMessageBox(mainWindow, {
        type: "question",
        buttons: ["Minimize to Tray", "Quit Orion", "Cancel"],
        defaultId: 0,
        title: "Orion Media Player",
        message: isPopout
          ? "Orion is currently streaming in a pop-out window."
          : "Orion is currently streaming in a mini-player.",
        detail: "Would you like to keep streaming in the background (system tray) or close the application?",
        checkboxLabel: "Remember my choice",
        checkboxChecked: false,
      }).then((result) => {
        const { response, checkboxChecked } = result;
        if (response === 0) { // Minimize to Tray
          if (checkboxChecked) {
            closeBehavior = "tray";
            mainWindow.webContents.send("update-close-behavior", "tray");
          }
          mainWindow.hide();
          trayController.showBalloonOnce();
        } else if (response === 1) { // Quit Orion
          if (checkboxChecked) {
            closeBehavior = "quit";
            mainWindow.webContents.send("update-close-behavior", "quit");
          }
          app.isQuiting = true;
          downloadsIpc.killAllDownloads();
          popoutController.close();
          app.quit();
        }
      });
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    app.quit();
  });
}

// ── Register all IPC modules ──────────────────────────────────────────────────
storageIpc.register();
googleAuthIpc.register();
downloadsIpc.register(getMainWindow, {
  resetSettingsData: storageIpc.resetStoredSettings,
});
subtitlesIpc.register({
  getDownloads: downloadsIpc.getDownloads,
  saveDownloads: downloadsIpc.saveDownloads,
});
allmangaIpc.register();
playerIpc.register(getMainWindow, {
  writeSecretMigration: storageIpc.writeSecretMigration,
});
ambientSampler.register(
  getMainWindow,
  () => performanceCoordinator.getSnapshot()?.tier || "balanced",
);
blockStats.init(getMainWindow);
diagnosticsIpc.register({
  getDownloads: downloadsIpc.getDownloads,
  getPlayerWebContentsCount: () => playerWcIds.size,
});

ipcMain.on("mini-player-status", (_, status) => {
  trayController.setMiniPlayerStatus(status);
});

// Retained as a no-op compatibility channel for v1.0.8 renderer/preload clients.
ipcMain.on("log-to-terminal", () => {});

ipcMain.on("set-close-behavior", (_, behavior) => {
  closeBehavior = behavior;
});

app.on("will-quit", () => {
  localMedia.clear();
  music.stop().catch(() => {});
  ambientSampler.clear();
  trayController.destroy();
  batteryService.destroy();
  performanceCoordinator.destroy();
  mediaControls.destroy();
});

app.on("before-quit", () => {
  app.isQuiting = true;
  downloadsIpc.killAllDownloads();
});

ipcMain.handle("get-block-stats", () => blockStats.getBlockStats());
ipcMain.handle("get-blocked-stats", () => blockStats.getBlockStats());

// ── Player memory cleanup ─────────────────────────────────────────────
ipcMain.on("player-stopped", () => {
  for (const id of playerWcIds) {
    try {
      const wc = webContents.fromId(id);
      if (wc && !wc.isDestroyed()) {
        try {
          wc.setAudioMuted(true);
        } catch {}
        wc.destroy();
      }
    } catch {}
  }
  playerWcIds.clear();

  try {
    const ps = session.fromPartition("persist:player");
    ps.clearCache().catch(() => {});
    ps.clearStorageData({ storages: ["shadercache", "cachestorage"] }).catch(
      () => {},
    );
  } catch {}

  if (typeof global.gc === "function") global.gc();
  const mw = mainWindow;
  if (mw && !mw.isDestroyed()) {
    mw.webContents
      .executeJavaScript("if(typeof gc==='function') gc();")
      .catch(() => {});
  }
});

registerNotifications();
popoutController.register();
// ── Single-instance lock ──────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    trayController.showMainWindow();
  });

  app.whenReady().then(() => {
    cinemaSourceHealthIpc.register();
    batteryService.register();
    performanceCoordinator.register();
    mediaControls.register();
    localMedia.register({ getDownloads: downloadsIpc.getDownloads, saveDownloads: downloadsIpc.saveDownloads });
    music.register().catch((error) => console.error("[music] startup failed", error));
    createWindow();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("activate", () => {
    if (mainWindow === null) createWindow();
  });
}
