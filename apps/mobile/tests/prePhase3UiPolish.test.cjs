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
  assert.match(source, /phoneLayout = width < 600/);
  assert.match(source, /styles\.summary/);
  assert.match(source, /styles\.actionsPhone/);
  assert.match(source, /rowPhone: \{ flexDirection: 'column'/);
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
  const screen = read("src/features/connect/ConnectScreen.tsx");
  const styles = read("src/features/connect/connectStyles.ts");
  assert.match(screen, /KeyboardAvoidingView/);
  assert.match(screen, /keyboardShouldPersistTaps="handled"/);
  assert.match(screen, /onShow=\{\(\) =>/);
  assert.match(styles, /pinBox:[\s\S]*flex: 1,[\s\S]*maxWidth: 48,[\s\S]*minWidth: 36/);
});

test("Media Detail structural surfaces consume the active theme", () => {
  const source = read("src/features/media-detail/MediaDetailScreen.tsx");
  assert.match(source, /useOrionTheme/);
  assert.match(source, /backgroundColor: theme\.background/);
  assert.match(source, /backgroundColor: theme\.elevated, borderColor: theme\.border/);
  assert.match(source, /backgroundColor: selectedSeason === s \? theme\.accent : theme\.surface/);
  assert.doesNotMatch(source, /backgrounds\.base|accent\.primary|text\.muted/);
});
