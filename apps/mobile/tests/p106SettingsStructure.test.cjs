const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

test('P10.6-C1 removes structural Settings cards while preserving the established page shell', () => {
  const settings = read('app', '(tabs)', 'settings.tsx');

  assert.match(settings, /<MobilePageHeader[\s\S]*eyebrow="ORION MOBILE"[\s\S]*title="Settings"[\s\S]*subtitle="Customize Orion Mobile on this device\."/);
  assert.match(settings, /<SettingsSectionNavigator[\s\S]*sections=\{MOBILE_ACTIVE_SETTINGS_SECTIONS\}/);

  assert.match(settings, /style=\{\[styles\.section, \{ borderBottomColor: theme\.border \}\]\}/);
  assert.doesNotMatch(settings, /styles\.section, \{ backgroundColor: theme\.surface, borderColor: theme\.border \}/);
  assert.match(settings, /section:\s*\{\s*paddingBottom: spacing\[6\], marginBottom: spacing\[5\], borderBottomWidth: StyleSheet\.hairlineWidth\s*\}/);
  assert.doesNotMatch(settings, /section:\s*\{[^}]*borderRadius:/);
  assert.doesNotMatch(settings, /section:\s*\{[^}]*borderWidth:\s*1/);

  assert.match(settings, /styles\.sectionIcon, \{ backgroundColor: theme\.accentSoft \}/);
  assert.match(settings, /sectionIcon:\s*\{\s*width: 40, height: 40, borderRadius: radii\.full/);
});

test('P10.6-C1 turns the reserved-settings footer into a divider-led note instead of another card', () => {
  const settings = read('app', '(tabs)', 'settings.tsx');

  assert.match(settings, /styles\.notice, \{ borderTopColor: theme\.border \}/);
  assert.match(settings, /notice:\s*\{\s*borderTopWidth: StyleSheet\.hairlineWidth, paddingTop: spacing\[4\]/);
  assert.doesNotMatch(settings, /styles\.notice, \{ backgroundColor: theme\.elevated, borderColor: theme\.border \}/);
  assert.match(settings, /More settings will appear here as Orion adds them\./);
});

test('P10.6-C1 preserves meaningful interactive controls instead of flattening Settings into plain text', () => {
  const settings = read('app', '(tabs)', 'settings.tsx');
  const navigator = read('src', 'features', 'settings', 'SettingsSectionNavigator.tsx');

  // Real selection/input controls remain visually and semantically distinct.
  assert.match(settings, /themeButton:\s*\{[^}]*borderWidth: 2/);
  assert.match(settings, /profileOption:\s*\{[^}]*borderWidth: 1/);
  assert.match(settings, /colorInput:\s*\{[^}]*borderWidth: 1/);
  assert.match(settings, /accessibilityRole="radio"/);
  assert.match(settings, /accessibilityRole="switch"/);

  // The existing section drawer/navigation model remains intact.
  assert.match(navigator, /Jump to section/);
  assert.match(navigator, /accessibilityRole="radio"/);
  assert.match(navigator, /onSelect\(section\.id\)/);
});

test('P10.6-C1 keeps all active Settings owners mounted and defers hierarchy/copy cleanup to later slices', () => {
  const settings = read('app', '(tabs)', 'settings.tsx');
  const architecture = read('src', 'features', 'settings', 'settingsArchitecture.ts');

  for (const id of ['account', 'appearance', 'performance', 'accessibility', 'notifications', 'updates', 'downloads']) {
    assert.match(settings, new RegExp(`sectionId="${id}"`));
  }

  assert.match(settings, /<AccountSettingsContent \/>/);
  assert.match(settings, /<NotificationSettingsContent \/>/);
  assert.match(settings, /<UpdatesSettingsContent \/>/);
  assert.match(settings, /<DownloadSettingsContent \/>/);

  assert.match(architecture, /id: 'account', label: 'Account', status: 'active'/);
  assert.match(architecture, /id: 'appearance', label: 'Appearance', status: 'active'/);
  assert.match(architecture, /id: 'performance', label: 'Performance', status: 'active'/);
  assert.match(architecture, /id: 'accessibility', label: 'Accessibility', status: 'active'/);
  assert.match(architecture, /id: 'notifications', label: 'Notifications', status: 'active'/);
  assert.match(architecture, /id: 'updates', label: 'Updates', status: 'active'/);
  assert.match(architecture, /id: 'downloads', label: 'Downloads', status: 'active'/);
});
