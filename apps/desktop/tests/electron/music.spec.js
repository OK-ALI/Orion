const path = require("path");
const os = require("os");
const { test, expect, _electron: electron } = require("@playwright/test");

async function dismissOptionalOverlays(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const skipSignIn = page.getByRole("button", { name: "Skip / Use Offline" });
    if (await skipSignIn.isVisible().catch(() => false)) await skipSignIn.click();

    const skipWhatsNew = page.getByRole("button", { name: "Continue to Cinema" });
    if (await skipWhatsNew.isVisible().catch(() => false)) await skipWhatsNew.click();

    await page.waitForTimeout(100);
  }
}

async function revealSidebar(page, world) {
  const label = world === "music" ? "Music Planet" : "Orion Cinema";
  const sidebar = page.getByRole("navigation", { name: `${label} sidebar` });
  await expect(sidebar).toBeVisible();

  const body = sidebar.locator(".sidebar-body");
  if (await body.getAttribute("aria-hidden") === "true") {
    const rail = sidebar.getByRole("button", { name: `Reveal ${label} sidebar` });
    await expect(rail).toBeVisible();
    await rail.focus();
  }

  await expect(body).toHaveAttribute("aria-hidden", "false");
  await expect(sidebar).toHaveClass(/revealed|pinned-open/);
  return sidebar;
}

async function openMusic(page) {
  const musicHeading = page.getByRole("heading", { name: "Music Planet" });
  if (await musicHeading.isVisible().catch(() => false)) return;

  const cinemaSidebar = await revealSidebar(page, "cinema");
  const enterMusic = cinemaSidebar.getByRole("button", { name: "Enter Music Planet" });
  await expect(enterMusic).toBeVisible();
  await enterMusic.click();
  await expect(musicHeading).toBeVisible();
}

// C4.6 parser-clean acceptance harness: one declaration per helper.
// C4.5 waits for actual scroll/layout stability before capturing a restoration oracle.
async function readMusicHomeScroll(page) {
  return page.evaluate(() => {
    const raw = window.sessionStorage.getItem("orion:music-home-scroll");
    return raw ? JSON.parse(raw) : null;
  });
}

async function chapterViewportOffset(page, chapter) {
  return page.locator(`#${chapter}`).evaluate((section) => {
    const container = document.querySelector(".music-planet-scroll-area");
    if (!container) throw new Error("Music scroll container is unavailable");
    return Math.round(section.getBoundingClientRect().top - container.getBoundingClientRect().top);
  });
}

async function waitForChapterGeometrySettled(page, chapter) {
  await page.locator(`#${chapter}`).evaluate(async (section) => {
    const container = document.querySelector(".music-planet-scroll-area");
    if (!container) throw new Error("Music scroll container is unavailable");

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let previous = "";
    let stableSamples = 0;

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const root = container.getBoundingClientRect();
      const rect = section.getBoundingClientRect();
      const snapshot = [
        Math.round(container.scrollTop),
        Math.round(container.scrollHeight),
        Math.round(root.height),
        Math.round(rect.top - root.top),
        Math.round(rect.height),
      ].join(":");

      if (snapshot === previous) stableSamples += 1;
      else stableSamples = 0;

      if (stableSamples >= 5) return;
      previous = snapshot;
      await sleep(50);
    }

    throw new Error(`Music chapter "${section.id}" did not settle`);
  });
}

async function expectChapterAtTop(page, chapter) {
  await waitForChapterGeometrySettled(page, chapter);
  await expect.poll(() => chapterViewportOffset(page, chapter)).toBeLessThan(120);
}

async function expectPersistedMusicContext(page, expectedChapter, tolerance = 2) {
  await expect.poll(async () => {
    const saved = await readMusicHomeScroll(page);
    if (!saved || saved.chapter !== expectedChapter) return 10000;

    const offset = await chapterViewportOffset(page, expectedChapter);
    const top = await page.locator(".music-planet-scroll-area").evaluate(
      (container) => Math.round(container.scrollTop),
    );

    return Math.max(
      Math.abs((Number(saved.top) || 0) - top),
      Math.abs((Number(saved.chapterOffset) || 0) + offset),
    );
  }).toBeLessThanOrEqual(tolerance);
}

async function createStableChapterContext(page, chapter, preferredOffset = 72) {
  await waitForChapterGeometrySettled(page, chapter);

  await page.locator(`#${chapter}`).evaluate((section, offset) => {
    const container = document.querySelector(".music-planet-scroll-area");
    if (!container) throw new Error("Music scroll container is unavailable");

    const root = container.getBoundingClientRect();
    const chapterTop =
      container.scrollTop + section.getBoundingClientRect().top - root.top;
    const maximum = Math.max(0, container.scrollHeight - container.clientHeight);
    const desired = Math.max(0, Math.min(maximum, chapterTop - offset));

    // Direct assignment intentionally cancels any completed/remaining smooth
    // navigation and establishes the exact context the user is leaving from.
    container.scrollTop = desired;
  }, preferredOffset);

  await waitForChapterGeometrySettled(page, chapter);
  await expectPersistedMusicContext(page, chapter);

  const saved = await readMusicHomeScroll(page);
  if (Math.abs(Number(saved.chapterOffset) || 0) < 2) {
    throw new Error(`Could not establish a non-zero ${chapter} return context`);
  }
  return saved;
}

async function expectRestoredMusicContext(page, saved, tolerance = 10) {
  await waitForChapterGeometrySettled(page, saved.chapter);
  await expect.poll(async () => {
    const offset = await chapterViewportOffset(page, saved.chapter);
    return Math.abs(offset + Number(saved.chapterOffset || 0));
  }).toBeLessThanOrEqual(tolerance);
}

