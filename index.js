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
  Notification,
  Tray,
  Menu,
  dialog,
  nativeImage,
} = require("electron");

/* ORION_PLAYER_RUNTIME_SWITCHES */
try {
  app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
  app.commandLine.appendSwitch("force-webrtc-ip-handling-policy", "disable_non_proxied_udp");
} catch {}
const path = require("path");

// ── Performance flags ────────────────────────────────────────────────────────
app.commandLine.appendSwitch(
  "js-flags",
  "--max-old-space-size=256 --expose-gc",
);
app.commandLine.appendSwitch(
  "disable-features",
  "HardwareMediaKeyHandling,MediaSessionService,UseSandboxedXdgPortal",
);
app.commandLine.appendSwitch("enable-features", "NetworkServiceInProcess2");
app.commandLine.appendSwitch("disk-cache-size", String(80 * 1024 * 1024));
app.commandLine.appendSwitch("renderer-process-limit", "3");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

// ── Sub-modules ──────────────────────────────────────────────────────────────
const blockStats = require("./src/ipc/blockStats");
const storageIpc = require("./src/ipc/storage");
const downloadsIpc = require("./src/ipc/downloads");
const subtitlesIpc = require("./src/ipc/subtitles");
const allmangaIpc = require("./src/ipc/allmanga");
const playerIpc = require("./src/ipc/player");
const diagnosticsIpc = require("./src/ipc/diagnostics");

// ── Session Manager ──────────────────────────────────────────────────────────
const { setupSession } = require("./src/main/sessionManager");

// ── Module-level state ────────────────────────────────────────────────────────
let mainWindow = null;
const getMainWindow = () => mainWindow;

let tray = null;
let miniPlayerActive = false;
let miniPlayerTitle = "";
let closeBehavior = "ask"; // "ask" | "tray" | "quit"
let shownTrayBalloon = false;

const playerWcIds = new Set();
let sessionsConfigured = false;

if (process.platform === "win32") {
  app.setAppUserModelId("com.orion.multiverse");
}


function createTray() {
  if (tray) return;

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "public", "icon.png");

  const trayIcon = nativeImage.createFromPath(iconPath);

  if (trayIcon.isEmpty()) {
    console.error("Tray icon failed to load:", iconPath);
    return;
  }

  try {
    tray = new Tray(trayIcon);
  } catch (error) {
    console.error("Failed to create tray:", error);
    return;
  }

  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send("tray-restore-window");
    }
  });

  updateTrayMenu();
}
function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Orion",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send("tray-restore-window");
        }
      },
    },
    { type: "separator" },
    {
      label: miniPlayerActive
        ? `Now Playing: ${miniPlayerTitle}`
        : "Orion: No Stream Active",
      enabled: false,
    },
    {
      label: "Stop Playback",
      enabled: miniPlayerActive,
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send("stop-mini-player");
        }

        miniPlayerActive = false;
        updateTrayMenu();
      },
    },
    { type: "separator" },
    {
      label: "Quit Orion",
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Orion Media Player");
  tray.setContextMenu(contextMenu);
}

