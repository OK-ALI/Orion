const path = require("path");
const os = require("os");
const { test, expect, _electron: electron } = require("@playwright/test");

test("Music Planet opens with an isolated database and provider host", async ({}, testInfo) => {
  const userDataDir = path.join(os.tmpdir(), `orion-music-pw-${process.pid}-${testInfo.workerIndex}-${Date.now()}`);
  const app = await electron.launch({ args: [path.join(__dirname, "../.."), `--user-data-dir=${userDataDir}`, "--disable-gpu"] });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForTimeout(1200);
  const skipSignIn = page.getByRole("button", { name: "Skip / Use Offline" });
  if (await skipSignIn.count()) await skipSignIn.click();
  const skipWhatsNew = page.getByRole("button", { name: "Continue to Cinema" });
  if (await skipWhatsNew.count()) await skipWhatsNew.click();

  const status = await page.evaluate(() => window.electron.musicGetStatus());
  expect(status).toMatchObject({ ok: true, schemaVersion: 4, trackCount: 0 });
  const providers = await page.evaluate(() => window.electron.musicListProviders());
  expect(providers.some((provider) => provider.id === "ytmusic-metadata")).toBe(true);
  expect(providers.some((provider) => provider.id === "ytmusic-streaming")).toBe(true);
  expect(providers.some((provider) => provider.id === "lrclib-lyrics")).toBe(true);
  expect(providers.some((provider) => provider.id === "spotify-charts-dashboard")).toBe(true);
  expect(providers.some((provider) => provider.id === "orion-local-streaming")).toBe(true);
  const pluginCatalog = await page.evaluate(() => window.electron.musicListPlugins());
  expect(pluginCatalog.some((plugin) => plugin.id === "orion-ytmusic" && plugin.installed && plugin.enabled)).toBe(true);
  expect(pluginCatalog.some((plugin) => plugin.id === "orion-lrclib" && plugin.installed && plugin.enabled)).toBe(true);
  expect(pluginCatalog.some((plugin) => plugin.id === "orion-spotify-import" && plugin.installed && plugin.enabled)).toBe(true);
  expect(pluginCatalog.some((plugin) => plugin.id === "orion-discogs")).toBe(false);

  const enterMusic = page.getByRole("button", { name: "Enter Music Planet" });
  if (await enterMusic.count()) await enterMusic.click();
  else await expect(page.getByRole("button", { name: "Return to Cinema" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Music Planet" })).toBeVisible();
  const musicGroups = page.locator(".sidebar-group-label");
  await expect(musicGroups.filter({ hasText: /^Listen$/ })).toHaveCount(1);
  await expect(musicGroups.filter({ hasText: /^Explore$/ })).toHaveCount(1);
  await expect(musicGroups.filter({ hasText: /^Yours$/ })).toHaveCount(1);
  await expect(page.getByText("Music Settings", { exact: true })).toHaveCount(1);
  await page.mouse.move(800, 300);
  await expect(page.locator(".music-planet-cursor")).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/music-custom-cursor-active/);
  const homeNav = page.getByRole("button", { name: /^Home(?: Home)?$/ });
  const sourcesNav = page.getByRole("button", { name: /^Signal Sources(?: Signal Sources)?$/ });
  await expect(homeNav).toHaveClass(/active/);
  await expect(sourcesNav).toBeVisible();
  await sourcesNav.click();
  await expect.poll(() => page.locator("#sources").evaluate((section) => {
    const container = document.querySelector(".music-planet-scroll-area");
    if (!container) return false;
    return Math.abs(section.getBoundingClientRect().top - container.getBoundingClientRect().top) < 120;
  })).toBe(true);
  await expect(sourcesNav).toHaveClass(/active/);
  await expect(page.getByText("Coming soon")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Return to Cinema" })).toBeVisible();
  await page.getByRole("button", { name: "Return to Cinema" }).click();
  await expect(page.locator("html")).not.toHaveClass(/music-custom-cursor-active/);
  await expect(page.getByText("Try Again", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enter Music Planet" })).toBeVisible();
  await page.getByRole("button", { name: "Enter Music Planet" }).click();
  await expect(page.getByRole("heading", { name: "Music Planet" })).toBeVisible();
  await expect(page.getByText("Try Again", { exact: true })).toHaveCount(0);
  await expect.poll(() => page.locator("#sources").evaluate((section) => {
    const container = document.querySelector(".music-planet-scroll-area");
    if (!container) return false;
    return Math.abs(section.getBoundingClientRect().top - container.getBoundingClientRect().top) < 120;
  })).toBe(true);
  await expect(sourcesNav).toHaveClass(/active/);

  await page.getByRole("button", { name: "Open Music settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Music Planet" }).evaluate((element) => element.click());
  await expect(page.locator("#sources")).toBeAttached();
  expect(errors).toEqual([]);
  await app.close();
});
