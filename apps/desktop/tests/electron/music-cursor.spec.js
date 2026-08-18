const path = require("path");
const os = require("os");
const { test, expect, _electron: electron } = require("@playwright/test");

async function dismissOptionalOverlays(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const skipSignIn = page.getByRole("button", { name: "Skip / Use Offline" });
    if (await skipSignIn.isVisible().catch(() => false)) await skipSignIn.click();

    const skipWhatsNew = page.getByRole("button", { name: "Continue to Cinema" });
    if (await skipWhatsNew.isVisible().catch(() => false)) await skipWhatsNew.click();
    await page.waitForTimeout(80);
  }
}

async function revealSidebar(page, world) {
  const label = world === "music" ? "Music Planet" : "Orion Cinema";
  const sidebar = page.getByRole("navigation", { name: `${label} sidebar` });
  const body = sidebar.locator(".sidebar-body");

  if (await body.getAttribute("aria-hidden") === "true") {
    await sidebar.getByRole("button", { name: `Reveal ${label} sidebar` }).focus();
  }

  await expect(body).toHaveAttribute("aria-hidden", "false");
  return sidebar;
}

test("Music context cursor keeps precision controls readable and distinguishes text/action states", async ({}, testInfo) => {
  const userDataDir = path.join(
    os.tmpdir(),
    `orion-music-cursor-${process.pid}-${testInfo.workerIndex}-${Date.now()}`,
  );
  const app = await electron.launch({
    args: [path.join(__dirname, "../.."), `--user-data-dir=${userDataDir}`, "--disable-gpu"],
  });

  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => typeof window.electron?.musicGetStatus === "function");
    await dismissOptionalOverlays(page);

    const cinemaSidebar = await revealSidebar(page, "cinema");
    await cinemaSidebar.getByRole("button", { name: "Enter Music Planet" }).click();
    await expect(page.getByRole("heading", { name: "Music Planet" })).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/music-custom-cursor-active/);

    const homeSearch = page.getByPlaceholder("Search galaxies for artists, albums, or tracks...");
    await homeSearch.fill("cursor proof");
    await homeSearch.press("Enter");

    await expect(page.getByRole("heading", { name: "Find your next favorite" })).toBeVisible();
    const clear = page.getByRole("button", { name: "Clear search" });
    const query = page.getByRole("textbox", { name: "Search artists, albums and tracks" });
    const all = page.getByRole("button", { name: "All", exact: true });
    const cursor = page.locator(".music-planet-cursor");

    const clearBeforeHover = await clear.boundingBox();
    await clear.hover();
    await expect(cursor).toHaveAttribute("data-context", "precision");
    const clearAfterHover = await clear.boundingBox();

    expect(Math.round(clearAfterHover?.x || 0)).toBe(Math.round(clearBeforeHover?.x || 0));
    expect(Math.round(clearAfterHover?.y || 0)).toBe(Math.round(clearBeforeHover?.y || 0));

    const geometry = await page.evaluate(() => {
      const cursorRect = document.querySelector(".music-planet-cursor")?.getBoundingClientRect();
      const clearRect = document.querySelector(".music-search-clear")?.getBoundingClientRect();
      return {
        cursorWidth: Math.round(cursorRect?.width || 0),
        clearWidth: Math.round(clearRect?.width || 0),
      };
    });
    expect(geometry.cursorWidth).toBeGreaterThan(0);
    expect(geometry.cursorWidth).toBeLessThan(geometry.clearWidth);

    await query.hover();
    await expect(cursor).toHaveAttribute("data-context", "text");

    await all.hover();
    await expect(cursor).toHaveAttribute("data-context", "action");
  } finally {
    await app.close();
  }
});
