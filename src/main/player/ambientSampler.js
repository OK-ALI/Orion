const { ipcMain, webContents, powerMonitor } = require("electron");
const { extractPaletteFromBitmap } = require("./ambientPalette");

const samplers = new Map();

function extractPalette(image) {
  const sample = image.resize({ width: 32, height: 18, quality: "good" });
  return extractPaletteFromBitmap(sample.toBitmap());
}

function stop(targetId) {
  const sampler = samplers.get(targetId);
  if (!sampler) return;
  clearInterval(sampler.timer);
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

function register(getMainWindow) {
  ipcMain.handle("ambient:start", async (event, options = {}) => {
    const targetId = String(options.targetId || "");
    const contentsId = Number(options.webContentsId);
    if (!targetId || !contentsId) return { ok: false, error: "Invalid ambient target." };
    stop(targetId);
    const interval = options.profile === "low" ? 1400 : options.profile === "vivid" ? 500 : 750;
    const tick = async () => {
      const contents = webContents.fromId(contentsId);
      const owner = getMainWindow();
      if (!contents || contents.isDestroyed()) return stop(targetId);
      if (!owner || owner.isDestroyed() || !owner.isVisible() || owner.isMinimized()) return;
      if (powerMonitor.isOnBatteryPower()) return;
      try {
        if (await videoIsPaused(contents)) return;
        const image = await contents.capturePage();
        if (image.isEmpty()) return;
        const colors = extractPalette(image);
        if (!event.sender.isDestroyed()) event.sender.send("ambient:palette", { targetId, colors, at: Date.now() });
      } catch {}
    };
    const timer = setInterval(tick, interval);
    samplers.set(targetId, { timer, contentsId });
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
