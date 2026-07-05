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

  const status = await page.evaluate(() => window.electron.musicGetStatus());
  expect(status).toMatchObject({ ok: true, schemaVersion: 3, trackCount: 0 });
  const providers = await page.evaluate(() => window.electron.musicListProviders());
  expect(providers.some((provider) => provider.id === "musicbrainz-metadata")).toBe(true);
  expect(providers.some((provider) => provider.id === "orion-local-streaming")).toBe(true);
  const pluginCatalog = await page.evaluate(() => window.electron.musicListPlugins());
  expect(pluginCatalog.some((plugin) => plugin.id === "orion-discogs" && !plugin.installed && plugin.available)).toBe(true);
  expect((await page.evaluate(() => window.electron.musicInstallPlugin("orion-discogs"))).ok).toBe(true);
  expect((await page.evaluate(() => window.electron.musicListProviders())).some((provider) => provider.id === "discogs-metadata")).toBe(true);
  expect((await page.evaluate(() => window.electron.musicSetPluginEnabled("orion-discogs", false))).ok).toBe(true);
  expect((await page.evaluate(() => window.electron.musicListProviders())).some((provider) => provider.id === "discogs-metadata")).toBe(false);

  await page.getByRole("button", { name: "Enter Music Planet" }).click();
  await expect(page.getByRole("heading", { name: "Music Planet" })).toBeVisible();
  await expect(page.getByText("Coming soon")).toBeVisible();
  await expect(page.getByRole("button", { name: /Back to Cinema/ })).toBeVisible();
  await page.getByRole("button", { name: /Back to Cinema/ }).click();
  await expect(page.getByText("Try Again", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enter Music Planet" })).toBeVisible();
  await page.getByRole("button", { name: "Enter Music Planet" }).click();
  await expect(page.getByRole("heading", { name: "Music Planet" })).toBeVisible();
  await expect(page.getByText("Try Again", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
  await app.close();
});

