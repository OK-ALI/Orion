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

async function resize(app, width, height) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setContentSize(size.width, size.height);
  }, { width, height });
}

async function expectNoHorizontalOverflow(locator) {
  const geometry = await locator.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 2);
}

test("Music final coherence preserves layer order and narrow-window containment", async ({}, testInfo) => {
  const userDataDir = path.join(
    os.tmpdir(),
    `orion-music-final-${process.pid}-${testInfo.workerIndex}-${Date.now()}`,
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

    const layers = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const read = (name) => Number(style.getPropertyValue(name).trim());
      return {
        detail: read("--music-layer-detail"),
        sidebar: read("--music-layer-sidebar"),
        menu: read("--music-layer-menu"),
        dialog: read("--music-layer-dialog"),
        modal: read("--music-layer-modal"),
        cursor: read("--music-layer-cursor"),
      };
    });

    expect(layers.detail).toBeLessThan(layers.sidebar);
    expect(layers.sidebar).toBeLessThan(layers.menu);
    expect(layers.menu).toBeLessThan(layers.dialog);
    expect(layers.dialog).toBeLessThan(layers.modal);
    expect(layers.modal).toBeLessThan(layers.cursor);

    await resize(app, 900, 720);
    await page.waitForTimeout(150);
    await expectNoHorizontalOverflow(page.locator(".music-planet-scroll-area"));

    const homeSearch = page.getByPlaceholder("Search galaxies for artists, albums, or tracks...");
    await homeSearch.fill("final coherence");
    await homeSearch.press("Enter");
    await expect(page.getByRole("heading", { name: "Find your next favorite" })).toBeVisible();
    await expectNoHorizontalOverflow(page.locator(".music-planet-detail-overlay"));
    await expectNoHorizontalOverflow(page.locator(".music-search-page"));

    await resize(app, 700, 700);
    await page.waitForTimeout(150);
    await expectNoHorizontalOverflow(page.locator(".music-planet-detail-overlay"));
    await expectNoHorizontalOverflow(page.locator(".music-search-page"));
  } finally {
    await app.close();
  }
});
