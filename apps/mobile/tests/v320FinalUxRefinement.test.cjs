"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");

test("v3.2 final Home reorder moves sections live while preserving the existing preference owner", () => {
  const content = read("src/features/settings/HomeLayoutSettingsContent.tsx");
  const preferences = read("src/features/home/homeLayoutPreferences.ts");

  assert.match(content, /onPanResponderMove:[\s\S]*Math\.round\(gesture\.dy \/ step\)/);
  assert.match(content, /onMove\(id, targetIndex\)/);
  assert.match(content, /currentIndex\.current = targetIndex/);
  assert.match(content, /transform: \[\{ translateY: dragY \}\]/);
  assert.match(content, /Position \{index \+ 1\}/);
  assert.match(content, /accessibilityActions/);
  assert.match(preferences, /moveHomeRail/);
  assert.match(preferences, /orion\.mobile\.home\.layout\.v1/);
});

test("v3.2 final Settings reorder has one persisted order for the page and Jump to section", () => {
  const settings = read("app/(tabs)/settings.tsx");
  const navigator = read("src/features/settings/SettingsSectionNavigator.tsx");
  const preferences = read("src/features/settings/settingsSectionOrderPreferences.ts");

  assert.match(preferences, /orion\.mobile\.settings\.section-order\.v1/);
  assert.match(preferences, /MOBILE_ACTIVE_SETTINGS_SECTIONS\.map/);
  assert.match(preferences, /useSyncExternalStore/);
  assert.match(preferences, /moveSettingsSection/);
  assert.match(settings, /useSettingsSectionOrderPreferences\(\)/);
  assert.match(settings, /settingsSectionOrder\.order[\s\S]*MOBILE_SETTINGS_SECTION_BY_ID/);
  assert.match(settings, /<SettingsSectionNavigator[\s\S]*sections=\{orderedSections\}/);
  assert.match(settings, /\{orderedSections\.map\(\(section\) => \([\s\S]*renderSettingsSection\(section\.id\)/);
  assert.match(settings, /for \(const section of orderedSections\)/);
  assert.match(navigator, /moveSettingsSection\(section\.id, targetIndex\)/);
  assert.match(navigator, /PanResponder\.create/);
  assert.match(navigator, /Tap to jump, or drag to arrange Settings\./);
  assert.match(navigator, /accessibilityRole="adjustable"/);
  assert.doesNotMatch(navigator, /<Switch/);
});

test("v3.2 final Settings reorder keeps Orion theme, responsiveness and active-only ownership", () => {
  const navigator = read("src/features/settings/SettingsSectionNavigator.tsx");
  const preferences = read("src/features/settings/settingsSectionOrderPreferences.ts");

  assert.match(navigator, /maxHeight: '82%'/);
  assert.match(navigator, /<ScrollView[\s\S]*nestedScrollEnabled/);
  assert.match(navigator, /minHeight: 48/);
  assert.match(navigator, /preferences\.reducedMotion \? 0 : 120/);
  assert.match(navigator, /theme\.accentSoft/);
  assert.match(navigator, /theme\.accent/);
  assert.match(navigator, /theme\.surface/);
  assert.doesNotMatch(navigator, /#E50914|#ff1f2d|#d96852|#6f8fb8|#a1121d/i);
  assert.match(preferences, /ACTIVE_IDS/);
  assert.doesNotMatch(preferences, /status === 'reserved'/);
});

test("v3.2 final embedded Original restores a visible provider surface without changing healthy Fit or Fill", () => {
  const surface = read("src/features/playback/EmbedPlayerSurface.tsx") + '\n' + read("src/features/playback/providerEmbedSupport.ts");

  assert.match(surface, /presentation === 'provider'\s*\? \{ width: '100%' as const, height: '100%' as const, flex: 0, alignSelf: 'stretch' as const \}/);
  assert.match(surface, /containerStyle=\{presentation === 'provider' \? presentationStyle : undefined\}/);
  assert.doesNotMatch(surface, /presentation === 'provider'\s*\? \{[^}]*flex: 1/);
  assert.match(surface, /presentation === 'fit'\s*\? \(screenWiderThanVideo \? \{ height: '100%' as const, aspectRatio: 16 \/ 9, alignSelf: 'center' as const, flex: 0 \}/);
  assert.match(surface, /presentation === 'fill'\s*\? \(screenWiderThanVideo \? \{ width: '100%' as const, aspectRatio: 16 \/ 9, alignSelf: 'center' as const, flex: 0 \}/);
  assert.match(surface, /style=\{\[styles\.webVideo, presentationStyle\]\}/);
});
