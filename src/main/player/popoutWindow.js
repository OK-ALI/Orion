const path = require("path");
const { BrowserWindow, ipcMain } = require("electron");

const POPOUT_CSS = `
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

function createPopoutWindowController({
  rootDir,
  getMainWindow,
  ensurePlayerSessions,
  setMiniPlayerStatus,
}) {
  let popoutWindow = null;
  let activePlayback = null;
  let closeSnapshotReady = false;

  const isOpen = () => Boolean(popoutWindow && !popoutWindow.isDestroyed());
  const close = () => {
    if (isOpen()) popoutWindow.close();
  };
  const notifyMain = (channel, payload) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
  };
  const injectCss = (contents) => contents.insertCSS(POPOUT_CSS).catch(() => {});
  const buildLoadUrl = (url, state) => {
    if (!String(url).startsWith("orion-media://")) return url;
    const safeUrl = String(url).replaceAll("&", "&amp;").replaceAll('"', "&quot;");
    const tracks = (state?.orionContext?.subtitles || [])
      .filter((item) => String(item?.url || "").startsWith("orion-media://"))
      .map((item, index) => `<track kind="subtitles" src="${String(item.url).replaceAll("&", "&amp;").replaceAll('"', "&quot;")}" srclang="${String(item.lang || "en").replace(/[^a-z-]/gi, "")}" label="${String(item.lang || `Subtitle ${index + 1}`).replaceAll('"', "&quot;")}" ${index === 0 ? "default" : ""}>`)
      .join("");
    const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}video{width:100%;height:100%;object-fit:contain}</style><video src="${safeUrl}" autoplay controls playsinline>${tracks}</video>`;
    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  };

  const restoreState = async (contents, state) => {
    if (!state || !contents || contents.isDestroyed()) return;
    const safe = JSON.stringify({
      currentTime: Math.max(0, Number(state.currentTime) || 0),
      volume: Math.max(0, Math.min(1, Number(state.volume ?? 1))),
      muted: Boolean(state.muted),
      paused: Boolean(state.paused),
    });
    const script = `(() => {
      const v = document.querySelector('video');
      if (!v) return false;
      const s = ${safe};
      const apply = () => {
        if (s.currentTime > 0) { try { v.currentTime = s.currentTime; } catch {} }
        v.volume = s.volume; v.muted = s.muted;
        if (s.paused) v.pause(); else v.play().catch(() => {});
      };
      if (v.readyState >= 1) apply(); else v.addEventListener('loadedmetadata', apply, { once: true });
      return true;
    })()`;
    const frames = [contents.mainFrame];
    for (let i = 0; i < frames.length; i += 1) frames.push(...(frames[i].frames || []));
    for (const frame of frames) {
      try {
        if (await frame.executeJavaScript(script)) return;
      } catch {}
    }
  };

  const snapshotState = async () => {
    if (!isOpen()) return activePlayback?.state || null;
    const frames = [popoutWindow.webContents.mainFrame];
    for (let i = 0; i < frames.length; i += 1) frames.push(...(frames[i].frames || []));
    for (const frame of frames) {
      try {
        const result = await frame.executeJavaScript(`(() => { const v = document.querySelector('video'); return v ? { currentTime:v.currentTime||0, duration:v.duration||0, paused:v.paused, muted:v.muted, volume:v.volume } : null; })()`);
        if (result) return result;
      } catch {}
    }
    return activePlayback?.state || null;
  };

  const open = async (_event, { url, title, state }) => {
    if (!url || url === "about:blank") {
      return { ok: false, error: "The player has not produced a stream URL yet." };
    }
    ensurePlayerSessions();
    activePlayback = { url, title, state: state || null };
    closeSnapshotReady = false;

    if (isOpen()) {
      try {
        await popoutWindow.loadURL(buildLoadUrl(url, state));
        await restoreState(popoutWindow.webContents, state);
        popoutWindow.focus();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    }

    popoutWindow = new BrowserWindow({
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
        preload: path.join(rootDir, "popout-preload.js"),
      },
    });

    popoutWindow.setAlwaysOnTop(true, "screen-saver");
    popoutWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    popoutWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    popoutWindow.webContents.on("did-attach-webview", (_attachedEvent, contents) => {
      contents.setWindowOpenHandler(() => ({ action: "deny" }));
      contents.on("dom-ready", () => injectCss(contents));
    });
    popoutWindow.webContents.on("did-finish-load", () => {
      if (isOpen()) injectCss(popoutWindow.webContents);
    });
    popoutWindow.on("maximize", () => {
      if (isOpen()) popoutWindow.webContents.send("popout-window-maximized", true);
    });
    popoutWindow.on("unmaximize", () => {
      if (isOpen()) popoutWindow.webContents.send("popout-window-maximized", false);
    });
    popoutWindow.on("close", (event) => {
      if (closeSnapshotReady) return;
      event.preventDefault();
      snapshotState().then((snapshot) => {
        if (activePlayback) activePlayback.state = { ...activePlayback.state, ...snapshot };
        closeSnapshotReady = true;
        if (isOpen()) popoutWindow.close();
      }).catch(() => {
        closeSnapshotReady = true;
        if (isOpen()) popoutWindow.close();
      });
    });
    popoutWindow.on("closed", () => {
      const payload = activePlayback;
      popoutWindow = null;
      activePlayback = null;
      notifyMain("pip-window-closed", payload);
      setMiniPlayerStatus({ active: false, title: "" });
    });

    try {
      await popoutWindow.loadURL(buildLoadUrl(url, state));
      if (!isOpen()) return { ok: false, error: "The pop-out window was closed." };
      popoutWindow.show();
      await restoreState(popoutWindow.webContents, state);
      popoutWindow.focus();
      setMiniPlayerStatus({ active: true, title: title || "Pop-out Stream" });
      notifyMain("pip-window-opened");
      return { ok: true };
    } catch (error) {
      if (isOpen()) popoutWindow.close();
      return { ok: false, error: `Could not load the pop-out player: ${error.message}` };
    }
  };

  const register = () => {
    ipcMain.handle("open-pip-window", open);
    ipcMain.handle("close-pip-window", async () => {
      close();
      return { ok: true };
    });
    ipcMain.handle("get-pip-webcontents-id", () =>
      isOpen() ? popoutWindow.webContents.id : null,
    );
    ipcMain.handle("popout-window-minimize", () => {
      if (isOpen()) popoutWindow.minimize();
    });
    ipcMain.handle("popout-window-toggle-maximize", () => {
      if (!isOpen()) return;
      if (popoutWindow.isMaximized()) popoutWindow.unmaximize();
      else popoutWindow.maximize();
    });
    ipcMain.handle("popout-window-close", async () => {
      close();
      return { ok: true };
    });
    ipcMain.handle("popout-window-is-maximized", () =>
      isOpen() ? popoutWindow.isMaximized() : false,
    );
  };

  return { close, isOpen, register };
}

module.exports = { createPopoutWindowController };
