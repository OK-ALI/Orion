const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test, expect, _electron: electron } = require("@playwright/test");

function silentWav(seconds = 240) {
  const bytes = seconds * 8000 * 2;
  const wav = Buffer.alloc(44 + bytes);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + bytes, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(bytes, 40);
  return wav;
}

function contrast(left, right) {
  const luminance = (value) => {
    const channels = value.match(/[\d.]+/g).slice(0, 3).map(Number).map((channel) => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const a = luminance(left), b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("offline Home keeps local actions, exact local playback and theme-aware keyboard access", async ({}, testInfo) => {
  test.setTimeout(90_000);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "orion-home-offline-"));
  const localPath = path.join(userDataDir, "home-local.wav");
  fs.writeFileSync(localPath, silentWav());
  fs.writeFileSync(path.join(userDataDir, "downloads.json"), JSON.stringify([
    { id: "home-local", mediaType: "movie", tmdbId: 42, name: "Local Home Story", status: "completed", filePath: localPath },
    { id: "home-cloud", mediaType: "movie", tmdbId: 43, name: "Cloud Only Story", status: "completed", filePath: null, driveFileId: "fixture-cloud-only" },
    { id: "home-missing", mediaType: "movie", tmdbId: 44, name: "Missing File Story", status: "completed", filePath: path.join(userDataDir, "missing.mp4") },
  ]));

  const app = await electron.launch({
    args: [path.join(__dirname, "../.."), "--user-data-dir=" + userDataDir, "--disable-gpu"],
  });
  try {
    expect(path.resolve(await app.evaluate(({ app }) => app.getPath("userData")))).toBe(path.resolve(userDataDir));
    const page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.waitForFunction(() => Boolean(window.electron?.secureSet));
    await page.evaluate(async () => {
      await window.electron.secureSet("apikey", "home-offline-test-token");
      const version = await window.electron.getAppVersion();
      localStorage.setItem("orion_whats_new_seen_version", version + ":orion-x-music-planet");
    });
    await page.route(/^https?:\/\//, (route) => route.abort("internetdisconnected"));
    await page.addInitScript(() => {
      window.__homeOnline = false;
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => window.__homeOnline });
      window.__homeBootId = Math.random();
      window.__homeRemoteRequests = 0;
      const originalFetch = window.fetch;
      window.fetch = (input, options) => {
        const url = typeof input === "string" ? input : input.url;
        if (/^https?:\/\//.test(url)) {
          window.__homeRemoteRequests += 1;
          if (window.__homeOnline) {
            return Promise.resolve(url.includes("generate_204")
              ? new Response(null, { status: 204 })
              : new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));
          }
          return Promise.reject(new TypeError("Isolated offline fixture"));
        }
        return originalFetch(input, options);
      };
      localStorage.setItem("orion_google_auth_skipped", "true");
      localStorage.setItem("orion_google_sync_enabled", "false");
      localStorage.setItem("orion_autoCheckUpdates", "false");
      localStorage.setItem("orion_reduceAnimations", "1");
      localStorage.setItem("orion_ambientProfile", JSON.stringify("off"));
      localStorage.setItem("orion_startPage", JSON.stringify("home"));
      if (!localStorage.getItem("home-offline-fixture-seeded")) {
        const records = [
          { id: 42, title: "Local Home Story", media_type: "movie" },
          { id: 43, title: "Cloud Only Story", media_type: "movie" },
          { id: 44, title: "Missing File Story", media_type: "movie" },
        ];
        const details = Object.fromEntries(records.map((item) => ["movie_" + item.id, {
          currentTime: 120, duration: 240, percent: 50, updatedAt: Date.now(),
          playbackVerified: true, playbackVerifiedAt: Date.now(), startedAt: Date.now(),
        }]));
        localStorage.setItem("orion_historyEnabled", "1");
        localStorage.setItem("orion_history", JSON.stringify(records));
        localStorage.setItem("orion_progress", JSON.stringify({ movie_42: 50, movie_43: 50, movie_44: 50 }));
        localStorage.setItem("orion_progressDetails", JSON.stringify(details));
        localStorage.setItem("orion_dlTime_movie_42", "120");
        localStorage.setItem("home-offline-fixture-seeded", "true");
      }
    });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 760));
    await page.reload();
    const home = page.locator(".home-local-continuity");
    await expect(home.getByRole("status")).toContainText("You're offline");
    await expect(home.getByRole("button", { name: "Resume Local Home Story locally" })).toBeVisible();
    await expect(home.getByRole("button", { name: /Cloud Only|Missing File/ })).toHaveCount(0);
    await expect(home.locator(".skeleton")).toHaveCount(0);
    expect((await page.evaluate(() => window.electron.getDownloads())).map((item) => item.id))
      .not.toContain("home-missing");

    await expect(page.locator(".api-status-banner")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
    await expect(page.locator(".titlebar-network")).toHaveAttribute("aria-label", "Offline");
    await expect(home.getByRole("button", { name: "Check connection" })).toBeVisible();

    // The same centered column must fit the available canvas with either sidebar mode.
    for (const width of [960, 1280]) {
      await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 760), width);
      for (const pinned of [false, true]) {
        if (await page.locator(".sidebar").evaluate((sidebar) => sidebar.classList.contains("mode-pinned")) !== pinned) {
          await page.keyboard.press("Control+b");
        }
        await expect(page.locator(".sidebar")).toHaveClass(pinned ? /mode-pinned/ : /mode-auto/);
        const geometry = await home.evaluate((root) => {
          const column = root.querySelector(".homepage-content");
          const acknowledgement = root.querySelector(".home-connection-state");
          const continuation = root.querySelector(".home-section");
          const canvas = root.closest(".app-content").getBoundingClientRect();
          const content = column.getBoundingClientRect();
          const ack = acknowledgement.getBoundingClientRect();
          const section = continuation.getBoundingClientRect();
          const actions = root.querySelector(".home-local-actions").getBoundingClientRect();
          const heading = continuation.querySelector("h2").getBoundingClientRect();
          return {
            sharedOwner: acknowledgement.parentElement === column && continuation.parentElement === column,
            topInset: ack.top - canvas.top,
            centerOffset: (content.left + content.right - canvas.left - canvas.right) / 2,
            leftInset: ack.left - canvas.left,
            rightInset: canvas.right - ack.right,
            leftAlignment: section.left - ack.left,
            widthDifference: section.width - ack.width,
            sectionGap: section.top - ack.bottom,
            actionGap: heading.top - actions.bottom,
            textAlign: getComputedStyle(column).textAlign,
            fits: content.left >= canvas.left && content.right <= canvas.right,
          };
        });
        expect(geometry.sharedOwner).toBe(true);
        expect(geometry.topInset).toBeGreaterThanOrEqual(48);
        expect(Math.abs(geometry.centerOffset)).toBeLessThanOrEqual(1);
        expect(geometry.leftInset).toBeGreaterThanOrEqual(24);
        expect(geometry.rightInset).toBeGreaterThanOrEqual(24);
        expect(Math.abs(geometry.leftAlignment)).toBeLessThanOrEqual(1);
        expect(Math.abs(geometry.widthDifference)).toBeLessThanOrEqual(1);
        expect(Math.round(geometry.sectionGap)).toBeGreaterThanOrEqual(32);
        expect(Math.round(geometry.sectionGap)).toBeLessThanOrEqual(40);
        expect(Math.round(geometry.actionGap)).toBeGreaterThanOrEqual(32);
        expect(Math.round(geometry.actionGap)).toBeLessThanOrEqual(40);
        expect(geometry.textAlign).not.toBe("center");
        expect(geometry.fits).toBe(true);
        await testInfo.attach("home-layout-" + width + (pinned ? "-pinned" : "-rail"), {
          body: JSON.stringify(geometry, null, 2), contentType: "application/json",
        });
        if (width === 1280 && pinned) {
          await page.screenshot({ path: testInfo.outputPath("home-offline-wide-pinned.png") });
        }
      }
    }
    await page.keyboard.press("Control+b");
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 760));

    const bootId = await page.evaluate(() => window.__homeBootId);
    await home.getByRole("button", { name: "Check connection" }).click();
    await expect(home.getByRole("status")).toContainText("You're offline");
    expect(await page.evaluate(() => window.__homeBootId)).toBe(bootId);

    async function returnHome() {
      await page.evaluate(() => [...document.querySelectorAll(".sidebar-item")]
        .find((item) => item.textContent.trim() === "Home")?.click());
      await expect(home).toBeVisible();
      await expect(page.locator(".api-status-banner")).toHaveCount(0);
      await expect(page.locator(".titlebar-network")).toHaveAttribute("aria-label", "Offline");
    }

    await home.getByRole("button", { name: "Open Downloads" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Downloads", exact: true })).toBeVisible();
    await expect(page.locator(".api-status-banner")).toContainText("Cannot reach TMDB");
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await returnHome();
    await home.getByRole("button", { name: "Open Library" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".library-title")).toHaveText("My Library");
    await expect(page.locator(".api-status-banner")).toContainText("Cannot reach TMDB");
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await returnHome();

    for (const theme of ["dark", "amoled", "watchfree", "mocha", "slate", "light", "custom"]) {
      await page.evaluate((id) => localStorage.setItem("orion_theme", JSON.stringify(id)), theme);
      await page.reload();
      const resume = home.getByRole("button", { name: "Resume Local Home Story locally" });
      await expect(resume).toBeVisible();
      await resume.focus();
      const presentation = await resume.evaluate((button) => {
        const style = getComputedStyle(button);
        const bounds = button.getBoundingClientRect();
        return {
          color: style.color, background: style.backgroundColor, outline: style.outlineStyle,
          visible: bounds.left >= 0 && bounds.right <= window.innerWidth,
          reduced: document.body.classList.contains("no-anim"),
          theme: document.documentElement.dataset.theme,
        };
      });
      expect(presentation.theme).toBe(theme);
      expect(presentation.visible).toBe(true);
      expect(presentation.reduced).toBe(true);
      expect(presentation.outline).toBe("solid");
      expect(contrast(presentation.color, presentation.background), theme + " local resume contrast").toBeGreaterThanOrEqual(4.5);
      if (theme === "dark" || theme === "light") {
        await page.screenshot({ path: testInfo.outputPath("home-offline-" + theme + ".png") });
      }
    }

    const remoteRequests = await page.evaluate(() => window.__homeRemoteRequests);
    await home.getByRole("button", { name: "Resume Local Home Story locally" }).focus();
    await page.keyboard.press("Enter");
    const player = page.getByRole("dialog", { name: "Playing Local Home Story" });
    await expect(player).toBeVisible();
    await expect(page.locator(".search-orb")).toHaveAttribute("aria-hidden", "true");
    const video = player.locator("video");
    await expect(video).toHaveAttribute("src", /^orion-media:\/\/asset\//);
    await expect.poll(() => video.evaluate((element) => element.currentTime)).toBeGreaterThanOrEqual(120);
    expect(await page.evaluate(() => window.__homeRemoteRequests)).toBe(remoteRequests);
    expect(await page.locator(".home-local-continuity").count()).toBe(1);
    await video.evaluate((element) => element.pause());
    await player.getByRole("button", { name: "Close player", exact: true }).click();
    await expect(page.locator(".search-orb")).toHaveAttribute("aria-hidden", "false");
    // Restored product connectivity must not globally hide the API-session warning.
    // The session was initialized as unreachable; its independent owner is unchanged.
    await page.evaluate(() => {
      window.__homeOnline = true;
      window.dispatchEvent(new Event("online"));
    });
    await expect(page.locator(".titlebar-network")).toHaveClass(/is-online/);
    await expect(home).toHaveCount(0);
    await expect(page.locator(".fade-in.homepage-container")).toBeVisible();
    await expect(page.locator(".api-status-banner")).toContainText("Cannot reach TMDB");
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await expect(page.locator(".homepage-content")).toHaveCSS("margin-top", "-38px");
    await expect(page.locator(".homepage-content")).toHaveCSS("display", "block");
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
