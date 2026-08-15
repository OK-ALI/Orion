"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("Cinema shield stays native-only, compatibility-first, and redacted", () => {
  const client = read("apps", "mobile", "plugins", "orion-cinema-webview-native", "OrionCinemaWebViewClient.kt");
  const chromeClient = read("apps", "mobile", "plugins", "orion-cinema-webview-native", "OrionCinemaWebChromeClient.kt");
  const manager = read("apps", "mobile", "plugins", "orion-cinema-webview-native", "OrionCinemaWebViewManager.kt");
  const plugin = read("apps", "mobile", "plugins", "withOrionCinemaWebView.js");
  const surface = read("apps", "mobile", "src", "features", "playback", "OrionCinemaWebView.tsx");

  assert.match(client, /class OrionCinemaWebViewClient/);
  assert.match(client, /shouldInterceptRequest/);
  assert.match(client, /SafeBrowsingResponse/);
  assert.match(client, /isForMainFrame/);
  assert.match(client, /latest\?\.decision/);
  assert.match(client, /pendingClassifications/);
  assert.match(client, /"classifications"/);
  assert.match(client, /"active"/);
  assert.match(client, /mediaOrigins/);
  assert.match(client, /artworkOrigins/);
  assert.match(client, /subtitleOrigins/);
  assert.match(client, /redacted evidence/);
  assert.match(client, /reportedRoutineEvidence/);
  assert.match(client, /routine redacted evidence once per page/);
  assert.match(client, /else null/);
  assert.match(client, /scheme-deny/);
  assert.match(client, /hostless-deny/);
  assert.match(chromeClient, /onCreateWindow/);
  assert.match(chromeClient, /return false/);
  assert.match(manager, /setSupportMultipleWindows\(false\)/);
  assert.match(manager, /javaScriptCanOpenWindowsAutomatically = false/);
  assert.match(plugin, /OrionCinemaWebChromeClient\.kt/);
  assert.match(surface, /nativeConfig/);
  assert.doesNotMatch(surface, /https?:\/\/.*token/i);
});

test("standalone Android builds synchronize the authoritative Cinema shield client", () => {
  const sourceRoot = path.join(root, "apps", "mobile", "plugins", "orion-cinema-webview-native");
  const generatedRoot = path.join(
    root,
    "apps",
    "mobile",
    "android",
    "app",
    "src",
    "main",
    "java",
    "com",
    "okali",
    "orion",
    "playback",
  );
  const files = [
    "OrionCinemaWebViewClient.kt",
    "OrionCinemaWebChromeClient.kt",
    "OrionCinemaWebViewManager.kt",
    "OrionCinemaWebViewPackage.kt",
  ];
  for (const fileName of files) {
    assert.equal(
      fs.readFileSync(path.join(generatedRoot, fileName), "utf8"),
      fs.readFileSync(path.join(sourceRoot, fileName), "utf8"),
      `${fileName} must match its authoritative plugin source`,
    );
  }

  const buildScript = read("apps", "mobile", "scripts", "build-android-standalone.cjs");
  assert.match(buildScript, /syncCinemaNativeSources/);
  assert.match(buildScript, /OrionCinemaWebChromeClient\.kt/);
  assert.match(buildScript, /fs\.copyFileSync/);
});

test("all current Mobile Cinema providers carry an enforced shared blocker manifest", () => {
  const registry = read("packages", "shared", "src", "sources", "registry.ts");
  const blockerCatalog = read("packages", "shared", "cinemaBlockRules.cjs");
  const mobileSources = read("apps", "mobile", "src", "features", "playback", "mobileSources.ts");

  assert.match(registry, /createEnforcedManifest/);
  assert.match(registry, /mode:\s*"enforce"/);
  assert.match(registry, /CINEMA_BLOCK_RULE_CATALOG_V1/);
  assert.match(registry, /allowedNavigationOrigins/);
  assert.match(registry, /mediaRequestOrigins/);
  assert.match(registry, /artworkRequestOrigins/);
  assert.match(registry, /subtitleRequestOrigins/);
  assert.match(registry, /popupPolicy:\s*"block"/);
  assert.match(blockerCatalog, /gsbdom\.click/);
  assert.match(blockerCatalog, /includeSubdomains/);
  assert.match(mobileSources, /MOBILE_QUARANTINED_SOURCE_IDS/);
  assert.match(mobileSources, /new Set\(\['autoembed'\]\)/);
  assert.match(mobileSources, /!MOBILE_QUARANTINED_SOURCE_IDS\.has\(source\.id\)/);
  assert.match(mobileSources, /vidking/);
});

