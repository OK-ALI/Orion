const path = require("path");
const os = require("os");
const { test, expect, _electron: electron } = require("@playwright/test");

test("starting a movie never calls WebView methods before dom-ready", async ({}, testInfo) => {
  const userDataDir = path.join(os.tmpdir(), `orion-playback-${process.pid}-${testInfo.workerIndex}-${Date.now()}`);
  const app = await electron.launch({
    args: [path.join(__dirname, "../.."), `--user-data-dir=${userDataDir}`, "--disable-gpu"],
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const movies = page.locator(".media-carousel-section").filter({ hasText: "Trending Movies" });
  await expect(movies).toBeVisible({ timeout: 20_000 });
  await movies.locator(".media-carousel-item.active").click();
  const play = page.getByRole("button", { name: /^Play$/ });
  await expect(play).toBeVisible({ timeout: 15_000 });
  await play.click();
  await expect(page.locator("webview")).toBeAttached({ timeout: 10_000 });
  await page.waitForTimeout(1_000);

  await expect(page.getByText("Something went wrong")).toHaveCount(0);
  expect(errors.filter((message) => message.includes("WebView must be attached"))).toEqual([]);
  await app.close();
});
