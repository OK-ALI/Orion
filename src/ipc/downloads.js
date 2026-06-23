// ── IPC: Downloads ────────────────────────────────────────────────────────────
// Manages the download queue, spawns the downloader binary, tracks progress,
// and handles all download-related IPC handlers.

const { app, ipcMain, shell, dialog, session } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const os = require("os");
const crypto = require("crypto");

// ── Download store ────────────────────────────────────────────────────────────

let downloads = [];
let _downloadsFile = null;
const downloadsFile = () =>
  _downloadsFile ||
  (_downloadsFile = path.join(app.getPath("userData"), "downloads.json"));

const activeProcs = new Map();

const trustedBinaryPaths = new Map();
const { downloadFile, extractFfmpeg, findWorkingBinary } = require("./downloader-helper");
let installingTools = false;

let _getMainWindow = () => null;

const TOOL_DIR = () => path.join(app.getPath("userData"), "tools");
const YTDLP_NAME = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const FFMPEG_NAME = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

function toolPath(name) {
  return path.join(TOOL_DIR(), name);
}

function sendToolInstallProgress(update) {
  const mw = _getMainWindow();
  if (mw && !mw.isDestroyed()) {
    mw.webContents.send("downloader-tools-progress", update);
  }
}

function safeFileName(name) {
  return String(name || "Orion Download")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "Orion Download";
}

async function getDownloaderStatus() {
  const ytCandidates = [toolPath(YTDLP_NAME), YTDLP_NAME];
  const ffmpegCandidates =
    process.platform === "win32"
      ? [toolPath(FFMPEG_NAME), "ffmpeg", "C:\\ffmpeg\\bin\\ffmpeg.exe"]
      : [
          toolPath(FFMPEG_NAME),
          "/opt/homebrew/bin/ffmpeg",
          "/usr/local/bin/ffmpeg",
          "/usr/bin/ffmpeg",
          "ffmpeg",
        ];
  const [ytDlp, ffmpeg] = await Promise.all([
    findWorkingBinary(ytCandidates, ["--version"]),
    findWorkingBinary(ffmpegCandidates, ["-version"]),
  ]);
  const exists = ytDlp.ok && ffmpeg.ok;
  return {
    exists,
    ready: exists,
    managedDir: TOOL_DIR(),
    platform: process.platform,
    installing: installingTools,
    ytDlp,
    ffmpeg,
    token: exists ? "direct-tools" : null,
    reason: exists
      ? "ready"
      : !ytDlp.ok && !ffmpeg.ok
        ? "missing_tools"
        : !ytDlp.ok
          ? "missing_ytdlp"
          : "missing_ffmpeg",
  };
}

async function installDownloaderTools() {
  if (installingTools) {
    return { ok: false, error: "Downloader tools are already installing" };
  }
  if (process.platform !== "win32") {
    return {
      ok: false,
      error:
        "Automatic downloader setup is currently available on Windows. Install yt-dlp and ffmpeg on PATH, then refresh.",
    };
  }
  installingTools = true;
  try {
    fs.mkdirSync(TOOL_DIR(), { recursive: true });
    sendToolInstallProgress({ step: "Preparing", progress: 0 });

    await downloadFile(
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
      toolPath(YTDLP_NAME),
      "yt-dlp",
      (p) => sendToolInstallProgress({ step: "Downloading yt-dlp", progress: p })
    );

    const ffZip = path.join(TOOL_DIR(), "ffmpeg-release-essentials.zip");
    await downloadFile(
      "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
      ffZip,
      "ffmpeg",
      (p) => sendToolInstallProgress({ step: "Downloading ffmpeg", progress: p })
    );

    sendToolInstallProgress({ step: "Extracting ffmpeg", progress: 0 });
    await extractFfmpeg(ffZip, TOOL_DIR());

    let extractedFfmpeg = null;
    const walk = (dir, depth = 0) => {
      if (depth > 4 || extractedFfmpeg) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, depth + 1);
        else if (entry.isFile() && entry.name.toLowerCase() === FFMPEG_NAME) {
          extractedFfmpeg = full;
          return;
        }
      }
    };
    walk(TOOL_DIR());
    if (!extractedFfmpeg) throw new Error("ffmpeg.exe was not found after extraction");
    fs.copyFileSync(extractedFfmpeg, toolPath(FFMPEG_NAME));
    try {
      fs.unlinkSync(ffZip);
    } catch {}

    // Cleanup extracted directory to save space
    try {
      const entries = fs.readdirSync(TOOL_DIR(), { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(TOOL_DIR(), entry.name);
        if (entry.isDirectory() && entry.name.toLowerCase().startsWith("ffmpeg-")) {
          fs.rmSync(full, { recursive: true, force: true });
        }
      }
    } catch {}

    const status = await getDownloaderStatus();
    sendToolInstallProgress({ step: "Ready", progress: 100 });
    return status.exists
      ? { ok: true, status }
      : { ok: false, error: "Tools installed but could not be verified", status };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    installingTools = false;
  }
}

