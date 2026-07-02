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
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
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
  await page.evaluate(() => {
    [...document.querySelectorAll(".sidebar-item")]
      .find((element) => element.textContent.includes("Search"))
      ?.click();
  });
  const input = page.getByPlaceholder(/Search movies, series and people/);
  await expect(input).toBeVisible();
  await input.fill("Jane");
  await page.getByRole("button", { name: /Jane Example/ }).click();
  await expect(page.getByRole("heading", { name: "Jane Example" })).toBeVisible();
  await expect(page.getByText("A test biography.")).toBeVisible();
  await page.getByRole("button", { name: /Back/ }).click();
  await expect(page.locator(".sidebar-item.active")).toContainText("Home");
  await expect(page.getByRole("heading", { name: "Jane Example" })).toHaveCount(0);
  expect(errors).toEqual([]);
  await app.close();
});
