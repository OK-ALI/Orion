const { ipcMain, webContents, powerMonitor } = require("electron");
const { extractPaletteFromBitmap } = require("./ambientPalette");
const { boundedSampleRect, samplingInterval } = require("./ambientSampling");

const samplers = new Map();

function extractPalette(image) {
  const sample = image.resize({ width: 32, height: 18, quality: "good" });
  return extractPaletteFromBitmap(sample.toBitmap());
}

function stop(targetId) {
  const sampler = samplers.get(targetId);
  if (!sampler) return;
  clearTimeout(sampler.timer);
  samplers.delete(targetId);
}

async function videoIsPaused(contents) {
  const frames = [contents.mainFrame];
  for (let index = 0; index < frames.length; index += 1) frames.push(...(frames[index].frames || []));
  let found = false;
  for (const frame of frames) {
    try {
      const state = await frame.executeJavaScript(`(() => { const v = document.querySelector('video'); return v ? { found: true, paused: v.paused || v.ended } : null; })()`);
      if (state?.found) { found = true; if (!state.paused) return false; }
    } catch {}
  }
  return found;
}

function register(getMainWindow, getPerformanceTier = () => "balanced") {
  ipcMain.handle("ambient:start", async (event, options = {}) => {
    const targetId = String(options.targetId || "");
    const captureContentsId = Number(options.captureWebContentsId || options.webContentsId);
    const playbackContentsId = Number(options.playbackWebContentsId || captureContentsId);
    if (!targetId || !captureContentsId) return { ok: false, error: "Invalid ambient target." };
    stop(targetId);
    const tick = async () => {
      const captureContents = webContents.fromId(captureContentsId);
      const playbackContents = webContents.fromId(playbackContentsId);
      const owner = getMainWindow();
      if (!captureContents || captureContents.isDestroyed()) return stop(targetId);
      if (owner && !owner.isDestroyed() && owner.isVisible() && !owner.isMinimized()) {
        try {
          const stateTarget = playbackContents && !playbackContents.isDestroyed()
            ? playbackContents
            : captureContents;
          if (!(await videoIsPaused(stateTarget))) {
            let sourceRect = options.cropRect || null;
            if (!sourceRect) {
              try {
                sourceRect = await captureContents.mainFrame.executeJavaScript(
                  `({ x: 0, y: 0, width: Math.max(1, innerWidth), height: Math.max(1, innerHeight) })`,
                );
              } catch {}
            }
            const efficiency = getPerformanceTier() === "efficiency";
            const image = await captureContents.capturePage(
              boundedSampleRect(sourceRect, efficiency ? 160 : 320, efficiency ? 90 : 180),
            );
            if (!image.isEmpty()) {
              const colors = extractPalette(image);
              if (!event.sender.isDestroyed()) event.sender.send("ambient:palette", { targetId, colors, at: Date.now() });
            }
          }
        } catch {}
      }
      const sampler = samplers.get(targetId);
      if (sampler) {
        const profile = getPerformanceTier() === "efficiency" ? "low" : options.profile;
        sampler.timer = setTimeout(tick, samplingInterval(profile, powerMonitor.isOnBatteryPower()));
      }
    };
    samplers.set(targetId, { timer: null, captureContentsId, playbackContentsId });
    tick();
    return { ok: true };
  });
  ipcMain.handle("ambient:stop", (_event, targetId) => {
    stop(String(targetId || ""));
    return { ok: true };
  });
}

function clear() {
  for (const targetId of samplers.keys()) stop(targetId);
}

module.exports = { clear, extractPalette, register };
