// ── IPC: Player launch, window controls, auto-updater ─────────────────────────

const { ipcMain, shell, app } = require("electron");
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const os = require("os");

let _updateAbortController = null;

function register(getMainWindow, { writeSecretMigration }) {
  ipcMain.handle("player:renderer-webcontents-id", (event) => event.sender.id);
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

  ipcMain.handle("detect-update-format", () => {
    if (process.platform === "win32") return "exe";
    if (process.platform === "darwin") return "dmg";
    if (process.platform === "linux") {
      if (process.env.APPIMAGE) return "appimage";
      const isArch =
        spawnSync("which", ["pacman"], { encoding: "utf8" }).status === 0;
      return isArch ? "pacman" : "deb";
    }
    return null;
  });

  ipcMain.handle("download-and-install-update", async (_, { url, format }) => {
    try {
      const ALLOWED_FORMATS = ["exe", "deb", "pacman", "dmg", "dmg_arm64", "appimage"];
      if (!ALLOWED_FORMATS.includes(format)) {
        return { ok: false, error: "Invalid format" };
      }

      const TRUSTED_ORIGIN   = "https://github.com";
      const TRUSTED_PATH     = "/ok-ali/orion/releases/download/";
      const ALLOWED_REDIRECT_HOSTS = [
        "github.com",
        "objects.githubusercontent.com",
        "release-assets.githubusercontent.com",
      ];

      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return { ok: false, error: "Invalid URL" };
      }

      if (
        parsed.origin !== TRUSTED_ORIGIN ||
        !parsed.pathname.toLowerCase().startsWith(TRUSTED_PATH)
      ) {
        return { ok: false, error: "Unauthorized update source" };
      }

      _updateAbortController = new AbortController();
      const { signal } = _updateAbortController;

      const ext =
        format === "exe" ? ".exe"
        : format === "deb" ? ".deb"
        : format === "pacman" ? ".pacman"
        : format === "dmg" ? ".dmg"
        : ".AppImage";
      const destPath = path.join(os.tmpdir(), `orion-update${ext}`);

      await new Promise((resolve, reject) => {
        if (signal.aborted) return reject(new Error("Cancelled"));

        const doRequest = (reqUrl, redirectDepth = 0) => {
          if (redirectDepth > 5) {
            return reject(new Error("Too many redirects"));
          }
          let reqParsed;
          try {
            reqParsed = new URL(reqUrl);
          } catch {
            return reject(new Error("Invalid redirect URL"));
          }
          if (!ALLOWED_REDIRECT_HOSTS.includes(reqParsed.hostname)) {
            return reject(
              new Error(`Untrusted redirect host: ${reqParsed.hostname}`)
            );
          }

          const lib = reqUrl.startsWith("https") ? https : http;
          const req = lib.get(
            reqUrl,
            {
              headers: {
                "User-Agent": "Orion-AutoUpdater",
                Accept: "application/octet-stream",
              },
            },
            (res) => {
              if (
                res.statusCode >= 300 &&
                res.statusCode < 400 &&
                res.headers.location
              ) {
                res.resume();
                const next = res.headers.location.startsWith("http")
                  ? res.headers.location
                  : new URL(res.headers.location, reqUrl).toString();
                doRequest(next, redirectDepth + 1);
                return;
              }
              if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${res.statusCode}`));
              }

              const total = parseInt(res.headers["content-length"] || "0", 10);
              let downloaded = 0;
              const file = fs.createWriteStream(destPath);

              res.on("data", (chunk) => {
                if (signal.aborted) {
                  req.destroy();
                  file.destroy();
                  reject(new Error("Cancelled"));
                  return;
                }
                downloaded += chunk.length;
                file.write(chunk);
                const percent =
                  total > 0 ? Math.round((downloaded / total) * 100) : 0;
                const mb = (downloaded / 1e6).toFixed(1);
                const totalMb =
                  total > 0 ? `/ ${(total / 1e6).toFixed(1)} MB` : "";
                const mw = getMainWindow();
                if (mw && !mw.isDestroyed()) {
                  mw.webContents.send("update-progress", {
                    percent,
                    label: `Downloading… ${mb} MB ${totalMb}`,
                  });
                }
              });
              res.on("end", () => {
                file.end();
                file.on("finish", resolve);
                file.on("error", reject);
              });
              res.on("error", reject);
              req.on("error", reject);
            },
          );
          req.on("error", reject);
        };

        doRequest(url);
      });

      if (signal.aborted) return { ok: false, error: "Cancelled" };

      const sendInstalling = () => {
        const mw = getMainWindow();
        if (mw && !mw.isDestroyed()) {
          mw.webContents.send("update-progress", {
            percent: 100,
            label: "Installing…",
          });
        }
      };

      if (format === "appimage") {
        sendInstalling();
        fs.chmodSync(destPath, 0o755);
        const currentAppImage = process.env.APPIMAGE;
        if (currentAppImage) {
          const scriptPath = path.join(os.tmpdir(), "orion-update.sh");
          const pid = process.pid;
          const target = currentAppImage;
          const scriptContent =
            [
              "#!/bin/sh",
              `while kill -0 ${pid} 2>/dev/null; do sleep 0.2; done`,
              `mv -f "${destPath}" "${target}"`,
              `chmod +x "${target}"`,
              `"${target}" &`,
            ].join("\n") + "\n";
          fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
          spawn("sh", [scriptPath], {
            detached: true,
            stdio: "ignore",
          }).unref();
        } else {
          spawn(destPath, [], { detached: true, stdio: "ignore" }).unref();
        }
        writeSecretMigration();
        app.exit(0);
      } else if (format === "pacman") {
        sendInstalling();
        await new Promise((r) => setTimeout(r, 150));
        fs.chmodSync(destPath, 0o644);
        const pacmanLaunchers = [
          { bin: "pkexec", args: ["pacman", "-U", "--noconfirm", destPath] },
          { bin: "pamac-installer", args: [destPath] },
        ];
        let launched = false;
        for (const { bin, args } of pacmanLaunchers) {
          try {
            const which = spawnSync("which", [bin], { encoding: "utf8" });
            if (which.status !== 0) continue;
            const result = spawnSync(bin, args, { stdio: "inherit" });
            if (result.status === 0) {
              launched = true;
              break;
            }
          } catch {
            continue;
          }
        }
        if (launched) {
          writeSecretMigration();
          app.relaunch();
          app.exit(0);
        } else {
          shell.openPath(destPath);
        }
      } else if (format === "deb") {
        sendInstalling();
        await new Promise((r) => setTimeout(r, 150));
        fs.chmodSync(destPath, 0o644);
        const debLaunchers = [
          { bin: "pkexec", args: ["dpkg", "-i", destPath] },
          { bin: "pkexec", args: ["apt", "install", "-y", destPath] },
          { bin: "gdebi-gtk", args: [destPath] },
          { bin: "pkexec", args: ["gdebi", "-n", destPath] },
        ];
        let launched = false;
        for (const { bin, args } of debLaunchers) {
          try {
            const which = spawnSync(
              process.platform === "win32" ? "where" : "which",
              [bin],
              { encoding: "utf8" },
            );
            if (which.status !== 0) continue;
            const result = spawnSync(bin, args, { stdio: "inherit" });
            if (result.status === 0) {
              launched = true;
              break;
            }
          } catch {
            continue;
          }
        }
        if (launched) {
          writeSecretMigration();
          app.relaunch();
          app.exit(0);
        } else {
          shell.openPath(destPath);
        }
      } else if (format === "exe") {
        sendInstalling();
        spawn(destPath, [], { detached: true, stdio: "ignore" }).unref();
        app.exit(0);
      } else if (format === "dmg") {
        sendInstalling();
        spawn("hdiutil", ["attach", destPath], {
          detached: true,
          stdio: "ignore",
        }).unref();
      }

      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      _updateAbortController = null;
    }
  });

  ipcMain.handle("cancel-update", () => {
    _updateAbortController?.abort();
  });

  ipcMain.handle("query-video-progress", async (_, webContentsId) => {
    try {
      const { webContents } = require("electron");
      const wc = webContents.fromId(webContentsId);
      if (!wc || wc.isDestroyed()) return null;

      const allFrames = [];
      const collect = (frame) => {
        allFrames.push(frame);
        for (const child of frame.frames || []) collect(child);
      };
      collect(wc.mainFrame);

      const JS = `
        (() => {
          const v = document.querySelector('video');
          if (!v) return null;
          if (!v._seekTracked) {
            v._seekTracked = true;
            v.addEventListener('seeked', () => {
              v._lastUserSeek = Date.now();
              v._lastUserSeekTo = v.currentTime;
            });
          }
          return {
            currentTime: v.currentTime,
            duration: v.duration || 0,
            paused: v.paused,
            muted: v.muted,
            volume: v.volume,
            recentUserSeek: v._lastUserSeek ? (Date.now() - v._lastUserSeek < 6000) : false,
            lastUserSeekTo: v._lastUserSeekTo ?? null,
          };
        })()
      `;

      for (const frame of allFrames) {
        try {
          const result = await frame.executeJavaScript(JS);
          if (result && result.duration > 0 && result.duration !== Infinity) return result;
        } catch {}
      }
      return null;
    } catch {
      return null;
    }
  });

  ipcMain.handle("control-video", async (_, webContentsId, action) => {
    const scripts = {
      toggle: `if (v.paused) { v.play().catch(() => {}); } else { v.pause(); }`,
      play: `v.play().catch(() => {});`,
      pause: `v.pause();`,
      mute: `v.muted = true;`,
      unmute: `v.muted = false;`,
    };
    if (!Object.hasOwn(scripts, action)) {
      return { ok: false, error: "Unsupported player action" };
    }
    try {
      const { webContents } = require("electron");
      const wc = webContents.fromId(webContentsId);
      if (!wc || wc.isDestroyed()) {
        return { ok: false, error: "The mini-player is no longer available." };
      }

      const frames = [];
      const collect = (frame) => {
        frames.push(frame);
        for (const child of frame.frames || []) collect(child);
      };
      collect(wc.mainFrame);

      const script = `
        (() => {
          const v = document.querySelector('video');
          if (!v) return null;
          ${scripts[action]}
          return {
            paused: v.paused,
            muted: v.muted,
            currentTime: v.currentTime || 0,
            duration: v.duration || 0,
          };
        })()
      `;
      for (const frame of frames) {
        try {
          const result = await frame.executeJavaScript(script);
          if (result) return { ok: true, ...result };
        } catch {}
      }
      return { ok: false, error: "No active video was found yet." };
    } catch (error) {
      return { ok: false, error: error.message };
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
      const frames = [];
      const collect = (frame) => {
        frames.push(frame);
        for (const child of frame.frames || []) collect(child);
      };
      collect(wc.mainFrame);
      const serialized = JSON.stringify(safeState);
      const script = `
        (() => {
          const v = document.querySelector('video');
          if (!v) return null;
          const state = ${serialized};
          const apply = () => {
            if (state.currentTime !== null && Math.abs((v.currentTime || 0) - state.currentTime) > 1) {
              try { v.currentTime = Math.min(state.currentTime, Number.isFinite(v.duration) ? v.duration : state.currentTime); } catch {}
            }
            if (state.volume !== null) v.volume = state.volume;
            if (state.muted !== null) v.muted = state.muted;
            if (state.paused === false) v.play().catch(() => {});
            if (state.paused === true) v.pause();
          };
          if (v.readyState >= 1) apply();
          else v.addEventListener('loadedmetadata', apply, { once: true });
          return { currentTime: v.currentTime || 0, duration: v.duration || 0, paused: v.paused, muted: v.muted, volume: v.volume };
        })()
      `;
      for (const frame of frames) {
        try {
          const result = await frame.executeJavaScript(script);
          if (result) return { ok: true, ...result };
        } catch {}
      }
      return { ok: false, error: "No active video was found yet." };
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
      const wc = webContents.fromId(webContentsId);
      if (!wc || wc.isDestroyed()) return false;

      const allFrames = [];
      const collect = (frame) => {
        allFrames.push(frame);
        for (const child of frame.frames || []) collect(child);
      };
      collect(wc.mainFrame);

      for (const frame of allFrames) {
        try {
          const res = await frame.executeJavaScript(`
            (() => {
              const v = document.querySelector('video');
              if (v) {
                v.play().catch(() => {});
                return true;
              }
              return false;
            })()
          `);
          if (res) return true;
        } catch {}
      }
      return false;
    } catch {
      return false;
    }
  });
}

module.exports = { register };
