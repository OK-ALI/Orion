"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");

test("top-level utility pages use the shared editorial header", () => {
  for (const relative of [
    "src/features/discover/DiscoverScreen.tsx",
    "src/features/connect/ConnectScreen.tsx",
    "src/features/library/LibraryScreen.tsx",
    "app/(tabs)/downloads.tsx",
    "app/(tabs)/settings.tsx",
  ]) {
    assert.match(read(relative), /MobilePageHeader/);
  }
  const header = read("src/components/MobilePageHeader.tsx");
  assert.match(header, /paddingTop: isTablet \? insets\.top \+ 20 : isLandscape \? insets\.top \+ 12 : insets\.top \+ 64/);
  assert.match(header, /accessibilityRole="header"/);
});

test("Discover, Connect and their people surface consume live theme tokens", () => {
  const discover = read("src/features/discover/DiscoverScreen.tsx");
  const discoverStyles = read("src/features/discover/discoverStyles.ts");
  const connect = read("src/features/connect/ConnectScreen.tsx");
  const connectStyles = read("src/features/connect/connectStyles.ts");
  const person = read("src/components/PersonCard.tsx");
  assert.match(discover, /useOrionTheme/);
  assert.match(discoverStyles, /createDiscoverStyles.*MobileThemeTokens/);
  assert.match(connect, /useOrionTheme/);
  assert.match(connectStyles, /createConnectStyles.*MobileThemeTokens/);
  assert.match(person, /useOrionTheme/);
  assert.doesNotMatch(discover, /backgrounds\.base|accent\.primary|text\.muted/);
  assert.doesNotMatch(connect, /backgrounds\.base|accent\.primary/);
});

test("application confirmations use Orion dialogs instead of raw alerts", () => {
  const roots = ["app", "src"];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) {
        const source = fs.readFileSync(target, "utf8");
        assert.doesNotMatch(source, /Alert\.alert\s*\(|\balert\s*\(/, `Raw alert in ${target}`);
      }
    }
  };
  roots.forEach((root) => visit(path.join(mobileRoot, root)));
  assert.match(read("src/features/library/LibraryScreen.tsx"), /OrionDialog/);
  assert.match(read("src/features/connect/ConnectScreen.tsx"), /QR code not recognized/);
});

test("Library keeps explicit tabs and adds direction-locked finger paging", () => {
  const library = read("src/features/library/LibraryScreen.tsx");
  assert.match(library, /Gesture\.Pan\(\)/);
  assert.match(library, /activeOffsetX\(\[-24, 24\]\)/);
  assert.match(library, /failOffsetY\(\[-14, 14\]\)/);
  assert.match(library, /accessibilityRole="tab"/);
  assert.match(library, /preferences\.reducedMotion \? 0 : 210/);
});

test("offline status floats inside the safe area and compacts after four seconds", () => {
  const banner = read("src/components/OfflineBanner.tsx");
  const layout = read("app/_layout.tsx");
  assert.match(banner, /insets\.top \+ 8/);
  assert.match(banner, /setTimeout\(\(\) => setState\("compact"\), 4000\)/);
  assert.match(banner, /Offline — cached library data remains available/);
  assert.match(layout, /<OfflineBanner \/>/);
});

test("Home Continue Watching uses a compact capped rail presentation", () => {
  const card = read("src/features/library/ContinueWatchingCard.tsx");
  const home = read("src/features/library/HomeContinueWatching.tsx");
  const library = read("src/features/library/LibraryScreen.tsx");
  assert.match(card, /Math\.min\(330/);
  assert.match(card, /aspectRatio: 16 \/ 9/);
  assert.match(home, /presentation="home-rail"/);
  assert.match(library, /presentation="library-full"/);
  assert.match(card, /width: 44, height: 44/);
});