function sendProgress(update) {
  const mw = _getMainWindow();
  if (mw && !mw.isDestroyed()) {
    mw.webContents.send("download-progress", update);
  }
}

function loadDownloads() {
  try {
    const raw = fs.readFileSync(downloadsFile(), "utf8");
    const parsed = JSON.parse(raw);
    const seen = new Map();
    const sorted = [...parsed].sort(
      (a, b) =>
        (b.completedAt || b.startedAt || 0) -
        (a.completedAt || a.startedAt || 0),
    );
    for (const d of sorted) {
      const key =
        d.tmdbId && d.mediaType
          ? `${d.tmdbId}|${d.mediaType}|${d.season ?? ""}|${d.episode ?? ""}`
          : d.id;
      if (!seen.has(key)) seen.set(key, d);
    }
    downloads = [...seen.values()];
  } catch {
    downloads = [];
  }
}

function saveDownloads() {
  try {
    const toSave = downloads.filter(
      (d) => d.status !== "downloading" && d.status !== "error",
    );
    fs.writeFileSync(downloadsFile(), JSON.stringify(toSave, null, 2));
  } catch {}
}

function cleanupTempFiles(downloadPath) {
  if (!downloadPath) return;
  const TEMP_PATTERNS = [
    /\.part$/,
    /\.part\.\d+$/,
    /\.part\.tmp$/,
    /\.tmp$/,
    /\.ytdl$/,
    /\.part-Frag\d+$/,
  ];
  try {
    const entries = fs.readdirSync(downloadPath);
    for (const entry of entries) {
      if (TEMP_PATTERNS.some((p) => p.test(entry))) {
        try {
          fs.unlinkSync(path.join(downloadPath, entry));
        } catch {}
      }
    }
  } catch {}
}

function killAllDownloads() {
  for (const [id, proc] of activeProcs.entries()) {
    try {
      proc.kill("SIGKILL");
    } catch {}
    const idx = downloads.findIndex((d) => d.id === id);
    if (idx !== -1) {
      downloads[idx].status = "error";
      downloads[idx].lastMessage = "Cancelled on exit";
    }
    activeProcs.delete(id);
  }
  const folders = new Set(downloads.map((d) => d.downloadPath).filter(Boolean));
  for (const folder of folders) cleanupTempFiles(folder);
  saveDownloads();
}

