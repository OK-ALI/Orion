const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

test('P10.6-C2 keeps the established Settings shell and section order while refining hierarchy inside sections', () => {
  const settings = read('app', '(tabs)', 'settings.tsx');

  assert.match(settings, /<MobilePageHeader[\s\S]*eyebrow="ORION MOBILE"[\s\S]*title="Settings"/);
  assert.match(settings, /<SettingsSectionNavigator[\s\S]*sections=\{MOBILE_ACTIVE_SETTINGS_SECTIONS\}/);

  const order = ['account', 'appearance', 'performance', 'accessibility', 'notifications', 'updates', 'downloads'];
  let cursor = -1;
  for (const id of order) {
    const next = settings.indexOf(`sectionId="${id}"`);
    assert.ok(next > cursor, `${id} should remain in the established Settings order`);
    cursor = next;
  }
});

test('P10.6-C2 gives Appearance explicit Theme and System appearance subgroups without changing theme behavior', () => {
  const settings = read('app', '(tabs)', 'settings.tsx');

  assert.match(settings, />Theme<\/Text>/);
  assert.match(settings, /accessibilityRole="header" style=\{\[styles\.subgroupTitle, \{ color: theme\.text \}\]\}>System appearance<\/Text>/);
  assert.match(settings, /<View style=\{styles\.settingRow\}>[\s\S]*>Follow system appearance<\/Text>/);
  assert.match(settings, /value=\{preferences\.followSystem\}/);
  assert.match(settings, /onValueChange=\{setFollowSystem\}/);

  assert.match(settings, /\(Object\.keys\(ORION_MOBILE_THEMES\) as OrionThemeId\[\]\)\.map/);
  assert.match(settings, /onPress=\{\(\) => setTheme\(id\)\}/);
  assert.match(settings, /preferences\.theme === "custom"/);
  assert.match(settings, /onEndEditing=\{\(event\) => setCustomAccent/);
});

test('P10.6-C2 keeps the interactive Profiles hierarchy explicit after redundant passive status is retired', () => {
  const settings = read('app', '(tabs)', 'settings.tsx');

  assert.match(settings, /accessibilityRole="header" style=\{\[styles\.groupTitle, \{ color: theme\.text \}\]\}>Profiles<\/Text>/);
  assert.match(settings, /PERFORMANCE_PROFILE_OPTIONS\.map/);
  assert.match(settings, /accessibilityRole="radio"/);
  assert.match(settings, /onPress=\{\(\) => setSelection\(option\.id as PerformanceProfileSelection\)\}/);
  assert.match(settings, /Currently: \{PERFORMANCE_PROFILE_LABELS\[resolvedProfile\]\}/);

  assert.doesNotMatch(settings, /Active profile/);
  assert.doesNotMatch(settings, /styles\.performanceSummary/);
  assert.doesNotMatch(settings, /styles\.profileBadge/);
});

test('P10.6-C2 leaves child Settings owners mounted so their existing internal hierarchy remains authoritative', () => {
  const settings = read('app', '(tabs)', 'settings.tsx');
  const notifications = read('src', 'features', 'settings', 'NotificationSettingsContent.tsx');
  const updates = read('src', 'features', 'settings', 'UpdatesSettingsContent.tsx');
  const downloads = read('src', 'features', 'downloads', 'DownloadSettingsContent.tsx');

  assert.match(settings, /<AccountSettingsContent \/>/);
  assert.match(settings, /<NotificationSettingsContent \/>/);
  assert.match(settings, /<UpdatesSettingsContent \/>/);
  assert.match(settings, /<DownloadSettingsContent \/>/);

  assert.match(notifications, />Alerts<\/Text>/);
  assert.match(notifications, />Quiet hours<\/Text>/);
  assert.match(updates, />Update channel<\/Text>/);
  assert.match(updates, />Update options<\/Text>/);
  assert.match(downloads, />Offline storage<\/Text>/);
  assert.match(downloads, />Preferred quality<\/Text>/);
  assert.match(downloads, />Subtitles<\/Text>/);
});
