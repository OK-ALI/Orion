const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const { safeFileName } = require("./paths");
const { isSegmentExtension } = require("./mediaSegments");

const VIDEO_EXTS = new Set([".mp4", ".mkv", ".webm", ".mov", ".m4v", ".ts", ".m4s", ".cmfv", ".cmfa"]);

function parseDurationClock(value) {
  const match = String(value || "").match(/(\d+):(\d+):([\d.]+)/);
  if (!match) return 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function parseFfmpegInspection(stderr) {
  const text = String(stderr || "");
  const duration = text.match(/Duration:\s*([^,\r\n]+)/i)?.[1] || "";
  return {
    durationSeconds: parseDurationClock(duration),
    hasVideo: /Stream\s+#.*:\s*Video:/i.test(text),
    hasAudio: /Stream\s+#.*:\s*Audio:/i.test(text),
    invalidData: /Invalid data found|moov atom not found|could not find codec parameters|error reading header/i.test(text),
  };
}

function assessMediaArtifact(probe, options = {}) {
  const expected = Number(options.expectedDurationSeconds) || 0;
  const confidence = options.expectedDurationConfidence === "approximate" ? "approximate" : "exact";
  if (probe.invalidData) return { ok: false, code: "invalid_container", error: "Downloaded file is not a valid playable media container. Try another captured source." };
  if (!probe.hasVideo) return { ok: false, code: "no_video", error: "Downloaded artifact does not contain a video stream. Try another captured source." };
  if (!probe.hasAudio) return { ok: false, code: "no_audio", error: "Downloaded artifact does not contain an audio stream. Try another captured source." };
  if (!(probe.durationSeconds > 0)) return { ok: false, code: "no_duration", error: "Downloaded media duration could not be verified. Try another captured source." };

  if (expected > 0) {
    const ratio = probe.durationSeconds / expected;
    const minRatio = confidence === "approximate" ? 0.3 : 0.55;
    const maxRatio = confidence === "approximate" ? 2.5 : 1.6;
    if (ratio < minRatio || ratio > maxRatio) {
      const actualMin = Math.max(0.1, probe.durationSeconds / 60).toFixed(1);
      const expectedMin = Math.max(0.1, expected / 60).toFixed(1);
      return {
        ok: false,
        code: "duration_mismatch",
        error: `Invalid stream: downloaded media is ${actualMin} min, but this title is expected to be about ${expectedMin} min. Try another captured source.`,
      };
    }
  } else if (probe.durationSeconds < 30) {
    return {
      ok: false,
      code: "obvious_auxiliary",
      error: `Invalid stream: downloaded media is only ${probe.durationSeconds.toFixed(1)} seconds and looks like an auxiliary/ad clip. Try another captured source.`,
    };
  }
  return { ok: true };
}

function findTaskArtifact(entry) {
  if (entry.filePath && fs.existsSync(entry.filePath)) {
    const ext = path.extname(entry.filePath).toLowerCase();
    const owned = !entry.outputStem || path.basename(entry.filePath).toLowerCase().startsWith(`${entry.outputStem}.`.toLowerCase());
    if (owned && VIDEO_EXTS.has(ext)) return entry.filePath;
  }
  if (!entry.downloadPath || !entry.outputStem || !fs.existsSync(entry.downloadPath)) return null;
  const prefix = `${entry.outputStem}.`.toLowerCase();
  const matches = fs.readdirSync(entry.downloadPath)
    .filter((name) => name.toLowerCase().startsWith(prefix))
    .filter((name) => VIDEO_EXTS.has(path.extname(name).toLowerCase()))
    .filter((name) => !/\.part(?:\.|$)|\.tmp$/i.test(name))
    .map((name) => {
      const fullPath = path.join(entry.downloadPath, name);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return matches[0]?.fullPath || null;
}

function inspectWithFfmpeg(ffmpegPath, filePath) {
  return new Promise((resolve, reject) => {
    const executable = ffmpegPath || "ffmpeg";
    execFile(
      executable,
      ["-hide_banner", "-i", filePath],
      { windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const probe = parseFfmpegInspection(`${stdout || ""}\n${stderr || ""}`);
        if (probe.hasVideo || probe.hasAudio || probe.durationSeconds > 0 || probe.invalidData) {
          resolve(probe);
          return;
        }
        if (error?.code === "ENOENT") {
          reject(Object.assign(new Error("ffmpeg is unavailable for final media verification."), { code: "verification_tool_missing" }));
          return;
        }
        if (error?.killed) {
          reject(Object.assign(new Error("Final media verification timed out."), { code: "verification_timeout" }));
          return;
        }
        reject(Object.assign(new Error("ffmpeg could not inspect the downloaded artifact."), { code: "verification_failed" }));
      },
    );
  });
}

function uniqueFinalPath(downloadPath, name, ext, currentPath) {
  const base = safeFileName(name);
  let candidate = path.join(downloadPath, `${base}${ext}`);
  if (path.resolve(candidate) === path.resolve(currentPath) || !fs.existsSync(candidate)) return candidate;
  for (let index = 2; index < 1000; index += 1) {
    candidate = path.join(downloadPath, `${base} (${index})${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error("Could not choose a unique final filename for the verified download.");
}

async function verifyDownloadedArtifact(entry, { ffmpegPath, appendLog = () => {} } = {}) {
  const artifactPath = findTaskArtifact(entry);
  if (!artifactPath) {
    return { ok: false, code: "artifact_missing", error: "Downloader exited successfully, but Orion could not find this task's media artifact." };
  }
  let stat;
  try {
    stat = fs.statSync(artifactPath);
  } catch {
    return { ok: false, code: "artifact_missing", error: "Downloaded artifact disappeared before verification." };
  }
  if (!stat.isFile() || stat.size <= 0) {
    return { ok: false, code: "artifact_empty", error: "Downloaded artifact is empty." };
  }

  if (isSegmentExtension(artifactPath)) {
    appendLog(`Verification: rejected streaming segment artifact ${path.extname(artifactPath).toLowerCase()}.`);
    return {
      ok: false,
      code: "media_segment",
      error: "Invalid stream: the downloaded file is only a streaming media segment, not the full movie or episode. Try another captured source.",
      filePath: artifactPath,
    };
  }

  let probe;
  try {
    probe = await inspectWithFfmpeg(ffmpegPath, artifactPath);
  } catch (error) {
    return { ok: false, code: error.code || "verification_failed", error: error.message, filePath: artifactPath };
  }
  const assessment = assessMediaArtifact(probe, {
    expectedDurationSeconds: entry.expectedDurationSeconds,
    expectedDurationConfidence: entry.expectedDurationConfidence,
  });
  appendLog(`Verification: video=${probe.hasVideo} audio=${probe.hasAudio} duration=${probe.durationSeconds.toFixed(2)}s expected=${Number(entry.expectedDurationSeconds) || 0}s`);
  if (!assessment.ok) return { ...assessment, ...probe, filePath: artifactPath };

  const ext = path.extname(artifactPath) || ".mp4";
  const finalPath = uniqueFinalPath(entry.downloadPath, entry.name, ext, artifactPath);
  if (path.resolve(finalPath) !== path.resolve(artifactPath)) fs.renameSync(artifactPath, finalPath);
  return { ok: true, ...probe, filePath: finalPath, bytes: stat.size };
}

module.exports = {
  assessMediaArtifact,
  findTaskArtifact,
  parseDurationClock,
  parseFfmpegInspection,
  verifyDownloadedArtifact,
};
