const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test, expect, _electron: electron } = require("@playwright/test");

test("offline Music uses real local grants, assets and search without remote provider calls", async ({}, testInfo) => {
  test.setTimeout(90_000);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "orion-slice-c-"));
  const app = await electron.launch({ args: [path.join(__dirname, "../.."), "--user-data-dir=" + userDataDir, "--disable-gpu"] });
  try {
    expect(path.resolve(await app.evaluate(({ app }) => app.getPath("userData")))).toBe(path.resolve(userDataDir));
    const page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.waitForFunction(() => Boolean(window.electron?.musicGetStatus));
    await page.evaluate(async () => {
      await window.electron.secureSet("apikey", "slice-c-isolated-fixture");
      localStorage.setItem("orion_whats_new_seen_version", (await window.electron.getAppVersion()) + ":orion-x-music-planet");
    });
    const fixture = await app.evaluate(({ app }) => {
      const require = process.getBuiltinModule("node:module").createRequire(app.getAppPath() + "/package.json");
      const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
      const db = require(path.join(app.getAppPath(), "src/main/music/database"));
      const registry = require(path.join(app.getAppPath(), "src/main/music/providers/registry"));
      const directory = app.getPath("userData");
      const filePath = path.join(directory, "local-silence.wav");
      const pcm = Buffer.alloc(8000 * 2 * 60);
      const header = Buffer.alloc(44);
      header.write("RIFF"); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVEfmt ", 8);
      header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
      header.writeUInt32LE(8000, 24); header.writeUInt32LE(16000, 28); header.writeUInt16LE(2, 32);
      header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
      fs.writeFileSync(filePath, Buffer.concat([header, pcm]));
      const artworkPath = path.join(directory, "local-art.png");
      const png = require("electron").nativeImage.createFromBitmap(Buffer.from([70, 140, 230, 255]), { width: 1, height: 1 }).toPNG();
      fs.writeFileSync(artworkPath, png);
      const local = { id: "local:slice-c", provider: "local", title: "Local validation signal", artistName: "Orion", albumTitle: "Local validation",
        filePath, mimeType: "audio/wav", durationMs: 60000, artworkPath, lyricsText: "[00:01]Local words survive", addedAt: Date.now(), updatedAt: Date.now() };
      db.upsertTrack(local);
      const publicLocal = db.publicTrack(db.getPrivateTrack(local.id));
      const remote = { id: "remote:slice-c", provider: "ytmusic", title: "Remote validation signal", artistName: "Orion",
        artworkUrl: "https://i.ytimg.com/vi/slice-c/default.jpg" };
      const cacheDir = path.join(directory, "music-artwork");
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(path.join(cacheDir, crypto.createHash("sha256").update(remote.artworkUrl).digest("hex").slice(0, 32) + "-512.png"), png);
      db.savePlaylist({ id: "slice-c-mixed", name: "Mixed validation", items: [publicLocal, remote] });
      global.__sliceCRemoteCalls = [];
      for (const provider of registry.list()) {
        if (provider.id.startsWith("orion-local-") || provider.id === "orion-embedded-lyrics") continue;
        for (const method of ["search", "searchForTrack", "resolveCandidate", "getLyrics", "getDashboard", "getRadio", "getSuggestions", "continueSearch", "getArtist", "getAlbum", "getPlaylist"]) {
          if (typeof provider[method] !== "function") continue;
          provider[method] = async () => { global.__sliceCRemoteCalls.push(provider.id + ":" + method); throw new Error("Isolated remote provider unavailable"); };
        }
      }
      return { local: publicLocal, remote };
    });
    await page.route(/^https?:\/\//, (route) => {
      const host = new URL(route.request().url()).hostname;
      return host === "127.0.0.1" || host === "localhost" ? route.continue() : route.abort("internetdisconnected");
    });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      localStorage.setItem("orion_google_auth_skipped", "true");
      localStorage.setItem("orion_google_sync_enabled", "false");
      localStorage.setItem("orion_autoCheckUpdates", "false");
      localStorage.setItem("orion_reduceAnimations", "1");
      localStorage.setItem("orion_ambientProfile", JSON.stringify("off"));
    });
    await page.reload();
    await expect(page.locator(".titlebar-network")).toHaveAttribute("aria-label", "Offline");
    const enter = page.getByRole("button", { name: "Enter Music Planet" });
    if (!await enter.isVisible()) await page.getByRole("button", { name: "Reveal Orion Cinema sidebar" }).focus();
    await enter.click();
    const notice = page.getByRole("status", { name: "Music availability" });
    await expect(notice).toContainText("Local Music is available");
    const localPlay = page.getByRole("button", { name: "Play Local validation signal by Orion" }).first();
    await localPlay.scrollIntoViewIfNeeded();
    await localPlay.focus();
    await expect(localPlay).toBeFocused();
    await localPlay.click();
    const audio = page.locator("audio.music-audio-engine");
    await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(0);
    expect(await audio.getAttribute("src")).toMatch(/^http:\/\/127\.0\.0\.1:/);
    await audio.evaluate((element) => { element.currentTime = 20; });
    await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThanOrEqual(20);
    const results = await page.evaluate(async ({ local, remote }) => ({
      lyrics: await window.electron.musicGetLyrics(local),
      artwork: await window.electron.musicGetArtwork(local),
      cached: await window.electron.musicGetArtwork(remote),
      search: await window.electron.musicSearch("Local validation"),
      empty: await window.electron.musicSearch("No such local song"),
      remote: await window.electron.musicResolveTrack(remote),
      playlists: await window.electron.musicListPlaylists(),
    }), fixture);
    expect(results.lyrics.lyrics.lines[0].text).toBe("Local words survive");
    expect(results.artwork.ok && results.cached.ok).toBe(true);
    expect(results.search.results[0].value.tracks[0].provider).toBe("local");
    expect(results.empty.results).toEqual([]);
    expect(results.empty.errors.join(" ")).toMatch(/connection/i);
    expect(results.remote.error).toMatch(/connection/i);
    expect(results.playlists.find((item) => item.id === "slice-c-mixed").items.map((item) => item.id))
      .toEqual([fixture.local.id, fixture.remote.id]);
    expect(await app.evaluate(() => global.__sliceCRemoteCalls)).toEqual([]);
    await page.getByRole("button", { name: "Open full library" }).click();
    await expect(page.getByRole("heading", { name: "Music Library" })).toBeVisible();
    await expect(page.getByText("Opening Music Planet", { exact: true })).toHaveCount(0);
    await expect(audio).toHaveCount(1);
    await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(20);
    await expect(page.getByRole("status", { name: "Music availability" })).toContainText("require a connection");
    await page.screenshot({ path: testInfo.outputPath("music-offline-local-library.png") });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
