const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

test('P10.6-C3 replaces engineering language in the primary Settings shell with customer-facing copy', () => {
  const settings = read('app', '(tabs)', 'settings.tsx');

  assert.match(settings, /description="Your Orion profile and sign-in\."/);
  assert.match(settings, />Enter the color code you want Orion to use\.<\/Text>/);
  assert.match(settings, /description="Choose how Orion balances browsing speed and device resources\."/);
  assert.match(settings, /Profiles adjust how much browsing work Orion keeps ready\. Your catalog, artwork and playback stay the same\./);
  assert.match(settings, /description="Choose your alerts and quiet hours\."/);
  assert.match(settings, /description="Choose when you receive updates and see what is available\."/);
  assert.match(settings, /More settings will appear here as Orion adds them\./);

  assert.doesNotMatch(settings, /six-digit hexadecimal accent color/);
  assert.doesNotMatch(settings, /browsing render budgets/);
  assert.doesNotMatch(settings, /Android compatibility/);
  assert.doesNotMatch(settings, /Mobile features are ready/);
});

test('P10.6-C3 makes Offline Download copy media-first while retaining necessary service names and API-key controls', () => {
  const settings = read('src', 'features', 'downloads', 'DownloadSettingsContent.tsx');

  assert.match(settings, /Automatically find the best English subtitles when a subtitle service is set up\./);
  assert.match(settings, /Orion keeps your offline library organized while completed downloads stay visible in the folder you choose\./);
  assert.match(settings, /Choose where Orion should keep your offline downloads\./);
  assert.match(settings, />Subtitle services<\/Text>/);
  assert.match(settings, /Add your own SubDL and\/or Wyzie key\. Orion uses any saved service automatically\./);
  assert.match(settings, /Subtitle service keys saved securely\./);
  assert.match(settings, /Automatic subtitle search will stay off\./);
  assert.match(settings, /\{savingKeys \? 'Saving…' : 'Save keys'\}/);

  assert.doesNotMatch(settings, /completed MP4 files/);
  assert.doesNotMatch(settings, /writable Android folder/);
  assert.doesNotMatch(settings, /Opening Android folder picker/);
  assert.doesNotMatch(settings, /Configured providers are searched automatically/);
  assert.doesNotMatch(settings, /Subtitle provider keys saved securely/);

  // These technical labels are intentionally retained because the user must know
  // which credential belongs in each field.
  assert.match(settings, /accessibilityLabel="SubDL API key"/);
  assert.match(settings, /accessibilityLabel="Wyzie API key"/);
});

test('P10.6-C3 removes build terminology from customer-visible update guidance without changing update behavior', () => {
  const updates = read('src', 'features', 'settings', 'UpdatesSettingsContent.tsx');
  const execution = read('src', 'features', 'settings', 'MobileUpdateExecutionSection.tsx');

  assert.match(updates, /Try newer Orion versions before they reach Stable\./);
  assert.doesNotMatch(updates, /newer test builds/);

  assert.match(execution, /This version of Orion can't install updates directly\./);
  assert.doesNotMatch(execution, /App updates are not available in this build/);

  assert.match(execution, /installDirectApkV1/);
  assert.match(execution, /expectedSha256: integrity\.sha256/);
  assert.match(execution, /expectedSignerSha256: integrity\.signerSha256/);
  assert.match(execution, />App updates<\/Text>/);
  assert.match(execution, /Orion verifies every app update before installation\./);
});

test('P10.6-C3 changes language only and preserves the C1/C2 Settings structure and active controls', () => {
  const settings = read('app', '(tabs)', 'settings.tsx');

  assert.match(settings, /style=\{\[styles\.section, \{ borderBottomColor: theme\.border \}\]\}/);
  assert.match(settings, />System appearance<\/Text>/);
  assert.match(settings, />Profiles<\/Text>/);
  assert.match(settings, /sectionId="account"/);
  assert.match(settings, /sectionId="appearance"/);
  assert.match(settings, /sectionId="performance"/);
  assert.match(settings, /sectionId="accessibility"/);
  assert.match(settings, /sectionId="notifications"/);
  assert.match(settings, /sectionId="updates"/);
  assert.match(settings, /sectionId="downloads"/);
  assert.match(settings, /onPress=\{\(\) => setTheme\(id\)\}/);
  assert.match(settings, /onValueChange=\{setFollowSystem\}/);
  assert.match(settings, /onPress=\{\(\) => setSelection\(option\.id as PerformanceProfileSelection\)\}/);
});
