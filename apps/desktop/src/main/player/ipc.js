// ── IPC: Player launch, window controls, auto-updater ─────────────────────────

const { ipcMain, shell, app, session } = require("electron");
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const {
  collectFrames,
  executeOnVideo,
  findPrimaryVideo,
  qualifyUserSeek,
} = require("./videoTargeting");
const { createPointerInputRouter } = require("./pointerInput");
const { setVoiceBoost } = require("./voiceBoost");

function register(getMainWindow, { getPopoutController } = {}) {
  const { webContents } = require("electron");
  const pointerInput = createPointerInputRouter({
    getMainWindow,
    resolveWebContentsById: (id) => webContents.fromId(Number(id)),
    isTrustedDetachedTarget: (sender, target) => {
      const mainWindow = getMainWindow?.();
      if (!mainWindow || mainWindow.isDestroyed?.() || mainWindow.webContents?.id !== sender?.id) {
        return false;
      }
      return Boolean(getPopoutController?.()?.ownsWebContents?.(target));
    },
  });

  ipcMain.on("player:pointer-move", (event, payload) => {
    pointerInput.move(event.sender, payload);
  });
  ipcMain.handle("player:pointer-click", (event, payload) =>
    pointerInput.click(event.sender, payload),
  );
  ipcMain.handle("player:renderer-webcontents-id", (event) => event.sender.id);
  ipcMain.handle("player:voice-boost", async (event, webContentsId, enabled) => {
    const mainWindow = getMainWindow?.();
    const target = webContents.fromId(Number(webContentsId));
    if (!mainWindow || mainWindow.isDestroyed?.() || event.sender !== mainWindow.webContents
      || !target || target.isDestroyed?.()
      || target.hostWebContents?.id !== event.sender.id
      || target.session !== session.fromPartition("persist:player")) {
      return { ok: false, code: "player_closed" };
    }
    return setVoiceBoost(target, enabled === true);
  });
  ipcMain.handle(
    "open-path-at-time",
    (_, { filePath, seconds, subtitlePaths }) => {
      const sec = Math.floor(seconds || 0);
      const platform = process.platform;

      const resolveBin = (bin) => {
        if (path.isAbsolute(bin)) return fs.existsSync(bin) ? bin : null;
        const whichCmd = platform === "win32" ? "where" : "which";
        try {
          const result = spawnSync(whichCmd, [bin], { encoding: "utf8" });
          if (result.status === 0 && result.stdout.trim()) {
            return result.stdout.trim().split("\n")[0].trim();
          }
        } catch {}
        return null;
      };

      const tryLaunch = (bin, args) => {
        const resolved = resolveBin(bin);
        if (!resolved) return false;
        try {
          spawn(resolved, args, { detached: true, stdio: "ignore" }).unref();
          return true;
        } catch {
          return false;
        }
      };

      const vlcPaths =
        platform === "win32"
          ? [
              "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe",
              "C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe",
              "vlc",
            ]
          : platform === "darwin"
            ? ["/Applications/VLC.app/Contents/MacOS/VLC", "vlc"]
            : ["/usr/bin/vlc", "/usr/local/bin/vlc", "/snap/bin/vlc", "vlc"];

      const mpvPaths =
        platform === "win32"
          ? ["mpv", "C:\\Program Files\\mpv\\mpv.exe"]
          : platform === "darwin"
            ? ["/opt/homebrew/bin/mpv", "/usr/local/bin/mpv", "mpv"]
            : ["/usr/bin/mpv", "/usr/local/bin/mpv", "/snap/bin/mpv", "mpv"];

      const subFilePaths = Array.isArray(subtitlePaths)
        ? subtitlePaths
            .map((sp) => (typeof sp === "string" ? sp : sp?.path))
            .filter((p) => p && fs.existsSync(p))
        : [];
      const mpvSubArgs = subFilePaths.map((p) => `--sub-file=${p}`);
      const vlcSubArgs =
        subFilePaths.length > 0 ? [`--sub-file=${subFilePaths[0]}`] : [];

      if (sec > 0) {
        for (const mpv of mpvPaths) {
          if (tryLaunch(mpv, [`--start=${sec}`, ...mpvSubArgs, filePath]))
            return;
        }
        for (const vlc of vlcPaths) {
          if (tryLaunch(vlc, [`--start-time=${sec}`, ...vlcSubArgs, filePath]))
            return;
        }
      } else if (mpvSubArgs.length > 0) {
        for (const mpv of mpvPaths) {
          if (tryLaunch(mpv, [...mpvSubArgs, filePath])) return;
        }
        for (const vlc of vlcPaths) {
          if (tryLaunch(vlc, [...vlcSubArgs, filePath])) return;
        }
      }

      shell.openPath(filePath);
    },
  );

  ipcMain.handle("window-minimize", () => {
    const mw = getMainWindow();
    if (mw && !mw.isDestroyed()) mw.minimize();
  });

  ipcMain.handle("window-toggle-maximize", () => {
    const mw = getMainWindow();
    if (!mw || mw.isDestroyed()) return;
    if (mw.isMaximized()) mw.unmaximize();
    else mw.maximize();
  });

  ipcMain.handle("window-toggle-fullscreen", () => {
    const mw = getMainWindow();
    if (!mw || mw.isDestroyed()) return { ok: false };
    mw.setFullScreen(!mw.isFullScreen());
    return { ok: true, fullscreen: mw.isFullScreen() };
  });

  ipcMain.handle("window-close", () => {
    const mw = getMainWindow();
    if (mw && !mw.isDestroyed()) mw.close();
  });

  ipcMain.handle("window-is-maximized", () => {
    const mw = getMainWindow();
    return mw ? mw.isMaximized() : false;
  });

  ipcMain.handle("quit-app", () => {
    const mw = getMainWindow();
    if (mw && !mw.isDestroyed()) mw.close();
  });

  ipcMain.handle("get-platform", () => process.platform);

  ipcMain.handle("get-video-duration", async (_, filePath) => {
    if (!filePath) return { ok: false };
    const platform = process.platform;

    const probePaths =
      platform === "win32"
        ? ["ffprobe", "C:\\ffmpeg\\bin\\ffprobe.exe"]
        : platform === "darwin"
          ? ["/opt/homebrew/bin/ffprobe", "/usr/local/bin/ffprobe", "ffprobe"]
          : ["/usr/bin/ffprobe", "/usr/local/bin/ffprobe", "ffprobe"];

    for (const probe of probePaths) {
      try {
        const result = spawnSync(
          probe,
          [
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            filePath,
          ],
          { encoding: "utf8", timeout: 8000 },
        );
        if (result.status === 0) {
          const secs = parseFloat(result.stdout.trim());
          if (!isNaN(secs) && secs > 0) return { ok: true, duration: secs };
        }
      } catch {}
    }

    const ffmpegPaths =
      platform === "win32"
        ? ["ffmpeg", "C:\\ffmpeg\\bin\\ffmpeg.exe"]
        : platform === "darwin"
          ? ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg"]
          : ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg"];

    for (const ff of ffmpegPaths) {
      try {
        const r = spawnSync(ff, ["-i", filePath], {
          encoding: "utf8",
          timeout: 8000,
        });
        const combined = (r.stdout || "") + (r.stderr || "");
        const m = combined.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
        if (m) {
          const secs =
            parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
          if (secs > 0) return { ok: true, duration: secs };
        }
      } catch {}
    }

    return { ok: false };
  });
  ipcMain.handle("query-video-progress", async (_, webContentsId, options) => {
    try {
      const { webContents } = require("electron");
      const wc = webContents.fromId(Number(webContentsId));
      if (!wc || wc.isDestroyed()) return null;

      const primary = await findPrimaryVideo(collectFrames(wc.mainFrame), {
        requireFiniteDuration: options?.controlReadiness !== true,
      });
      if (!primary) return null;

      const userSeek = qualifyUserSeek(primary);
      return {
        currentTime: primary.currentTime,
        duration: primary.finiteDuration ? primary.duration : null,
        paused: primary.paused,
        muted: primary.muted,
        volume: primary.volume,
        readyState: primary.readyState,
        controlReady: !primary.error && primary.readyState >= 2,
        playbackRate: primary.playbackRate,
        networkState: primary.networkState,
        bufferedAhead: primary.bufferedAhead,
        droppedFrames: primary.droppedFrames,
        recentUserSeek: userSeek.recentUserSeek,
        lastUserSeekTo: userSeek.lastUserSeekTo,
        lastPlaybackGestureAt: Number(primary.lastPlaybackGestureAt) || 0,
      };
    } catch {
      return null;
    }
  });

  ipcMain.handle("control-video", async (event, webContentsId, action, options) => {
    const { beginRemoteVideoOperation, cancelRemoteVideoOperation, remoteVideoScript } = require("./remoteVideoOperation");
    if (action === "cancelRemoteOperation") {
      cancelRemoteVideoOperation(event.sender.id, options?.id);
      return { ok: true };
    }
    const scripts = {
      toggle: `if (v.paused) { await v.play(); } else { v.pause(); }`,
      play: `await v.play();`,
      pause: `v.pause();`,
      mute: `v.muted = true;`,
      unmute: `v.muted = false;`,
      toggleMute: `v.muted = !v.muted;`,
      volumeUp: `v.muted = false; v.volume = Math.min(1, v.volume + 0.05);`,
      volumeDown: `v.volume = Math.max(0, v.volume - 0.05);`,
      seekBackward: `v._orionProgrammaticSeekUntil = Date.now() + 1500; v._orionProgrammaticSeekTarget = Math.max(0, (v.currentTime || 0) - 10); v.currentTime = v._orionProgrammaticSeekTarget; v._orionLastInteractiveSeekAt = Date.now(); v._orionLastInteractiveSeekTo = v.currentTime;`,
      seekForward: `v._orionProgrammaticSeekUntil = Date.now() + 1500; v._orionProgrammaticSeekTarget = Math.min(Number.isFinite(v.duration) ? v.duration : Infinity, (v.currentTime || 0) + 10); v.currentTime = v._orionProgrammaticSeekTarget; v._orionLastInteractiveSeekAt = Date.now(); v._orionLastInteractiveSeekTo = v.currentTime;`,
      restart: `v._orionProgrammaticSeekUntil = Date.now() + 1500; v._orionProgrammaticSeekTarget = 0; v.currentTime = 0; v._orionLastInteractiveSeekAt = Date.now(); v._orionLastInteractiveSeekTo = 0; await v.play();`,
      toggleSubtitles: `
        if (v.textTracks && v.textTracks.length) {
          const visible = Array.from(v.textTracks).some((track) => track.mode === 'showing');
          Array.from(v.textTracks).forEach((track, index) => {
            track.mode = visible ? 'disabled' : (index === 0 ? 'showing' : 'disabled');
          });
        }
      `,
    };

    let selectedScript = scripts[action];
    if (String(action).startsWith("intentSeek:")) {
      const seconds = Number(String(action).slice(11));
      if (Number.isFinite(seconds)) {
        selectedScript = `v._orionProgrammaticSeekUntil = Date.now() + 1500; v._orionProgrammaticSeekTarget = Math.max(0, Math.min(Number.isFinite(v.duration) ? v.duration : ${seconds}, ${seconds})); v.currentTime = v._orionProgrammaticSeekTarget;`;
      }
    } else if (String(action).startsWith("seek:")) {
      const seconds = Number(String(action).slice(5));
      if (Number.isFinite(seconds)) {
        selectedScript = `v._orionProgrammaticSeekUntil = Date.now() + 1500; v._orionProgrammaticSeekTarget = Math.max(0, Math.min(Number.isFinite(v.duration) ? v.duration : ${seconds}, ${seconds})); v.currentTime = v._orionProgrammaticSeekTarget; v._orionLastInteractiveSeekAt = Date.now(); v._orionLastInteractiveSeekTo = v.currentTime;`;
      }
    }
    if (String(action).startsWith("speed:")) {
      const rate = Number(String(action).slice(6));
      if (Number.isFinite(rate) && rate >= 0.25 && rate <= 4) {
        selectedScript = `v.playbackRate = ${rate};`;
      }
    }
    if (!selectedScript) {
      return { ok: false, error: "Unsupported player action" };
    }

    const operation = options ? beginRemoteVideoOperation(event.sender.id, options) : null;
    if (options && !operation) return { ok: false, error: "The remote command expired or the player is busy." };
    try {
      const { webContents } = require("electron");
      const wc = webContents.fromId(Number(webContentsId));
      if (!wc || wc.isDestroyed()) {
        return { ok: false, error: "The player is no longer available." };
      }

      const frames = collectFrames(wc.mainFrame);
      const primary = await findPrimaryVideo(frames);
      if (!primary) {
        return { ok: false, error: "No active video was found yet." };
      }

      if (operation && !operation.valid()) return { ok: false, error: "The remote command expired." };
      if (operation) operation.frame = primary.frame;
      const result = await executeOnVideo(primary, operation ? remoteVideoScript(operation, action, selectedScript) : selectedScript);
      if (!result) {
        return { ok: false, error: "The active video changed while applying the command." };
      }
      return { ok: true, ...result };
    } catch (error) {
      return { ok: false, error: error.message };
    } finally {
      operation?.finish();
    }
  });

  ipcMain.handle("set-video-state", async (_, webContentsId, state = {}) => {
    try {
      const { webContents } = require("electron");
      const wc = webContents.fromId(Number(webContentsId));
      if (!wc || wc.isDestroyed()) {
        return { ok: false, error: "The player is no longer available." };
      }

      const safeState = {
        currentTime: Number.isFinite(Number(state.currentTime))
          ? Math.max(0, Number(state.currentTime))
          : null,
        volume: Number.isFinite(Number(state.volume))
          ? Math.max(0, Math.min(1, Number(state.volume)))
          : null,
        muted: typeof state.muted === "boolean" ? state.muted : null,
        paused: typeof state.paused === "boolean" ? state.paused : null,
      };
      const serialized = JSON.stringify(safeState);
      const primary = await findPrimaryVideo(collectFrames(wc.mainFrame));
      if (!primary) {
        return { ok: false, error: "No active video was found yet." };
      }

      const result = await executeOnVideo(primary, `
        const state = ${serialized};
        const apply = () => {
          if (state.currentTime !== null && Math.abs((v.currentTime || 0) - state.currentTime) > 1) {
            v._orionProgrammaticSeekUntil = Date.now() + 1500;
            v._orionProgrammaticSeekTarget = Math.min(state.currentTime, Number.isFinite(v.duration) ? v.duration : state.currentTime);
            try { v.currentTime = v._orionProgrammaticSeekTarget; } catch {}
          }
          if (state.volume !== null) v.volume = state.volume;
          if (state.muted !== null) v.muted = state.muted;
          if (state.paused === false) v.play().catch(() => {});
          if (state.paused === true) v.pause();
        };
        if (v.readyState >= 1) apply();
        else v.addEventListener("loadedmetadata", apply, { once: true });
      `);
      return result
        ? { ok: true, ...result }
        : { ok: false, error: "The active video changed while restoring state." };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle("inject-script-all-frames", async (_, webContentsId, script) => {
    try {
      const { webContents } = require("electron");
      const wc = webContents.fromId(webContentsId);
      if (!wc || wc.isDestroyed()) {
        console.error(`[inject-script-all-frames] webContents ${webContentsId} not found or destroyed.`);
        return false;
      }

      const allFrames = [];
      const collect = (frame) => {
        allFrames.push(frame);
        for (const child of frame.frames || []) collect(child);
      };
      collect(wc.mainFrame);
      for (const frame of allFrames) {
        try {
          frame.executeJavaScript(script).catch((err) => {
            if (!app.isPackaged) console.error("[inject-script-all-frames] executeJavaScript rejected:", err.message || err);
          });
        } catch (err) {
          if (!app.isPackaged) console.error("[inject-script-all-frames] executeJavaScript threw:", err.message || err);
        }
      }
      return true;
    } catch (err) {
      if (!app.isPackaged) console.error("[inject-script-all-frames] Failed to run handler:", err.message || err);
      return false;
    }
  });

  ipcMain.handle("resume-video", async (_, webContentsId) => {
    try {
      const { webContents } = require("electron");
      const wc = webContents.fromId(Number(webContentsId));
      if (!wc || wc.isDestroyed()) return false;

      const primary = await findPrimaryVideo(collectFrames(wc.mainFrame));
      if (!primary) return false;
      return Boolean(await executeOnVideo(primary, `v.play().catch(() => {});`));
    } catch {
      return false;
    }
  });
}

module.exports = { register };
