"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot =
  path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(
    path.join(
      mobileRoot,
      relativePath,
    ),
    "utf8",
  );
}

test("Home consumes the frozen P10A.1 connection and recovery contracts", () => {
  const home =
    read("app/(tabs)/index.tsx");

  for (const marker of [
    "useNetworkStatus",
    "useRemoteRecoveryEffect",
    "network.remoteReady",
    "network.productState",
    "mountedRecoveryEpochRef",
    "network.recoveryEpoch !== mountedRecoveryEpochRef.current",
    "initialRemoteLoadStartedRef",
  ]) {
    assert.ok(
      home.includes(marker),
      `Missing Home connection marker: ${marker}`,
    );
  }
});

test("cold offline Home stays useful instead of waiting behind a full-screen remote loader", () => {
  const home =
    read("app/(tabs)/index.tsx");

  const panel =
    read(
      "src/components/HomeConnectionPanel.tsx",
    );

  assert.ok(
    home.includes(
      "HomeContinueWatching",
    ),
  );

  assert.ok(
    home.includes(
      "HomeConnectionPanel",
    ),
  );

  assert.ok(
    home.includes(
      "router.push('/(tabs)/downloads')",
    ),
  );

  assert.ok(
    home.includes(
      "router.push('/(tabs)/library')",
    ),
  );

  assert.ok(
    read("src/components/HomeOfflineIntroduction.tsx").includes(
      "Your local Orion is ready.",
    ),
  );

  assert.ok(
    read("src/components/HomeOfflineIntroduction.tsx").includes(
      "Your Library and verified Downloads stay available without internet.",
    ),
  );

  assert.doesNotMatch(
    home,
    /if\s*\(\s*loading\s*\)\s*\{\s*return\s*\(/,
  );
});

test("Home never starts TMDB work unless the shared connection owner says remote capability is ready", () => {
  const home =
    read("app/(tabs)/index.tsx");

  assert.match(
    home,
    /if\s*\(!remoteReadyRef\.current\)\s*\{\s*return;/,
  );

  assert.match(
    home,
    /const loadRemoteHome = useCallback\(async \(\) => \{/,
  );

  for (const endpoint of [
    "/trending/movie/week",
    "/trending/tv/week",
    "/discover/tv?with_original_language=ko",
    "/movie/top_rated?page=1",
    "/tv/top_rated?page=1",
  ]) {
    assert.ok(
      home.includes(endpoint),
      `Home endpoint disappeared: ${endpoint}`,
    );
  }
});

test("mid-session connection loss fences stale Home responses without clearing local state", () => {
  const home =
    read("app/(tabs)/index.tsx");

  assert.ok(
    home.includes(
      "remoteLoadGenerationRef",
    ),
  );

  assert.ok(
    home.includes(
      "generation !== remoteLoadGenerationRef.current",
    ),
  );

  assert.ok(
    home.includes(
      "!remoteReadyRef.current",
    ),
  );

  assert.match(
    home,
    /if\s*\(network\.remoteReady\)\s*\{\s*return;/,
  );

  assert.doesNotMatch(
    home,
    /setTrendingMovies\(\[\]\)/,
  );

  assert.doesNotMatch(
    home,
    /setTrendingTV\(\[\]\)/,
  );
});

test("initial or late-mounted online Home loads once while later restoration is consumed by the shared recovery hook", () => {
  const home =
    read("app/(tabs)/index.tsx");

  assert.ok(
    home.includes(
      "const mountedRecoveryEpochRef = useRef(network.recoveryEpoch);",
    ),
  );

  assert.ok(
    home.includes(
      "network.recoveryEpoch !== mountedRecoveryEpochRef.current",
    ),
  );

  assert.ok(
    home.includes(
      "initialRemoteLoadStartedRef.current = true",
    ),
  );

  assert.match(
    home,
    /useRemoteRecoveryEffect\(\(\) => \{/,
  );

  assert.match(
    home,
    /return loadRemoteHome\(\);/,
  );
});

test("remote-only Home rails stay hidden while the product state is not remote-ready", () => {
  const home =
    read("app/(tabs)/index.tsx");

  assert.ok(
    home.includes(
      "const showRemoteCatalog =",
    ),
  );

  assert.ok(
    home.includes(
      "network.remoteReady",
    ),
  );

  assert.match(
    home,
    /showRemoteCatalog\s*&&\s*spotlightItems\.length/,
  );

  assert.match(
    home,
    /showRemoteCatalog\s*&&\s*trendingMovies\.length/,
  );

  assert.match(
    home,
    /showRemoteCatalog\s*&&\s*trendingTV\.length/,
  );
});

test("Home connection panel exposes truthful offline, degraded, reconnecting, and checking states", () => {
  const panel =
    read(
      "src/components/HomeConnectionPanel.tsx",
    );

  assert.ok(
    read("src/components/HomeOfflineIntroduction.tsx").includes(
      "Your local Orion is ready.",
    ),
  );

  assert.ok(
    panel.includes(
      "Cinema is temporarily unavailable.",
    ),
  );

  assert.ok(
    panel.includes(
      "Internet transport is available, but the Cinema catalog service is not.",
    ),
  );

  assert.ok(
    panel.includes(
      "Reconnecting to Orion Cinema.",
    ),
  );

  assert.ok(
    panel.includes(
      "Checking Cinema connection.",
    ),
  );

  assert.ok(
    panel.includes(
      "Cinema did not refresh.",
    ),
  );
});

test("Continue Watching remains local-first and defers metadata enrichment until remote capability returns", () => {
  const source =
    read(
      "src/features/library/HomeContinueWatching.tsx",
    );

  assert.ok(
    source.includes(
      "useNetworkStatus",
    ),
  );

  assert.ok(
    source.includes(
      "const { remoteReady } = useNetworkStatus();",
    ),
  );

  assert.match(
    source,
    /if\s*\(!remoteReady\)\s*return;/,
  );

  assert.ok(
    source.includes(
      "enrichPlaybackMetadata(entry.key)",
    ),
  );

  assert.match(
    source,
    /\[enrichPlaybackMetadata, entries, remoteReady\]/,
  );
});

test("the extracted Home panel owns presentation only and does not duplicate connection measurement", () => {
  const panel =
    read(
      "src/components/HomeConnectionPanel.tsx",
    );

  assert.ok(
    panel.includes(
      "NetworkProductState",
    ),
  );

  assert.doesNotMatch(
    panel,
    /useNetworkStatus/,
  );

  assert.doesNotMatch(
    panel,
    /NetInfo/,
  );

  assert.doesNotMatch(
    panel,
    /tmdbFetch/,
  );

  assert.doesNotMatch(
    panel,
    /useRemoteRecoveryEffect/,
  );
});

test("P10A.2-A does not mutate Discover or duplicate the shared network owner", () => {
  const home =
    read("app/(tabs)/index.tsx");

  const continueWatching =
    read(
      "src/features/library/HomeContinueWatching.tsx",
    );

  const panel =
    read(
      "src/components/HomeConnectionPanel.tsx",
    );

  for (const source of [
    home,
    continueWatching,
    panel,
  ]) {
    assert.doesNotMatch(
      source,
      /NetInfo\.addEventListener/,
    );

    assert.doesNotMatch(
      source,
      /PROBE_INTERVAL_MS/,
    );

    assert.doesNotMatch(
      source,
      /probeRemoteService/,
    );
  }

  const discover =
    read(
      "src/features/discover/DiscoverScreen.tsx",
    );

  assert.doesNotMatch(
    discover,
    /useRemoteRecoveryEffect/,
  );

  assert.doesNotMatch(
    discover,
    /useNetworkStatus/,
  );
});