'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  MOBILE_LIBRARY_MEDIA_FILTERS,
  MOBILE_LIBRARY_SORT_OPTIONS,
  MOBILE_LIBRARY_SORT_SHORT_LABELS,
  countMobileLibraryMediaTypes,
  filterMobileLibraryItems,
  normalizeMobileLibrarySort,
  sortMobileLibraryItems,
} = require('../src/features/library/librarySort.ts');

const items = [
  { id: 1, media_type: 'movie', title: 'Zulu', vote_average: 4, vote_count: 20, release_date: '2020-01-01' },
  { id: 2, media_type: 'tv', name: 'alpha', vote_average: 9, vote_count: 10, first_air_date: '2022-01-01' },
  { id: 3, media_type: 'movie', title: 'Beta', vote_average: 9, vote_count: 30, year: 2024 },
  { id: 4, media_type: 'tv', title: '', vote_average: null },
];

test('My List keeps four full sort names and compact toolbar labels', () => {
  assert.deepEqual(MOBILE_LIBRARY_SORT_OPTIONS.map((option) => option.label), [
    'Custom order', 'A–Z', 'Top rated', 'Newest first',
  ]);
  assert.deepEqual(MOBILE_LIBRARY_SORT_SHORT_LABELS, {
    manual: 'Custom', title: 'A–Z', rating: 'Rating', year: 'Newest',
  });
  assert.equal(normalizeMobileLibrarySort('rating'), 'rating');
  assert.equal(normalizeMobileLibrarySort('invalid'), 'manual');
});

test('Custom order remains byte-for-byte aligned with savedOrder input', () => {
  const sorted = sortMobileLibraryItems(items, 'manual');
  assert.deepEqual(sorted.map((item) => item.id), [1, 2, 3, 4]);
  assert.notEqual(sorted, items);
});

test('A–Z remains case-insensitive and stable', () => {
  assert.deepEqual(sortMobileLibraryItems(items, 'title').map((item) => item.id), [4, 2, 3, 1]);
  const tied = [{ id: 1, title: 'Same' }, { id: 2, title: 'Same' }];
  assert.deepEqual(sortMobileLibraryItems(tied, 'title').map((item) => item.id), [1, 2]);
});

test('Newest first uses full dates within one year, then year precision, with unknown dates last', () => {
  const dated = [
    { id: 6, title: 'Year-only next year', year: '2027' },
    { id: 1, title: 'January', release_date: '2026-01-01', year: '2026' },
    { id: 2, title: 'December', release_date: '2026-12-01', year: '2026' },
    { id: 3, title: 'Year only', year: '2025' },
    { id: 4, title: 'Unknown' },
    { id: 5, title: 'Invalid', release_date: '2026-99-99' },
  ];
  assert.deepEqual(sortMobileLibraryItems(dated, 'year').map((item) => item.id), [6, 2, 1, 3, 5, 4]);
});

test('Rating distinguishes valid zero from missing metadata and resolves ties deterministically', () => {
  const rated = [
    { id: 1, title: 'Same', vote_average: 8, vote_count: 10 },
    { id: 2, title: 'Same', vote_average: 8, vote_count: 40 },
    { id: 3, title: 'Zero', vote_average: 0 },
    { id: 4, title: 'Missing', vote_average: null },
    { id: 5, title: 'Absent' },
  ];
  assert.deepEqual(sortMobileLibraryItems(rated, 'rating').map((item) => item.id), [2, 1, 3, 5, 4]);
  const stable = [{ id: 6, title: 'Tie', vote_average: 5 }, { id: 7, title: 'Tie', vote_average: 5 }];
  assert.deepEqual(sortMobileLibraryItems(stable, 'rating').map((item) => item.id), [6, 7]);
});

test('media filters toggle over movie/tv truth and never mutate source order', () => {
  assert.deepEqual(MOBILE_LIBRARY_MEDIA_FILTERS, [
    { id: 'movie', label: 'Movies' },
    { id: 'tv', label: 'TV & Anime' },
  ]);
  const sourceIds = items.map((item) => item.id);
  assert.deepEqual(countMobileLibraryMediaTypes(items), { movie: 2, tv: 2 });
  assert.deepEqual(filterMobileLibraryItems(items, 'all').map((item) => item.id), [1, 2, 3, 4]);
  assert.deepEqual(filterMobileLibraryItems(items, 'movie').map((item) => item.id), [1, 3]);
  assert.deepEqual(filterMobileLibraryItems(items, 'tv').map((item) => item.id), [2, 4]);
  assert.deepEqual(items.map((item) => item.id), sourceIds);
});

test('watched counts describe the current media subset after sorting', () => {
  const watchedIds = new Set([2, 3]);
  const sorted = sortMobileLibraryItems(items, 'title');
  const movies = filterMobileLibraryItems(sorted, 'movie');
  const movieWatched = movies.filter((item) => watchedIds.has(item.id)).length;
  assert.deepEqual({ all: movies.length, unwatched: movies.length - movieWatched, watched: movieWatched }, {
    all: 2, unwatched: 1, watched: 1,
  });
  const tv = filterMobileLibraryItems(sorted, 'tv');
  const tvWatched = tv.filter((item) => watchedIds.has(item.id)).length;
  assert.deepEqual({ all: tv.length, unwatched: tv.length - tvWatched, watched: tvWatched }, {
    all: 2, unwatched: 1, watched: 1,
  });
});

test('Library uses one aligned 2x3 deck and applies sort before media and watched filters', () => {
  const screen = fs.readFileSync(
    path.resolve(__dirname, '../src/features/library/LibraryScreen.tsx'),
    'utf8',
  );
  const sortIndex = screen.indexOf('const sortedSavedItems');
  const mediaIndex = screen.indexOf('const mediaFilteredSavedItems');
  const watchIndex = screen.indexOf('const savedWatchRows');
  const filterIndex = screen.indexOf('const filteredSavedItems');
  assert.ok(sortIndex > 0 && mediaIndex > sortIndex && watchIndex > mediaIndex && filterIndex > watchIndex);
  assert.match(screen, /type SavedMediaFilter = 'all' \| 'movie' \| 'tv'/);
  assert.match(screen, /countMobileLibraryMediaTypes\(savedItems\)/);
  assert.match(screen, /filterMobileLibraryItems\(sortedSavedItems, savedMediaFilter\)/);
  assert.match(screen, /setSavedMediaFilter\(\(current\) => current === filter\.id \? 'all' : filter\.id\)/);
  assert.match(screen, /styles\.savedControlDeck/);
  assert.equal((screen.match(/style=\{styles\.savedControlRow\}/g) || []).length, 2);
  assert.match(screen, /savedControlCell: \{ flex: 1, minWidth: 0, minHeight: 44/);
  assert.match(screen, /accessibilityLabel=\{`\$\{filter\.label\} My List filter, \$\{mediaFilterCounts\[filter\.id\]\} titles`\}/);
  assert.match(screen, /accessibilityLabel=\{'Sort My List: ' \+ currentSortOption\?\.label\}/);
  assert.match(screen, /accessibilityState=\{\{ selected: active \}\}/);
  assert.match(screen, /AccessibilityInfo\.announceForAccessibility/);
  assert.doesNotMatch(screen, /sortMobileLibraryItems\(continueItems/);
  assert.doesNotMatch(screen, /sortMobileLibraryItems\(historyItems/);
});

test('sort selector remains modal, radio-based, dismissible, and reduced-motion aware', () => {
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