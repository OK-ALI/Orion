const { app } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { downloadFile, extractFfmpeg, findWorkingBinary } = require("./downloaderHelper");
let _getMainWindow = () => null;
function configure(getMainWindow) { _getMainWindow = getMainWindow; }

const trustedBinaryPaths = new Map();

let installingTools = false;

const TOOL_DIR = () => path.join(app.getPath("userData"), "tools");

const YTDLP_NAME = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";

const FFMPEG_NAME = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

function toolPath(name) {
  return path.join(TOOL_DIR(), name);
}

function temporaryExecutableName(name) {
  if (process.platform === "win32" && name.toLowerCase().endsWith(".exe")) {
    return `${name.slice(0, -4)}.download.exe`;
  }
  return `${name}.download`;
}

function sendToolInstallProgress(update) {
  const mw = _getMainWindow();
  if (mw && !mw.isDestroyed()) {
    mw.webContents.send("downloader-tools-progress", update);
  }
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

function checkHelperDownloader(folderPath) {
  if (!folderPath) return { exists: false, reason: "no_folder" };
  let entries;
  try {
    entries = fs.readdirSync(folderPath);
  } catch (e) {
    return {
      exists: false,
      reason: e.code === "EACCES" ? "folder_permission" : "folder_unreadable",
    };
  }
  if (!entries.includes("_internal")) {
    return { exists: false, reason: "no_internal" };
  }
  const binary = entries.find((entry) => {
    if (entry === "_internal" || entry.startsWith(".")) return false;
    try {
      const stat = fs.statSync(path.join(folderPath, entry));
      if (!stat.isFile()) return false;
      return process.platform === "win32" ? entry.endsWith(".exe") : !!(stat.mode & 0o111);
    } catch {
      return false;
    }
  });
  if (!binary) return { exists: false, reason: "no_executable" };
  const token = crypto.randomUUID();
  const binaryPath = path.join(folderPath, binary);
  trustedBinaryPaths.set(token, binaryPath);
  return { exists: true, ready: true, token, folderPath, binary };
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
  const ytTemp = toolPath(temporaryExecutableName(YTDLP_NAME));
  const ffTemp = toolPath(temporaryExecutableName(FFMPEG_NAME));
  const ffZip = path.join(TOOL_DIR(), "ffmpeg-release-essentials.zip");
  try {
    fs.mkdirSync(TOOL_DIR(), { recursive: true });
    sendToolInstallProgress({ step: "Preparing", progress: 0 });

    await downloadFile(
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
      ytTemp,
      "yt-dlp",
      (p) => sendToolInstallProgress({ step: "Downloading yt-dlp", progress: p })
    );
    const ytVerification = await findWorkingBinary([ytTemp], ["--version"]);
    if (!ytVerification.ok) throw new Error("Downloaded yt-dlp failed verification");
    try { fs.rmSync(toolPath(YTDLP_NAME), { force: true }); } catch {}
    fs.renameSync(ytTemp, toolPath(YTDLP_NAME));

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
    fs.copyFileSync(extractedFfmpeg, ffTemp);
    const ffVerification = await findWorkingBinary([ffTemp], ["-version"]);
    if (!ffVerification.ok) throw new Error("Downloaded ffmpeg failed verification");
    try { fs.rmSync(toolPath(FFMPEG_NAME), { force: true }); } catch {}
    fs.renameSync(ffTemp, toolPath(FFMPEG_NAME));
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
    const message = e?.message || "Downloader tool installation failed";
    sendToolInstallProgress({ step: "Installation failed", progress: 0, error: message });
    for (const partial of [ytTemp, ffTemp, ffZip]) {
      try { if (fs.existsSync(partial)) fs.unlinkSync(partial); } catch {}
    }
    return { ok: false, error: message };
  } finally {
    installingTools = false;
  }
}
function getTrustedBinaryPath(token) { return trustedBinaryPaths.get(token) || null; }
module.exports = {
  checkHelper: checkHelperDownloader,
  configure,
  getStatus: getDownloaderStatus,
  getToolDir: TOOL_DIR,
  getTrustedBinaryPath,
  install: installDownloaderTools,
  temporaryExecutableName,
};
