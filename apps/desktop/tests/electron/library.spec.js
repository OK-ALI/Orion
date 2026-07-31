const path = require("path");
const os = require("os");
const { test, expect, _electron: electron } = require("@playwright/test");

test("Library repairs legacy metadata and applies live sorting", async ({}, testInfo) => {
  const userDataDir = path.join(os.tmpdir(), `orion-library-${process.pid}-${testInfo.workerIndex}-${Date.now()}`);
  const app = await electron.launch({
    args: [path.join(__dirname, "../.."), `--user-data-dir=${userDataDir}`, "--disable-gpu"],
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = (input, options) => {
      const url = String(input);
      if (!url.startsWith("https://api.themoviedb.org/3/")) return originalFetch(input, options);
      const pathname = new URL(url).pathname;
      const records = {
        "/3/movie/1": { id: 1, title: "Older Favorite", release_date: "1998-05-01", poster_path: "/older.jpg", backdrop_path: "/older-bg.jpg", vote_average: 9.2 },
        "/3/movie/2": { id: 2, title: "Newer Film", release_date: "2024-04-03", poster_path: "/newer.jpg", backdrop_path: "/newer-bg.jpg", vote_average: 7.5 },
      };
      const body = records[pathname] || {};
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
    };
  });
  await page.evaluate(() => {
    localStorage.setItem("orion_saved", JSON.stringify({
      movie_1: { id: 1, media_type: "movie", title: "Older Favorite", year: "1998" },
      movie_2: { id: 2, media_type: "movie", title: "Newer Film", year: "2024" },
    }));
    localStorage.setItem("orion_savedOrder", JSON.stringify(["movie_1"]));
    localStorage.setItem("orion_librarySort", JSON.stringify("manual"));
  });
  await page.reload();
  await page.waitForTimeout(900);
  const skipSignIn = page.getByRole("button", { name: "Skip / Use Offline" });
  if (await skipSignIn.count()) await skipSignIn.click();
  const skipWhatsNew = page.getByRole("button", { name: "Continue to Cinema" });
  if (await skipWhatsNew.count()) await skipWhatsNew.click();
  await page.evaluate(() => {
    [...document.querySelectorAll(".sidebar-item")].find((element) => element.textContent.includes("My Library"))?.click();
  });
  await expect(page.locator(".library-card-grid .media-card-title")).toHaveCount(2);
  await expect(page.getByText("May 1, 1998 · Movie")).toBeVisible();
  await expect(page.getByText("Apr 3, 2024 · Movie")).toBeVisible();

  const sort = page.getByRole("combobox", { name: "Sort My List" });
  await sort.selectOption("year");
  await expect(page.locator(".library-card-grid .media-card-title").first()).toHaveText("Newer Film");
  await sort.selectOption("rating");
  await expect(page.locator(".library-card-grid .media-card-title").first()).toHaveText("Older Favorite");
  expect(errors).toEqual([]);
  await app.close();
});
