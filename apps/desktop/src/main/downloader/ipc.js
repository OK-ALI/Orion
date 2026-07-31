// ── IPC: Downloads ────────────────────────────────────────────────────────────
// Manages the download queue, spawns the downloader binary, tracks progress,
// and handles all download-related IPC handlers.

const { ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const filesystemIpc = require("../ipc/filesystemIpc");
const { safeFileName, safeSourceLabel, publicDownload, qualityFormat, buildTargetDirectory } = require("./paths");
const {
  buildDownloadHeaders,
  createHlsProxy,
  getPlayerUserAgent,
} = require("./hlsProxy");
const downloadStore = require("./store");
const { preflightCandidate } = require("./preflight");
const { exportSessionCookies } = require("./requestContext");
const { downloadSubtitleFile } = require("./subtitleAsset");
const {
  beginCaptureSession,
  listCandidates,
  clearCandidates,
  endCaptureSession,
  resolveCandidate,
} = require("./streamCandidates");

// ── Download store ────────────────────────────────────────────────────────────

let downloads = [];

const activeProcs = new Map();


const toolManager = require("./tools");
const { killProcessTree, trackProcess } = require("./processRunner");


let _getMainWindow = () => null;



























function sendProgress(update) {
  const mw = _getMainWindow();
  if (mw && !mw.isDestroyed()) {
    mw.webContents.send("download-progress", update);
  }
}

const processContext = {
  activeProcs,
  get downloads() { return downloads; },
  killProcessTree,
  saveDownloads,
  sendProgress,
};



function loadDownloads() {
  try {
    downloads = downloadStore.normalize(downloadStore.load());
    saveDownloads();
  } catch {
    downloads = [];
  }
}

function saveDownloads() {
  downloadStore.save(downloads);
}

function cleanupTempFiles(downloadPath) {
  downloadStore.cleanupTempFiles(downloadPath);
}

function killAllDownloads() {
  for (const [id, proc] of activeProcs.entries()) {
    try {
      killProcessTree(proc);
    } catch {}
    try {
      proc.__orionCleanup?.();
    } catch {}
    const idx = downloads.findIndex((d) => d.id === id);
    if (idx !== -1) {
      downloads[idx].status = "paused";
      downloads[idx].lastMessage = "Interrupted when Orion closed";
    }
    activeProcs.delete(id);
  }
  // Keep .part/.ytdl files on app exit so interrupted downloads can resume.
  // Explicit cancel/remove actions still clean task-owned temporary files.
  saveDownloads();
}

function pauseDownload(id, message = "Paused") {
  try {
    const proc = activeProcs.get(id);
    if (proc) {
      killProcessTree(proc);
      try {
        proc.__orionCleanup?.();
      } catch {}
      activeProcs.delete(id);
    }
    const idx = downloads.findIndex((d) => d.id === id);
    if (idx !== -1) {
      const entry = downloads[idx];
      entry.status = "paused";
      entry.lastMessage = message;
      if (entry.cookiePath) {
        try {
          if (fs.existsSync(entry.cookiePath)) fs.unlinkSync(entry.cookiePath);
        } catch {}
        entry.cookiePath = null;
      }
      sendProgress({ id, status: "paused", lastMessage: message });
      saveDownloads();
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function pauseAllDownloads(message = "Paused from the system tray") {
  const pausable = downloads.filter((entry) =>
    ["queued", "preflighting", "downloading", "processing"].includes(entry.status),
  );
  for (const entry of pausable) pauseDownload(entry.id, message);
  return { ok: true, count: pausable.length };
}





function register(getMainWindow, { resetSettingsData } = {}) {
  _getMainWindow = getMainWindow;
  toolManager.configure(getMainWindow);

  ipcMain.handle("get-downloader-status", () => toolManager.getStatus());
  ipcMain.handle("downloads:begin-capture", (_, details = {}) =>
    beginCaptureSession(details),
  );
  ipcMain.handle("downloads:end-capture", (_, sessionId) => ({
    ok: endCaptureSession(sessionId),
  }));
  ipcMain.handle("downloads:list-candidates", (_, details = {}) => listCandidates(details));
  ipcMain.handle("downloads:clear-candidates", (_, details = {}) => {
    clearCandidates(details);
    return { ok: true };
  });
  ipcMain.handle("downloads:preflight", (_, { candidateId } = {}) =>
    preflightCandidate(candidateId),
  );
  ipcMain.handle("install-downloader-tools", () => toolManager.install());
  ipcMain.handle("open-downloader-tools-folder", async () => {
    try {
      fs.mkdirSync(toolManager.getToolDir(), { recursive: true });
      await shell.openPath(toolManager.getToolDir());
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("check-downloader", (_, folderPath) =>
    folderPath ? toolManager.checkHelper(folderPath) : toolManager.getStatus(),
  );
  ipcMain.handle("check-helper-downloader", (_, folderPath) =>
    toolManager.checkHelper(folderPath),
  );

  ipcMain.handle(
    "run-download",
    async (
      _,
      {
        candidateId,
        m3u8Url,
        m3u8Context,
        name,
        downloadPath,
        mediaId,
        mediaType,
        season,
        episode,
        posterPath,
        tmdbId,
        subtitles,
        downloaderEngine = "auto",
        helperToken,
        qualityPreset = "best",
        concurrency = 2,
        fragmentConcurrency = 6,
        downloadStrategy = "auto",
      },
    ) => {
      try {
        const capturedCandidate = candidateId ? resolveCandidate(candidateId) : null;
        const resolvedM3u8Url = capturedCandidate?.url || m3u8Url;
        const resolvedM3u8Context = capturedCandidate || m3u8Context;
        if (!resolvedM3u8Url) {
          return { ok: false, error: "No active stream was captured. Start playback and try again." };
        }
        const helperPath = helperToken ? toolManager.getTrustedBinaryPath(helperToken) : null;
        const directStatus = await toolManager.getStatus();
        const useHelper =
          downloaderEngine === "ext-helper" ||
          (downloaderEngine === "auto" && !directStatus.exists && !!helperPath);
        if (useHelper && !helperPath) {
          return {
            ok: false,
            error: "External helper is not ready. Choose the helper folder, then retry.",
          };
        }
        if (!useHelper && !directStatus.exists) {
          return {
            ok: false,
            error:
              "yt-dlp and ffmpeg are not ready. Install downloader tools from the download dialog or Settings, then retry.",
            status: directStatus,
          };
        }
        const id = crypto.randomUUID();
        const logPath = path.join(os.tmpdir(), `orion_dl_${id}.log`);

        if (!downloadPath) return { ok: false, error: "Choose a download folder first." };
        const targetDir = buildTargetDirectory(downloadPath, mediaType, name, season);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        let cookiePath = null;
        if (resolvedM3u8Url && resolvedM3u8Url.startsWith("http")) {
          try {
            cookiePath = path.join(os.tmpdir(), `orion_cookies_${id}.txt`);
            const ok = await exportSessionCookies(resolvedM3u8Url, cookiePath);
            if (!ok) {
              cookiePath = null;
            }
          } catch {
            cookiePath = null;
          }
        }
        const userAgent = getPlayerUserAgent();

        const entry = {
          id,
          schemaVersion: 3,
          name,
          candidateId: candidateId || null,
          m3u8Url: resolvedM3u8Url,
          m3u8Context: resolvedM3u8Context || null,
          downloadPath: targetDir,
          filePath: null,
          status: "downloading",
          progress: 0,
          speed: "",
          size: "",
          downloadedBytes: 0,
          totalBytes: 0,
          etaSeconds: null,
          retryCount: 0,
          totalFragments: 0,
          completedFragments: 0,
          lastMessage: "Starting…",
          startedAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: null,
          mediaId: mediaId || null,
          mediaType: mediaType || null,
          season: season || null,
          episode: episode || null,
          posterPath: posterPath || null,
          tmdbId: tmdbId || mediaId || null,
          subtitles: Array.isArray(subtitles) ? subtitles : [],
          subtitlePaths: [],
          logPath,
          cookiePath,
          downloaderEngine: useHelper ? "ext-helper" : "yt-dlp",
          strategy: useHelper
            ? "external-helper"
            : downloadStrategy === "direct"
              ? "direct-captured-context"
              : "electron-session-proxy",
          qualityPreset,
          fragmentConcurrency: Math.max(1, Math.min(12, Number(fragmentConcurrency) || 6)),
          sourceHost: capturedCandidate ? new URL(capturedCandidate.url).host : "",
        };

        try {
          fs.writeFileSync(
            logPath,
            `Orion Download Log\nName: ${name}\nSource: ${safeSourceLabel(resolvedM3u8Url)}\nStarted: ${new Date().toISOString()}\n${"─".repeat(60)}\n`,
            "utf8",
          );
        } catch {}

        const isSameMedia = (d) =>
          d.tmdbId &&
          d.tmdbId === entry.tmdbId &&
          d.mediaType === entry.mediaType &&
          String(d.season ?? "") === String(entry.season ?? "") &&
          String(d.episode ?? "") === String(entry.episode ?? "");
        const duplicate = downloads.find(isSameMedia);
        if (duplicate) {
          if (["failed", "error", "paused", "interrupted", "cancelled"].includes(duplicate.status)) {
            try { if (duplicate.cookiePath && fs.existsSync(duplicate.cookiePath)) fs.unlinkSync(duplicate.cookiePath); } catch {}
            try { if (duplicate.logPath && fs.existsSync(duplicate.logPath)) fs.unlinkSync(duplicate.logPath); } catch {}
            cleanupTempFiles(duplicate.downloadPath);
            downloads = downloads.filter((item) => item.id !== duplicate.id);
          } else {
            try { if (cookiePath && fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath); } catch {}
            try { if (fs.existsSync(logPath)) fs.unlinkSync(logPath); } catch {}
            return {
              ok: false,
              code: "duplicate",
              duplicateId: duplicate.id,
              error: duplicate.status === "completed"
                ? "This title is already downloaded. Remove it before downloading again."
                : "This title already has a download task.",
            };
          }
        }
        downloads.push(entry);
        saveDownloads();

        const launch = async () => {
        entry.status = "downloading";
        entry.lastMessage = "Starting…";
        sendProgress({ id, name, status: entry.status, lastMessage: entry.lastMessage });
        let hlsProxy = null;
        let downloadUrl = resolvedM3u8Url;
        if (!useHelper && downloadStrategy !== "direct" && resolvedM3u8Url && /^https?:\/\//i.test(resolvedM3u8Url)) {
          try {
            hlsProxy = await createHlsProxy(resolvedM3u8Url, resolvedM3u8Context);
            downloadUrl = hlsProxy.url;
            try {
              fs.appendFileSync(
                logPath,
                `Using local HLS proxy: ${downloadUrl}\n`,
                "utf8",
              );
            } catch {}
          } catch (proxyError) {
            try {
              fs.appendFileSync(
                logPath,
                `Local HLS proxy unavailable: ${proxyError.message}\n`,
                "utf8",
              );
            } catch {}
          }
        }

        const outputTemplate = path.join(targetDir, `${safeFileName(name)}.%(ext)s`);
        const ffmpegDir = directStatus.ffmpeg?.path ? path.dirname(directStatus.ffmpeg.path) : null;
        const downloadHeaders = buildDownloadHeaders(resolvedM3u8Context, userAgent);
        const args = useHelper
          ? [
              "--cli",
              resolvedM3u8Url,
              "-f",
              "mp4 (with Audio)",
              "-r",
              "best",
              "-b",
              "320",
              "-n",
              name,
              "-d",
              targetDir,
            ]
          : [
              "--newline",
              "--no-playlist",
              "--retries",
              "10",
              "--fragment-retries",
              "12",
              "--concurrent-fragments",
              String(entry.fragmentConcurrency),
              "--retry-sleep",
              "fragment:exp=1:15",
              "--socket-timeout",
              "30",
              "--skip-unavailable-fragments",
              "--ffmpeg-location",
              ffmpegDir,
              "--merge-output-format",
              "mp4",
              "-f",
              qualityFormat(qualityPreset),
            ];

        if (!useHelper) {
          if (cookiePath) {
            args.push("--cookies", cookiePath);
          }
          if (userAgent) {
            args.push("--user-agent", userAgent);
          }
          for (const [header, value] of downloadHeaders) {
            if (header.toLowerCase() === "user-agent") continue;
            args.push("--add-headers", `${header}:${value}`);
          }
          args.push("-o", outputTemplate, downloadUrl);
        }

        const env = { ...process.env };
        if (ffmpegDir) {
          const pathKey = process.platform === "win32" ? "Path" : "PATH";
          env[pathKey] = `${ffmpegDir}${path.delimiter}${env[pathKey] || ""}`;
        }

        const proc = spawn(useHelper ? helperPath : directStatus.ytDlp.path, args, {
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
          env,
        });
        proc.__orionCleanup = () => hlsProxy?.close();
        activeProcs.set(id, proc);

        trackProcess(processContext, id, proc, name, targetDir, logPath, cookiePath, proc.__orionCleanup);
        saveDownloads();
        };

        const maxConcurrent = Math.max(1, Math.min(3, Number(concurrency) || 2));
        if (activeProcs.size >= maxConcurrent) {
          entry.status = "queued";
          entry.lastMessage = "Waiting for an available download slot";
          saveDownloads();
          sendProgress({ id, name, status: "queued", lastMessage: entry.lastMessage });
          const queueTimer = setInterval(async () => {
            const queuedEntry = downloads.find((item) => item.id === id);
            if (!queuedEntry || queuedEntry.status !== "queued") {
              clearInterval(queueTimer);
              return;
            }
            if (activeProcs.size >= maxConcurrent) return;
            clearInterval(queueTimer);
            try {
              await launch();
            } catch (error) {
              entry.status = "failed";
              entry.lastMessage = error.message || "Failed to start queued download";
              entry.completedAt = Date.now();
              saveDownloads();
              sendProgress({ id, status: "failed", lastMessage: entry.lastMessage });
            }
          }, 1000);
          return { ok: true, id, queued: true, download: publicDownload(entry) };
        }

        await launch();

        return { ok: true, id, download: publicDownload(entry) };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
  );

  ipcMain.handle("pause-download", (_, id) => pauseDownload(id));

  ipcMain.handle("resume-download", async (_, { id }) => {
    try {
      const status = await toolManager.getStatus();
      if (!status.exists) {
        return {
          ok: false,
          error:
            "yt-dlp and ffmpeg are not ready. Install downloader tools, then retry.",
          status,
        };
      }
      const idx = downloads.findIndex((d) => d.id === id);
      if (idx === -1) return { ok: false, error: "Download not found" };

      const entry = downloads[idx];
      entry.status = "downloading";
      entry.lastMessage = "Resuming…";
      sendProgress({ id, status: "downloading", lastMessage: "Resuming…" });

      if (!entry.logPath) {
        entry.logPath = path.join(os.tmpdir(), `orion_dl_${id}.log`);
      }
      try {
        fs.appendFileSync(
          entry.logPath,
          `\n${"─".repeat(60)}\nResumed: ${new Date().toISOString()}\nSource: ${safeSourceLabel(entry.m3u8Url)}\n${"─".repeat(60)}\n`,
          "utf8",
        );
      } catch {}

      let cookiePath = null;
      if (entry.m3u8Url && entry.m3u8Url.startsWith("http")) {
        try {
          cookiePath = path.join(os.tmpdir(), `orion_cookies_${id}.txt`);
          const ok = await exportSessionCookies(entry.m3u8Url, cookiePath);
          if (!ok) {
            cookiePath = null;
          }
        } catch {
          cookiePath = null;
        }
      }
      entry.cookiePath = cookiePath;
      const userAgent = getPlayerUserAgent();

      const outputTemplate = path.join(
        entry.downloadPath,
        `${safeFileName(entry.name)}.%(ext)s`,
      );
      let hlsProxy = null;
      let downloadUrl = entry.m3u8Url;
      if (
        entry.strategy !== "direct-captured-context" &&
        entry.m3u8Url &&
        /^https?:\/\//i.test(entry.m3u8Url)
      ) {
        try {
          hlsProxy = await createHlsProxy(entry.m3u8Url, entry.m3u8Context);
          downloadUrl = hlsProxy.url;
          try {
            fs.appendFileSync(
              entry.logPath,
              `Using local HLS proxy: ${downloadUrl}\n`,
              "utf8",
            );
          } catch {}
        } catch (proxyError) {
          try {
            fs.appendFileSync(
              entry.logPath,
              `Local HLS proxy unavailable: ${proxyError.message}\n`,
              "utf8",
            );
          } catch {}
        }
      }
      const downloadHeaders = buildDownloadHeaders(entry.m3u8Context, userAgent);
      const args = [
        "--newline",
        "--no-playlist",
          "--retries",
          "10",
        "--fragment-retries",
        "12",
        "--concurrent-fragments",
        String(entry.fragmentConcurrency || 6),
        "--retry-sleep",
        "fragment:exp=1:15",
        "--socket-timeout",
        "30",
        "--skip-unavailable-fragments",
        "--ffmpeg-location",
        path.dirname(status.ffmpeg.path),
        "--merge-output-format",
        "mp4",
        "-f",
        qualityFormat(entry.qualityPreset || "best"),
      ];

      if (cookiePath) {
        args.push("--cookies", cookiePath);
      }
      if (userAgent) {
        args.push("--user-agent", userAgent);
      }
      for (const [header, value] of downloadHeaders) {
        if (header.toLowerCase() === "user-agent") continue;
        args.push("--add-headers", `${header}:${value}`);
      }
      args.push("-o", outputTemplate, downloadUrl);

      const proc = spawn(status.ytDlp.path, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      proc.__orionCleanup = () => hlsProxy?.close();
      activeProcs.set(id, proc);

      trackProcess(processContext, 
        id,
        proc,
        entry.name,
        entry.downloadPath,
        entry.logPath,
        cookiePath,
        proc.__orionCleanup,
      );

      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("get-downloads", () => downloads.map(publicDownload));

  ipcMain.handle("delete-download", (_, { id, filePath }) => {
    try {
      const dlEntry = downloads.find((d) => d.id === id);
      if (activeProcs.has(id)) {
        try {
          killProcessTree(activeProcs.get(id));
        } catch {}
        activeProcs.delete(id);
      }
      if (dlEntry?.cookiePath) {
        try {
          if (fs.existsSync(dlEntry.cookiePath)) fs.unlinkSync(dlEntry.cookiePath);
        } catch {}
      }
      if (filePath) {
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}
      }
      for (const sp of dlEntry?.subtitlePaths || []) {
        try {
          if (sp?.path && fs.existsSync(sp.path)) fs.unlinkSync(sp.path);
        } catch {}
      }
      const dlPath = dlEntry?.downloadPath;
      if (dlPath) cleanupTempFiles(dlPath);
      if (dlEntry?.driveFileId) {
        try {
          const { googleDriveRequest } = require("../ipc/googleAuthIpc");
          googleDriveRequest(`https://www.googleapis.com/drive/v3/files/${dlEntry.driveFileId}`, { method: "DELETE" }).catch(() => {});
        } catch {}
      }
      downloads = downloads.filter((d) => d.id !== id);
      saveDownloads();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("delete-all-downloads", async () => {
    try {
      let deleted = 0,
        errors = 0;
      for (const dl of downloads) {
        if (dl.filePath) {
          try {
            if (fs.existsSync(dl.filePath)) {
              fs.unlinkSync(dl.filePath);
              deleted++;
            }
          } catch {
            errors++;
          }
        }
        for (const sp of dl.subtitlePaths || []) {
          try {
            if (sp?.path && fs.existsSync(sp.path)) fs.unlinkSync(sp.path);
          } catch {}
        }
      }
      downloads = [];
      saveDownloads();
      return { ok: true, deleted, errors };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("get-downloads-size", async () => {
    let bytes = 0;
    await Promise.all(
      downloads.map(async (dl) => {
        if (!dl.filePath) return;
        try {
          const stat = await fs.promises.stat(dl.filePath);
          if (stat.isFile()) bytes += stat.size;
        } catch {}
      }),
    );
    return { bytes };
  });

  ipcMain.handle("show-in-folder", (_, filePath) => {
    if (filePath && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
    else shell.openPath(path.dirname(filePath || ""));
  });

  ipcMain.handle("open-download-log", async (_, filePath) => {
    try {
      const resolved = path.resolve(String(filePath || ""));
      const tempRoot = path.resolve(os.tmpdir()) + path.sep;
      if (!resolved.startsWith(tempRoot) || !path.basename(resolved).startsWith("orion_dl_")) {
        return { ok: false, error: "Invalid download log path" };
      }
      if (!fs.existsSync(resolved)) return { ok: false, error: "The download log no longer exists" };
      const error = await shell.openPath(resolved);
      return error ? { ok: false, error } : { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  filesystemIpc.register({
    getMainWindow,
    resetAppData: async () => {
      downloadStore.clear();
      downloads = [];
      await resetSettingsData?.();
    },
  });

}

module.exports = {
  register,
  loadDownloads,
  saveDownloads,
  killAllDownloads,
  pauseDownload,
  pauseAllDownloads,
  saveDownloads,
  getDownloads: () => downloads,
};
