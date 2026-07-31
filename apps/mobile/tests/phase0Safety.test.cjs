"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");

test("native storage failure is surfaced instead of silently becoming volatile", () => {
  const storage = read("src/services/storageAdapter.ts");
  assert.match(storage, /MMKV_INIT_FAILED/);
  assert.match(storage, /state:\s*'unavailable'/);
  assert.match(storage, /EXPO_PUBLIC_ALLOW_MEMORY_STORAGE/);
  assert.doesNotMatch(
    storage,
    /catch\s*\([^)]*\)\s*\{\s*[^}]*adapter\s*=\s*new MemoryStorageAdapter\(\)/s,
  );
});

test("large mobile routes are thin shims and have no source-size exceptions", () => {
  for (const route of [
    "app/(tabs)/connect.tsx",
    "app/(tabs)/discover.tsx",
    "app/media/[id].tsx",
    "app/player/[id].tsx",
  ]) {
    const source = read(route);
    assert.match(source, /^export \{ default \} from /);
    assert.ok(source.split(/\r?\n/).length <= 3);
  }

  const sizeGate = read("scripts/check-source-size.cjs");
  assert.doesNotMatch(sizeGate, /OVERSIZED_ALLOWLIST/);
});

test("critical mobile route graph remains present for build-time smoke coverage", () => {
  for (const route of [
    "app/(tabs)/index.tsx",
    "app/(tabs)/discover.tsx",
    "app/media/[id].tsx",
    "app/player/[id].tsx",
    "app/(tabs)/library.tsx",
    "app/(tabs)/settings.tsx",
    "app/(tabs)/connect.tsx",
  ]) {
    assert.equal(
      fs.existsSync(path.join(mobileRoot, route)),
      true,
      `Missing critical route: ${route}`,
    );
  }
});

test("mobile diagnostics contract excludes private transport material", () => {
  const diagnostics = read("src/services/mobileDiagnostics.ts");
  for (const forbiddenField of [
    "token:",
    "password:",
    "cookie:",
    "signedUrl:",
    "localPath:",
    "desktopIp:",
  ]) {
    assert.doesNotMatch(diagnostics, new RegExp(forbiddenField, "i"));
  }
  assert.match(diagnostics, /redacted-url/);
  assert.match(diagnostics, /redacted-address/);
});

test("embedded page load cannot write playback history or claim source readiness", () => {
  const surface = read("src/features/playback/EmbedPlayerSurface.tsx");
  const loadedBody = surface.match(/const markSurfaceLoaded = \(\) => \{([\s\S]*?)\n  \};/);
  assert.ok(loadedBody, "Expected a dedicated WebView load handler");
  assert.doesNotMatch(loadedBody[1], /recordPlayback|updateMobileSourceHealth/);
  assert.match(loadedBody[1], /markOpenedOnly/);
  assert.match(surface, /decision\.state\.session\.verified/);
});
