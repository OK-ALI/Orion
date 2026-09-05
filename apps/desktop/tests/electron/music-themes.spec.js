const path = require("path");
const os = require("os");
const { test, expect, _electron: electron } = require("@playwright/test");

const THEMES = ["dark", "amoled", "watchfree", "mocha", "slate", "light", "custom"];

function luminance(rgb) {
  const srgb = String(rgb || "").match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  const values = srgb
    ? srgb.slice(1, 4).map((value) => Number(value) * 255)
    : String(rgb || "").match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
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
  const musicHeading = page.getByRole("heading", { name: "Music Planet" });
  if (await musicHeading.count()) {
    await expect(musicHeading).toBeVisible();
    return;
  }

  const enterMusic = page.getByRole("button", { name: "Enter Music Planet" });
  if (!(await enterMusic.isVisible().catch(() => false))) {
    const revealCinema = page.getByRole("button", { name: "Reveal Orion Cinema sidebar" });
    await expect(revealCinema).toBeVisible();
    await revealCinema.focus();
    await expect(page.locator(".sidebar")).toHaveClass(/revealed/);
  }

  await expect(enterMusic).toBeVisible();
  await enterMusic.click();
  await expect(musicHeading).toBeVisible();
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
      const sceneRoot = document.querySelector(".music-planet-canvas-container");
      const canvas = sceneRoot.querySelector("canvas");
      const lightweightOrb = sceneRoot.querySelector(".music-lite-reactive-orb");
      return {
        scene: getComputedStyle(sceneRoot).backgroundColor,
        title: get(".music-planet-title"),
        subtitle: get(".music-planet-subtitle"),
        input: get(".music-hero-search input"),
        dock: get(".glass-music-player .player-meta"),
        renderMode: sceneRoot.dataset.musicRenderMode,
        hasCanvas: Boolean(canvas),
        hasLightweightOrb: Boolean(lightweightOrb),
        canvasOpacity: canvas ? Number.parseFloat(getComputedStyle(canvas).opacity || "0") : null,
        heroSearchRadius: Number.parseFloat(getComputedStyle(document.querySelector(".music-hero-search")).borderTopLeftRadius || "0"),
        ...(() => {
          const root = document.querySelector(".music-planet-container");
          const action = document.createElement("button");
          action.style.color = "var(--music-action-text, var(--bg-base))";
          action.style.background = "var(--music-action-fill, var(--music-highlight))";
          const searchLayout = document.createElement("div");
          searchLayout.className = "music-search-feature";
          const listeningLayout = document.createElement("div");
          listeningLayout.className = "music-listening-core";
          root.append(action, searchLayout, listeningLayout);
          const actionStyle = getComputedStyle(action);
          const searchStyle = getComputedStyle(searchLayout);
          const listeningStyle = getComputedStyle(listeningLayout);
          const result = {
            actionText: actionStyle.color,
            actionBackground: actionStyle.backgroundColor,
            searchLayoutBackground: searchStyle.backgroundColor,
            searchLayoutImage: searchStyle.backgroundImage,
            listeningLayoutBackground: listeningStyle.backgroundColor,
            listeningLayoutImage: listeningStyle.backgroundImage,
          };
          action.remove();
          searchLayout.remove();
          listeningLayout.remove();
          return result;
        })(),
      };
    });
    expect(contrast(colors.title, colors.scene), `${theme} title contrast`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.subtitle, colors.scene), `${theme} subtitle contrast`).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.input, colors.scene), `${theme} header input contrast`).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.dock, colors.scene), `${theme} dock contrast`).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.actionText, colors.actionBackground), `${theme} Music primary-action contrast`).toBeGreaterThanOrEqual(4.5);
    expect(["full", "orb", "static"]).toContain(colors.renderMode);
    if (colors.renderMode === "full") {
      expect(colors.hasCanvas, `${theme} Quality Music canvas`).toBe(true);
    } else if (colors.renderMode === "orb") {
      expect(colors.hasCanvas, `${theme} Balanced Music avoids Three canvas`).toBe(false);
      expect(colors.hasLightweightOrb, `${theme} Balanced Music lightweight orb`).toBe(true);
    } else {
      expect(colors.hasCanvas, `${theme} Efficiency Music avoids Three canvas`).toBe(false);
      expect(colors.hasLightweightOrb, `${theme} Efficiency Music stays static`).toBe(false);
    }
    if (theme === "light") {
      if (colors.renderMode === "full") {
        expect(colors.canvasOpacity, "light Quality Music core visibility").toBeGreaterThanOrEqual(0.58);
      }
      expect(colors.heroSearchRadius, "light Music search shell radius").toBeGreaterThanOrEqual(30);
      expect(colors.searchLayoutBackground, "light Music search layout stays transparent").toBe("rgba(0, 0, 0, 0)");
      expect(colors.searchLayoutImage, "light Music search layout has no raw background image").toBe("none");
      expect(colors.listeningLayoutBackground, "light Music listening layout stays transparent").toBe("rgba(0, 0, 0, 0)");
      expect(colors.listeningLayoutImage, "light Music listening layout has no raw background image").toBe("none");
    }
  }
  expect(errors).toEqual([]);
  await app.close();
});
