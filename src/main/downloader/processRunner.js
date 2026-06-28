const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { resolveSubtitleAsset } = require("../subtitles/ipc");
const DOWNLOAD_STALL_TIMEOUT_MS = 5 * 60 * 1000;
const DOWNLOAD_STALL_CHECK_MS = 15 * 1000;

function parseClock(value) {
  const parts = String(value || "").split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || null;
}

function parseByteSize(value) {
  const match = String(value || "").trim().match(/^([\d.]+)\s*([KMGT]?i?B)$/i);
  if (!match) return null;
  const base = /iB$/i.test(match[2]) ? 1024 : 1000;
  const powers = { B: 0, KB: 1, KIB: 1, MB: 2, MIB: 2, GB: 3, GIB: 3, TB: 4, TIB: 4 };
  return Math.round(parseFloat(match[1]) * base ** (powers[match[2].toUpperCase()] || 0));
}

function killProcessTree(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === "win32" && proc.pid) {
      spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    } else {
      proc.kill("SIGKILL");
    }
  } catch {}
}

function trackProcess(context, id, proc, name, downloadPath, logPath, cookiePath, cleanup) {
  const { activeProcs, killProcessTree, saveDownloads, sendProgress } = context;
  let lastProgressAt = Date.now();
  let lastProgressSignature = "";
  let stallTimer = null;
  let consecutiveFragmentFailures = 0;
  let lastPersistedAt = 0;

  const markProgressActivity = (entry, update) => {
    const signature = [
      update.completedFragments ?? entry.completedFragments ?? "",
      update.progress ?? entry.progress ?? "",
      update.size ?? entry.size ?? "",
    ].join("|");
    if (signature && signature !== lastProgressSignature) {
      lastProgressSignature = signature;
      lastProgressAt = Date.now();
    }
  };

  const handleLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const idx = context.downloads.findIndex((d) => d.id === id);
    if (idx === -1) return;

    const update = {};
    const etaMatch = trimmed.match(/\bETA\s+([\d:]+)/i);
    if (etaMatch) update.etaSeconds = parseClock(etaMatch[1]);

    const fragMatch = trimmed.match(/\(frag\s+(\d+)\/(\d+)\)/);
    if (fragMatch) {
      consecutiveFragmentFailures = 0;
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

    if (!fragMatch && !context.downloads[idx].totalFragments) {
      const dlPctMatch = trimmed.match(
        /^\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+\s*(?:[KMGT]i?B|B))/i,
      );
      if (dlPctMatch) {
        const pct = parseFloat(dlPctMatch[1]);
        update.progress = Math.min(99, Math.round(pct));
        update.size = dlPctMatch[2].trim();
        update.totalBytes = parseByteSize(update.size);
        if (update.totalBytes) update.downloadedBytes = Math.round(update.totalBytes * pct / 100);
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
      if (totalSecs > 0) context.downloads[idx]._ffmpegTotalSecs = totalSecs;
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
      const totalSecs = context.downloads[idx]._ffmpegTotalSecs || 0;
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
      trimmed.match(/Read timed? out/i) ||
      trimmed.match(/HTTP Error 403|Forbidden|fragment not found/i);
    if (retryMatch) {
      // A retry is active recovery, not an idle stall. Let yt-dlp exhaust its
      // configured retry budget instead of the watchdog terminating it early.
      lastProgressAt = Date.now();
      update.speed = "0 MB/s";
      update.retryCount = (context.downloads[idx].retryCount || 0) + 1;
      const retryNumMatch = trimmed.match(/Retrying\s+\((\d+)\/(\d+)\)/i);
      update.lastMessage = retryNumMatch
        ? `Retrying… (${retryNumMatch[1]}/${retryNumMatch[2]})`
        : "Retrying…";
      if (/HTTP Error 403|Forbidden|fragment not found/i.test(trimmed)) {
        consecutiveFragmentFailures += 1;
        update.lastMessage =
          consecutiveFragmentFailures >= 3
            ? "Repeated fragment errors; extended recovery is still in progress…"
            : "A video fragment failed; retrying…";
      }

      update.updatedAt = Date.now();
      context.downloads[idx] = { ...context.downloads[idx], ...update };
      sendProgress({ id, ...update, status: context.downloads[idx].status });

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
    if (sizeMatch) {
      update.totalBytes = parseByteSize(update.size);
      const pct = Number(update.progress ?? context.downloads[idx].progress);
      if (update.totalBytes && Number.isFinite(pct)) {
        update.downloadedBytes = Math.round(update.totalBytes * pct / 100);
      }
    }

    const fragTotalMatch = trimmed.match(/Total fragments:\s+(\d+)/);
    if (fragTotalMatch) {
      const total = parseInt(fragTotalMatch[1]);
      const u = {
        totalFragments: total,
        completedFragments: 0,
        lastMessage: `HLS: ${total} fragments`,
      };
      context.downloads[idx] = { ...context.downloads[idx], ...u };
      sendProgress({ id, ...u, status: context.downloads[idx].status });
      return;
    }

    const destMatch = trimmed.match(/^\[download\] Destination:\s+(.+)/);
    if (destMatch) {
      const u = {
        filePath: destMatch[1].trim(),
        lastMessage: "Downloading…",
      };
      context.downloads[idx] = { ...context.downloads[idx], ...u };
      sendProgress({ id, ...u, status: context.downloads[idx].status });
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
      context.downloads[idx] = { ...context.downloads[idx], ...u };
      sendProgress({ id, ...u, status: context.downloads[idx].status });
      return;
    }

    const SUPPRESS_PATTERNS = [
      /Sleeping\s+[\d.]+\s+seconds/i,
      /^\[yt-dlp\s+DEBUG\]/i,
      /^\[debug\]/i,
    ];
    if (Object.keys(update).length === 0) {
      const suppress =
        context.downloads[idx].lastMessage.startsWith("Fragment") ||
        context.downloads[idx].lastMessage.startsWith("Retrying") ||
        SUPPRESS_PATTERNS.some((p) => p.test(trimmed));
      if (!suppress) update.lastMessage = trimmed;
    }

    if (Object.keys(update).length > 0) {
      update.updatedAt = Date.now();
      markProgressActivity(context.downloads[idx], update);
      context.downloads[idx] = { ...context.downloads[idx], ...update };
      sendProgress({ id, ...update, status: context.downloads[idx].status });
      if (update.updatedAt - lastPersistedAt >= 5000) {
        lastPersistedAt = update.updatedAt;
        saveDownloads();
      }
    }
  };

  let buf = "";
  let stderrBuf = "";

  const appendLog = (line) => {
    try {
      fs.appendFileSync(logPath, line + "\n", "utf8");
    } catch {}
  };

  stallTimer = setInterval(() => {
    const idx = context.downloads.findIndex((d) => d.id === id);
    if (idx === -1 || context.downloads[idx].status !== "downloading") return;
    const idleMs = Date.now() - lastProgressAt;
    if (idleMs < DOWNLOAD_STALL_TIMEOUT_MS) return;

    const msg =
      "Download stalled: no fragment, byte, or retry activity for 5 minutes. The streaming source likely stopped responding.";
    context.downloads[idx].status = "failed";
    context.downloads[idx].completedAt = Date.now();
    context.downloads[idx].lastMessage = msg;
    context.downloads[idx].speed = "0 MB/s";
    appendLog(msg);
    sendProgress({
      id,
      status: "failed",
      lastMessage: msg,
      speed: "0 MB/s",
    });
    saveDownloads();

    try {
      killProcessTree(proc);
    } catch {}
  }, DOWNLOAD_STALL_CHECK_MS);

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
    if (stallTimer) clearInterval(stallTimer);
    try {
      cleanup?.();
    } catch {}
    if (cookiePath) {
      try {
        if (fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath);
      } catch {}
    }
    activeProcs.delete(id);
    const idx = context.downloads.findIndex((d) => d.id === id);
    if (idx === -1) return;
    const msg =
      err.code === "EACCES"
        ? `Permission denied, binary is not executable`
        : err.code === "ENOENT"
          ? `Binary not found`
          : `Failed to start downloader: ${err.message}`;
    context.downloads[idx].status = "failed";
    context.downloads[idx].completedAt = Date.now();
    context.downloads[idx].lastMessage = msg;
    appendLog(msg);
    sendProgress({ id, status: "failed", lastMessage: msg });
    saveDownloads();
  });

  proc.on("close", (code) => {
    if (stallTimer) clearInterval(stallTimer);
    try {
      cleanup?.();
    } catch {}
    if (cookiePath) {
      try {
        if (fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath);
      } catch {}
    }
    activeProcs.delete(id);
    if (buf.trim()) {
      appendLog(buf.trim());
      handleLine(buf.trim());
    }
    const idx = context.downloads.findIndex((d) => d.id === id);
    if (idx === -1) return;

    if (["interrupted", "paused"].includes(context.downloads[idx].status)) {
      return; // Paused explicitly, ignore close status update
    }

    const wasAlreadyError = context.downloads[idx].status === "failed";
    const status = code === 0 ? "completed" : "failed";
    context.downloads[idx].status = status;
    context.downloads[idx].completedAt = Date.now();
    if (code === 0) {
      context.downloads[idx].progress = 100;
      context.downloads[idx].logPath = null;
      try {
        fs.unlinkSync(logPath);
      } catch {}
    } else if (!wasAlreadyError) {
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
      const prev = context.downloads[idx].lastMessage || "";
      const base = errorLine || prev;
      context.downloads[idx].lastMessage = base
        ? `${base} (exit ${code})`
        : `Download failed (exit code ${code})`;
    } else {
      try {
        fs.appendFileSync(
          logPath,
          `${"─".repeat(60)}\nStopped after prior error: exit code ${code}\nFinished: ${new Date().toISOString()}\n`,
          "utf8",
        );
      } catch {}
    }

    if (code === 0 && !context.downloads[idx].filePath) {
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
          context.downloads[idx].filePath = path.join(downloadPath, match.f);
      } catch {}
    }

    if (code === 0 && context.downloads[idx].filePath) {
      try {
        const ext = path.extname(context.downloads[idx].filePath) || ".mp4";
        const safeName = name
          .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (safeName) {
          const newPath = path.join(downloadPath, safeName + ext);
          if (newPath !== context.downloads[idx].filePath) {
            fs.renameSync(context.downloads[idx].filePath, newPath);
            context.downloads[idx].filePath = newPath;
          }
        }
      } catch {}
    }

    if (context.downloads[idx].filePath) {
      try {
        const bytes = fs.statSync(context.downloads[idx].filePath).size;
        context.downloads[idx].size =
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
      context.downloads[idx].subtitles?.length > 0 &&
      context.downloads[idx].filePath
    ) {
      const videoBase = context.downloads[idx].filePath.replace(/\.[^.]+$/, "");
      const langCounter = {};
      const subPromises = context.downloads[idx].subtitles.map(async (subtitle) => {
          const lang = subtitle.language || subtitle.lang || "unknown";
          const safeLang = lang.replace(/[^a-z0-9_-]/gi, "");
          const lIdx = langCounter[safeLang] ?? 0;
          langCounter[safeLang] = lIdx + 1;
          const suffix = lIdx > 0 ? `.${lIdx}` : "";
          try {
            const asset = await resolveSubtitleAsset(subtitle);
            const subDestPath = `${videoBase}.${safeLang}${suffix}.${asset.ext}`;
            fs.writeFileSync(subDestPath, asset.data);
            return {
              lang,
              path: subDestPath,
              file_id: subtitle.file_id || null,
              release: subtitle.release || subtitle.file_name || null,
              source: subtitle.via_subdl ? "subdl" : subtitle.via_wyzie ? "wyzie" : "stream",
            };
          } catch (error) {
            try { fs.appendFileSync(logPath, `Subtitle failed (${lang}): ${error.message}\n`, "utf8"); } catch {}
            return null;
          }
        });
      Promise.all(subPromises).then((results) => {
        const i2 = context.downloads.findIndex((d) => d.id === id);
        if (i2 !== -1) {
          context.downloads[i2].subtitlePaths = results.filter(Boolean);
          saveDownloads();
          sendProgress({
            id,
            subtitlePaths: context.downloads[i2].subtitlePaths,
          });
        }
      });
    }

    sendProgress({
      id,
      name,
      status: context.downloads[idx].status,
      progress: context.downloads[idx].progress,
      completedAt: context.downloads[idx].completedAt,
      filePath: context.downloads[idx].filePath,
      size: context.downloads[idx].size,
      completedFragments: context.downloads[idx].completedFragments,
      totalFragments: context.downloads[idx].totalFragments,
      lastMessage: context.downloads[idx].lastMessage,
      logPath: context.downloads[idx].logPath,
    });
    saveDownloads();
  });
}

module.exports = { killProcessTree, parseByteSize, parseClock, trackProcess };
