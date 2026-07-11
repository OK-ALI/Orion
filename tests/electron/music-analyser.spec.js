const fs = require("fs");
const os = require("os");
const path = require("path");
const { test, expect, _electron: electron } = require("@playwright/test");

function writeToneWav(filePath, seconds = 12) {
  const sampleRate = 44_100;
  const samples = sampleRate * seconds;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + dataSize, 4); buffer.write("WAVE", 8);
  buffer.write("fmt ", 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write("data", 36); buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < samples; index += 1) {
    const envelope = Math.min(1, index / 1000, (samples - index) / 1000);
    const value = Math.sin((2 * Math.PI * 110 * index) / sampleRate) * .58
      + Math.sin((2 * Math.PI * 880 * index) / sampleRate) * .24;
    buffer.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(value * envelope * 32767))), 44 + index * 2);
  }
  fs.writeFileSync(filePath, buffer);
}

async function dismissOptionalOverlays(page) {
  for (const name of ["Skip / Use Offline", "Continue to Cinema"]) {
    const button = page.getByRole("button", { name });
    if (await button.count()) await button.click();
  }
}

test("protected Music grants expose analysis headers without falsely reporting synchronization", async ({}, testInfo) => {
  const root = path.join(os.tmpdir(), `orion-music-analyser-${process.pid}-${testInfo.workerIndex}-${Date.now()}`);
  const library = path.join(root, "library");
  const userData = path.join(root, "profile");
  fs.mkdirSync(library, { recursive: true });
  writeToneWav(path.join(library, "Orion Visual Sync.wav"));
  const app = await electron.launch({ args: [path.join(__dirname, "../.."), `--user-data-dir=${userData}`, "--disable-gpu", "--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
  const page = await app.firstWindow();
  await page.waitForTimeout(900);
  await dismissOptionalOverlays(page);
  await app.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
  }, library);
  const added = await page.evaluate(() => window.electron.musicAddFolder());
  expect(added.ok).toBe(true);
  await page.evaluate(() => window.electron.musicScan());
  const tracks = await page.evaluate(() => window.electron.musicListTracks({ limit: 10 }));
  expect(tracks.length).toBeGreaterThan(0);
  await page.evaluate((track) => window.electron.musicSaveQueue({ items: [track], index: 0, repeat: "off", shuffle: false }), tracks[0]);
  await page.reload();
  await page.waitForTimeout(700);
  await dismissOptionalOverlays(page);
  const dock = page.locator(".glass-music-player");
  await expect(dock).toBeVisible();
  await page.bringToFront();
  await page.evaluate(() => {
    const button = document.createElement("button"); button.id = "context-probe"; button.textContent = "Probe";
    button.onclick = () => { const context = new AudioContext(); const oscillator = context.createOscillator();
      oscillator.connect(context.destination); oscillator.start(); window.__contextProbe = { context, oscillator }; };
    document.body.appendChild(button);
  });
  await page.locator("#context-probe").click();
  await dock.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(3_000);
  const result = await page.evaluate(async () => { const audio = document.querySelector(".music-audio-engine");
    const response = await fetch(audio.currentSrc, { headers: { Range: "bytes=0-1" } });
    return {
    analyser: document.documentElement.dataset.musicAnalyserState, context: document.documentElement.dataset.musicAnalyserContextState,
    frames: document.documentElement.dataset.musicAnalyserFrames, signalFrames: document.documentElement.dataset.musicAnalyserSignalFrames,
    sourceConnected: document.documentElement.dataset.musicAnalyserSourceConnected,
    unlocks: document.documentElement.dataset.musicAnalyserUnlocks,
    paused: audio?.paused, readyState: audio?.readyState,
    currentTime: audio?.currentTime, duration: audio?.duration, error: audio?.error?.code || 0, source: audio?.currentSrc,
    cors: response.headers.get("access-control-allow-origin"), resourcePolicy: response.headers.get("cross-origin-resource-policy"),
  }; });
  result.control = await page.evaluate(async () => {
    const primary = document.querySelector(".music-audio-engine");
    const probe = new Audio(); probe.crossOrigin = "anonymous"; probe.muted = true; probe.src = primary.currentSrc;
    await probe.play().catch((error) => { probe.dataset.error = error.message; });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { currentTime: probe.currentTime, paused: probe.paused, readyState: probe.readyState, error: probe.dataset.error || "" };
  });
  result.recoveredTime = await page.evaluate(() => document.querySelector(".music-audio-engine")?.currentTime || 0);
  result.contextProbe = await page.evaluate(() => window.__contextProbe?.context?.state);
  const sourceUrl = new URL(result.source);
  expect(sourceUrl.hostname).toBe("127.0.0.1");
  expect(sourceUrl.pathname.split("/").filter(Boolean)).toHaveLength(2);
  expect(result.cors).toBe("*");
  expect(result.resourcePolicy).toBe("cross-origin");
  expect(result.unlocks).toBe("1");
  if (result.contextProbe === "running") {
    expect(result.context).toBe("running");
    expect(result.analyser).toBe("active");
    expect(result.sourceConnected).toBe("true");
    expect(Number(result.signalFrames)).toBeGreaterThan(0);
  } else {
    // CI hosts without an audio output keep every AudioContext suspended. The
    // engine must report that honestly instead of claiming synchronization;
    // the independent control element also proves the protected grant itself
    // remains playable in that environment.
    expect(["awaiting-gesture", "suspended", "silent"]).toContain(result.analyser);
    expect(result.control.currentTime).toBeGreaterThan(0.5);
  }
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
});
