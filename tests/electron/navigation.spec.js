const path = require("path");
const os = require("os");
const { test, expect, _electron: electron } = require("@playwright/test");

test("Settings, Downloads, Discover, and Library render without page errors", async ({}, testInfo) => {
  const userDataDir = path.join(
    os.tmpdir(),
    `orion-pw-${process.pid}-${testInfo.workerIndex}-${Date.now()}`,
  );
  const app = await electron.launch({
    args: [
      path.join(__dirname, "../.."),
      `--user-data-dir=${userDataDir}`,
      "--disable-gpu",
    ],
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    [...document.querySelectorAll(".sidebar-footer .sidebar-item")]
      .find((element) => element.textContent.includes("Settings"))
      ?.click();
  });
  await expect(page.getByText("SETTINGS", { exact: true })).toBeVisible();

  await page.evaluate(() => {
    [...document.querySelectorAll(".sidebar-item")]
      .find((element) => element.textContent.includes("Downloads"))
      ?.click();
  });
  await expect(page.getByRole("heading", { name: "Downloads", exact: true })).toBeVisible();

  await page.evaluate(() => {
    [...document.querySelectorAll(".sidebar-item")]
      .find((element) => element.textContent.includes("Discover"))
      ?.click();
  });
  await expect(page.getByRole("heading", { name: "Choose your orbit" })).toBeVisible();

  await page.evaluate(() => {
    [...document.querySelectorAll(".sidebar-item")]
      .find((element) => element.textContent.includes("My Library"))
      ?.click();
  });
  await expect(page.locator(".library-title")).toHaveText("My Library");
  await expect(page.getByRole("tab", { name: /Downloads/ })).toBeVisible();
  expect(errors).toEqual([]);
  await app.close();
});
