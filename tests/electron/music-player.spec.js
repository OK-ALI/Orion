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
  await page.evaluate(() => window.electron.musicSaveQueue({
    items: [{ id: "orion-player-test", provider: "test", title: "Orion Player Test", artistName: "Orion" }],
    index: 0, repeat: "off", shuffle: false,
  }));
  await page.reload();
  const dock = page.locator(".music-player-bar");
  await expect(dock).toBeVisible();
  await expect(dock).toHaveClass(/music-player-compact/);
  await expect(page.getByRole("button", { name: "Previous track" })).toBeVisible();
  await expect(dock.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next track" })).toBeVisible();

  await page.getByRole("button", { name: "Enter Music Planet" }).click();
  await expect(page.getByRole("heading", { name: "Music Planet" })).toBeVisible();
  await expect(page.getByText("Coming soon")).toBeVisible();

  // Dock stays visible on the locked screen
  await expect(dock).toBeVisible();

  // The sidebar still aligns with the dock
  const sidebar = page.locator(".sidebar");
  await sidebar.hover();
  await page.waitForTimeout(350);
  const [sidebarBox, dockBox] = await Promise.all([sidebar.boundingBox(), dock.boundingBox()]);
  expect(dockBox.x).toBeGreaterThanOrEqual(sidebarBox.x + sidebarBox.width - 1);

  expect(errors).toEqual([]);
  await app.close();
});