test("AutoEmbed stays registered but is quarantined from Mobile selection after failed protection verification", () => {
  const experimental = read("packages", "shared", "src", "sources", "adapters", "experimental.ts");
  const mobileSources = read("apps", "mobile", "src", "features", "playback", "mobileSources.ts");

  assert.match(experimental, /id:\s*"autoembed"/);
  assert.match(mobileSources, /MOBILE_QUARANTINED_SOURCE_IDS/);
  assert.match(mobileSources, /new Set\(\['autoembed'\]\)/);
  assert.match(mobileSources, /!MOBILE_QUARANTINED_SOURCE_IDS\.has\(source\.id\)/);
  assert.match(mobileSources, /autoembed:\s*Object\.freeze/);
});

test("VidSrc stays manually selectable while Orion discloses external-browser advertising risk", () => {
  const mobileSources = read("apps", "mobile", "src", "features", "playback", "mobileSources.ts");
  const sheet = read("apps", "mobile", "src", "components", "player", "SourcesSheet.tsx");

  assert.match(mobileSources, /new Set\(\['autoembed'\]\)/);
  assert.match(mobileSources, /vidsrc:\s*Object\.freeze\(\{[\s\S]*?mode: 'outgoing-only'[\s\S]*?automaticTarget: false/);
  assert.match(mobileSources, /SAFETY_NOTICES[\s\S]*?vidsrc:[\s\S]*?External browser ads observed[\s\S]*?External Ads/);
  assert.match(mobileSources, /requiresSelectionConfirmation: true/);
  assert.match(sheet, /getMobileSourceSafetyNotice/);
  assert.match(sheet, /pendingSourceId/);
  assert.match(sheet, /OrionDialog/);
  assert.match(sheet, /Continue with \${pendingSourceName}/);
  assert.match(sheet, /onSelect\(sourceId\)/);
});

test("Cinema cleanup blocks popup links without permanent polling", () => {
  const blocker = read("apps", "mobile", "src", "features", "playback", "mobileAdBlocker.ts");
  assert.match(blocker, /window\.open/);
  assert.match(blocker, /MutationObserver/);
  assert.match(blocker, /mutation\.addedNodes/);
  assert.match(blocker, /removeAds\(node\)/);
  assert.doesNotMatch(blocker, /attributes:\s*true/);
  assert.match(blocker, /ORION_COSMETIC_BLOCK/);
  assert.match(blocker, /cosmeticFlushes\s*<\s*12/);
  assert.match(blocker, /setTimeout\(flushCosmeticEvidence, 900\)/);
  assert.match(blocker, /gsbdom\.click/);
  assert.doesNotMatch(blocker, /setInterval/);
  assert.match(blocker, /ORION_SUBTITLE_TRACK/);
  assert.match(blocker, /video\.textTracks/);
});

test("Streaming Servers keeps source selection primary and details expandable", () => {
  const sheet = read("apps", "mobile", "src", "components", "player", "SourcesSheet.tsx");
  assert.match(sheet, /flex:\s*1/);
  assert.match(sheet, /Source details/);
  assert.match(sheet, /detailsOpen/);
  assert.match(sheet, /detailsPanePhone/);
  assert.match(sheet, /MOBILE_PLAYER_SOURCES\.map/);
  assert.match(sheet, /useOrionTheme/);
  assert.doesNotMatch(sheet, /#[0-9a-f]{3,8}/i);
});

test("player HUD exposes native shield status and a blocked-request counter", () => {
  const surface = read("apps", "mobile", "src", "features", "playback", "EmbedPlayerSurface.tsx");
  const hud = read("apps", "mobile", "src", "features", "playback", "EmbeddedPlayerHud.tsx");
  assert.match(surface, /surfaceLoaded\.current/);
  assert.match(surface, /nativeProtectionVerified/);
  assert.match(surface, /nativeShieldObserved/);
  assert.match(surface, /nativeBlockObserved/);
  assert.match(hud, /blockedRequests > 0/);
  assert.match(surface, /ORION_COSMETIC_BLOCK/);
  assert.match(surface, /cosmeticTotal/);
  assert.match(surface, /nativeSessionObserved/);
  assert.match(surface, /ORION_SUBTITLE_TRACK/);
  assert.match(hud, /styles\.shieldCounter/);
  assert.match(hud, /props\.blockedRequests/);
  assert.match(hud, /'Protected'/);
});

test("subtitle references remain opaque and external fallback validates outcomes", () => {
  const discovery = read("apps", "mobile", "src", "features", "playback", "subtitleDiscovery.ts");
  const subtitleService = read("apps", "mobile", "src", "services", "subtitles.ts");
  const sharedMedia = read("packages", "shared", "src", "types", "media.ts");

  assert.match(sharedMedia, /interface EmbeddedSubtitleTrackV1/);
  assert.match(sharedMedia, /type SubtitleDiscoveryState/);
  assert.match(discovery, /opaqueId/);
  assert.match(discovery, /getInternalSubtitleTrack/);
  assert.match(discovery, /searchSubtitlesWithOutcome/);
  assert.match(subtitleService, /isSafeSubtitleUrl/);
  assert.match(subtitleService, /SubtitleSearchOutcome/);
  assert.match(subtitleService, /invalid-file/);
});
