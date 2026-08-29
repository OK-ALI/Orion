const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

test('P10.6-C4 removes the duplicate Performance summary while keeping manual selection and Automatic resolution visible', () => {
  const settings = read('app', '(tabs)', 'settings.tsx');

  assert.doesNotMatch(settings, /Active profile/);
  assert.doesNotMatch(settings, /styles\.performanceSummary/);
  assert.doesNotMatch(settings, /styles\.profileBadge/);

  assert.match(settings, />Profiles<\/Text>/);
  assert.match(settings, /Automatic \(Recommended\)/);
  assert.match(settings, /Currently: \{PERFORMANCE_PROFILE_LABELS\[resolvedProfile\]\}/);
  assert.match(settings, /accessibilityState=\{\{ checked: selected \}\}/);
  assert.match(settings, /onPress=\{\(\) => setSelection\(option\.id as PerformanceProfileSelection\)\}/);
});

test('P10.6-C4 stops presenting Orion Library as a selected destination when it is the only download destination', () => {
  const settings = read('src', 'features', 'downloads', 'DownloadSettingsContent.tsx');

  assert.match(settings, /<View style=\{styles\.storageIntro\}>/);
  assert.match(settings, />Orion Library<\/Text>/);
  assert.match(settings, /completed downloads stay visible in the folder you choose/);
  assert.match(settings, /Storage folder: \$\{libraryStorageTarget\.displayName\}/);
  assert.match(settings, /Change storage folder/);
  assert.match(settings, /Choose storage folder/);

  assert.doesNotMatch(settings, /accessibilityLabel="Destination Orion Library"/);
  assert.doesNotMatch(settings, /styles\.destinationCard/);
  assert.doesNotMatch(settings, /name="checkmark-circle" size=\{20\}/);
  assert.doesNotMatch(settings, /styles\.iconBox/);
});

test('P10.6-C4 keeps update status in one authoritative summary while preserving install progress, recovery and actions', () => {
  const updates = read('src', 'features', 'settings', 'UpdatesSettingsContent.tsx');
  const execution = read('src', 'features', 'settings', 'MobileUpdateExecutionSection.tsx');

  assert.match(updates, /v\{currentVersion\}/);
  assert.match(updates, /styles\.stateBadge/);
  assert.match(updates, /\{summaryState\.label\}/);
  assert.match(updates, /\{summaryState\.description\}/);
  assert.match(updates, /Last checked/);

  assert.doesNotMatch(execution, /styles\.statusChip/);
  assert.doesNotMatch(execution, /statusChipText/);
  assert.match(execution, /\{presentation\.description\}/);
  assert.match(execution, /Math\.round\(state\.progress \* 100\)/);
  assert.match(execution, /label="Allow installs"/);
  assert.match(execution, /label=\{state\.status === 'failed' \? 'Retry update' : 'Download & install'\}/);
  assert.match(execution, /appUpdateFeedback\(state, message\)/);
});

test('P10.6-C4 does not over-clean distinct permission, cloud, recovery or destructive states', () => {
  const notifications = read('src', 'features', 'settings', 'NotificationSettingsContent.tsx');
  const account = read('src', 'features', 'settings', 'AccountSettingsContent.tsx');
  const downloads = read('src', 'features', 'downloads', 'DownloadSettingsContent.tsx');
  const execution = read('src', 'features', 'settings', 'MobileUpdateExecutionSection.tsx');

  assert.match(notifications, /notificationStatusLabel\(permission, preferences\.enabled\)/);
  assert.match(notifications, /Notifications are blocked by Android/);
  assert.match(notifications, /Open system notification settings/);

  assert.match(account, /\{driveStatus\}/);
  assert.match(account, /Disconnect Orion Cloud/);
  assert.match(account, /Disconnect Google/);

  assert.match(downloads, /Orion Library folder access needs to be selected again/);
  assert.match(execution, /Android needs permission before Orion can install this update/);
  assert.match(execution, /This update is not ready to install safely yet/);
});
