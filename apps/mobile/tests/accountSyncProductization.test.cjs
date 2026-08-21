"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");

const account = read("src/features/settings/AccountSettingsContent.tsx");
const row = read("src/features/settings/AccountSyncDomainRow.tsx");
const manual = read("src/features/settings/useManualSyncPresentation.ts");
const myList = read("src/features/settings/MyListEnrollmentPreflight.tsx");
const watched = read("src/features/settings/WatchedSyncControl.tsx");
const viewing = read("src/features/settings/ViewingActivitySyncControl.tsx");
const myListSteady = read("src/features/account/MyListSteadyStateSync.tsx");
const watchedSteady = read("src/features/account/WatchedSteadyStateSync.tsx");
const viewingSteady = read("src/features/account/ViewingActivitySteadyStateSync.tsx");

const domains = [myList, watched, viewing];
const userFacingSyncSources = [...domains, myListSteady, watchedSteady, viewingSteady];

test("Mobile Account flows directly from Orion Cloud into the three compact sync domains", () => {
  assert.match(account, />Orion Cloud</);
  assert.match(account, /Keep your Orion library in sync across devices/);
  assert.match(account, /<MyListEnrollmentPreflight/);
  assert.match(account, /<WatchedSyncControl/);
  assert.match(account, /<ViewingActivitySyncControl/);

  const cloudIndex = account.indexOf('>Orion Cloud<');
  const myListIndex = account.indexOf('<MyListEnrollmentPreflight');
  assert.ok(cloudIndex >= 0 && myListIndex > cloudIndex, "sync domains should follow Orion Cloud directly");

  assert.doesNotMatch(account, />Sync</);
  assert.doesNotMatch(account, /Choose what stays updated automatically on this device/);
  assert.doesNotMatch(account, /Sync with Orion Cloud/);
  assert.doesNotMatch(account, /Choose what this device keeps in sync/);
  assert.doesNotMatch(account, /Google connects your Orion identity\. Orion Cloud is a separate connection/);
  assert.doesNotMatch(account, /styles\.statusRow|styles\.statusChip/);
});

test("signed-in Google identity stays compact without losing responsive metadata", () => {
  assert.match(account, /<Text style=\{\[styles\.profileMeta[^>]*>Google connected<\/Text>/);
  assert.match(account, /profileRow: \{ flexDirection: 'row', alignItems: 'center', gap: spacing\[2\] \}/);
  assert.match(account, /avatar: \{ width: 48, height: 48, borderRadius: 24 \}/);
  assert.match(account, /profileName: \{ fontSize: fontSizes\.sm/);
  assert.match(account, /profileEmail: \{ marginTop: 2, fontSize: 11, lineHeight: 15/);
  assert.match(account, /profileMeta: \{ marginTop: 1, fontSize: 10, lineHeight: 14/);
});

test("three sync domains share one responsive theme-owned row and identical status badge system", () => {
  for (const source of domains) {
    assert.match(source, /AccountSyncDomainRow/);
  }

  assert.match(row, /useResponsiveLayout/);
  assert.match(row, /layout === 'compact-phone' \|\| fontScale > 1\.15/);
  assert.match(row, /useOrionTheme/);
  assert.match(row, /theme\.accentSoft/);
  assert.match(row, /theme\.surfaceHover/);
  assert.match(row, /theme\.warning/);
  assert.match(row, /status === 'Synced' \|\| status === 'Syncing'/);
  assert.match(row, /status === 'Needs review'/);
  assert.match(row, /minHeight: 44/);
  assert.match(row, /accessibilityState=\{\{ disabled: autoSync\.disabled, checked: autoSync\.value \}\}/);
});

test("Mobile sync rows keep only useful count nouns and contextual actions", () => {
  assert.match(myList, /summary=\{`\$\{localCount\} title/);
  assert.match(watched, /summary=\{itemLabel\(localCount\)\}/);
  assert.match(viewing, /history .*entries?.*, .*playback .*positions?/);
  assert.doesNotMatch(viewing, /â€¢|•/);

  for (const source of domains) {
    assert.doesNotMatch(source, /['"]Check now['"]/);
    assert.doesNotMatch(source, /['"]Manual['"]/);
    assert.match(source, /'Sync now'/);
  }

  assert.doesNotMatch(myList, /Sync saved titles across Orion devices\. First sync asks/);
  assert.doesNotMatch(watched, /Sync watched movies and individual episodes across Orion devices\. First sync asks/);
  assert.doesNotMatch(viewing, /Continue Watching is built from those positions/);
});

test("manual Sync now retains immediate visible busy presentation while Auto sync is paused", () => {
  for (const source of domains) {
    assert.match(source, /useManualSyncPresentation/);
    assert.match(source, /manualSync\.runManualSync/);
    assert.match(source, /manualSync\.manualBusy/);
  }

  assert.match(manual, /setManualBusy\(true\)/);
  assert.match(manual, /600/);
});

test("all three Auto sync controls retain accessibility and live Orion theme ownership", () => {
  assert.match(myList, /accessibilityLabel: 'Auto sync My List'/);
  assert.match(watched, /accessibilityLabel: 'Auto sync Watched'/);
  assert.match(viewing, /accessibilityLabel: 'Auto sync Viewing Activity'/);

  assert.match(row, /trackColor=\{\{ false: theme\.surfaceHover, true: theme\.accentSoft \}\}/);
  assert.match(row, /thumbColor=\{autoSync\.value \? theme\.accent : theme\.textMuted\}/);
  assert.match(row, /minHeight: 58/);
  assert.match(row, /controlsStacked/);
});

test("Mobile Account accessibility and exceptional copy stays product-facing", () => {
  const syncCopy = userFacingSyncSources.join("\n");
  assert.doesNotMatch(syncCopy, /Runs one safe .* reconciliation/i);
  assert.doesNotMatch(syncCopy, /cannot safely reconcile/i);
  assert.doesNotMatch(syncCopy, /cannot reconcile safely/i);
  assert.doesNotMatch(syncCopy, /no checkpoint was created/i);
  assert.doesNotMatch(syncCopy, /last verified checkpoint/i);
  assert.doesNotMatch(syncCopy, /saved My List checkpoint/i);
  assert.doesNotMatch(syncCopy, /portable Watched state/i);
  assert.doesNotMatch(syncCopy, /local History or Progress/i);
  assert.doesNotMatch(syncCopy, /Reconciling verified History and Progress/i);
});

test("Mobile sync-domain badges use the normalized transient Syncing status", () => {
  for (const source of domains) {
    assert.doesNotMatch(source, /\? 'Checking'/);
  }
  assert.match(myList, /\? 'Syncing'/);
  assert.match(watched, /steady\.phase === 'checking' \? 'Syncing'/);
  assert.match(viewing, /steady\.phase === 'checking' \? 'Syncing'/);
});
