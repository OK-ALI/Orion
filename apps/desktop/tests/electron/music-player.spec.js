const path = require("path");
const os = require("os");
const { test, expect, _electron: electron } = require("@playwright/test");

test("Music dock follows the sidebar and exposes complete transport controls", async ({}, testInfo) => {
  const userDataDir = path.join(os.tmpdir(), `orion-player-pw-${process.pid}-${testInfo.workerIndex}-${Date.now()}`);
  const app = await electron.launch({ args: [path.join(__dirname, "../.."), `--user-data-dir=${userDataDir}`, "--disable-gpu"] });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForTimeout(1000);
  const skipSignIn = page.getByRole("button", { name: "Skip / Use Offline" });
  if (await skipSignIn.count()) await skipSignIn.click();
  const skipWhatsNew = page.getByRole("button", { name: "Continue to Cinema" });
  if (await skipWhatsNew.count()) await skipWhatsNew.click();
  await page.evaluate(() => window.electron.musicSaveQueue({
    items: [{ id: "orion-player-test", provider: "test", title: "Orion Player Test", artistName: "Orion" }],
    index: 0, repeat: "off", shuffle: false,
  }));
  await page.reload();
  if (await skipSignIn.count()) await skipSignIn.click();
  if (await skipWhatsNew.count()) await skipWhatsNew.click();
  const dock = page.locator(".glass-music-player");
  await expect(dock).toBeVisible();
  await expect(dock).toHaveClass(/is-compact/);
  await expect(page.getByRole("button", { name: "Previous track" })).toBeVisible();
  await expect(dock.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next track" })).toBeVisible();

  await page.getByRole("button", { name: "Enter Music Planet" }).click();
  await expect(page.getByRole("heading", { name: "Music Planet" })).toBeVisible();
  await expect(dock).toBeVisible();
  await expect(dock).not.toHaveClass(/is-compact/);
  await expect(dock.getByRole("button", { name: "Shuffle" })).toBeVisible();
  await expect(dock.getByRole("button", { name: /Repeat/ })).toBeVisible();
  await expect(dock.getByRole("button", { name: "Queue" })).toBeVisible();
  await expect(dock.getByRole("button", { name: "Lyrics" })).toBeVisible();
  await expect(dock.locator(".music-progress-wave-fill")).toBeVisible();
  await expect(dock.locator(".timeline-scrub")).toHaveCSS("opacity", "1");
  await expect(dock.getByRole("button", { name: "Show total duration" })).toBeVisible();

  // The expanded sidebar still leaves the dock fully reachable.
  const sidebar = page.locator(".sidebar");
  await sidebar.hover();
  await page.waitForTimeout(350);
  const [sidebarBox, dockBox] = await Promise.all([sidebar.boundingBox(), dock.boundingBox()]);
  expect(dockBox.x).toBeGreaterThanOrEqual(sidebarBox.x + sidebarBox.width - 1);

  expect(errors).toEqual([]);
  await app.close();
});
