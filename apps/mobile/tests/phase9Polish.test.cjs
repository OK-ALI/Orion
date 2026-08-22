const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('Phase 9 Notifications is grouped around access, alerts, quiet hours and device test', () => {
  const settings = read('src', 'features', 'settings', 'NotificationSettingsContent.tsx');
  const service = read('src', 'services', 'mobileNotifications.ts');

  assert.match(settings, />Notification access</);
  assert.match(settings, />Alerts</);
  assert.match(settings, />Quiet hours</);
  assert.match(settings, />Test notifications</);
  assert.match(service, /label: 'Orion updates'/);
  assert.match(service, /label: 'My List releases'/);
  assert.match(service, /Saved movies, shows and anime release or become available to watch/);
  assert.doesNotMatch(settings, /remote push token|bounded and rotate|treated as a baseline/i);
});

test('Phase 9 Updates uses consumer-facing hierarchy instead of engineering diagnostics', () => {
  const settings = read('src', 'features', 'settings', 'UpdatesSettingsContent.tsx');
  const appUpdate = read('src', 'features', 'settings', 'MobileUpdateExecutionSection.tsx');
  const quickUpdate = read('src', 'features', 'settings', 'RuntimeUpdateExecutionSection.tsx');

  assert.match(settings, />Update channel</);
  assert.match(settings, />Update options</);
  assert.match(settings, /Up to date/);
  assert.match(appUpdate, />App updates</);
  assert.match(quickUpdate, />Quick updates</);
  assert.match(settings, /What's new/);
  assert.match(settings, /showRetryAction=\{!error\}/);
  assert.match(appUpdate, /result\?\.state === 'current'\) return 'No update'/);
  assert.doesNotMatch(settings, /Minimum Android|Installer|Signed APK updates remain|Google Play distribution/i);
  assert.doesNotMatch(quickUpdate, /\{status\.message\}/);
  assert.match(quickUpdate, /showRetryAction = true/);
  assert.match(quickUpdate, /const statusMessage = runtimeStatusMessage\(status\)/);
});

test('Phase 9 update errors are translated before they reach the Settings UI', () => {
  const settings = read('src', 'features', 'settings', 'UpdatesSettingsContent.tsx');
  const appUpdate = read('src', 'features', 'settings', 'MobileUpdateExecutionSection.tsx');
  const quickUpdate = read('src', 'features', 'settings', 'RuntimeUpdateExecutionSection.tsx');

  assert.match(settings, /friendlyAppCheckError/);
  assert.match(settings, /could not check for app updates/i);
  assert.match(appUpdate, /could not finish the app update/i);
  assert.match(quickUpdate, /runtimeStatusMessage/);
  assert.match(quickUpdate, /could not check for quick updates/i);
  assert.doesNotMatch(quickUpdate, /<Text[^>]*>\s*\{status\.message\}/);
});

test('Phase 9 notification payloads use concise Orion product language', () => {
  const service = read('src', 'services', 'mobileNotifications.ts');
  const coordinator = read('src', 'features', 'notifications', 'MobileNotificationCoordinator.tsx');
  const availability = read('src', 'services', 'mobileAvailabilityChecks.ts');

  assert.match(service, /title: 'Notifications are working'/);
  assert.match(coordinator, /title: 'Orion update available'/);
  assert.match(coordinator, /title: 'Sync needs attention'/);
  assert.match(coordinator, /title: 'Playback source unavailable'/);
  assert.match(availability, /is now available/);
  assert.match(availability, /availability changed/);
  assert.doesNotMatch(coordinator, /verified .* APK is ready|cooldown is active/i);
});