function downloadSubtitleFile(url, destPath) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === "file:") {
        try {
          fs.copyFileSync(decodeURIComponent(parsedUrl.pathname), destPath);
          resolve(true);
        } catch {
          resolve(false);
        }
        return;
      }
      const lib = parsedUrl.protocol === "https:" ? https : http;
      const req = lib.get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
            Referer: parsedUrl.origin,
            Accept: "*/*",
          },
        },
        (res) => {
          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            const loc = res.headers.location.startsWith("http")
              ? res.headers.location
              : parsedUrl.origin + res.headers.location;
            downloadSubtitleFile(loc, destPath).then(resolve);
            return;
          }
          if (res.statusCode !== 200) {
            res.resume();
            resolve(false);
            return;
          }
          const file = fs.createWriteStream(destPath);
          res.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve(true);
          });
          file.on("error", () => {
            try {
              fs.unlinkSync(destPath);
            } catch {}
            resolve(false);
          });
          res.on("error", () => resolve(false));
        },
      );
      req.on("error", () => resolve(false));
      req.setTimeout(20000, () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

function trackProcess(id, proc, name, downloadPath, logPath) {
  const handleLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const idx = downloads.findIndex((d) => d.id === id);
    if (idx === -1) return;

    const update = {};

    const fragMatch = trimmed.match(/\(frag\s+(\d+)\/(\d+)\)/);
    if (fragMatch) {
      const currentFrag = parseInt(fragMatch[1]);
      const total = parseInt(fragMatch[2]);
      update.completedFragments = currentFrag;
      update.totalFragments = total;
      update.progress = Math.min(
        99,
        Math.round((currentFrag / total) * 100),
      );
      update.lastMessage = `Fragment ${currentFrag} / ${total}`;
    }

    if (!fragMatch && !downloads[idx].totalFragments) {
      const dlPctMatch = trimmed.match(
        /^\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+\s*(?:[KMGT]i?B|B))/i,
      );
      if (dlPctMatch) {
        const pct = parseFloat(dlPctMatch[1]);
        update.progress = Math.min(99, Math.round(pct));
        update.size = dlPctMatch[2].trim();
        const spMatch = trimmed.match(
          /\bat\s+([\d.]+\s*(?:[KMGT]i?B|B)\/s)/i,
        );
        if (spMatch) update.speed = spMatch[1].trim();
        update.lastMessage = `${Math.round(pct)}% of ${update.size}`;
      }
    }

    const durationMatch = trimmed.match(
      /Duration:\s*(\d+):(\d+):([\d.]+)/,
    );
    if (durationMatch) {
      const totalSecs =
        parseInt(durationMatch[1]) * 3600 +
        parseInt(durationMatch[2]) * 60 +
        parseFloat(durationMatch[3]);
      if (totalSecs > 0) downloads[idx]._ffmpegTotalSecs = totalSecs;
      return;
    }

    const ffmpegMatch = trimmed.match(
      /size=\s*([\d.]+\s*\w+)\s+time=(\d+):(\d+):([\d.]+)/i,
    );
    if (ffmpegMatch) {
      const elapsedSecs =
        parseInt(ffmpegMatch[2]) * 3600 +
        parseInt(ffmpegMatch[3]) * 60 +
        parseFloat(ffmpegMatch[4]);
      const totalSecs = downloads[idx]._ffmpegTotalSecs || 0;
      if (totalSecs > 0) {
        update.progress = Math.min(
          99,
          Math.round((elapsedSecs / totalSecs) * 100),
        );
      }
      const rawSize = ffmpegMatch[1].trim();
      const kbMatch = rawSize.match(/([\d.]+)\s*kB/i);
      if (kbMatch) {
        const mb = parseFloat(kbMatch[1]) / 1024;
        update.size =
          mb >= 1024
            ? `${(mb / 1024).toFixed(1)} GiB`
            : `${mb.toFixed(1)} MiB`;
      } else {
        update.size = rawSize;
      }
      const speedXMatch = trimmed.match(/speed=\s*([\d.]+)x/i);
      if (speedXMatch) update.speed = `${speedXMatch[1]}x`;
      update.lastMessage = `Processing… ${update.size}${update.speed ? ` at ${update.speed}` : ""}`;
    }

    const retryMatch =
      trimmed.match(/Retrying\s+\(\d+\/\d+\)/i) ||
      trimmed.match(/Got error:.*timed?\s*out/i) ||
      trimmed.match(/Read timed? out/i);
    if (retryMatch) {
      update.speed = "0 MB/s";
      const retryNumMatch = trimmed.match(/Retrying\s+\((\d+)\/(\d+)\)/i);
      update.lastMessage = retryNumMatch
        ? `Retrying… (${retryNumMatch[1]}/${retryNumMatch[2]})`
        : "Retrying…";
      downloads[idx] = { ...downloads[idx], ...update };
      sendProgress({ id, ...update, status: downloads[idx].status });
      return;
    }

    const speedMatch = trimmed.match(
      /\bat\s+([\d.]+\s*(?:[KMGT]i?B|B)\/s)/i,
    );
    if (speedMatch) update.speed = speedMatch[1].trim();

    const sizeMatch = trimmed.match(
      /\bof\s+~?\s*([\d.]+\s*(?:[KMGT]i?B|B))\b/i,
    );
    if (sizeMatch) update.size = sizeMatch[1].trim();

    const fragTotalMatch = trimmed.match(/Total fragments:\s+(\d+)/);
    if (fragTotalMatch) {
      const total = parseInt(fragTotalMatch[1]);
      const u = {
        totalFragments: total,
        completedFragments: 0,
        lastMessage: `HLS: ${total} fragments`,
      };
      downloads[idx] = { ...downloads[idx], ...u };
      sendProgress({ id, ...u, status: downloads[idx].status });
      return;
    }

    const destMatch = trimmed.match(/^\[download\] Destination:\s+(.+)/);
    if (destMatch) {
      const u = {
        filePath: destMatch[1].trim(),
        lastMessage: "Downloading…",
      };
      downloads[idx] = { ...downloads[idx], ...u };
      sendProgress({ id, ...u, status: downloads[idx].status });
      return;
    }

    const mergeMatch = trimmed.match(
      /\[Merger\] Merging formats into "(.+)"/,
    );
    if (mergeMatch) {
      const u = {
        filePath: mergeMatch[1].trim(),
        lastMessage: "Merging…",
        progress: 99,
      };
      downloads[idx] = { ...downloads[idx], ...u };
      sendProgress({ id, ...u, status: downloads[idx].status });
      return;
    }

    const SUPPRESS_PATTERNS = [
      /Sleeping\s+[\d.]+\s+seconds/i,
      /^\[yt-dlp\s+DEBUG\]/i,
      /^\[debug\]/i,
    ];
    if (Object.keys(update).length === 0) {
      const suppress =
        downloads[idx].lastMessage.startsWith("Fragment") ||
        downloads[idx].lastMessage.startsWith("Retrying") ||
        SUPPRESS_PATTERNS.some((p) => p.test(trimmed));
      if (!suppress) update.lastMessage = trimmed;
    }

    if (Object.keys(update).length > 0) {
      downloads[idx] = { ...downloads[idx], ...update };
      sendProgress({ id, ...update, status: downloads[idx].status });
    }
  };

  let buf = "";
  let stderrBuf = "";

  const appendLog = (line) => {
    try {
      fs.appendFileSync(logPath, line + "\n", "utf8");
    } catch {}
  };

  proc.stdout.on("data", (chunk) => {
    buf += chunk.toString();
    const lines = buf.split(/\r\n|\r|\n/);
    buf = lines.pop();
    lines.forEach((l) => {
      appendLog(l);
      handleLine(l);
    });
  });
  proc.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    stderrBuf += text;
    text.split(/\r\n|\r|\n/).forEach((l) => {
      appendLog(l);
      handleLine(l);
    });
  });

  proc.on("error", (err) => {
    activeProcs.delete(id);
    const idx = downloads.findIndex((d) => d.id === id);
    if (idx === -1) return;
    const msg =
      err.code === "EACCES"
        ? `Permission denied, binary is not executable`
        : err.code === "ENOENT"
          ? `Binary not found`
          : `Failed to start downloader: ${err.message}`;
    downloads[idx].status = "error";
    downloads[idx].completedAt = Date.now();
    downloads[idx].lastMessage = msg;
    appendLog(msg);
    sendProgress({ id, status: "error", lastMessage: msg });
  });

  proc.on("close", (code) => {
    activeProcs.delete(id);
    if (buf.trim()) {
      appendLog(buf.trim());
      handleLine(buf.trim());
    }
    const idx = downloads.findIndex((d) => d.id === id);
    if (idx === -1) return;

    if (downloads[idx].status === "interrupted") {
      return; // Paused explicitly, ignore close status update
    }

    const status = code === 0 ? "completed" : "error";
    downloads[idx].status = status;
    downloads[idx].completedAt = Date.now();
    if (code === 0) {
      downloads[idx].progress = 100;
      downloads[idx].logPath = null;
      try {
        fs.unlinkSync(logPath);
      } catch {}
    } else {
      try {
        fs.appendFileSync(
          logPath,
          `${"─".repeat(60)}\nFailed: exit code ${code}\nFinished: ${new Date().toISOString()}\n`,
          "utf8",
        );
      } catch {}
      const errorLine =
        stderrBuf
          .split(/\r\n|\r|\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .reverse()
          .find((l) => /error|failed|unable|cannot|denied/i.test(l)) ||
        "";
      const prev = downloads[idx].lastMessage || "";
      const base = errorLine || prev;
      downloads[idx].lastMessage = base
        ? `${base} (exit ${code})`
        : `Download failed (exit code ${code})`;
    }

    if (code === 0 && !downloads[idx].filePath) {
      try {
        const VIDEO_EXTS = [
          ".mp4",
          ".mkv",
          ".webm",
          ".avi",
          ".ts",
          ".m4v",
        ];
        const match = fs
          .readdirSync(downloadPath)
          .filter((f) =>
            VIDEO_EXTS.some((e) => f.toLowerCase().endsWith(e)),
          )
          .map((f) => ({
            f,
            mtime: fs.statSync(path.join(downloadPath, f)).mtimeMs,
          }))
          .sort((a, b) => b.mtime - a.mtime)[0];
        if (match)
          downloads[idx].filePath = path.join(downloadPath, match.f);
      } catch {}
    }

    if (code === 0 && downloads[idx].filePath) {
      try {
        const ext = path.extname(downloads[idx].filePath) || ".mp4";
        const safeName = name
          .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (safeName) {
          const newPath = path.join(downloadPath, safeName + ext);
          if (newPath !== downloads[idx].filePath) {
            fs.renameSync(downloads[idx].filePath, newPath);
            downloads[idx].filePath = newPath;
          }
        }
      } catch {}
    }

    if (downloads[idx].filePath) {
      try {
        const bytes = fs.statSync(downloads[idx].filePath).size;
        downloads[idx].size =
          bytes > 1e9
            ? (bytes / 1e9).toFixed(2) + " GB"
            : bytes > 1e6
              ? (bytes / 1e6).toFixed(1) + " MB"
              : bytes > 1e3
                ? (bytes / 1e3).toFixed(1) + " KB"
                : bytes + " B";
      } catch {}
    }

    if (
      code === 0 &&
      downloads[idx].subtitles?.length > 0 &&
      downloads[idx].filePath
    ) {
      const videoBase = downloads[idx].filePath.replace(/\.[^.]+$/, "");
      const langCounter = {};
      const KNOWN_SUB_EXTS = [
        ".vtt",
        ".srt",
        ".ass",
        ".ssa",
        ".sub",
        ".idx",
      ];
      const subPromises = downloads[idx].subtitles.map(
        ({ url, lang, name: subName, file_id }) => {
          const urlClean = url.split("?")[0].split("#")[0];
          const urlExt = path
            .extname(urlClean)
            .toLowerCase()
            .replace(/[^a-z0-9.]/g, "");
          const nameExt = subName
            ? path
                .extname(subName)
                .toLowerCase()
                .replace(/[^a-z0-9.]/g, "")
            : "";
          const subExt = KNOWN_SUB_EXTS.includes(urlExt)
            ? urlExt
            : KNOWN_SUB_EXTS.includes(nameExt)
              ? nameExt
              : ".srt";
          const safeLang = (lang || "unknown").replace(
            /[^a-z0-9_-]/gi,
            "",
          );
          const lIdx = langCounter[safeLang] ?? 0;
          langCounter[safeLang] = lIdx + 1;
          const suffix = lIdx > 0 ? `.${lIdx}` : "";
          const subDestPath = `${videoBase}.${safeLang}${suffix}${subExt}`;
          return downloadSubtitleFile(url, subDestPath).then((ok) =>
            ok
               ? {
                  lang: lang || "unknown",
                  path: subDestPath,
                  file_id: file_id || null,
                }
              : null,
          );
        },
      );
      Promise.all(subPromises).then((results) => {
        const i2 = downloads.findIndex((d) => d.id === id);
        if (i2 !== -1) {
          downloads[i2].subtitlePaths = results.filter(Boolean);
          saveDownloads();
          sendProgress({
            id,
            subtitlePaths: downloads[i2].subtitlePaths,
          });
        }
      });
    }

    sendProgress({
      id,
      name,
      status: downloads[idx].status,
      progress: downloads[idx].progress,
      completedAt: downloads[idx].completedAt,
      filePath: downloads[idx].filePath,
      size: downloads[idx].size,
      completedFragments: downloads[idx].completedFragments,
      totalFragments: downloads[idx].totalFragments,
      lastMessage: downloads[idx].lastMessage,
      logPath: downloads[idx].logPath,
    });
    saveDownloads();
  });
}