test("Music Planet provider host and C4 UX preserve exact local context", async ({}, testInfo) => {
  const userDataDir = path.join(
    os.tmpdir(),
    `orion-music-pw-${process.pid}-${testInfo.workerIndex}-${Date.now()}`,
  );
  const app = await electron.launch({
    args: [path.join(__dirname, "../.."), `--user-data-dir=${userDataDir}`, "--disable-gpu"],
  });

  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.waitForFunction(() => typeof window.electron?.musicGetStatus === "function");
    await dismissOptionalOverlays(page);

    // Provider-host proof is local and deterministic. No live catalog result is required.
    const status = await page.evaluate(() => window.electron.musicGetStatus());
    expect(status).toMatchObject({ ok: true, schemaVersion: 4, trackCount: 0 });

    const providers = await page.evaluate(() => window.electron.musicListProviders());
    expect(providers.some((provider) => provider.id === "ytmusic-metadata")).toBe(true);
    expect(providers.some((provider) => provider.id === "ytmusic-streaming")).toBe(true);
    expect(providers.some((provider) => provider.id === "lrclib-lyrics")).toBe(true);
    expect(providers.some((provider) => provider.id === "spotify-charts-dashboard")).toBe(true);
    expect(providers.some((provider) => provider.id === "orion-local-streaming")).toBe(true);

    const pluginCatalog = await page.evaluate(() => window.electron.musicListPlugins());
    expect(pluginCatalog.some((plugin) => plugin.id === "orion-ytmusic" && plugin.installed && plugin.enabled)).toBe(true);
    expect(pluginCatalog.some((plugin) => plugin.id === "orion-lrclib" && plugin.installed && plugin.enabled)).toBe(true);
    expect(pluginCatalog.some((plugin) => plugin.id === "orion-spotify-import" && plugin.installed && plugin.enabled)).toBe(true);
    expect(pluginCatalog.some((plugin) => plugin.id === "orion-discogs")).toBe(false);

    await openMusic(page);

    // Sidebar navigation is only accessible while the auto-hide rail is revealed.
    let musicSidebar = await revealSidebar(page, "music");
    const musicGroups = musicSidebar.locator(".sidebar-group-label");
    await expect(musicGroups.filter({ hasText: /^Listen$/ })).toHaveCount(1);
    await expect(musicGroups.filter({ hasText: /^Explore$/ })).toHaveCount(1);
    await expect(musicGroups.filter({ hasText: /^Yours$/ })).toHaveCount(1);
    await expect(musicGroups.filter({ hasText: /^System$/ })).toHaveCount(1);

    const homeNav = musicSidebar.getByRole("button", { name: "Home", exact: true });
    const libraryNav = musicSidebar.getByRole("button", { name: "Library", exact: true });
    await expect(homeNav).toHaveClass(/active/);
    await expect(libraryNav).toBeVisible();

    // Library is a middle chapter, so the restoration proof is not distorted by
    // the scroll container's bottom clamp as the final Sources chapter can be.
    await libraryNav.click();
    await expectChapterAtTop(page, "library");

    musicSidebar = await revealSidebar(page, "music");
    await expect(
      musicSidebar.getByRole("button", { name: "Library", exact: true }),
    ).toHaveClass(/active/);

    await createStableChapterContext(page, "library", 72);

    // Cursor proof intentionally moves away from the rail. Subsequent sidebar
    // interaction must explicitly reveal it again rather than relying on hover state.
    await page.mouse.move(800, 300);
    await expect(page.locator(".music-planet-cursor")).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/music-custom-cursor-active/);

    // The restoration oracle is the final state immediately before the user exits,
    // after all navigation animation and layout changes have settled.
    await waitForChapterGeometrySettled(page, "library");
    await expectPersistedMusicContext(page, "library");
    const exitMusicContext = await readMusicHomeScroll(page);
    expect(exitMusicContext.chapter).toBe("library");

    musicSidebar = await revealSidebar(page, "music");
    const returnToCinema = musicSidebar.getByRole("button", { name: "Return to Cinema" });
    await expect(returnToCinema).toBeVisible();
    await returnToCinema.click();
    await expect(page.locator("html")).not.toHaveClass(/music-custom-cursor-active/);
    await expect(page.getByText("Try Again", { exact: true })).toHaveCount(0);

    await openMusic(page);
    await expect(page.getByText("Try Again", { exact: true })).toHaveCount(0);
    await expectRestoredMusicContext(page, exitMusicContext);
    await expect.poll(async () => (await readMusicHomeScroll(page))?.chapter).toBe("library");

    musicSidebar = await revealSidebar(page, "music");
    await expect(
      musicSidebar.getByRole("button", { name: "Library", exact: true }),
    ).toHaveClass(/active/);

    // C4 contract: Appearance is reachable inside Music, and Back returns to the
    // exact previous Music viewport rather than resetting the single-surface home.
    await page.getByRole("button", { name: "Open Music settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    const projectorSilver = page.getByRole("button", { name: "Use Projector Silver theme" });
    await expect(projectorSilver).toBeVisible();
    await projectorSilver.click();
    await expect(projectorSilver).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.getByRole("button", { name: "Back in Music Planet" }).click();
    await expect(page.locator("#library")).toBeVisible();
    await expectRestoredMusicContext(page, exitMusicContext);
    await expect.poll(async () => (await readMusicHomeScroll(page))?.chapter).toBe("library");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    expect(errors).toEqual([]);
  } finally {
    await app.close().catch(() => {});
  }
});
