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

  // Public release contract: a fresh machine gets Orion-managed configuration,
  // never end-user TMDB or Google developer credential prompts.
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(page.getByText("Developer OAuth Credentials", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Google connection setup", { exact: true })).toHaveCount(0);

  const skipSignIn = page.getByRole("button", { name: "Skip / Use Offline" });
  if (await skipSignIn.count()) await skipSignIn.click();

  await expect(page.getByText("TMDB API Read Access Token", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Orion metadata unavailable", { exact: false })).toHaveCount(0);

  const skipWhatsNew = page.getByRole("button", { name: "Continue to Cinema" });
  if (await skipWhatsNew.count()) await skipWhatsNew.click();
  await page.evaluate(() => {
    [...document.querySelectorAll(".sidebar-footer .sidebar-item")]
      .find((element) => element.textContent.includes("Settings"))
      ?.click();
  });
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByText("Google connection setup", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Change API Token" })).toHaveCount(0);

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
  await expect(page.getByRole("heading", { name: "My Library", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Downloads/ })).toBeVisible();
  expect(errors).toEqual([]);
  await app.close();
});
