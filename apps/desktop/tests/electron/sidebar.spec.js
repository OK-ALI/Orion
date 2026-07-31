const path = require("path");
const os = require("os");
const { test, expect, _electron: electron } = require("@playwright/test");

test("Cinema and Music restore independent Axiom-style sidebar rails", async ({}, testInfo) => {
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
      localStorage.setItem("orion.sidebar.cinema.mode", "collapsed");
      localStorage.setItem("orion.sidebar.cinema.openMode", "compact");
      localStorage.setItem("orion.sidebar.music.mode", "collapsed");
      localStorage.setItem("orion.sidebar.music.openMode", "expanded");
    });
    await page.reload();

    const cinemaRail = page.getByRole("button", { name: "Expand Orion Cinema sidebar" });
    await expect(cinemaRail).toBeVisible();
    await expect(cinemaRail).toContainText("ORION CINEMA");
    await cinemaRail.click();
    await expect(page.locator(".sidebar")).toHaveClass(/sidebar-compact/);

    await page.getByRole("button", { name: "Enter Music Planet" }).click();
    const musicRail = page.getByRole("button", { name: "Expand Music Planet sidebar" });
    await expect(musicRail).toBeVisible();
    await expect(musicRail).toContainText("MUSIC PLANET");
  } finally {
    await app.close();
  }
});
