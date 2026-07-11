const path = require("path");
const os = require("os");
const { test, expect, _electron: electron } = require("@playwright/test");

const THEMES = ["dark", "amoled", "mocha", "slate", "light", "custom"];

function luminance(rgb) {
  const values = rgb.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
  if (!values || values.length !== 3) return null;
  const channels = values.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(left, right) {
  const a = luminance(left); const b = luminance(right);
  if (a == null || b == null) return 0;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function dismissOptionalOverlays(page) {
  const skipSignIn = page.getByRole("button", { name: "Skip / Use Offline" });
  if (await skipSignIn.count()) await skipSignIn.click();
  const skipWhatsNew = page.getByRole("button", { name: "Continue to Cinema" });
  if (await skipWhatsNew.count()) await skipWhatsNew.click();
}

async function openMusic(page) {
  const enterMusic = page.getByRole("button", { name: "Enter Music Planet" });
  if (await enterMusic.count()) await enterMusic.click();
  await expect(page.getByRole("heading", { name: "Music Planet" })).toBeVisible();
}

test("Music Planet keeps its readable orbital foreground in every supported theme", async ({}, testInfo) => {
  const userDataDir = path.join(os.tmpdir(), `orion-music-themes-${process.pid}-${testInfo.workerIndex}-${Date.now()}`);
  const app = await electron.launch({ args: [path.join(__dirname, "../.."), `--user-data-dir=${userDataDir}`, "--disable-gpu"] });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForTimeout(900);
  await dismissOptionalOverlays(page);
  await page.evaluate(() => window.electron.musicSaveQueue({
    items: [{ id: "theme-track", provider: "test", title: "Theme Signal", artistName: "Orion" }], index: 0, repeat: "off", shuffle: false,
  }));

  for (const theme of THEMES) {
    await page.evaluate((id) => localStorage.setItem("orion_theme", JSON.stringify(id)), theme);
    await page.reload();
    await page.waitForTimeout(700);
    await dismissOptionalOverlays(page);
    await openMusic(page);
    await expect(page.locator(".music-planet-title")).toBeVisible();
    await expect(page.locator(".music-planet-subtitle")).toBeVisible();
    await expect(page.locator(".music-hero-search input")).toBeVisible();
    await expect(page.locator(".glass-music-player .player-meta")).toBeVisible();
    const colors = await page.evaluate(() => {
      const get = (selector) => getComputedStyle(document.querySelector(selector)).color;
      return {
        scene: getComputedStyle(document.querySelector(".music-planet-canvas-container")).backgroundColor,
        title: get(".music-planet-title"),
        subtitle: get(".music-planet-subtitle"),
        input: get(".music-hero-search input"),
        dock: get(".glass-music-player .player-meta"),
      };
    });
    expect(contrast(colors.title, colors.scene), `${theme} title contrast`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.subtitle, colors.scene), `${theme} subtitle contrast`).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.input, colors.scene), `${theme} header input contrast`).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.dock, colors.scene), `${theme} dock contrast`).toBeGreaterThanOrEqual(3);
  }
  expect(errors).toEqual([]);
  await app.close();
});
