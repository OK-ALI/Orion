const path = require("path");
const os = require("os");
const { test, expect, _electron: electron } = require("@playwright/test");

test("quick search opens a TMDB person and preserves back navigation", async ({}, testInfo) => {
  const userDataDir = path.join(
    os.tmpdir(),
    `orion-people-${process.pid}-${testInfo.workerIndex}-${Date.now()}`,
  );
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
      let body = {};
      if (pathname.endsWith("/search/multi")) {
        body = { page: 1, total_pages: 1, results: [{ id: 10, media_type: "person", name: "Jane Example", known_for_department: "Acting", known_for: [] }] };
      } else if (pathname.endsWith("/person/10/combined_credits")) {
        body = { cast: [{ id: 20, media_type: "movie", title: "A Film", release_date: "2025-01-01", character: "Lead" }], crew: [] };
      } else if (pathname.endsWith("/person/10")) {
        body = { id: 10, name: "Jane Example", biography: "A test biography.", birthday: "1990-01-01", known_for_department: "Acting" };
      }
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
    };
  });
  await page.reload();
  await page.waitForTimeout(900);
  const skipSignIn = page.getByRole("button", { name: "Skip / Use Offline" });
  if (await skipSignIn.count()) await skipSignIn.click();
  const skipWhatsNew = page.getByRole("button", { name: "Continue to Cinema" });
  if (await skipWhatsNew.count()) await skipWhatsNew.click();
  await page.evaluate(() => {
    [...document.querySelectorAll(".sidebar-item")]
      .find((element) => element.textContent.includes("Search"))
      ?.click();
  });
  const input = page.getByPlaceholder(/Search movies, series and people/);
  await expect(input).toBeVisible();
  await input.fill("Jane");
  const personResult = page.getByRole("button", { name: /Jane Example/ });
  await expect(personResult).toBeVisible();
  await personResult.evaluate((element) => element.click());
  await expect(page.getByRole("heading", { name: "Jane Example" })).toBeVisible();
  await expect(page.getByText("A test biography.")).toBeVisible();
  await page.getByRole("button", { name: /Back/ }).click();
  await expect(page.locator(".sidebar-item.active")).toContainText("Home");
  await expect(page.getByRole("heading", { name: "Jane Example" })).toHaveCount(0);
  expect(errors).toEqual([]);
  await app.close();
});

test("quick search visually separates people and same-title media", async ({}, testInfo) => {
  const userDataDir = path.join(os.tmpdir(), `orion-search-layout-${process.pid}-${testInfo.workerIndex}-${Date.now()}`);
  const app = await electron.launch({
    args: [path.join(__dirname, "../.."), `--user-data-dir=${userDataDir}`, "--disable-gpu"],
  });
  const page = await app.firstWindow();
  const layoutErrors = [];
  page.on("pageerror", (error) => layoutErrors.push(error.message));
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = (input, options) => {
      const url = String(input);
      if (!url.startsWith("https://api.themoviedb.org/3/")) return originalFetch(input, options);
      const results = [
        { id: 10, media_type: "person", name: "Tom Cruise", known_for_department: "Acting", known_for: [{ id: 1, media_type: "movie", title: "Edge of Tomorrow" }, { id: 2, media_type: "movie", title: "Oblivion" }] },
        { id: 20, media_type: "movie", title: "Tom Cruise", original_title: "Tom Cruise", original_language: "en", release_date: "2024-01-01", vote_average: 6.4 },
        { id: 21, media_type: "movie", title: "Tom Cruise", original_title: "टॉम क्रूज़", original_language: "hi", release_date: "2021-01-01", vote_average: 7.2 },
      ];
      const body = url.includes("/search/multi") ? { page: 1, total_pages: 1, results } : {};
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
    };
  });
  await page.reload();
  await page.waitForTimeout(900);
  const skipSignIn = page.getByRole("button", { name: "Skip / Use Offline" });
  if (await skipSignIn.count()) await skipSignIn.click();
  const skipWhatsNew = page.getByRole("button", { name: "Continue to Cinema" });
  if (await skipWhatsNew.count()) await skipWhatsNew.click();
  await page.evaluate(() => {
    [...document.querySelectorAll(".sidebar-item")].find((element) => element.textContent.includes("Search"))?.click();
  });
  await page.getByPlaceholder(/Search movies, series and people/).fill("Tom Cruise");
  await expect(page.getByRole("tab", { name: /All.*3/ })).toBeVisible();
  await expect(page.getByText("Known for", { exact: true })).toBeVisible();
  await expect(page.locator(".search-result-supporting").first()).toContainText("Edge of Tomorrow, Oblivion");
  await expect(page.getByText("Same-title match", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Hindi", { exact: true })).toBeVisible();
  await expect(page.getByText("Original title", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /Bollywood.*1/ }).evaluate((element) => element.click());
  await expect(page.locator(".quick-search-result-grid .search-result")).toHaveCount(1);
  await expect(page.getByText("Bollywood", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /Global.*3/ }).evaluate((element) => element.click());
  await expect(page.getByText("Same-title match", { exact: true })).toHaveCount(2);
  const screenshotPath = testInfo.outputPath("search-layout.png");
  await page.screenshot({ path: screenshotPath });
  await testInfo.attach("search-layout", { path: screenshotPath, contentType: "image/png" });
  await page.evaluate(() => localStorage.setItem("orion_theme", JSON.stringify("light")));
  await page.reload();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    [...document.querySelectorAll(".sidebar-item")].find((element) => element.textContent.includes("Search"))?.click();
  });
  await page.getByPlaceholder(/Search movies, series and people/).fill("Tom Cruise");
  await expect(page.getByRole("tab", { name: /All.*3/ })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const lightScreenshotPath = testInfo.outputPath("search-layout-light.png");
  await page.screenshot({ path: lightScreenshotPath });
  await testInfo.attach("search-layout-light", { path: lightScreenshotPath, contentType: "image/png" });
  expect(layoutErrors).toEqual([]);
  await app.close();
});
