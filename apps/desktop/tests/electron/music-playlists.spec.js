const path = require("path");
const os = require("os");
const { test, expect, _electron: electron } = require("@playwright/test");

async function dismissStartup(page) {
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

async function openFavoritesDetail(page, expectedTrackTitles = []) {
  const revealMusic = page.getByRole("button", { name: "Reveal Music Planet sidebar" });
  const autoRail = await revealMusic.isVisible().catch(() => false);
  if (autoRail) {
    await revealMusic.focus();
    await expect(page.locator(".sidebar")).toHaveClass(/revealed/);
  }

  const musicSidebar = page.getByRole("navigation", { name: "Music Planet sidebar" });
  const favoritesNav = musicSidebar.getByRole("button", { name: "Favorites", exact: true });
  await expect(favoritesNav).toBeVisible();
  await favoritesNav.click();

  const favoritesSection = page.locator("#favorites");
  await expect(favoritesSection).toBeVisible();
  await expect(favoritesNav).toHaveClass(/active/);
  for (const title of expectedTrackTitles) {
    await expect(favoritesSection.getByText(title, { exact: true })).toBeVisible();
  }
  await expect.poll(async () => favoritesSection.evaluate((section) => {
    const container = section.closest(".music-planet-scroll-area");
    if (!container) return false;
    const root = container.getBoundingClientRect();
    const rect = section.getBoundingClientRect();
    return rect.top >= root.top - 8 && rect.top <= root.top + 140;
  })).toBe(true);

  if (autoRail) {
    await page.keyboard.press("Escape");
    await expect(page.locator(".sidebar")).not.toHaveClass(/revealed/);
  }

  await favoritesSection.getByRole("button", { name: "View all favorites", exact: true }).click();
  const favoritesDetail = page.locator(".music-favorites-page");
  await expect(favoritesDetail).toBeVisible();
  await expect(favoritesDetail.getByRole("heading", { name: "Favorites", exact: true })).toBeVisible();
}

async function openAddToPlaylist(page, trackTitle) {
  const addButton = page.getByRole("button", { name: `Add ${trackTitle} to playlist` }).last();
  await expect(addButton).toBeVisible();
  await addButton.click();
  const dialog = page.getByRole("dialog", { name: "Add to playlist" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("Music Add to Playlist is a stable top-level overlay for empty, create, existing and Escape flows", async ({}, testInfo) => {
  const userDataDir = path.join(os.tmpdir(), `orion-music-playlists-${process.pid}-${testInfo.workerIndex}-${Date.now()}`);
  const app = await electron.launch({ args: [path.join(__dirname, "../.."), `--user-data-dir=${userDataDir}`, "--disable-gpu"] });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForTimeout(1000);
  await dismissStartup(page);

  const track = { id: "playlist-flow-track", provider: "test", title: "Playlist Flow Track", artistName: "Orion" };
  const favoriteTracks = [
    track,
    { id: "favorite-minimal-a", title: "Minimal Favorite A" },
    { id: "favorite-minimal-b", title: "Minimal Favorite B" },
  ];
  await page.evaluate(async (values) => {
    for (const value of values) {
      await window.electron.musicToggleFavorite("track", `test:${value.id}`, value);
    }
  }, favoriteTracks);
  await page.reload();
  await dismissStartup(page);

  await openMusic(page);
  await openFavoritesDetail(page, favoriteTracks.map((item) => item.title));

  let dialog = await openAddToPlaylist(page, track.title);
  await expect(page.getByText("No playlists yet", { exact: true })).toBeVisible();
  const backdrop = page.locator(".music-add-to-playlist-backdrop");
  await expect(backdrop).toBeVisible();
  expect(await backdrop.evaluate((element) => element.parentElement?.classList.contains("music-planet-container"))).toBe(true);
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  expect(box.y + box.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight));

  await page.getByRole("button", { name: "Create playlist", exact: true }).click();
  const nameInput = page.getByPlaceholder("My playlist");
  await expect(nameInput).toBeFocused();
  await nameInput.fill("Night Drive");
  await page.getByRole("button", { name: "Create & Add" }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => window.electron.musicListPlaylists())).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "Night Drive", items: expect.arrayContaining([expect.objectContaining({ id: "playlist-flow-track" })]) }),
  ]));

  await page.evaluate(() => window.electron.musicSavePlaylist({ name: "Road Trip", description: "", items: [] }));
  dialog = await openAddToPlaylist(page, track.title);
  const roadTrip = dialog.locator(".music-playlist-choice-list button").filter({ hasText: "Road Trip" });
  await expect(roadTrip).toBeVisible();
  await roadTrip.click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => window.electron.musicListPlaylists())).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "Road Trip", items: expect.arrayContaining([expect.objectContaining({ id: "playlist-flow-track" })]) }),
  ]));

  dialog = await openAddToPlaylist(page, track.title);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await page.getByRole("button", { name: "Back in Music Planet" }).click();
  const revealMusic = page.getByRole("button", { name: "Reveal Music Planet sidebar" });
  if (await revealMusic.isVisible().catch(() => false)) {
    await revealMusic.focus();
    await expect(page.locator(".sidebar")).toHaveClass(/revealed/);
  }
  const musicSidebar = page.getByRole("navigation", { name: "Music Planet sidebar" });
  const playlistsNav = musicSidebar.getByRole("button", { name: "Playlists", exact: true });
  await playlistsNav.click();
  const playlistsSection = page.locator("#playlists");
  await expect(playlistsSection.getByText("Night Drive", { exact: true })).toBeVisible();
  await expect(playlistsSection.getByText("Road Trip", { exact: true })).toBeVisible();
  await expect(playlistsSection.locator(".music-playlist-artwork").first()).toBeVisible();

  await playlistsSection.getByRole("button", { name: "Manage playlists", exact: true }).click();
  const playlistPage = page.locator(".music-playlists-page");
  await expect(playlistPage).toBeVisible();
  await playlistPage.getByRole("button", { name: "Edit", exact: true }).click();
  const editDialog = page.getByRole("dialog", { name: "Playlist details" });
  await expect(editDialog.getByRole("button", { name: "Smart mosaic", exact: true })).toBeVisible();
  await expect(editDialog.getByRole("button", { name: "Orion Glow", exact: true })).toBeVisible();
  await editDialog.getByRole("button", { name: "Orion Glow", exact: true }).click();
  await editDialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => page.evaluate(() => window.electron.musicListPlaylists())).toEqual(expect.arrayContaining([
    expect.objectContaining({ artwork: expect.objectContaining({ kind: "preset", preset: "orion-glow" }) }),
  ]));

  expect(errors).toEqual([]);
  await app.close();
});
