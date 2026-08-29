const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

test('P10.6-B1 keeps the established Downloads hero while replacing structural card stacks with hierarchy', () => {
  const screen = read('app', '(tabs)', 'downloads.tsx');

  assert.match(
    screen,
    /<MobilePageHeader[\s\S]*eyebrow="OFFLINE"[\s\S]*title="Downloads"[\s\S]*subtitle="Keep verified movies and episodes ready\."/
  );

  assert.match(screen, /styles\.summaryStrip/);
  assert.match(screen, /styles\.summaryMetric/);
  assert.match(screen, /styles\.summaryDivider/);
  assert.match(screen, /styles\.destinationRow/);
  assert.match(screen, /styles\.emptyState/);

  assert.doesNotMatch(screen, /styles\.summaryCard|summaryCard:/);
  assert.doesNotMatch(screen, /styles\.destinationCard|destinationCard:/);
  assert.doesNotMatch(screen, /styles\.emptyCard|emptyCard:/);

  assert.match(
    screen,
    /destinationRow:\s*\{[\s\S]*borderTopWidth:\s*StyleSheet\.hairlineWidth[\s\S]*borderBottomWidth:\s*StyleSheet\.hairlineWidth/
  );
});

test('P10.6-B1 makes download rows content-first without flattening real controls', () => {
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');

  assert.match(activity, /styles\.downloadItem/);
  assert.match(
    activity,
    /downloadItem:\s*\{[\s\S]*borderBottomWidth:\s*StyleSheet\.hairlineWidth/
  );
  assert.match(activity, /styles\.attentionItem/);
  assert.match(activity, /borderLeftColor:\s*theme\.warning/);
  assert.doesNotMatch(activity, /styles\.card|^\s*card:\s*\{/m);
  assert.match(
    activity,
    /styles\.searchBox,\s*\{\s*backgroundColor:\s*theme\.input,\s*borderColor:\s*theme\.border\s*\}/
  );

  for (const control of [
    'Search downloads',
    'All media',
    'Newest',
    'Pause',
    'Resume',
    'Retry',
    'Cancel',
  ]) {
    assert.match(activity, new RegExp(control));
  }
});

test('P10.6-B1 is theme-driven and intentionally defers action consolidation and Offline Library copy to later slices', () => {
  const screen = read('app', '(tabs)', 'downloads.tsx');
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');
  const themeContext = read('src', 'context', 'ThemeContext.tsx');

  assert.match(screen, /useOrionTheme/);
  assert.match(activity, /useOrionTheme/);
  assert.doesNotMatch(`${screen}\n${activity}`, /#[0-9a-fA-F]{6}/);

  for (const themeId of [
    'midnight-premiere',
    'amoled',
    'mocha',
    'slate',
    'projector-silver',
    'custom',
  ]) {
    assert.match(themeContext, new RegExp(themeId));
  }

  // Later slices may consolidate duplicate entrances, but B1's underlying
  // playback and management capabilities must remain wired.
  assert.match(screen, /<DownloadManagementSheet/);
  assert.match(activity, /onManageAssets/);
  assert.match(activity, /label="Play in Orion"/);
  assert.match(activity, /label="Play Locally"/);

  // Later slices may refine completed-media copy; B1 only requires the
  // completed content hierarchy and metadata surface to remain.
  assert.match(activity, /visibleGroups\.map/);
  assert.match(activity, /styles\.meta/);
  assert.match(activity, /styles\.metrics/);
});
