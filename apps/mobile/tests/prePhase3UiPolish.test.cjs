"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");

test("landscape playback prompt stays bounded and wraps actions", () => {
  const source = read("src/features/playback/ResumePlaybackPrompt.tsx");
  assert.match(source, /Math\.min\(width - spacing\[6\], 640\)/);
  assert.match(source, /maxWidth: 640/);
  assert.match(source, /flexBasis: 220/);
  assert.match(source, /justifyContent: 'center'/);
});

test("History uses a two-level phone layout instead of squeezing metadata", () => {
  const source = read("src/features/library/HistoryRow.tsx");
  assert.match(source, /isPhone/);
  assert.match(source, /styles\.summary/);
  assert.match(source, /styles\.actionsPhone/);
  assert.match(source, /rowPhone: \{ flexDirection: 'column'/);
});

test("landscape phones keep the phone shell and bounded content density", () => {
  const responsive = read("src/services/responsive.ts");
  const tabShell = read("app/(tabs)/_layout.tsx");
  const discover = read("src/features/discover/DiscoverScreen.tsx");
  const hero = read("src/components/HeroBillboard.tsx");
  assert.match(responsive, /Math\.min\(width, height\)/);
  assert.match(responsive, /isLandscape/);
  assert.match(tabShell, /isTablet && <SidebarDrawer/);
  assert.match(discover, /isPhone[\s\S]*isLandscape \? 4/);
  assert.match(hero, /isPhoneLandscape/);
  assert.match(hero, /heroHeight/);
});

test("Home hero retains artwork beneath restrained readability layers", () => {
  const source = read("src/components/HeroBillboard.tsx");
  assert.match(source, /BlurView intensity=\{18\}/);
  assert.match(source, /rgba\(0,0,0,0\.20\)/);
  assert.doesNotMatch(source, /colors=\{\[theme\.mediaScrim, 'transparent'\]\}/);
});

test("system-following theme listens live and refreshes after foregrounding", () => {
  const source = read("src/context/ThemeContext.tsx");
  assert.match(source, /Appearance\.addChangeListener/);
  assert.match(source, /AppState\.addEventListener/);
  assert.match(source, /Appearance\.getColorScheme\(\)/);
});

test("pairing modal is keyboard-aware and PIN boxes fit compact phones", () => {
  const screen = read("src/features/connect/SmartConnectPairingModal.tsx");
  const styles = read("src/features/connect/connectStyles.ts");
  assert.match(screen, /KeyboardAvoidingView/);
  assert.match(screen, /keyboardShouldPersistTaps="handled"/);
  assert.match(screen, /onShow=\{\(\) =>/);
  assert.match(styles, /pinBox:[\s\S]*flex: 1,[\s\S]*maxWidth: 48,[\s\S]*minWidth: 0/);
});

test("Media Detail structural surfaces consume the active theme", () => {
  const source = read("src/features/media-detail/MediaDetailScreen.tsx");
  assert.match(source, /useOrionTheme/);
  assert.match(source, /backgroundColor: theme\.background/);
  assert.match(source, /backgroundColor: theme\.elevated, borderColor: theme\.border/);
  assert.match(source, /backgroundColor: selectedSeason === s \? theme\.accent : theme\.surface/);
  assert.doesNotMatch(source, /backgrounds\.base|accent\.primary|text\.muted/);
});

test("Person profile and filmography use one live semantic theme", () => {
  const source = read("app/person/[id].tsx");
  const card = read("src/components/PersonCard.tsx");
  const detail = read("src/features/media-detail/MediaDetailScreen.tsx");
  assert.match(source, /useOrionTheme/);
  assert.match(source, /useResponsiveLayout/);
  assert.match(source, /headerContainerLandscape/);
  assert.match(source, /contentContainerLandscape/);
  assert.match(source, /backgroundColor: theme\.background/);
  assert.match(source, /backgroundColor: theme\.elevated, borderColor: theme\.border/);
  assert.match(source, /color: theme\.text/);
  assert.match(source, /color: theme\.textSecondary/);
  assert.match(source, /color: theme\.accent/);
  assert.match(card, /colors=\{\['transparent', theme\.mediaScrim\]\}/);
  assert.match(card, /color: theme\.onAccent/);
  assert.match(detail, /styles\.castCard, \{ backgroundColor: theme\.surface, borderColor: theme\.border \}/);
  assert.doesNotMatch(source, /backgrounds\.base|accent\.primary|text\.secondary/);
});

test("Media Detail changes hero contrast at the image-to-surface boundary", () => {
  const source = read("src/features/media-detail/MediaDetailScreen.tsx");
  assert.match(source, /const heroText = theme\.dark \? '#ffffff' : theme\.text/);
  assert.match(source, /const heroSecondary = theme\.dark/);
  assert.match(source, /backgroundColor: heroSurface, borderColor: heroBorder/);
  assert.match(source, /color: isActive \? theme\.accent : theme\.textSecondary/);
  assert.doesNotMatch(source, /isActive && styles\.tabPillTextActive/);
});
