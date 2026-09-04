'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  MOBILE_LIBRARY_SORT_OPTIONS,
  normalizeMobileLibrarySort,
  sortMobileLibraryItems,
} = require('../src/features/library/librarySort.ts');

const items = [
  { id: 1, title: 'Zulu', vote_average: 4, release_date: '2020-01-01' },
  { id: 2, name: 'alpha', vote_average: 9, first_air_date: '2022-01-01' },
  { id: 3, title: 'Beta', vote_average: 9, year: 2024 },
  { id: 4, title: '', vote_average: null },
];

test('My List exposes the four Desktop-equivalent sort modes', () => {
  assert.deepEqual(MOBILE_LIBRARY_SORT_OPTIONS.map((option) => option.label), [
    'Custom order', 'A–Z', 'Top rated', 'Newest first',
  ]);
  assert.equal(normalizeMobileLibrarySort('rating'), 'rating');
  assert.equal(normalizeMobileLibrarySort('invalid'), 'manual');
});

test('Custom order remains byte-for-byte aligned with savedOrder input', () => {
  const sorted = sortMobileLibraryItems(items, 'manual');
  assert.deepEqual(sorted.map((item) => item.id), [1, 2, 3, 4]);
  assert.notEqual(sorted, items);
});

test('A-Z, Top rated, and Newest first handle missing metadata and stable ties', () => {
  assert.deepEqual(sortMobileLibraryItems(items, 'title').map((item) => item.id), [4, 2, 3, 1]);
  assert.deepEqual(sortMobileLibraryItems(items, 'rating').map((item) => item.id), [2, 3, 1, 4]);
  assert.deepEqual(sortMobileLibraryItems(items, 'year').map((item) => item.id), [3, 2, 1, 4]);
  const tied = [{ id: 1, title: 'Same' }, { id: 2, title: 'Same' }];
  assert.deepEqual(sortMobileLibraryItems(tied, 'title').map((item) => item.id), [1, 2]);
});

test('sorting composes before watched filtering and does not touch Continue or History', () => {
  const screen = fs.readFileSync(
    path.resolve(__dirname, '../src/features/library/LibraryScreen.tsx'),
    'utf8',
  );
  const sortIndex = screen.indexOf('const sortedSavedItems');
  const filterIndex = screen.indexOf('const filteredSavedItems');
  assert.ok(sortIndex > 0 && filterIndex > sortIndex);
  assert.match(screen, /savedWatchRows\.filter\(\(entry\) => entry\.state === savedFilter\)/);
  assert.match(screen, /normalizeMobileLibrarySort\(mmkvStorageAdapter\.get\(MOBILE_LIBRARY_SORT_KEY\)\)/);
  assert.match(screen, /mmkvStorageAdapter\.set\(MOBILE_LIBRARY_SORT_KEY, sort\)/);
  assert.match(screen, /AccessibilityInfo\.announceForAccessibility\('My List sorted by '/);
  assert.doesNotMatch(screen, /sortMobileLibraryItems\(continueItems/);
  assert.doesNotMatch(screen, /sortMobileLibraryItems\(historyItems/);
});

test('sort selector is modal, radio-based, dismissible, and reduced-motion aware', () => {
  const dialog = fs.readFileSync(
    path.resolve(__dirname, '../src/features/library/LibrarySortDialog.tsx'),
    'utf8',
  );
  assert.match(dialog, /accessibilityViewIsModal/);
  assert.match(dialog, /accessibilityRole="radiogroup"/);
  assert.match(dialog, /accessibilityRole="radio"/);
  assert.match(dialog, /accessibilityState=\{\{ checked \}\}/);
  assert.match(dialog, /onRequestClose=\{onDismiss\}/);
  assert.match(dialog, /preferences\.reducedMotion/);
});