function createWindow() {
  storageIpc.applySecretMigrationIfNeeded();
  downloadsIpc.loadDownloads();
  blockStats.loadBlockStats();
  createTray();



  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 940,
    minHeight: 560,
    backgroundColor: "#0a0a0f",
    icon: app.isPackaged
  ? path.join(process.resourcesPath, "icon.png")
  : path.join(__dirname, "public", "icon.png"),
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    frame: process.platform !== "win32",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      backgroundThrottling: true,
      spellcheck: false,
      additionalArguments: ["--js-flags=--max-old-space-size=256 --expose-gc"],
    },
  });

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


    if (!sessionsConfigured) {
      sessionsConfigured = true;
      const playerSession = session.fromPartition("persist:player");
      const trailerSession = session.fromPartition("persist:trailer");
      setupSession(playerSession, trailerSession, getMainWindow);
    }

    try {
      if (wc.session === session.fromPartition("persist:player")) {
        playerWcIds.add(wc.id);
        wc.once("destroyed", () => playerWcIds.delete(wc.id));

        // Inject custom keyboard hotkeys (Space, Arrows, F, M) inside sandboxed player webview
        wc.on("before-input-event", async (event, input) => {
          if (input.type === "keyDown") {
            const key = input.key.toLowerCase();
            if (
              key === " " ||
              key === "arrowleft" ||
              key === "arrowright" ||
              key === "arrowup" ||
              key === "arrowdown" ||
              key === "f" ||
              key === "m"
            ) {
              event.preventDefault();
              const JS = `
                (() => {
                  const v = document.querySelector('video');
                  if (!v) return false;
                  const key = "${key}";
                  if (key === " ") {
                    if (v.paused) v.play(); else v.pause();
                  } else if (key === "arrowleft") {
                    v.currentTime = Math.max(0, v.currentTime - 10);
                  } else if (key === "arrowright") {
                    v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10);
                  } else if (key === "arrowup") {
                    v.volume = Math.min(1, v.volume + 0.1);
                  } else if (key === "arrowdown") {
                    v.volume = Math.max(0, v.volume - 0.1);
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
  mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));

  // Trigger scheduled backup after load
  mainWindow.webContents.once("did-finish-load", () => {
    const sbSettings = storageIpc.loadScheduledBackupSettings();
    if (storageIpc.shouldRunScheduledBackup(sbSettings)) {
      mainWindow.webContents.send("scheduled-backup-requested");
    }
  });

  // Intercept close if downloads or mini-player are active
  let closeResponsePending = false;
  mainWindow.on("close", (e) => {
    if (app.isQuiting) return;

    const running = downloadsIpc
      .getDownloads()
      .filter((d) => d.status === "downloading");

    // Case 1: Active downloads running
    if (running.length > 0) {
      e.preventDefault();
      if (closeResponsePending) return;
      closeResponsePending = true;
      mainWindow.webContents.send("confirm-close", { count: running.length });
      return;
    }

    // Case 2: Mini-player is active (background tray streaming)
    if (miniPlayerActive) {
      if (closeBehavior === "tray") {
        e.preventDefault();
        mainWindow.hide();
        showTrayBalloonOnce();
        return;
      }

      if (closeBehavior === "quit") {
        // Let normal quit happen
        app.isQuiting = true;
        downloadsIpc.killAllDownloads();
        if (pipWindow && !pipWindow.isDestroyed()) pipWindow.close();
        app.quit();
        return;
      }

      // closeBehavior === "ask"
      e.preventDefault();
      const isPopout = pipWindow && !pipWindow.isDestroyed();
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
          showTrayBalloonOnce();
        } else if (response === 1) { // Quit Orion
          if (checkboxChecked) {
            closeBehavior = "quit";
            mainWindow.webContents.send("update-close-behavior", "quit");
          }
          app.isQuiting = true;
          downloadsIpc.killAllDownloads();
          if (pipWindow && !pipWindow.isDestroyed()) pipWindow.close();
          app.quit();
        }
      });
    }
  });

  ipcMain.on("close-response", (_, confirmed) => {
    closeResponsePending = false;
    if (confirmed) {
      app.isQuiting = true;
      downloadsIpc.killAllDownloads();
      mainWindow.destroy();
      app.quit();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    app.quit();
  });
}

// ── Register all IPC modules ──────────────────────────────────────────────────
storageIpc.register();
downloadsIpc.register(getMainWindow);
subtitlesIpc.register({
  getDownloads: downloadsIpc.getDownloads,
  saveDownloads: downloadsIpc.saveDownloads,
});
allmangaIpc.register();
playerIpc.register(getMainWindow, {
  writeSecretMigration: storageIpc.writeSecretMigration,
});
blockStats.init(getMainWindow);
diagnosticsIpc.register({
  getDownloads: downloadsIpc.getDownloads,
  getPlayerWebContentsCount: () => playerWcIds.size,
});

ipcMain.on("mini-player-status", (_, status) => {
  miniPlayerActive = status.active;
  miniPlayerTitle = status.title || "";
  updateTrayMenu();
});

ipcMain.on("log-to-terminal", (_, msg) => {
  console.log("[Renderer Log]", msg);
});

ipcMain.on("set-close-behavior", (_, behavior) => {
  closeBehavior = behavior;
});

app.on("will-quit", () => {
  if (tray) tray.destroy();
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

// ── Desktop notifications ─────────────────────────────────────────────────────
ipcMain.handle(
  "show-notification",
  (_event, { title, body, silent = false }) => {
    try {
      if (!Notification.isSupported()) return;
      const n = new Notification({
        title: String(title),
        body: String(body),
        silent,
      });
      n.show();
    } catch {}
  },
);

// ── Picture-in-Picture / Pop-Out window ──────────────────────────────────────
let pipWindow = null;
const getPipWindow = () => pipWindow;

ipcMain.handle("open-pip-window", (_, { url, title }) => {
  if (!url || url === "about:blank") return { ok: false, reason: "no-url" };

  if (!sessionsConfigured) {
    sessionsConfigured = true;
    const playerSession = session.fromPartition("persist:player");
    const trailerSession = session.fromPartition("persist:trailer");
    setupSession(playerSession, trailerSession, getMainWindow);
  }

  if (pipWindow && !pipWindow.isDestroyed()) {
    pipWindow.loadURL(url);
    pipWindow.focus();
    return { ok: true };
  }

  pipWindow = new BrowserWindow({
    width: 640,
    height: 360,
    minWidth: 320,
    minHeight: 180,
    alwaysOnTop: true,
    title: title ? `${title} - Pop-out` : "Pop-out Player",
    backgroundColor: "#000000",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    frame: process.platform !== "win32",
    webPreferences: {
      partition: "persist:player",
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "popout-preload.js"),
    },
  });

  pipWindow.setAlwaysOnTop(true, "screen-saver");
  pipWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const injectPopoutCSS = (wc) => {
    const css = `
      video::cue {
        background: rgba(0, 0, 0, 0.75) !important;
        color: #ffffff !important;
        font-family: sans-serif !important;
      }
      .jw-captions, .jw-caption-text,
      .vjs-text-track-display, .vjs-text-track-cue,
      .plyr__captions, .plyr__caption,
      .art-subtitles, .art-subtitle,
      .shaka-text-container, .shaka-text-region,
      .dplayer-subtitles, .dplayer-subtitle,
      [class*="caption"], [class*="subtitle"], [class*="cue"] {
        transform: translateY(0) !important;
        margin-bottom: 0 !important;
        display: block !important;
      }
      @media (max-height: 450px) {
        video::cue { font-size: 12px !important; }
        .jw-captions, .jw-caption-text,
        .vjs-text-track-display, .vjs-text-track-cue,
        .plyr__captions, .plyr__caption,
        .art-subtitles, .art-subtitle,
        .shaka-text-container, .shaka-text-region,
        .dplayer-subtitles, .dplayer-subtitle,
        [class*="caption"], [class*="subtitle"], [class*="cue"] {
          bottom: 20px !important;
          font-size: 11px !important;
        }
      }
      @media (min-height: 451px) and (max-height: 750px) {
        video::cue { font-size: 16px !important; }
        .jw-captions, .jw-caption-text,
        .vjs-text-track-display, .vjs-text-track-cue,
        .plyr__captions, .plyr__caption,
        .art-subtitles, .art-subtitle,
        .shaka-text-container, .shaka-text-region,
        .dplayer-subtitles, .dplayer-subtitle,
        [class*="caption"], [class*="subtitle"], [class*="cue"] {
          bottom: 35px !important;
          font-size: 14px !important;
        }
      }
      @media (min-height: 751px) {
        video::cue { font-size: 20px !important; }
        .jw-captions, .jw-caption-text,
        .vjs-text-track-display, .vjs-text-track-cue,
        .plyr__captions, .plyr__caption,
        .art-subtitles, .art-subtitle,
        .shaka-text-container, .shaka-text-region,
        .dplayer-subtitles, .dplayer-subtitle,
        [class*="caption"], [class*="subtitle"], [class*="cue"] {
          bottom: 45px !important;
          font-size: 18px !important;
        }
      }
    `;
    wc.insertCSS(css).catch(() => {});
  };

  pipWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  pipWindow.webContents.on("did-attach-webview", (_, wc) => {
    wc.setWindowOpenHandler(() => ({ action: "deny" }));
    wc.on("dom-ready", () => injectPopoutCSS(wc));
  });

  pipWindow.webContents.on("did-finish-load", () => {
    injectPopoutCSS(pipWindow.webContents);
  });

  pipWindow.loadURL(url);

  pipWindow.on("maximize", () => {
    if (!pipWindow.isDestroyed())
      pipWindow.webContents.send("popout-window-maximized", true);
  });
  pipWindow.on("unmaximize", () => {
    if (!pipWindow.isDestroyed())
      pipWindow.webContents.send("popout-window-maximized", false);
  });

  const notifyMain = (channel) => {
    const mw = getMainWindow();
    if (mw && !mw.isDestroyed()) mw.webContents.send(channel);
  };

  pipWindow.on("closed", () => {
    pipWindow = null;
    notifyMain("pip-window-closed");
    miniPlayerActive = false;
    miniPlayerTitle = "";
    updateTrayMenu();
  });

  miniPlayerActive = true;
  miniPlayerTitle = title || "Pop-out Stream";
  updateTrayMenu();

  notifyMain("pip-window-opened");
  return { ok: true };
});

ipcMain.handle("close-pip-window", () => {
  if (pipWindow && !pipWindow.isDestroyed()) pipWindow.close();
});

ipcMain.handle("get-pip-webcontents-id", () => {
  if (pipWindow && !pipWindow.isDestroyed()) return pipWindow.webContents.id;
  return null;
});

// ── Popout window controls (used by popout-preload.js title bar buttons) ─────
ipcMain.handle("popout-window-minimize", () => {
  if (pipWindow && !pipWindow.isDestroyed()) pipWindow.minimize();
});
ipcMain.handle("popout-window-toggle-maximize", () => {
  if (!pipWindow || pipWindow.isDestroyed()) return;
  if (pipWindow.isMaximized()) pipWindow.unmaximize();
  else pipWindow.maximize();
});
ipcMain.handle("popout-window-close", () => {
  if (pipWindow && !pipWindow.isDestroyed()) pipWindow.close();
});
ipcMain.handle("popout-window-is-maximized", () => {
  return pipWindow && !pipWindow.isDestroyed()
    ? pipWindow.isMaximized()
    : false;
});

// ── Single-instance lock ──────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("activate", () => {
    if (mainWindow === null) createWindow();
  });
}

