"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(mobileRoot, "../..");
const readMobile = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");
const readWorkspace = (relative) => fs.readFileSync(path.join(workspaceRoot, relative), "utf8");

test("v3.2 experience search extends the existing TMDB owner with Desktop-proven person search", () => {
  const api = readWorkspace("packages/shared/src/api/tmdb.ts");
  const apiIndex = readWorkspace("packages/shared/src/api/index.ts");
  const hook = readMobile("src/features/discover/useDiscoverSearchResults.ts");

  assert.match(api, /export async function fetchPersonSearch/);
  assert.match(api, /\/search\/person\?query=/);
  assert.match(apiIndex, /fetchPersonSearch/);
  assert.match(api, /normalize\('NFKD'\)/);
  assert.match(api, /tokens\.slice\(\)\.reverse\(\)\.join\(' '\)/);
  assert.match(api, /fetchPersonSearch\(primary, 2/);
  assert.match(api, /mergeSearchResults/);
  assert.match(api, /original_title/);
  assert.match(api, /original_name/);
  assert.match(hook, /fetchSearch\(trimmedQuery\)/);
  assert.match(hook, /generation === generationRef\.current && remoteReadyRef\.current/);
  assert.doesNotMatch(api, /fuse\.js|Fuse\(|levenshtein/i);
});

test("v3.2 entertainment alerts extend the existing local notification categories without push registration", () => {
  const notifications = readMobile("src/services/mobileNotifications.ts");
  const entertainment = readMobile("src/services/mobileEntertainmentAlerts.ts");
  const coordinator = readMobile("src/features/notifications/MobileNotificationCoordinator.tsx");
  const settings = readMobile("src/features/settings/NotificationSettingsContent.tsx");

  for (const category of ["newMovies", "newSeries", "newEpisodes", "animeReleases", "upcoming"]) {
    assert.match(notifications, new RegExp(category));
    assert.match(settings, new RegExp(category));
  }
  assert.match(entertainment, /\/discover\/movie/);
  assert.match(entertainment, /\/discover\/tv/);
  assert.match(entertainment, /last_episode_to_air/);
  assert.match(entertainment, /next_episode_to_air/);
  assert.match(entertainment, /SAVED_BATCH_SIZE = 12/);
  assert.match(entertainment, /CATALOG_INTERVAL_MS = 6 \* 60 \* 60_000/);
  assert.match(coordinator, /checkMobileEntertainmentAlertsV1/);
  assert.match(coordinator, /preferences\.categories\.newEpisodes/);
  assert.match(settings, /label: 'Entertainment'/);
  assert.match(settings, /label: 'Orion'/);
  assert.match(notifications, /Notable movies arriving now/);
  assert.match(notifications, /Fresh episodes from shows in My List/);
  assert.match(notifications, /\['orion-availability', 'New & Upcoming'/);
  assert.match(entertainment, /target: \{ target: 'discover', feed: 'new-releases'/);
  assert.match(entertainment, /target: \{ target: 'discover', feed: 'upcoming'/);
  assert.doesNotMatch(notifications, /compact daily alert|one-week and one-day reminders/i);
  assert.doesNotMatch(notifications, /getExpoPushTokenAsync|getDevicePushTokenAsync/);
  assert.doesNotMatch(entertainment, /setInterval|BackgroundFetch|TaskManager/);
});

test("v3.2 picture resize repair keeps one presentation owner and tells the truth for embedded sources", () => {
  const sheet = readMobile("src/components/player/PresentationSheet.tsx");
  const embeddedHud = readMobile("src/features/playback/EmbeddedPlayerHud.tsx");
  const preferences = readMobile("src/features/playback/presentationPreferences.ts");
  const surface = readMobile("src/features/playback/EmbedPlayerSurface.tsx") + '\n' + readMobile("src/features/playback/providerEmbedSupport.ts");
  const styles = readMobile("src/features/playback/playerStyles.ts");

  assert.match(sheet, />Resize picture</);
  assert.match(sheet, /Current: \{currentLabel\}/);
  assert.match(sheet, /Orion remembers this choice for this player source/);
  for (const mode of ["provider", "fit", "fill", "stretch"]) assert.match(sheet, new RegExp(`id: '${mode}'`));
  assert.match(embeddedHud, /Resize picture\. Current mode/);
  assert.match(embeddedHud, /resize-outline/);
  assert.match(surface, /presentation=\{presentation\}/);
  assert.match(preferences, /orion\.player\.presentation\.v1/);
  assert.match(preferences, /\['provider', 'fit', 'fill'\]/);
  assert.doesNotMatch(preferences, /viewportSafe\.has\(sourceId\) \? \['provider', 'fit', 'fill', 'stretch'\]/);
  assert.match(surface, /screenWiderThanVideo/);
  assert.match(surface, /presentation === 'provider'[\s\S]*?\? \{ width: '100%' as const, height: '100%' as const, flex: 0, alignSelf: 'stretch' as const \}/);
  assert.match(surface, /presentation === 'provider'\s*\? \{ width: '100%' as const, height: '100%' as const, flex: 0, alignSelf: 'stretch' as const \}\s*:\s*presentation === 'fit'/);
  assert.match(surface, /containerStyle=\{presentation === 'provider' \? presentationStyle : undefined\}/);
  assert.doesNotMatch(surface, /presentation === 'provider'\s*\? \{[^}]*flex: 1/);
  assert.doesNotMatch(surface, /118%/);
  assert.match(styles, /videoBoxWrapper:[\s\S]*alignItems: 'center'[\s\S]*justifyContent: 'center'[\s\S]*overflow: 'hidden'/);
  assert.doesNotMatch(sheet, /document\.|querySelector|style\.objectFit/);
});


test("v3.2 Home stays editorial while Discover owns deeper timely exploration", () => {
  const home = readMobile("app/(tabs)/index.tsx");
  const discover = readMobile("src/features/discover/DiscoverScreen.tsx");
  const catalog = readMobile("src/features/discover/discoverCatalog.ts");

  assert.match(home, /SectionTitle title="New" highlight="Releases"/);
  assert.match(home, /SectionTitle title="Coming" highlight="Soon"/);
  assert.match(home, /Explore more/);
  assert.match(home, /pathname: '\/discover'/);
  assert.match(home, /exploreIntent: String\(Date\.now\(\)\)/);
  assert.match(home, /feed: 'trending'/);
  assert.match(home, /feed: 'new-releases'/);
  assert.match(home, /feed: 'upcoming'/);
  assert.match(home, /backgroundColor: theme\.surface/);
  assert.match(home, /backgroundColor: theme\.accentSoft/);
  assert.match(home, /color=\{theme\.accent\}/);
  assert.doesNotMatch(home, /#E50914|#ff1f2d|#d96852|#6f8fb8|#a1121d/i);

  assert.match(catalog, /id: 'trending', name: 'Trending'/);
  assert.match(catalog, /id: 'new-releases', name: 'New Releases'/);
  assert.match(catalog, /id: 'upcoming', name: 'Coming Soon'/);
  assert.match(catalog, /getDiscoverReleaseDateParams/);
  assert.match(discover, /params\.exploreIntent/);
  assert.match(discover, /setActiveFeed\(feed\)/);
  assert.match(discover, /TRENDING_WINDOW_OPTIONS/);
  assert.match(discover, /RELEASE_WINDOW_OPTIONS/);
  assert.match(discover, /activeFeed === 'trending'/);
  assert.ok(discover.split(/\r?\n/).length <= 800);
});

test("v3.2 notification taps reuse the existing safe router and product destinations", () => {
  const notifications = readMobile("src/services/mobileNotifications.ts");
  const router = readMobile("src/features/notifications/MobileNotificationResponseRouter.tsx");
  const settings = readMobile("src/features/settings/NotificationSettingsContent.tsx");
  const coordinator = readMobile("src/features/notifications/MobileNotificationCoordinator.tsx");

  assert.match(notifications, /target: 'discover'/);
  assert.match(notifications, /feed: 'trending' \| 'new-releases' \| 'upcoming'/);
  assert.match(router, /pathname: '\/discover'/);
  assert.match(router, /addNotificationResponseReceivedListener/);
  assert.match(router, /getLastNotificationResponseAsync/);
  assert.match(settings, />Preview an alert</);
  assert.match(settings, /Send alert/);
  assert.doesNotMatch(settings, /Test notifications|developer|diagnostic/i);
  assert.doesNotMatch(coordinator, /verified and stored/i);
  assert.doesNotMatch(router, /Linking\.openURL/);
});
