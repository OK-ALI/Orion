const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

let daemonProcess = null;
let requestQueue = [];
let volumeListeners = new Set();
let cachedState = {
  volume: 50,
  muted: false,
  brightness: 100,
  brightnessSupported: false,
  initialized: false,
};

function resolveBinaryPath() {
  if (process.platform !== "win32") return null;
  const devPath = path.join(__dirname, "..", "..", "..", "bin", "orion-syscontrol.exe");
  if (fs.existsSync(devPath)) return devPath;

  const prodPath = path.join(process.resourcesPath, "bin", "orion-syscontrol.exe");
  if (fs.existsSync(prodPath)) return prodPath;

  return null;
}

function ensureDaemon() {
  if (daemonProcess && !daemonProcess.killed) return daemonProcess;
  const binPath = resolveBinaryPath();
  if (!binPath) return null;

  try {
    const proc = spawn(binPath, ["daemon"], {
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
    });

    let buffer = "";
    proc.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.status === "ready") {
            continue;
          }
          if (parsed.event === "volume_changed") {
            cachedState.volume = Number(parsed.volume) || 0;
            cachedState.muted = Boolean(parsed.muted);
            for (const listener of volumeListeners) {
              try { listener(cachedState); } catch {}
            }
            continue;
          }
          const next = requestQueue.shift();
          if (next) {
            clearTimeout(next.timer);
            next.resolve(parsed);
          }
        } catch {}
      }
    });

    proc.on("error", () => {
      daemonProcess = null;
      drainQueueWithError("System control process error.");
    });

    proc.on("exit", () => {
      daemonProcess = null;
      drainQueueWithError("System control process terminated.");
    });

    daemonProcess = proc;
    return daemonProcess;
  } catch {
    return null;
  }
}

function drainQueueWithError(error) {
  while (requestQueue.length > 0) {
    const req = requestQueue.shift();
    clearTimeout(req.timer);
    req.resolve({ ok: false, error });
  }
}

function sendDaemonCommand(commandLine) {
  return new Promise((resolve) => {
    const daemon = ensureDaemon();
    if (!daemon || !daemon.stdin) {
      resolve({ ok: false, error: "System control unavailable on this host." });
      return;
    }

    const timer = setTimeout(() => {
      const idx = requestQueue.findIndex((item) => item.timer === timer);
      if (idx >= 0) {
        requestQueue.splice(idx, 1);
        resolve({ ok: false, error: "System control request timed out." });
      }
    }, 1500);

    requestQueue.push({ resolve, timer });
    try {
      daemon.stdin.write(`${commandLine}\n`);
    } catch {
      clearTimeout(timer);
      const idx = requestQueue.findIndex((item) => item.timer === timer);
      if (idx >= 0) requestQueue.splice(idx, 1);
      resolve({ ok: false, error: "Failed to write to system control process." });
    }
  });
}

async function getSystemVolume() {
  const result = await sendDaemonCommand("volume get");
  if (result?.ok) {
    cachedState.volume = Number(result.volume) || 0;
    cachedState.muted = Boolean(result.muted);
    cachedState.initialized = true;
  }
  return result;
}

async function setSystemVolume(percent) {
  const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const result = await sendDaemonCommand(`volume set ${safePercent}`);
  if (result?.ok) {
    cachedState.volume = Number(result.volume) || safePercent;
    cachedState.muted = Boolean(result.muted);
  }
  return result;
}

async function setSystemMute(mode) {
  const safeMode = mode === "toggle" ? "toggle" : mode ? "true" : "false";
  const result = await sendDaemonCommand(`volume mute ${safeMode}`);
  if (result?.ok) {
    cachedState.volume = Number(result.volume) || cachedState.volume;
    cachedState.muted = Boolean(result.muted);
  }
  return result;
}

async function getDisplayBrightness() {
  const result = await sendDaemonCommand("brightness get");
  if (result?.ok) {
    cachedState.brightnessSupported = Boolean(result.supported);
    if (result.supported && result.brightness != null) {
      cachedState.brightness = Number(result.brightness);
    }
  }
  return result;
}

async function setDisplayBrightness(percent) {
  const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const result = await sendDaemonCommand(`brightness set ${safePercent}`);
  if (result?.ok && result.supported) {
    cachedState.brightness = safePercent;
    cachedState.brightnessSupported = true;
  }
  return result;
}

function onSystemVolumeChanged(listener) {
  volumeListeners.add(listener);
  return () => volumeListeners.delete(listener);
}

function getSystemSnapshot() {
  return { ...cachedState };
}

function stopSystemControl() {
  if (daemonProcess) {
    try {
      daemonProcess.stdin.write("exit\n");
      daemonProcess.kill();
    } catch {}
    daemonProcess = null;
  }
  drainQueueWithError("System control stopped.");
}

if (app) {
  app.once("before-quit", stopSystemControl);
}

module.exports = {
  getSystemVolume,
  setSystemVolume,
  setSystemMute,
  getDisplayBrightness,
  setDisplayBrightness,
  onSystemVolumeChanged,
  getSystemSnapshot,
  stopSystemControl,
};
