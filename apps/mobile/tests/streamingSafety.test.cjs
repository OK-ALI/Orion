"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("Cinema shield stays native-only, compatibility-first, and redacted", () => {
  const client = read("apps", "mobile", "plugins", "orion-cinema-webview-native", "OrionCinemaWebViewClient.kt");
  const surface = read("apps", "mobile", "src", "features", "playback", "OrionCinemaWebView.tsx");

  assert.match(client, /class OrionCinemaWebViewClient/);
  assert.match(client, /shouldInterceptRequest/);
  assert.match(client, /SafeBrowsingResponse/);
  assert.match(client, /isForMainFrame/);
  assert.match(client, /latest\?\.decision/);
  assert.match(client, /redacted evidence/);
  assert.match(surface, /nativeConfig/);
  assert.doesNotMatch(surface, /https?:\/\/.*token/i);
});

test("all current Mobile Cinema providers carry an observation manifest", () => {
  const registry = read("packages", "shared", "src", "sources", "registry.ts");
  const mobileSources = read("apps", "mobile", "src", "features", "playback", "mobileSources.ts");

  assert.match(registry, /createObservationManifest/);
  assert.match(registry, /mode:\s*"observe"/);
  assert.match(registry, /allowedNavigationOrigins/);
  assert.match(registry, /popupPolicy:\s*"block"/);
  assert.match(mobileSources, /!source\.async && !source\.animeOnly/);
  assert.match(mobileSources, /vidking/);
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