function register(getMainWindow) {
  _getMainWindow = getMainWindow;

  ipcMain.handle("get-downloader-status", () => getDownloaderStatus());
  ipcMain.handle("install-downloader-tools", () => installDownloaderTools());
  ipcMain.handle("open-downloader-tools-folder", async () => {
    try {
      fs.mkdirSync(TOOL_DIR(), { recursive: true });
      await shell.openPath(TOOL_DIR());
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("check-downloader", () => getDownloaderStatus());

  ipcMain.handle(
    "run-download",
    async (
      _,
      {
        m3u8Url,
        name,
        downloadPath,
        mediaId,
        mediaType,
        season,
        episode,
        posterPath,
        tmdbId,
        subtitles,
      },
    ) => {
      try {
        const status = await getDownloaderStatus();
        if (!status.exists) {
          return {
            ok: false,
            error:
              "yt-dlp and ffmpeg are not ready. Install downloader tools from the download dialog or Settings, then retry.",
            status,
          };
        }
        const id = crypto.randomUUID();
        const logPath = path.join(os.tmpdir(), `orion_dl_${id}.log`);

        // Create title-specific subfolder inside downloadPath
        const cleanFolderName = safeFileName(
          mediaType === "tv" ? name.replace(/\s+S\d+\s*E\d+.*$/i, "") : name,
        );
        const targetDir = path.join(downloadPath, cleanFolderName);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const entry = {
          id,
          name,
          m3u8Url,
          downloadPath: targetDir,
          filePath: null,
          status: "downloading",
          progress: 0,
          speed: "",
          size: "",
          totalFragments: 0,
          completedFragments: 0,
          lastMessage: "Starting…",
          startedAt: Date.now(),
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
        };

        try {
          fs.writeFileSync(
            logPath,
            `Orion Download Log\nName: ${name}\nURL: ${m3u8Url}\nStarted: ${new Date().toISOString()}\n${"─".repeat(60)}\n`,
            "utf8",
          );
        } catch {}

        downloads.push(entry);

        const isSameMedia = (d) =>
          d.id !== id &&
          d.tmdbId &&
          d.tmdbId === entry.tmdbId &&
          d.mediaType === entry.mediaType &&
          String(d.season ?? "") === String(entry.season ?? "") &&
          String(d.episode ?? "") === String(entry.episode ?? "");
        downloads = downloads.filter((d) => !isSameMedia(d));

        const outputTemplate = path.join(targetDir, `${safeFileName(name)}.%(ext)s`);
        const ffmpegDir = path.dirname(status.ffmpeg.path);
        const args = [
          "--newline",
          "--no-playlist",
          "--retries",
          "10",
          "--fragment-retries",
          "10",
          "--ffmpeg-location",
          ffmpegDir,
          "-f",
          "best",
          "--merge-output-format",
          "mp4",
          "-o",
          outputTemplate,
          m3u8Url,
        ];

        const proc = spawn(status.ytDlp.path, args, {
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        });
        activeProcs.set(id, proc);

        trackProcess(id, proc, name, targetDir, logPath);

        return { ok: true, id };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
  );

  ipcMain.handle("pause-download", (_, id) => {
    try {
      const proc = activeProcs.get(id);
      if (proc) {
        proc.kill("SIGKILL");
        activeProcs.delete(id);
      }
      const idx = downloads.findIndex((d) => d.id === id);
      if (idx !== -1) {
        downloads[idx].status = "interrupted";
        downloads[idx].lastMessage = "Paused";
        sendProgress({
          id,
          status: "interrupted",
          lastMessage: "Paused",
        });
        saveDownloads();
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("resume-download", async (_, { id }) => {
    try {
      const status = await getDownloaderStatus();
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
          `\n${"─".repeat(60)}\nResumed: ${new Date().toISOString()}\nURL: ${entry.m3u8Url}\n${"─".repeat(60)}\n`,
          "utf8",
        );
      } catch {}

      const outputTemplate = path.join(
        entry.downloadPath,
        `${safeFileName(entry.name)}.%(ext)s`,
      );
      const args = [
        "--newline",
        "--no-playlist",
        "--retries",
        "10",
        "--fragment-retries",
        "10",
        "--ffmpeg-location",
        path.dirname(status.ffmpeg.path),
        "-f",
        "best",
        "--merge-output-format",
        "mp4",
        "-o",
        outputTemplate,
        entry.m3u8Url,
      ];

      const proc = spawn(status.ytDlp.path, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      activeProcs.set(id, proc);

      trackProcess(id, proc, entry.name, entry.downloadPath, entry.logPath);

      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("get-downloads", () => downloads);

  ipcMain.handle("delete-download", (_, { id, filePath }) => {
    try {
      const dlEntry = downloads.find((d) => d.id === id);
      if (activeProcs.has(id)) {
        try {
          activeProcs.get(id).kill("SIGKILL");
        } catch {}
        activeProcs.delete(id);
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

  ipcMain.handle("file-exists", (_, filePath) => {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  });

  ipcMain.handle("pick-folder", async () => {
    const mw = getMainWindow();
    if (!mw) return null;
    const result = await dialog.showOpenDialog(mw, {
      properties: ["openDirectory"],
      title: "Select Folder",
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("open-external", (_, url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        shell.openExternal(url);
      }
    } catch {}
  });

  ipcMain.handle("open-path", (_, filePath) => {
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        shell.openPath(filePath);
      } else {
        shell.showItemInFolder(filePath);
      }
    } catch {
      shell.openPath(filePath);
    }
  });

  ipcMain.handle("get-install-path", () => {
    if (process.env.APPIMAGE) {
      return path.dirname(process.env.APPIMAGE);
    }

    if (app.isPackaged) {
      return path.dirname(process.execPath);
    }

    return app.getAppPath();
  });

  ipcMain.handle("scan-directory", (_, folderPath) => {
    try {
      if (!folderPath || !fs.existsSync(folderPath)) return [];
      const VIDEO_EXTS = [
        ".mp4",
        ".mkv",
        ".webm",
        ".avi",
        ".mov",
        ".m4v",
        ".ts",
      ];
      const results = [];
      const scanDir = (dir, depth = 0) => {
        if (depth > 3) return;
        let entries;
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath, depth + 1);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (VIDEO_EXTS.includes(ext)) {
              let size = "";
              try {
                const bytes = fs.statSync(fullPath).size;
                size =
                  bytes > 1e9
                    ? (bytes / 1e9).toFixed(2) + " GB"
                    : bytes > 1e6
                      ? (bytes / 1e6).toFixed(1) + " MB"
                      : bytes > 1e3
                        ? (bytes / 1e3).toFixed(1) + " KB"
                        : bytes + " B";
              } catch {}
              results.push({
                filePath: fullPath,
                name: path.basename(entry.name, ext),
                size,
                ext,
              });
            }
          }
        }
      };
      scanDir(folderPath);
      return results;
    } catch {
      return [];
    }
  });

  ipcMain.handle("clear-app-cache", async () => {
    try {
      const sessions = [
        session.defaultSession,
        session.fromPartition("persist:player"),
        session.fromPartition("persist:trailer"),
      ];
      await Promise.all(sessions.map((s) => s.clearCache()));
      await Promise.all(
        sessions.map((s) =>
          s.clearStorageData({
            storages: ["shadercache", "serviceworkers", "cachestorage"],
          }),
        ),
      );
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("clear-watch-data", async () => {
    try {
      const vs = session.fromPartition("persist:player");
      await vs.clearStorageData();
      await vs.clearCache();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("get-cache-size", async () => {
    try {
      const sessions = [
        session.defaultSession,
        session.fromPartition("persist:player"),
        session.fromPartition("persist:trailer"),
      ];
      const sizes = await Promise.all(sessions.map((s) => s.getCacheSize()));
      return { bytes: sizes.reduce((a, b) => a + b, 0) };
    } catch {
      return { bytes: 0 };
    }
  });

  ipcMain.handle("reset-app", async () => {
    try {
      const sessions = [
        session.defaultSession,
        session.fromPartition("persist:player"),
        session.fromPartition("persist:trailer"),
      ];
      await Promise.all(sessions.map((s) => s.clearStorageData()));
      await Promise.all(sessions.map((s) => s.clearCache()));
      const dlFile = downloadsFile();
      if (fs.existsSync(dlFile)) fs.unlinkSync(dlFile);
      downloads = [];
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
}

module.exports = {
  register,
  loadDownloads,
  saveDownloads,
  killAllDownloads,
  getDownloads: () => downloads,
};
