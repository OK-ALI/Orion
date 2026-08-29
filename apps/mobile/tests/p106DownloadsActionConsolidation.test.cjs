const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

test('P10.6-B2 keeps one page-level management entrance while preserving the shared management sheet', () => {
  const screen = read('app', '(tabs)', 'downloads.tsx');
  const sheet = read('src', 'features', 'downloads', 'DownloadManagementSheet.tsx');

  assert.match(screen, /accessibilityLabel="Manage completed downloads"/);
  assert.match(screen, />Manage</);
  assert.doesNotMatch(screen, />Free Up Space</);
  assert.doesNotMatch(screen, /mode:\s*'free-space'/);
  assert.match(screen, /<DownloadManagementSheet[\s\S]*mode="manage"/);
  assert.match(screen, /initialAssetIds=\{management\?\.assetIds \|\| \[\]\}/);

  // B2 removes the duplicate entrance, not the underlying management capability.
  assert.match(sheet, /type ManagementMode = 'manage' \| 'free-space'/);
  assert.match(sheet, /mode === 'free-space' \? 'size' : 'title'/);
  assert.match(sheet, /Delete all downloads/);
});

test('P10.6-B2 replaces visible Manage copy/series pills with a compact contextual overflow without losing scope', () => {
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');

  assert.doesNotMatch(activity, /'Manage copy'|'Manage series'/);
  assert.match(activity, /accessibilityLabel=\{`Manage \$\{mediaPrimaryTitle\(entry\.media\)\}`\}/);
  assert.match(activity, /onManageAssets\(group\.entries\.flatMap\(\(candidate\) => candidate\.assetIds\)\)/);
  assert.match(activity, /styles\.actionOverflow/);
  assert.match(activity, /hitSlop=\{5\}/);

  // Playback choices remain unchanged for B3 to reorganize later.
  assert.match(activity, /label="Play in Orion"/);
  assert.match(activity, /label="Play Locally"/);
});

test('P10.6-B2 stays theme-driven and leaves attention-specific management intact', () => {
  const screen = read('app', '(tabs)', 'downloads.tsx');
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');

  assert.doesNotMatch(`${screen}\n${activity}`, /#[0-9a-fA-F]{6}/);
  assert.match(screen, /Needs attention · \{librarySummary\.needsAttentionCount\}/);
  assert.match(screen, /theme\.warning/);
  assert.match(activity, /backgroundColor: pressed \? theme\.surfaceHover : theme\.elevated/);
});
