const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { resolveSubtitleAsset } = require("../subtitles/ipc");
const { verifyDownloadedArtifact } = require("./artifactVerifier");
const { finalizationWatchdogAction } = require("./finalizationWatchdog");
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

function trackProcess(context, id, proc, name, downloadPath, logPath, cookiePath, cleanup, verificationTools = {}) {
  const { activeProcs, killProcessTree, saveDownloads, sendProgress } = context;
  let lastProgressAt = Date.now();
  let lastProgressSignature = "";
  let stallTimer = null;
  let consecutiveFragmentFailures = 0;
  let lastPersistedAt = 0;
  let terminalRecoveryRequested = false;

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
    const entry = context.downloads[idx];
    const idleMs = Date.now() - lastProgressAt;
    const finalizationAction = finalizationWatchdogAction(entry, idleMs);

    if (finalizationAction === "recover") {
      entry.finalizationRecoveryCount = (Number(entry.finalizationRecoveryCount) || 0) + 1;
      entry.lastMessage = "Finalizing stream… Orion is rechecking the completed fragments.";
      entry.speed = "0 MB/s";
      entry.updatedAt = Date.now();
      terminalRecoveryRequested = true;
      appendLog(
        `Automatic finalization recovery ${entry.finalizationRecoveryCount}: terminal fragment state stayed idle for ${Math.round(idleMs / 1000)}s. Restarting the same task with continuation enabled.`,
      );
      sendProgress({
        id,
        status: "downloading",
        lastMessage: entry.lastMessage,
        speed: entry.speed,
        finalizationRecoveryCount: entry.finalizationRecoveryCount,
      });
      saveDownloads();
      try {
        killProcessTree(proc);
      } catch {}
      return;
    }

    if (finalizationAction === "fail") {
      const msg =
        "Download reached the end of its fragments, but stream finalization remained stalled after Orion's automatic recovery. Diagnostics were preserved.";
      entry.status = "failed";
      entry.completedAt = Date.now();
      entry.lastMessage = msg;
      entry.speed = "0 MB/s";
      appendLog(msg);
      sendProgress({ id, status: "failed", lastMessage: msg, speed: "0 MB/s" });
      saveDownloads();
      try {
        killProcessTree(proc);
      } catch {}
      return;
    }

    if (idleMs < DOWNLOAD_STALL_TIMEOUT_MS) return;

    const msg =
      "Download stalled: no fragment, byte, or retry activity for 5 minutes. The streaming source likely stopped responding.";
    entry.status = "failed";
    entry.completedAt = Date.now();
    entry.lastMessage = msg;
    entry.speed = "0 MB/s";
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

  proc.on("close", async (code) => {
    if (stallTimer) clearInterval(stallTimer);
    try { cleanup?.(); } catch {}
    if (cookiePath) {
      try { if (fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath); } catch {}
    }
    activeProcs.delete(id);
    if (buf.trim()) {
      appendLog(buf.trim());
      handleLine(buf.trim());
    }
    const idx = context.downloads.findIndex((d) => d.id === id);
    if (idx === -1) return;
    const entry = context.downloads[idx];
    if (["interrupted", "paused"].includes(entry.status)) return;

    if (terminalRecoveryRequested) {
      terminalRecoveryRequested = false;
      appendLog(`${"─".repeat(60)}\nAutomatic finalization recovery restarting the same task.`);
      try {
        const recovered = await verificationTools.recoverTerminalStall?.();
        if (!recovered?.ok) {
          throw new Error(recovered?.error || "Automatic finalization recovery could not restart the download.");
        }
      } catch (error) {
        entry.status = "failed";
        entry.completedAt = Date.now();
        entry.lastMessage = error.message || "Automatic finalization recovery failed.";
        appendLog(`Automatic finalization recovery FAILED: ${entry.lastMessage}`);
        sendProgress({
          id,
          status: "failed",
          lastMessage: entry.lastMessage,
          completedAt: entry.completedAt,
          logPath: entry.logPath,
        });
        saveDownloads();
      }
      return;
    }

    if (entry.status === "failed") {
      appendLog(`${"─".repeat(60)}\nStopped after prior error: exit code ${code}\nFinished: ${new Date().toISOString()}`);
      saveDownloads();
      return;
    }

    if (code !== 0) {
      appendLog(`${"─".repeat(60)}\nFailed: exit code ${code}\nFinished: ${new Date().toISOString()}`);
      const errorLine = stderrBuf
        .split(/\r\n|\r|\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .reverse()
        .find((line) => /error|failed|unable|cannot|denied/i.test(line)) || "";
      entry.status = "failed";
      entry.completedAt = Date.now();
      entry.lastMessage = errorLine
        ? `${errorLine} (exit ${code})`
        : `Download failed (exit code ${code})`;
      sendProgress({ id, status: "failed", lastMessage: entry.lastMessage, completedAt: entry.completedAt, logPath: entry.logPath });
      saveDownloads();
      return;
    }

    entry.status = "processing";
    entry.progress = 99;
    entry.lastMessage = "Verifying downloaded media…";
    entry.completedAt = null;
    sendProgress({ id, status: "processing", progress: 99, lastMessage: entry.lastMessage });
    saveDownloads();
    appendLog(`${"─".repeat(60)}\nDownloader process exited 0. Final media verification started.`);

    let verification;
    try {
      verification = await verifyDownloadedArtifact(entry, {
        ffmpegPath: verificationTools.ffmpegPath,
        appendLog,
      });
    } catch (error) {
      verification = {
        ok: false,
        code: "verification_exception",
        error: error.message || "Final media verification failed unexpectedly.",
      };
    }
    entry.verification = {
      ok: Boolean(verification.ok),
      code: verification.code || null,
      durationSeconds: Number(verification.durationSeconds) || null,
      expectedDurationSeconds: Number(entry.expectedDurationSeconds) || null,
      hasVideo: verification.hasVideo ?? null,
      hasAudio: verification.hasAudio ?? null,
    };

    if (!verification.ok) {
      entry.status = "failed";
      entry.completedAt = Date.now();
      entry.progress = Math.min(99, Number(entry.progress) || 99);
      entry.filePath = verification.filePath || entry.filePath || null;
      entry.lastMessage = verification.error || "Downloaded artifact failed media verification. Try another captured source.";
      appendLog(`Verification FAILED [${verification.code || "unknown"}]: ${entry.lastMessage}`);
      if (["invalid_container", "no_video", "no_audio", "no_duration", "duration_mismatch", "obvious_auxiliary", "artifact_empty", "media_segment"].includes(verification.code) && entry.filePath) {
        try {
          if (fs.existsSync(entry.filePath)) fs.unlinkSync(entry.filePath);
          appendLog("Rejected task-owned artifact removed after failed verification.");
          entry.filePath = null;
        } catch (error) {
          appendLog(`Could not remove rejected artifact: ${error.message}`);
        }
      }
      sendProgress({
        id,
        status: "failed",
        progress: entry.progress,
        completedAt: entry.completedAt,
        filePath: entry.filePath,
        lastMessage: entry.lastMessage,
        logPath: entry.logPath,
        verification: entry.verification,
      });
      saveDownloads();
      return;
    }

    entry.filePath = verification.filePath;
    entry.status = "completed";
    entry.completedAt = Date.now();
    entry.progress = 100;
    entry.lastMessage = "Verified media ready to watch";
    try {
      const bytes = fs.statSync(entry.filePath).size;
      entry.downloadedBytes = bytes;
      entry.totalBytes = bytes;
      entry.size = bytes > 1e9
        ? `${(bytes / 1e9).toFixed(2)} GB`
        : bytes > 1e6
          ? `${(bytes / 1e6).toFixed(1)} MB`
          : bytes > 1e3
            ? `${(bytes / 1e3).toFixed(1)} KB`
            : `${bytes} B`;
    } catch {}
    appendLog(`Verification PASSED. Final file: ${entry.filePath}`);

    if (entry.subtitles?.length > 0 && entry.filePath) {
      const videoBase = entry.filePath.replace(/\.[^.]+$/, "");
      const langCounter = {};
      const results = await Promise.all(entry.subtitles.map(async (subtitle) => {
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
          appendLog(`Subtitle failed (${lang}): ${error.message}`);
          return null;
        }
      }));
      entry.subtitlePaths = results.filter(Boolean);
    }

    sendProgress({
      id,
      name,
      status: entry.status,
      progress: entry.progress,
      completedAt: entry.completedAt,
      filePath: entry.filePath,
      size: entry.size,
      downloadedBytes: entry.downloadedBytes,
      totalBytes: entry.totalBytes,
      completedFragments: entry.completedFragments,
      totalFragments: entry.totalFragments,
      lastMessage: entry.lastMessage,
      subtitlePaths: entry.subtitlePaths,
      verification: entry.verification,
      logPath: null,
    });
    saveDownloads();
    entry.logPath = null;
    saveDownloads();
    try { fs.unlinkSync(logPath); } catch {}
  });
}

module.exports = { killProcessTree, parseByteSize, parseClock, trackProcess };
