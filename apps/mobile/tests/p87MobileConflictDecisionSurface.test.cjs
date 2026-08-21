const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relative) {
  return fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
}

test('P8.7 Mobile exposes explicit device-or-cloud decisions for every reviewable steady-state conflict domain', () => {
  const myList = read('src/features/settings/MyListEnrollmentPreflight.tsx');
  const watched = read('src/features/settings/WatchedSyncControl.tsx');
  const viewing = read('src/features/settings/ViewingActivitySyncControl.tsx');

  assert.match(myList, /steady\.review\?\.reason === 'both-changed'/);
  assert.match(myList, />Keep this device<\/Text>/);
  assert.match(myList, />Keep Orion Cloud<\/Text>/);
  assert.match(myList, /title="Resolve My List conflict\?"/);

  assert.match(watched, /steady\.review\?\.reason === 'both-changed'/);
  assert.match(watched, />Keep this device<\/Text>/);
  assert.match(watched, />Keep Orion Cloud<\/Text>/);
  assert.match(watched, /title="Resolve Watched conflict\?"/);

  assert.match(viewing, /steady\.review\?\.reason === 'two-sided-divergence'/);
  assert.match(viewing, />Keep this device<\/Text>/);
  assert.match(viewing, />Keep Orion Cloud<\/Text>/);
  assert.match(viewing, /title="Resolve Viewing Activity conflict\?"/);
});

test('P8.7 Mobile never leaves a non-reviewable Needs review row as a dead end', () => {
  const myList = read('src/features/settings/MyListEnrollmentPreflight.tsx');
  const watched = read('src/features/settings/WatchedSyncControl.tsx');
  const viewing = read('src/features/settings/ViewingActivitySyncControl.tsx');

  for (const [name, source] of [['My List', myList], ['Watched', watched], ['Viewing Activity', viewing]]) {
    assert.match(source, /steady\.phase === 'needs-review' && !steadyReviewAvailable[\s\S]*\? 'Check again'/, `${name} must expose Check again for non-decision review states`);
    assert.match(source, /manualSync\.runManualSync\(\)/, `${name} must route Check again through the existing explicit one-shot reconcile`);
  }
});

test('P8.7 Mobile preserves the actual steady-state warning reason instead of presenting every warning as a conflict', () => {
  const myList = read('src/features/settings/MyListEnrollmentPreflight.tsx');
  const watched = read('src/features/settings/WatchedSyncControl.tsx');

  assert.match(myList, /steady\.phase === 'needs-review'[\s\S]*\? steady\.message/);
  assert.doesNotMatch(myList, /My List needs your attention before Orion can sync it safely\. Orion did not merge or overwrite either copy\./);

  assert.match(watched, /steady\.phase === 'needs-review'[\s\S]*\? steady\.message/);
  assert.doesNotMatch(watched, /Watched needs your attention before Orion can sync it safely\. Orion did not choose a winner or overwrite either copy\./);
});
