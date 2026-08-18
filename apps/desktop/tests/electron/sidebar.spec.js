const path = require("path");
const os = require("os");
const { test, expect, _electron: electron } = require("@playwright/test");

test("Cinema auto rail peeks without layout pinning and Music restores keep-open independently", async ({}, testInfo) => {
  const userDataDir = path.join(os.tmpdir(), `orion-sidebar-${process.pid}-${testInfo.workerIndex}-${Date.now()}`);
  const app = await electron.launch({
    args: [path.join(__dirname, "../.."), `--user-data-dir=${userDataDir}`, "--disable-gpu"],
  });
  const page = await app.firstWindow();

  try {
    await page.waitForTimeout(1200);
    const skipSignIn = page.getByRole("button", { name: "Skip / Use Offline" });
    if (await skipSignIn.count()) await skipSignIn.click();
    const continueCinema = page.getByRole("button", { name: "Continue to Cinema" });
    if (await continueCinema.count()) await continueCinema.click();

    await page.evaluate(() => {
      localStorage.setItem("orion.sidebar.cinema.mode", "auto");
      localStorage.setItem("orion.sidebar.music.mode", "pinned");
    });
    await page.reload();

    const cinemaRail = page.getByRole("button", { name: "Reveal Orion Cinema sidebar" });
    await expect(cinemaRail).toBeVisible();
    await expect(cinemaRail).toContainText("ORION CINEMA");
    await cinemaRail.hover();
    await expect(page.locator(".sidebar")).toHaveClass(/revealed/);
    await expect(page.locator(".sidebar")).toHaveClass(/peeking/);
    await expect(page.locator(".sidebar")).not.toHaveClass(/expanded/);
    await expect(page.getByText("Constellation", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Enter Music Planet" }).click();
    await expect(page.locator(".sidebar")).toHaveClass(/mode-pinned/);
    await expect(page.locator(".sidebar")).toHaveClass(/expanded/);
    await expect(page.getByRole("button", { name: "Use auto-hide sidebar rail" })).toBeVisible();
  } finally {
    await app.close();
  }
});
