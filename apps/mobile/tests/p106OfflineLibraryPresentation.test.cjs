const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

test('P10.6-B3 presents completed media as an Offline Library instead of verified storage records', () => {
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');

  assert.match(activity, />Ready offline\{!episodic && sourceLabel/);
  assert.match(activity, /\[episodeSize, 'Ready offline', sourceLabel\(assetById\.get\(episode\.primaryAssetId\)\?\.sourceId\)\]/);
  assert.doesNotMatch(activity, />Verified ·/);
  assert.doesNotMatch(activity, /\[episodeSize, 'Verified'/);
  assert.match(activity, /\{episodic \? `\$\{size\} total` : size\}/);

  // Storage identity remains available for attention/recovery work; it simply
  // stops dominating the normal completed-library presentation.
  assert.match(activity, /function assetLocationLabel/);
  assert.match(activity, /\{missing \? 'Missing' : 'Unavailable'\} · \{assetLocationLabel\(asset\)\}/);
});

test('episode rows keep local and management actions with compact touch targets and an accent primary play control', () => {
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');
  assert.match(activity, /moreButton: \{ width: 36, height: 36, borderWidth: 1, borderRadius: 18/);
  assert.match(activity, /accessibilityLabel=\{`Play \$\{episode\.[\s\S]*?in Orion`\} hitSlop=\{4\}/);
  assert.match(activity, /backgroundColor: theme\.accent, opacity: pressed \? 0\.82 : 1/);
  assert.match(activity, /name="play" size=\{16\} color=\{theme\.onAccent\}/);
  assert.match(activity, /onPlayLocally\(episodePlayableAssetId\)/);
  assert.match(activity, /onManageAssets\(episode\.assetIds\)/);
});

test('P10.6-B3 gives series an explicit Series to Season to Episode browsing hierarchy', () => {
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');

  assert.match(activity, /interface CompletedSeasonGroup/);
  assert.match(activity, /function buildCompletedSeasonGroups/);
  assert.match(activity, /function seasonDisplayTitle/);
  assert.match(activity, /return 'Specials'/);
  assert.match(activity, /return `Season \$\{season\}`/);
  assert.match(activity, /const seasonGroups = episodic \? buildCompletedSeasonGroups\(group\.entries, assetById\) : \[\]/);
  assert.match(activity, /\$\{seasonCount\} season\$\{seasonCount === 1 \? '' : 's'\} · \$\{group\.entries\.length\} episode/);
  assert.match(activity, /seasonGroups\.map\(\(seasonGroup\) =>/);
  assert.match(activity, /\{seasonDisplayTitle\(seasonGroup\.season\)\}/);
  assert.match(activity, />E\{episode\.media\.episode \?\? '-'\}</);
});

test('P10.6-B3 makes Play in Orion the clear theme-aware primary action without removing secondary capabilities', () => {
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');
  const screen = read('app', '(tabs)', 'downloads.tsx');

  assert.match(activity, /<ActionButton primary label="Play in Orion"/);
  assert.match(activity, /borderColor: primary \? theme\.accent : theme\.border/);
  assert.match(activity, /backgroundColor: primary \? \(pressed \? theme\.accentSoft : theme\.accent\)/);
  assert.match(activity, /color=\{primary \? theme\.onAccent : theme\.textSecondary\}/);

  // B3 is presentation-only: local playback and scoped management remain.
  assert.match(activity, /label="Play Locally"/);
  assert.match(activity, /onManageAssets\(group\.entries\.flatMap\(\(candidate\) => candidate\.assetIds\)\)/);
  assert.match(activity, /onManageAssets\(episode\.assetIds\)/);
  assert.match(screen, /accessibilityLabel="Manage completed downloads"/);

  assert.doesNotMatch(`${screen}\n${activity}`, /#[0-9a-fA-F]{6}/);
});
