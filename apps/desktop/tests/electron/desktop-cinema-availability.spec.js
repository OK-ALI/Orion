const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test, expect, _electron: electron } = require("@playwright/test");

function contrast(left, right) {
  const luminance = (value) => {
    const c = value.match(/[\d.]+/g).slice(0, 3).map(Number).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const a = luminance(left), b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("Cinema discovery and quick search distinguish offline, service failure and successful empty results", async ({}, testInfo) => {
  test.setTimeout(90_000);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "orion-slice-b-"));
  const app = await electron.launch({ args: [path.join(__dirname, "../.."), "--user-data-dir=" + userDataDir, "--disable-gpu"] });
  try {
    expect(path.resolve(await app.evaluate(({ app }) => app.getPath("userData")))).toBe(path.resolve(userDataDir));
    const page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.waitForFunction(() => Boolean(window.electron?.secureSet));
    await page.evaluate(async () => {
      await window.electron.secureSet("apikey", "slice-b-fixture-token");
      localStorage.setItem("orion_whats_new_seen_version", (await window.electron.getAppVersion()) + ":orion-x-music-planet");
    });
    await page.route(/^https?:\/\//, (route) => route.abort("internetdisconnected"));
    await page.addInitScript(() => {
      window.__sliceBOnline = false;
      window.__sliceBSearchRequests = 0;
      window.__sliceBBoot = Math.random();
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => window.__sliceBOnline });
      const originalFetch = window.fetch;
      window.fetch = (input, options) => {
        const url = typeof input === "string" ? input : input.url;
        if (!/^https?:\/\//.test(url)) return originalFetch(input, options);
        if (url.includes("/search/")) window.__sliceBSearchRequests += 1;
        if (!window.__sliceBOnline || (url.includes("/search/") && url.includes("service-error"))) {
          return Promise.reject(new TypeError("Isolated fixture service unavailable"));
        }
        if (url.includes("generate_204")) return Promise.resolve(new Response(null, { status: 204 }));
        const results = url.includes("/watch/providers/") ? [{ provider_id: 8, provider_name: "Netflix" }] : [];
        return Promise.resolve(new Response(JSON.stringify({ results, page: 1, total_pages: 1 }), {
          status: 200, headers: { "Content-Type": "application/json" },
        }));
      };
      localStorage.setItem("orion_google_auth_skipped", "true");
      localStorage.setItem("orion_google_sync_enabled", "false");
      localStorage.setItem("orion_autoCheckUpdates", "false");
      localStorage.setItem("orion_reduceAnimations", "1");
      localStorage.setItem("orion_ambientProfile", JSON.stringify("off"));
      localStorage.setItem("orion_startPage", JSON.stringify("discover"));
      localStorage.setItem("orion_discoveryRegion", JSON.stringify("US"));
      localStorage.setItem("orion_watchProviderCatalog_US", JSON.stringify({ at: Date.now(), results: { movie: [{ provider_id: 8, provider_name: "Netflix" }], tv: [] } }));
    });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1040, 820));
    await page.reload();
    const discover = page.locator(".discover-container");
    await expect(discover.getByRole("status")).toContainText("You're offline");
    await expect(discover.getByRole("status")).toContainText("previously loaded");
    await expect(discover.getByRole("button", { name: /Netflix.*Explore/ })).toBeEnabled();
    await expect(page.locator(".titlebar-network")).toHaveAttribute("aria-label", "Offline");
    await expect(page.locator(".api-status-banner")).toHaveCount(0);
    const boot = await page.evaluate(() => window.__sliceBBoot);
    await discover.getByRole("button", { name: "Check connection" }).click();
    expect(await page.evaluate(() => window.__sliceBBoot)).toBe(boot);
    await discover.getByRole("button", { name: "Hollywood" }).click();
    await expect(discover.getByText(/No trending|No titles match|No matches/)).toHaveCount(0);
    await discover.getByRole("button", { name: "Browse All" }).click();
    await expect(discover.getByText(/No trending|No titles match|No matches/)).toHaveCount(0);

    for (const theme of ["dark", "amoled", "watchfree", "mocha", "slate", "light", "custom"]) {
      await page.evaluate((theme) => localStorage.setItem("orion_theme", JSON.stringify(theme)), theme);
      await page.reload();
      await expect(discover.getByRole("status")).toContainText("You're offline");
      const button = discover.getByRole("button", { name: "Open Downloads" });
      await button.focus();
      const presentation = await discover.locator(".cinema-availability").evaluate((notice) => {
        const style = getComputedStyle(notice);
        const body = getComputedStyle(notice.querySelector("p"));
        const button = notice.querySelector("button");
        const bounds = button.getBoundingClientRect();
        return { color: style.color, body: body.color, background: style.backgroundColor,
          outline: getComputedStyle(button).outlineStyle, focused: document.activeElement === button,
          fits: bounds.left >= 0 && bounds.right <= window.innerWidth,
          reduced: document.body.classList.contains("no-anim") };
      });
      expect(contrast(presentation.color, presentation.background), theme + " heading contrast").toBeGreaterThanOrEqual(4.5);
      expect(contrast(presentation.body, presentation.background), theme + " body contrast").toBeGreaterThanOrEqual(4.5);
      expect(presentation.outline).toBe("solid");
      expect(presentation.focused && presentation.fits && presentation.reduced).toBe(true);
      if (theme === "dark" || theme === "light") await page.screenshot({ path: testInfo.outputPath("discover-offline-" + theme + ".png") });
    }

    await discover.getByRole("button", { name: "Open Downloads" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Downloads", exact: true })).toBeVisible();
    const orb = page.getByRole("button", { name: "Search Orion" });
    await orb.click({ button: "right" });
    const quick = page.getByRole("dialog", { name: "Cinema quick search" });
    const input = quick.locator(".search-input");
    await expect(input).toBeFocused();
    await input.fill("offline-story");
    await expect(quick.getByRole("status")).toContainText("You're offline");
    await expect(quick.getByText(/No results|No matching/)).toHaveCount(0);
    expect(await page.evaluate(() => window.__sliceBSearchRequests)).toBe(0);
    await input.press("Enter");
    await expect(quick.getByRole("status")).toContainText("You're offline");
    await expect(page.getByRole("heading", { name: "Downloads", exact: true })).toBeVisible();
    await expect(page.locator(".search-results-page")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("quick-search-offline.png") });
    await quick.getByRole("button", { name: "Open Library" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "My Library", exact: true })).toBeVisible();
    await expect(quick).toHaveCount(0);

    await page.evaluate(() => { window.__sliceBOnline = true; window.dispatchEvent(new Event("online")); });
    await expect(page.locator(".titlebar-network")).toHaveClass(/is-online/);
    await orb.click({ button: "right" });
    await input.fill("service-error");
    await expect(quick.getByRole("status")).toContainText("Cinema search is unavailable");
    await expect(quick.getByRole("status")).not.toContainText(/offline|No internet/i);
    await expect(quick.getByText(/No results/)).toHaveCount(0);
    await input.press("Enter");
    await expect(quick.getByRole("status")).toContainText("Cinema search is unavailable");
    await expect(page.getByRole("heading", { name: "My Library", exact: true })).toBeVisible();
    await expect(page.locator(".search-results-page")).toHaveCount(0);
    await input.fill("successful-empty");
    await expect(quick.getByText(/No results for/)).toBeVisible();
    await expect(quick.getByRole("status")).toHaveCount(0);
    await expect(quick.getByRole("button", { name: /View all results for/ })).toBeVisible();
    await input.press("Enter");
    await expect(quick).toHaveCount(0);
    await expect(page.locator(".search-results-page")).toBeVisible();
    await expect(page.locator(".search-input-full")).toHaveValue("successful-empty");
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
