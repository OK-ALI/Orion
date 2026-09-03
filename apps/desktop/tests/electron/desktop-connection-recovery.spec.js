const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test, expect, _electron: electron } = require("@playwright/test");

test("recovery restores verified Mobile releases and retries service failures without reload across themes", async ({}, testInfo) => {
  test.setTimeout(180_000);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "orion-slice-d-"));
  const app = await electron.launch({ args: [path.join(__dirname, "../.."), "--user-data-dir=" + userDataDir, "--disable-gpu"] });
  try {
    expect(path.resolve(await app.evaluate(({ app }) => app.getPath("userData")))).toBe(path.resolve(userDataDir));
    const page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.waitForFunction(() => Boolean(window.electron?.secureSet));
    await page.evaluate(async () => {
      await window.electron.secureSet("apikey", "slice-d-isolated-fixture");
      localStorage.setItem("orion_whats_new_seen_version", (await window.electron.getAppVersion()) + ":orion-x-music-planet");
    });
    await page.route(/^https?:\/\//, (route) => route.abort("internetdisconnected"));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      window.__d = { online: false, service: 200, hold: false, calls: [], epochs: [], boot: Math.random() };
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => window.__d.online });
      window.addEventListener("orion:network-restored", (event) => window.__d.epochs.push(event.detail.recoveryEpoch));
      const originalFetch = window.fetch;
      const apk = "orion-mobile-v2.2.14.apk";
      const base = "https://github.com/OK-ALI/Orion/releases/download/v2.2.14/";
      const releases = [{
        tag_name: "v2.2.14", name: "Orion Mobile v2.2.14", draft: false, prerelease: false,
        published_at: "2026-09-02T00:00:00Z", html_url: base, body: "Isolated validation release",
        assets: [
          { name: apk, browser_download_url: base + apk, size: 1024, content_type: "application/vnd.android.package-archive" },
          { name: "orion-release-integrity-v1.json", browser_download_url: base + "orion-release-integrity-v1.json", size: 512 },
        ],
      }];
      const manifest = { schemaVersion: 1, tag: "v2.2.14", version: "2.2.14",
        artifacts: [{ name: apk, size: 1024, sha256: "aa".repeat(32), signerSha256: "bb".repeat(32) }] };
      window.fetch = (input, options) => {
        const url = typeof input === "string" ? input : input.url;
        if (!/^https?:/.test(url)) return originalFetch(input, options);
        window.__d.calls.push({ url, cache: options?.cache });
        if (!window.__d.online) return Promise.reject(new Error("Isolated offline fixture"));
        if (url.includes("generate_204")) return Promise.resolve(new Response(null, { status: 204 }));
        if (url.includes("/configuration")) {
          const respond = () => new Response("{}", { status: window.__d.service });
          if (window.__d.hold) return new Promise((resolve) => { window.__d.finish = () => resolve(respond()); });
          return Promise.resolve(respond());
        }
        const value = url.includes("api.github.com") ? releases : url.endsWith("orion-release-integrity-v1.json") ? manifest : { results: [], total_pages: 1 };
        return Promise.resolve(new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } }));
      };
      localStorage.setItem("orion_google_auth_skipped", "true");
      localStorage.setItem("orion_google_sync_enabled", "false");
      localStorage.setItem("orion_autoCheckUpdates", "false");
      localStorage.setItem("orion_reduceAnimations", "0");
      localStorage.setItem("orion_ambientProfile", JSON.stringify("off"));
      localStorage.setItem("orion_startPage", JSON.stringify("get-mobile"));
    });
    const evidence = [];
    for (const theme of ["dark", "amoled", "watchfree", "mocha", "slate", "light", "custom"]) {
      // Reload only to seed an isolated theme; recovery below must preserve this document.
      await page.evaluate((theme) => localStorage.setItem("orion_theme", JSON.stringify(theme)), theme);
      await page.reload();
      const releasePage = page.locator(".gom-page");
      await expect(releasePage.getByRole("status")).toContainText("Internet required");
      await expect(page.locator(".api-status-banner")).toHaveCount(0);
      await expect(releasePage.getByText("Not published", { exact: true })).toHaveCount(0);
      await expect(releasePage.getByRole("button", { name: /Download APK/ })).toHaveCount(0);
      await expect(releasePage.getByRole("img", { name: /installation QR/ })).toHaveCount(0);
      const check = releasePage.getByRole("button", { name: "Check connection" });
      await check.focus();
      await expect(check).toBeFocused();
      await page.keyboard.press("Enter");
      expect(await page.evaluate(() => window.__d.calls.filter((call) => call.url.includes("api.github.com")).length)).toBe(0);
      const originalPage = await releasePage.elementHandle();
      const boot = await page.evaluate(() => window.__d.boot);
      await page.evaluate(() => {
        window.__d.online = true; window.__d.hold = true;
        window.dispatchEvent(new Event("online"));
      });
      await expect(page.locator(".titlebar-network")).toHaveText("Reconnecting");
      await page.waitForFunction(() => typeof window.__d.finish === "function");
      const calls = await page.evaluate(() => window.__d.calls.filter((call) => call.url.includes("/configuration")).length);
      await check.click();
      await page.evaluate(() => {
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("online"));
      });
      expect(await page.evaluate(() => window.__d.calls.filter((call) => call.url.includes("/configuration")).length)).toBe(calls);
      expect(await page.evaluate(() => window.__d.calls.filter((call) => call.url.includes("api.github.com")).length)).toBe(0);
      await page.evaluate(() => { window.__d.hold = false; window.__d.finish(); });
      await expect(page.locator(".titlebar-network")).toHaveClass(/is-online/);
      const toast = page.locator(".toast").filter({ hasText: "Connection restored" });
      await expect(toast).toHaveAttribute("role", "status");
      await expect(toast).toHaveAttribute("aria-live", "polite");
      await expect(toast).toHaveCSS("animation-name", "none");
      await expect(releasePage.getByRole("button", { name: /Download APK/ })).toBeVisible();
      await expect(releasePage.getByRole("img", { name: /installation QR/ })).toBeVisible();
      expect(await releasePage.evaluate((element, original) => element === original, originalPage)).toBe(true);
      expect(await page.evaluate(() => window.__d.boot)).toBe(boot);
      expect(await page.evaluate(() => window.__d.epochs)).toEqual([1]);
      expect(await page.evaluate(() => window.__d.calls.filter((call) => call.url.includes("/configuration")).every((call) => call.cache === "no-store"))).toBe(true);
      evidence.push(await toast.evaluate((element) => ({ theme: document.documentElement.dataset.theme, foreground: getComputedStyle(element).color,
        background: getComputedStyle(element).backgroundColor, motion: getComputedStyle(element).animationName })));
      if (theme === "dark" || theme === "light") await page.screenshot({ path: testInfo.outputPath("recovered-mobile-" + theme + ".png") });

      if (theme === "dark") {
        await page.evaluate(() => [...document.querySelectorAll(".sidebar-item")].find((item) => item.textContent.includes("Downloads"))?.click());
        const heading = page.getByRole("heading", { name: "Downloads", exact: true });
        await expect(heading).toBeVisible();
        const originalHeading = await heading.elementHandle();
        await page.evaluate(() => { window.__d.service = 503; window.dispatchEvent(new Event("online")); });
        await expect(page.locator(".titlebar-network")).toHaveClass(/is-degraded/);
        const retry = page.getByRole("button", { name: "Retry", exact: true });
        await expect(retry).toBeVisible();
        await page.evaluate(() => { window.__d.service = 200; window.__d.hold = true; window.__d.finish = null; });
        await retry.focus();
        await page.keyboard.press("Enter");
        await expect(page.locator(".titlebar-network")).toHaveText("Checking");
        await page.waitForFunction(() => typeof window.__d.finish === "function");
        await page.evaluate(() => { window.__d.hold = false; window.__d.finish(); });
        await expect(page.locator(".titlebar-network")).toHaveClass(/is-online/);
        await expect(page.locator(".api-status-banner")).toHaveCount(0);
        expect(await heading.evaluate((element, original) => element === original, originalHeading)).toBe(true);
        expect(await page.evaluate(() => window.__d.boot)).toBe(boot);
        expect(await page.evaluate(() => window.__d.epochs)).toEqual([1, 2]);
      }
    }
    await testInfo.attach("recovery-theme-evidence", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
    expect(errors).toEqual([]);
  } finally { await app.close(); }
});
