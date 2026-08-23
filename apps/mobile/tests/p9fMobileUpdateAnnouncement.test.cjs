const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const mobileRoot = path.resolve(__dirname, '..');

function readMobile(relativePath) {
  return fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

test('P9-F4/F5 Mobile routes canonical verified update state to both in-app announcement and notification paths', () => {
  const coordinator = readMobile('src/features/notifications/MobileNotificationCoordinator.tsx');
  const announcement = readMobile('src/services/mobileUpdateAnnouncement.ts');

  assert.match(coordinator, /checkMobileApplicationUpdateStateV1\(getMobileUpdateChannelV1\(\)\)/);
  assert.match(coordinator, /updateSessionCheckCompletedRef/);
  assert.doesNotMatch(
    coordinator,
    /if \(!preferences\.enabled \|\| !preferences\.categories\.appUpdates\) return;/,
  );
  assert.match(coordinator, /deliverMobileNotificationV1\(\{/);
  assert.match(coordinator, /target: \{ target: 'settings', section: 'updates' \}/);

  assert.match(announcement, /subscribeMobileApplicationUpdateStateV1\(syncFromApplicationUpdateState\)/);
  assert.match(announcement, /state\.status === 'available'/);
  assert.match(announcement, /state\.status === 'permission-required'/);
  assert.match(announcement, /`\$\{announcement\.channel\}:\$\{announcement\.version\}`/);
  assert.match(announcement, /dismissMobileUpdateAnnouncementV1/);
  assert.match(announcement, /readDismissedIds\(\)\.includes\(dismissalId\(announcement\)\)/);
  assert.match(announcement, /JSON\.parse\(value\)/);
  assert.match(announcement, /JSON\.stringify\(bounded\)/);
  assert.match(announcement, /MAX_DISMISSED_ANNOUNCEMENTS = 24/);
  assert.match(announcement, /writeDismissedIds\(\[\.\.\.readDismissedIds\(\), dismissalId\(announcement\)\]\)/);
});

test('P9-F4 Mobile mounts an interactive dismissible announcement that opens the real Updates section', () => {
  const layout = readMobile('app/_layout.tsx');
  const banner = readMobile('src/features/updates/MobileUpdateAnnouncementBanner.tsx');

  assert.match(layout, /<MobileUpdateAnnouncementBanner \/>/);
  assert.match(banner, /subscribeMobileUpdateAnnouncementV1/);
  assert.match(banner, /pathname: '\/\(tabs\)\/settings'/);
  assert.match(banner, /params: \{ section: 'updates' \}/);
  assert.match(banner, /dismissMobileUpdateAnnouncementV1\(announcement\)/);
  assert.match(banner, /announcement\.channel === 'preview'/);
  assert.match(banner, /accessibilityRole="alert"/);
  assert.match(banner, /accessibilityLabel="Dismiss update announcement"/);
});
