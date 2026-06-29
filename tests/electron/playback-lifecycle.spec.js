const path = require("path");
const os = require("os");
const { test, expect, _electron: electron } = require("@playwright/test");

async function installTmdbFixture(page) {
  const movie = {
    id: 101,
    title: "Orion Test Movie",
    overview: "Deterministic playback lifecycle fixture.",
    release_date: "2026-01-01",
    poster_path: null,
    backdrop_path: null,
    vote_average: 8,
    genre_ids: [28],
    genres: [{ id: 28, name: "Action" }],
    runtime: 100,
    media_type: "movie",
  };
  await page.addInitScript((fixture) => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = String(typeof input === "string" ? input : input?.url || "");
      if (!url.startsWith("https://api.themoviedb.org/")) return nativeFetch(input, init);
      const pathname = new URL(url).pathname;
      let body = { page: 1, total_pages: 1, results: [fixture] };
      if (pathname.endsWith("/movie/101")) body = fixture;
      if (pathname.endsWith("/videos") || pathname.endsWith("/recommendations") || pathname.endsWith("/similar") || pathname.endsWith("/credits")) body = { results: [], cast: [], crew: [] };
      if (pathname.endsWith("/release_dates")) body = { results: [] };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    };
  }, movie);
  await page.reload();
}

test("starting a movie never calls WebView methods before dom-ready", async ({}, testInfo) => {
  const userDataDir = path.join(os.tmpdir(), `orion-playback-${process.pid}-${testInfo.workerIndex}-${Date.now()}`);
  const app = await electron.launch({
    args: [path.join(__dirname, "../.."), `--user-data-dir=${userDataDir}`, "--disable-gpu"],
  });
  const page = await app.firstWindow();
  await installTmdbFixture(page);
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

test("movie handoff keeps a usable mini-player and pop-out transport", async ({}, testInfo) => {
  const userDataDir = path.join(os.tmpdir(), `orion-handoff-${process.pid}-${testInfo.workerIndex}-${Date.now()}`);
  const app = await electron.launch({
    args: [path.join(__dirname, "../.."), `--user-data-dir=${userDataDir}`, "--disable-gpu"],
  });
  const page = await app.firstWindow();
  await installTmdbFixture(page);
  const movies = page.locator(".media-carousel-section").filter({ hasText: "Trending Movies" });
  await expect(movies).toBeVisible({ timeout: 20_000 });
  await movies.locator(".media-carousel-item.active").click();
  await page.getByRole("button", { name: /^Play$/ }).click();
  await expect(page.locator("webview")).toBeAttached({ timeout: 10_000 });

  await page.locator(".sidebar-item").filter({ hasText: /^Home$/ }).click();
  const mini = page.locator(".orion-mini-player");
  await expect(mini).toBeVisible({ timeout: 12_000 });
  await expect(mini.getByText("Preparing mini-player…")).toHaveCount(0, { timeout: 12_000 });
  await expect(mini.getByRole("button", { name: "Mute" })).toBeVisible();

  await expect(mini.getByRole("button", { name: "Open always-on-top pop-out" })).toBeVisible();
  await app.close();
});
