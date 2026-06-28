// IPC: Backend diagnostics and local readiness checks.

const { app, ipcMain, session } = require("electron");
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function checkBinary(binary, args = ["--version"], candidates = []) {
  return new Promise((resolve) => {
    const list = [...candidates, binary].filter(Boolean);
    let index = 0;
    const tryNext = () => {
      const candidate = list[index++];
      if (!candidate) {
        resolve({ ok: false, name: binary, error: "Not found" });
        return;
      }
      const child = execFile(candidate, args, { timeout: 4000 }, (error, stdout, stderr) => {
        if (error) {
          tryNext();
          return;
        }
        const firstLine =
          String(stdout || stderr || "").split(/\r?\n/).find(Boolean) ||
          "Available";
        resolve({
          ok: true,
          name: binary,
          path: candidate,
          version: firstLine.slice(0, 120),
        });
      });
      child.on("error", tryNext);
    };
    tryNext();
  });
}

async function checkDirectory(dirPath) {
  if (!dirPath) return { ok: false, status: "not_configured" };
  try {
    const resolved = path.resolve(String(dirPath));
    const stat = await fs.promises.stat(resolved);
    if (!stat.isDirectory()) {
      return { ok: false, status: "not_directory", path: resolved };
    }
    await fs.promises.access(resolved, fs.constants.R_OK | fs.constants.W_OK);
    return { ok: true, status: "ready", path: resolved };
  } catch (e) {
    return { ok: false, status: "unavailable", path: String(dirPath), error: e.message };
  }
}

async function getCacheBytes() {
  try {
    const sessions = [
      session.defaultSession,
      session.fromPartition("persist:player"),
      session.fromPartition("persist:trailer"),
    ];
    const sizes = await Promise.all(sessions.map((s) => s.getCacheSize()));
    return sizes.reduce((total, size) => total + size, 0);
  } catch {
    return 0;
  }
}

function register({ getDownloads = () => [], getPlayerWebContentsCount = () => 0 } = {}) {
  ipcMain.handle("get-backend-status", async (_, args = {}) => {
    const downloads = getDownloads();
    const activeDownloads = downloads.filter((d) => d.status === "downloading");
    const errorDownloads = downloads.filter((d) => ["error", "failed"].includes(d.status));
    const completedDownloads = downloads.filter((d) => d.status === "completed");

    const toolsDir = path.join(app.getPath("userData"), "tools");
    const ytDlpName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
    const ffmpegName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const [ytDlp, ffmpeg, downloadPath, cacheBytes] = await Promise.all([
      checkBinary("yt-dlp", ["--version"], [path.join(toolsDir, ytDlpName)]),
      checkBinary("ffmpeg", ["-version"], [
        path.join(toolsDir, ffmpegName),
        process.platform === "win32" ? "C:\\ffmpeg\\bin\\ffmpeg.exe" : null,
      ]),
      checkDirectory(args.downloadPath),
      getCacheBytes(),
    ]);

    return {
      ok: true,
      checkedAt: new Date().toISOString(),
      app: {
        version: app.getVersion(),
        packaged: app.isPackaged,
        installPath: app.getAppPath(),
        userDataPath: app.getPath("userData"),
      },
      runtime: {
        platform: process.platform,
        arch: process.arch,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
        memoryMb: Math.round(process.getSystemMemoryInfo().free / 1024),
        cpuCount: os.cpus()?.length || 0,
      },
      configuration: {
        tmdbTokenSet: !!args.tmdbTokenSet,
        tmdbTokenSource: args.tmdbTokenSource || (args.tmdbTokenSet ? "user" : "missing"),
        downloadPath,
      },
      tools: {
        ytDlp,
        ffmpeg,
      },
      media: {
        playerWebContents: getPlayerWebContentsCount(),
        cacheBytes,
      },
      downloads: {
        total: downloads.length,
        active: activeDownloads.length,
        completed: completedDownloads.length,
        errors: errorDownloads.length,
      },
    };
  });
}

module.exports = { register };
