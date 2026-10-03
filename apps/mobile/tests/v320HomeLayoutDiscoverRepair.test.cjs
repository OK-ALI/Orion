"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");

test("v3.2 Home Layout extends Settings with one persisted rail preference owner", () => {
  const architecture = read("src/features/settings/settingsArchitecture.ts");
  const settings = read("app/(tabs)/settings.tsx");
  const content = read("src/features/settings/HomeLayoutSettingsContent.tsx");
  const preferences = read("src/features/home/homeLayoutPreferences.ts");
  const navigator = read("src/features/settings/SettingsSectionNavigator.tsx");

  assert.match(architecture, /id: 'home', label: 'Home', status: 'active'/);
  assert.match(settings, /sectionId="home"/);
  assert.match(settings, /<HomeLayoutSettingsContent \/>/);
  assert.match(preferences, /orion\.mobile\.home\.layout\.v1/);
  for (const id of ["continue-watching", "trending-movies", "trending-tv", "new-releases", "upcoming", "k-dramas", "top-rated"]) {
    assert.match(preferences, new RegExp(`'${id}'`));
  }
  assert.match(preferences, /normalizeHomeLayoutPreferences/);
  assert.match(preferences, /useSyncExternalStore/);
  assert.match(content, /The featured banner always stays at the top of Home/);
  assert.match(content, /setHomeRailEnabled/);
  assert.match(content, /moveHomeRail/);
  assert.match(content, /PanResponder\.create/);
  assert.match(content, /accessibilityActions/);
  assert.match(content, /Restore default layout/);
  assert.match(content, /theme\.accentSoft/);
  assert.match(content, /theme\.accent/);
  assert.match(content, /theme\.surface/);
  assert.doesNotMatch(content, /#E50914|#ff1f2d|#d96852|#6f8fb8|#a1121d/i);
  assert.match(navigator, /<ScrollView style=\{styles\.options\}/);
});

test("v3.2 Home customization preserves Hero ownership and renders existing rails from saved order", () => {
  const home = read("app/(tabs)/index.tsx");

  assert.match(home, /useHomeLayoutPreferences\(\)/);
  assert.match(home, /<HeroBillboard/);
  assert.match(home, /const visibleRailOrder = homeLayout\.order\.filter\(\(railId\) => !homeLayout\.hidden\.includes\(railId\)\)/);
  assert.match(home, /visibleRailOrder[\s\S]{0,500}\.map\(renderHomeRail\)/);
  assert.match(home, /railId === 'continue-watching'/);
  assert.match(home, /<HomeContinueWatching/);
  assert.match(home, /Your Home sections are hidden/);
  assert.match(home, /section: 'home'/);
  assert.match(home, /flexWrap: 'wrap'/);
  assert.match(home, /subfilter: 'kr'/);
  assert.match(home, /genreId: '18'/);
  assert.match(home, /feed: 'top-rated'/);
  assert.doesNotMatch(home, /HeroBillboard[\s\S]{0,120}homeLayout\.hidden/);
});

test("v3.2 Discover Explore More feeds stay truthful, paged and responsive", () => {
  const discover = read("src/features/discover/DiscoverScreen.tsx");
  const catalog = read("src/features/discover/discoverCatalog.ts");
  const styles = read("src/features/discover/discoverStyles.ts");

  assert.match(catalog, /id: 'top-rated', name: 'Top Rated'/);
  assert.match(discover, /activeFeed === 'top-rated'[\s\S]{0,140}`\/\$\{mediaType\}\/top_rated\?page=\$\{pageNum\}`/);
  assert.match(discover, /activeFeed === 'upcoming'[\s\S]{0,80}\? ''/);
  assert.match(discover, /activeFeed === 'new-releases'[\s\S]{0,120}mediaType === 'tv' \? 10 : 20/);
  assert.match(discover, /page < totalPages/);
  assert.match(discover, /fetchDiscoverResults\(page \+ 1\)/);
  assert.match(discover, /existingKeys/);
  assert.match(discover, /typeToggleScroller/);
  assert.match(discover, /contentContainerStyle=\{styles\.typeToggleScroll\}/);
  assert.match(styles, /typeToggleScroller:[\s\S]*flexGrow: 0/);
  assert.match(styles, /typeToggleScroll:[\s\S]*paddingHorizontal: spacing\[4\][\s\S]*gap: spacing\[2\]/);
  assert.doesNotMatch(styles, /typeToggle:\s*\{[\s\S]{0,100}flexDirection: 'row'/);
});

test("v3.2 embedded Original keeps an explicit full-size provider viewport without touching healthy Fit or Fill", () => {
  const surface = read("src/features/playback/EmbedPlayerSurface.tsx") + '\n' + read("src/features/playback/providerEmbedSupport.ts");
  const preferences = read("src/features/playback/presentationPreferences.ts");
  const styles = read("src/features/playback/playerStyles.ts");

  assert.match(surface, /presentation === 'provider'\s*\? \{ width: '100%' as const, height: '100%' as const, flex: 0, alignSelf: 'stretch' as const \}/);
  assert.match(surface, /containerStyle=\{presentation === 'provider' \? presentationStyle : undefined\}/);
  assert.doesNotMatch(surface, /presentation === 'provider'\s*\? \{[^}]*flex: 1/);
  assert.match(surface, /presentation === 'fit'/);
  assert.match(surface, /presentation === 'fill'/);
  assert.match(styles, /webVideo: \{ flex: 1, backgroundColor: '#000' \}/);
  assert.match(preferences, /\['provider', 'fit', 'fill'\]/);
  assert.doesNotMatch(preferences, /\['provider', 'fit', 'fill', 'stretch'\]/);
});
