const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P9.3 installs Expo local notifications without introducing remote push registration', () => {
  const pkg = JSON.parse(read('package.json'));
  const config = JSON.parse(read('app.json')).expo;
  const service = read('src', 'services', 'mobileNotifications.ts');

  assert.equal(pkg.dependencies['expo-notifications'], '~57.0.16');
  assert.ok(config.plugins.includes('expo-notifications'));
  assert.match(service, /scheduleNotificationAsync/);
  assert.match(service, /requestPermissionsAsync/);
  assert.doesNotMatch(service, /getExpoPushTokenAsync|getDevicePushTokenAsync/);
});

test('P9.3 notification policy is local, categorized, quiet-hour aware and deduplicated', () => {
  const service = read('src', 'services', 'mobileNotifications.ts');

  for (const category of ['appUpdates', 'syncFailures', 'offlineRecovery', 'providerHealth', 'watchlist']) {
    assert.match(service, new RegExp(category));
  }
  assert.match(service, /orion\.mobile\.notifications\.preferences\.v1/);
  assert.match(service, /orion\.mobile\.notifications\.dedupe\.v1/);
  assert.match(service, /isMobileNotificationQuietHoursV1/);
  assert.match(service, /hasDeliveredMobileNotificationV1/);
  assert.match(service, /MAX_DEDUPE_RECORDS/);
});

test('P9.3 requests permission only from the user-controlled Notifications settings surface', () => {
  const settings = read('src', 'features', 'settings', 'NotificationSettingsContent.tsx');
  const coordinator = read('src', 'features', 'notifications', 'MobileNotificationCoordinator.tsx');
  const layout = read('app', '_layout.tsx');

  assert.match(settings, /requestMobileNotificationPermissionV1/);
  assert.match(settings, /Enable Orion notifications/);
  assert.doesNotMatch(coordinator, /requestMobileNotificationPermissionV1/);
  assert.doesNotMatch(layout, /requestMobileNotificationPermissionV1/);
});

test('P9.3 keeps Notifications active with category, quiet-hour and device-test controls', () => {
  const architecture = read('src', 'features', 'settings', 'settingsArchitecture.ts');
  const navigator = read('src', 'features', 'settings', 'SettingsSectionNavigator.tsx');
  const settingsScreen = read('app', '(tabs)', 'settings.tsx');
  const settingsContent = read('src', 'features', 'settings', 'NotificationSettingsContent.tsx');

  assert.match(architecture, /\| 'notifications'/);
  assert.match(architecture, /id: 'notifications', label: 'Notifications', status: 'active'/);
  assert.match(navigator, /notifications: 'notifications-outline'/);
  assert.match(settingsScreen, /<NotificationSettingsContent \/>/);
  assert.match(settingsScreen, /useLocalSearchParams/);
  assert.match(settingsContent, />Alerts</);
  assert.match(settingsContent, />Quiet hours</);
  assert.match(settingsContent, /Send Orion test notification/);
  assert.match(settingsContent, /sendMobileNotificationSelfTestV1/);
  assert.match(settingsContent, /QuietHoursTimePicker/);
  assert.match(settingsContent, /Quiet hours start time/);
  assert.match(settingsContent, /Move .* back five minutes/);
  assert.match(settingsContent, /formatNotificationClockForDisplay/);
  assert.match(settingsContent, /formatNotificationTimeForDisplay/);
  assert.match(settingsContent, /pickerTimeClockText/);
  assert.match(settingsContent, /pickerTimeMeridiemText/);
  assert.match(settingsContent, /numberOfLines=\{1\}/);
  assert.match(settingsContent, /setNotificationMeridiem/);
  assert.match(settingsContent, /\['AM', 'PM'\]/);
  assert.match(settingsContent, /accessibilityRole="radiogroup"/);
  assert.doesNotMatch(settingsContent, /TextInput|inputMode="numeric"/);
});

test('P9.3 coordinator covers update, sync, offline recovery, source-health and watchlist availability signals', () => {
  const coordinator = read('src', 'features', 'notifications', 'MobileNotificationCoordinator.tsx');
  const appUpdateState = read('src', 'services', 'mobileApplicationUpdateState.ts');
  const sourceHealth = read('src', 'services', 'sourceHealth.ts');
  const availability = read('src', 'services', 'mobileAvailabilityChecks.ts');

  assert.match(coordinator, /checkMobileApplicationUpdateStateV1/);
  assert.doesNotMatch(coordinator, /checkMobileReleaseTruthV1/);
  assert.match(appUpdateState, /checkMobileReleaseTruthV1/);
  assert.match(coordinator, /useMyListSteadyStateSync/);
  assert.match(coordinator, /useWatchedSteadyStateSync/);
  assert.match(coordinator, /useViewingActivitySteadyStateSync/);
  assert.match(coordinator, /offlineRecovery/);
  assert.match(coordinator, /subscribeMobileSourceHealthV2/);
  assert.match(sourceHealth, /emitMobileSourceHealthV2/);
  assert.match(availability, /watch\/providers/);
  assert.match(availability, /WATCHLIST_AVAILABILITY_BATCH_SIZE_V1 = 12/);
  assert.match(availability, /previous\.providerSignature !== current\.providerSignature/);
  assert.match(availability, /!previous\.released && current\.released/);
});

test('P9.3 notification taps use a whitelisted target contract rather than arbitrary URLs', () => {
  const service = read('src', 'services', 'mobileNotifications.ts');
  const router = read('src', 'features', 'notifications', 'MobileNotificationResponseRouter.tsx');

  assert.match(service, /resolveMobileNotificationTargetV1/);
  assert.match(service, /value\.target === 'media'/);
  assert.match(service, /value\.target === 'settings'/);
  assert.match(service, /sendMobileNotificationSelfTestV1/);
  assert.match(service, /Notifications are working/);
  assert.doesNotMatch(router, /Linking\.openURL/);
  assert.match(router, /pathname: '\/media\/\[id\]'/);
  assert.match(router, /pathname: '\/\(tabs\)\/settings'/);
});
