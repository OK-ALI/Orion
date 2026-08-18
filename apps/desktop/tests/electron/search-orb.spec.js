const path = require("path");
const os = require("os");
const { test, expect, _electron: electron } = require("@playwright/test");

async function dismissOptionalOverlays(page) {
  const skipSignIn = page.getByRole("button", { name: "Skip / Use Offline" });
  if (await skipSignIn.count()) await skipSignIn.click();
  const continueCinema = page.getByRole("button", { name: "Continue to Cinema" });
  if (await continueCinema.count()) await continueCinema.click();
}

async function revealSidebar(page, world = "cinema") {
  const label = world === "music" ? "Reveal Music Planet sidebar" : "Reveal Orion Cinema sidebar";
  const rail = page.getByRole("button", { name: label });
  if (await rail.count()) await rail.hover();
}

async function goBackThroughSidebar(page, world = "cinema") {
  await revealSidebar(page, world);
  const back = page.locator(".sidebar-item").filter({ hasText: /^Back$/ }).first();
  await expect(back).toBeVisible();
  await back.click();
}

test("Cinema Search Orb opens anchored Quick Search, hides in full Search, and restores on Back", async ({}, testInfo) => {
  const userDataDir = path.join(os.tmpdir(), `orion-search-orb-${process.pid}-${testInfo.workerIndex}-${Date.now()}`);
  const app = await electron.launch({
    args: [path.join(__dirname, "../.."), `--user-data-dir=${userDataDir}`, "--disable-gpu"],
  });
  const page = await app.firstWindow();

  try {
    await page.waitForTimeout(1200);
    await dismissOptionalOverlays(page);

    const orb = page.getByRole("button", { name: "Search Orion" });
    await expect(orb).toBeVisible();

    await orb.click({ button: "right" });
    const anchored = page.locator(".quick-search-overlay.anchored");
    await expect(anchored).toBeVisible();
    await expect(anchored).toHaveAttribute("aria-label", "Cinema quick search");
    await expect(anchored.locator(".search-input")).toBeFocused();

    await orb.click({ button: "right" });
    await expect(anchored).toHaveCount(0, { timeout: 1_000 });

    await orb.click();
    await expect(page.locator(".search-results-page")).toBeVisible();
    await expect(page.locator(".search-input-full")).toBeFocused();
    await expect(orb).toBeHidden();

    await goBackThroughSidebar(page, "cinema");
    await expect(page.locator(".search-results-page")).toHaveCount(0);
    await expect(orb).toBeVisible();
  } finally {
    await app.close();
  }
});

test("Music Planet gives the same Orb Music-specific quick and full search contracts", async ({}, testInfo) => {
  const userDataDir = path.join(os.tmpdir(), `orion-music-search-orb-${process.pid}-${testInfo.workerIndex}-${Date.now()}`);
  const app = await electron.launch({
    args: [path.join(__dirname, "../.."), `--user-data-dir=${userDataDir}`, "--disable-gpu"],
  });
  const page = await app.firstWindow();

  try {
    await page.waitForTimeout(1200);
    await dismissOptionalOverlays(page);
    await revealSidebar(page, "cinema");
    const enterMusic = page.getByRole("button", { name: "Enter Music Planet" });
    await expect(enterMusic).toBeVisible();
    await enterMusic.click();
    await expect(page.getByRole("heading", { name: "Music Planet" })).toBeVisible({ timeout: 6_000 });

    const orb = page.getByRole("button", { name: "Search Music Planet" });
    await expect(orb).toBeVisible();
    await orb.click({ button: "right" });
    const anchored = page.locator(".quick-search-overlay.anchored");
    await expect(anchored).toBeVisible();
    await expect(anchored).toHaveAttribute("aria-label", "Music Planet quick search");
    await expect(anchored.locator(".search-input")).toHaveAttribute("placeholder", /tracks, artists and albums/i);

    await orb.click({ button: "right" });
    await expect(anchored).toHaveCount(0, { timeout: 1_000 });
    await orb.click();
    await expect(page.locator(".music-search-page")).toBeVisible({ timeout: 4_000 });
    await expect(page.getByRole("textbox", { name: "Search artists, albums and tracks" })).toBeFocused();
    await expect(orb).toBeHidden();

    await goBackThroughSidebar(page, "music");
    await expect(page.locator(".music-search-page")).toHaveCount(0);
    await expect(orb).toBeVisible();
  } finally {
    await app.close();
  }
});
