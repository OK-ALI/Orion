const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

test('P10.6-B4 makes tabs and controls horizontal, non-shrinking and safe for long labels', () => {
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');

  assert.match(activity, /<ScrollView horizontal showsHorizontalScrollIndicator=\{false\} contentContainerStyle=\{styles\.tabs\}>/);
  assert.match(activity, /<Text numberOfLines=\{1\} style=\{\[styles\.tabText/);
  assert.match(activity, /tab:\s*\{\s*flexShrink:\s*0/);
  assert.match(activity, /tabText:\s*\{\s*flexShrink:\s*0/);
  assert.match(activity, /countBadge:\s*\{\s*flexShrink:\s*0/);

  assert.match(activity, /<ScrollView horizontal showsHorizontalScrollIndicator=\{false\} contentContainerStyle=\{styles\.controlRow\}>/);
  assert.match(activity, /control:\s*\{\s*flexShrink:\s*0/);
  assert.match(activity, /controlText:\s*\{\s*flexShrink:\s*0/);
  assert.match(activity, /<Text numberOfLines=\{1\} style=\{\[styles\.controlText/);
});

test('P10.6-B4 applies Search and Media Filter consistently to attention items and empty-state truth', () => {
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');

  assert.match(activity, /const visibleAttentionAssets = useMemo\(\(\) => \{/);
  assert.match(activity, /mediaMatchesFilter\(asset\.media, mediaFilter\)/);
  assert.match(activity, /mediaMatchesQuery\(asset\.media, normalizedQuery\)/);
  assert.match(activity, /\{visibleAttentionAssets\.map\(\(asset\) => \{/);
  assert.doesNotMatch(activity, /attentionAssets\.map\(\(asset\)/);
  assert.match(activity, /visibleJobs\.length === 0 && visibleGroups\.length === 0 && visibleAttentionAssets\.length === 0/);

  assert.match(activity, /accessibilityLabel="Search downloads"/);
  assert.match(activity, /accessibilityLabel="Clear download search"/);
  assert.match(activity, /backgroundColor:\s*theme\.input/);
});

test('P10.6-B4 keeps sort choices meaningful to the selected download view', () => {
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');

  assert.match(activity, /function sortOptionsForTab\(tab: DownloadTab\)/);
  assert.match(activity, /if \(tab === 'active' \|\| tab === 'failed'\) return SORTS/);
  assert.match(activity, /return SORTS\.filter\(\(item\) => item\.id !== 'progress'\)/);
  assert.match(activity, /if \(sort === 'progress' && nextTab !== 'active' && nextTab !== 'failed'\) setSort\('newest'\)/);
  assert.match(activity, /const selectedSortLabel = sortOptions\.find/);
  assert.match(activity, /\{ id: 'name', label: 'A–Z' \}/);
  assert.match(activity, /\{ id: 'size', label: 'Largest' \}/);
});

test('P10.6-B4 remains presentation/filter-state only and preserves prior Phase 10 boundaries', () => {
  const activity = read('src', 'features', 'downloads', 'DownloadActivityList.tsx');
  const screen = read('app', '(tabs)', 'downloads.tsx');

  assert.match(screen, /eyebrow="OFFLINE"/);
  assert.match(screen, /title="Downloads"/);
  assert.match(activity, />Ready offline</);
  assert.match(activity, /<ActionButton primary label="Play in Orion"/);
  assert.match(activity, /label="Play Locally"/);
  assert.match(activity, /onManageAssets\(episode\.assetIds\)/);
  assert.doesNotMatch(`${screen}\n${activity}`, /#[0-9a-fA-F]{6}/);
});
