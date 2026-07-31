const path = require("path");
const os = require("os");
const { test, expect, _electron: electron } = require("@playwright/test");

test("Constellation opens a person and restores the catalog on Back", async ({}, testInfo) => {
  const userDataDir = path.join(os.tmpdir(), `orion-constellation-${process.pid}-${testInfo.workerIndex}-${Date.now()}`);
  const app = await electron.launch({ args: [path.join(__dirname, "../.."), `--user-data-dir=${userDataDir}`, "--disable-gpu"] });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = (input, options) => {
      const url = String(input);
      if (!url.startsWith("https://api.themoviedb.org/3/")) return originalFetch(input, options);
      const pathname = new URL(url).pathname;
      const person = { id: 7, media_type: "person", name: "Ava Example", known_for_department: "Acting", profile_path: null, popularity: 50, known_for: [{ id: 9, media_type: "movie", title: "Example Story", popularity: 20 }] };
      let body = {};
      if (pathname.endsWith("/trending/person/week") || pathname.endsWith("/person/popular")) body = { page: 1, total_pages: 1, results: [person] };
      else if (pathname.endsWith("/person/7/combined_credits")) body = { cast: [{ id: 9, media_type: "movie", title: "Example Story", release_date: "2025-01-01", character: "Lead" }], crew: [] };
      else if (pathname.endsWith("/person/7")) body = { ...person, biography: "A Constellation test profile." };
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
    [...document.querySelectorAll(".sidebar-item")].find((element) => element.textContent.includes("Constellation"))?.click();
  });
  await expect(page.getByRole("heading", { name: "Constellation" })).toBeVisible();
  await expect(page.getByText("Ava Example").first()).toBeVisible();
  await page.getByRole("button", { name: "Open Ava Example" }).first().click();
  await expect(page.getByRole("heading", { name: "Ava Example" })).toBeVisible();
  await expect(page.getByText("A Constellation test profile.")).toBeVisible();
  await page.getByRole("button", { name: /Back/ }).click();
  await expect(page.getByRole("heading", { name: "Constellation" })).toBeVisible();
  await expect(page.locator(".sidebar-item.active")).toContainText("Constellation");
  expect(errors).toEqual([]);
  await app.close();
});
