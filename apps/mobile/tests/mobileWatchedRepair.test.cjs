'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  selectSeriesWatchedReconciliationCandidates,
  withSeriesWatchedSummary,
  isSavedItemFullyWatched,
  nextSeriesWatchedSummaryExpiry,
  SERIES_WATCHED_ACTIVE_SUMMARY_TTL_MS,
} = require('../src/features/library/watchedState.ts');
const {
  runSeriesWatchedReconciliationBatch,
  SERIES_WATCHED_REQUEST_CONCURRENCY,
  SERIES_WATCHED_REQUEST_TIMEOUT_MS,
} = require('../src/features/library/seriesWatchedReconciler.ts');
const {
  canonicalMediaDetailWatchedRecord,
} = require('../src/features/media-detail/mediaDetailWatchedPolicy.ts');

const episode = (seriesId, season, number, timestamp = 1) => ({
  id: seriesId * 100 + number,
  media_type: 'tv',
  is_episode: true,
  series_id: seriesId,
  season,
  episode: number,
  timestamp,
});

test('movie watched identity exists before remote detail resolves', () => {
  assert.deepEqual(canonicalMediaDetailWatchedRecord({
    data: null,
    immediateRecord: { id: 7, title: 'Downloaded Seven', poster_path: '/seven.jpg' },
    type: 'movie',
    routeId: '7',
    fallbackTitle: 'This movie',
  }), {
    id: 7,
    title: 'Downloaded Seven',
    poster_path: '/seven.jpg',
    media_type: 'movie',
  });
  assert.equal(canonicalMediaDetailWatchedRecord({
    data: null,
    type: 'movie',
    routeId: '8',
    fallbackTitle: 'This movie',
  }).id, '8');
});

test('missing and expired TV summaries become one route-independent candidate', () => {
  const watched = {
    tv_9_s1_e1: episode(9, 1, 1, 10),
    tv_9_s1_e2: episode(9, 1, 2, 20),
  };
  const first = selectSeriesWatchedReconciliationCandidates(watched, 100);
  assert.equal(first.length, 1);
  assert.equal(first[0].seriesId, '9');

  const current = {
    ...watched,
    tv_9: { id: 9, is_series_summary: true, derived_from_episodes: true, valid_until: 200 },
  };
  assert.deepEqual(selectSeriesWatchedReconciliationCandidates(current, 100), []);

  const expired = {
    ...watched,
    tv_9: { id: 9, is_series_summary: true, derived_from_episodes: true, valid_until: 99 },
  };
  assert.equal(selectSeriesWatchedReconciliationCandidates(expired, 100).length, 1);
});

test('cloud-restored episode truth can rebuild a card tick without Media Detail', async () => {
  let watched = {
    tv_11_s1_e1: episode(11, 1, 1),
    tv_11_s1_e2: episode(11, 1, 2),
  };
  const candidates = selectSeriesWatchedReconciliationCandidates(watched);
  await runSeriesWatchedReconciliationBatch({
    candidates,
    fetchSeries: async () => ({
      id: 11,
      name: 'Eleven',
      status: 'Ended',
      number_of_episodes: 2,
      seasons: [{ season_number: 1, episode_count: 2, air_date: '2025-01-01' }],
    }),
    applySeries: (series) => { watched = withSeriesWatchedSummary(watched, series, 500); },
    isCurrent: () => true,
  });
  assert.equal(isSavedItemFullyWatched(watched, { id: 11, media_type: 'tv', name: 'Eleven' }), true);
  assert.equal(watched.tv_11.derived_from_episodes, true);
});

test('reconciliation is bounded to two requests and fences stale responses', async () => {
  const candidates = [1, 2, 3, 4].map((seriesId) => ({
    seriesId: String(seriesId),
    signature: 'episode-' + seriesId,
  }));
  let active = 0;
  let peak = 0;
  const applied = [];
  await runSeriesWatchedReconciliationBatch({
    candidates,
    concurrency: SERIES_WATCHED_REQUEST_CONCURRENCY,
    fetchSeries: async (seriesId) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 4));
      active -= 1;
      return { id: Number(seriesId) };
    },
    applySeries: (series) => applied.push(series.id),
    isCurrent: (candidate) => candidate.seriesId !== '3',
  });
  assert.equal(peak, 2);
  assert.deepEqual(applied, [1, 2, 4]);
});

test('hung series metadata is aborted by the bounded deadline', async () => {
  let aborted = false;
  await runSeriesWatchedReconciliationBatch({
    candidates: [{ seriesId: '12', signature: 'one' }],
    timeoutMs: 5,
    fetchSeries: (_seriesId, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        aborted = true;
        reject(new Error('aborted'));
      });
    }),
    applySeries: () => assert.fail('timed-out data must not apply'),
    isCurrent: () => true,
  });
  assert.equal(aborted, true);
  assert.equal(SERIES_WATCHED_REQUEST_TIMEOUT_MS, 8000);
});

test('the root coordinator defers offline and keys retries to recovery epochs', () => {
  const root = fs.readFileSync(path.resolve(__dirname, '../app/_layout.tsx'), 'utf8');
  const coordinator = fs.readFileSync(
    path.resolve(__dirname, '../src/features/library/MobileWatchedSummaryCoordinator.tsx'),
    'utf8',
  );
  assert.match(root, /<MobileWatchedSummaryCoordinator \/>/);
  assert.match(coordinator, /if \(!remoteReady \|\| candidates\.length === 0\) return/);
  assert.match(coordinator, /recoveryEpoch \+ ':' \+ candidate\.seriesId/);
  assert.match(coordinator, /controller\.abort\(\)/);
  assert.match(coordinator, /current\.signature === candidate\.signature/);
});
test('end-to-end deadline continues when fetch ignores AbortSignal and never settles', async () => {
  const applied = [];
  const startedAt = Date.now();
  await runSeriesWatchedReconciliationBatch({
    candidates: [
      { seriesId: '20', signature: 'hung' },
      { seriesId: '21', signature: 'ready' },
    ],
    concurrency: 1,
    timeoutMs: 10,
    fetchSeries: (seriesId) => (
      seriesId === '20'
        ? new Promise(() => {})
        : Promise.resolve({ id: Number(seriesId) })
    ),
    applySeries: (series) => applied.push(series.id),
    isCurrent: () => true,
  });
  assert.ok(Date.now() - startedAt < 250, 'batch exceeded its own deadline');
  assert.deepEqual(applied, [21]);
});

test('active series summaries use announced boundary, fallback TTL, and terminal series stay durable', () => {
  const now = Date.parse('2030-01-01T12:00:00Z');

  let knownNext = {
    tv_31_s1_e1: episode(31, 1, 1),
  };
  knownNext = withSeriesWatchedSummary(knownNext, {
    id: 31,
    name: 'Known Next',
    status: 'Returning Series',
    seasons: [{ season_number: 1, episode_count: 2, air_date: '2029-01-01' }],
    next_episode_to_air: { season_number: 1, episode_number: 2, air_date: '2030-01-03' },
  }, now, now);
  assert.equal(knownNext.tv_31.valid_until, Date.parse('2030-01-03T00:00:00Z'));
  assert.equal(knownNext.tv_31.series_terminal, false);

  let noNext = {
    tv_32_s1_e1: episode(32, 1, 1),
  };
  noNext = withSeriesWatchedSummary(noNext, {
    id: 32,
    name: 'Unannounced Future',
    status: 'Returning Series',
    seasons: [{ season_number: 1, episode_count: 1, air_date: '2029-01-01' }],
    last_episode_to_air: { season_number: 1, episode_number: 1 },
  }, now, now);
  assert.equal(noNext.tv_32.valid_until, now + SERIES_WATCHED_ACTIVE_SUMMARY_TTL_MS);
  assert.equal(noNext.tv_32.series_terminal, false);

  let ended = {
    tv_33_s1_e1: episode(33, 1, 1),
  };
  ended = withSeriesWatchedSummary(ended, {
    id: 33,
    name: 'Finished',
    status: 'Ended',
    seasons: [{ season_number: 1, episode_count: 1, air_date: '2029-01-01' }],
  }, now, now);
  assert.equal(ended.tv_33.valid_until, null);
  assert.equal(ended.tv_33.series_terminal, true);
  assert.equal(nextSeriesWatchedSummaryExpiry(ended, now), null);
});

test('unchanged watched truth becomes a reconciliation candidate after summary expiry', () => {
  const watched = {
    tv_41_s1_e1: episode(41, 1, 1, 10),
    tv_41: {
      id: 41,
      media_type: 'tv',
      is_series_summary: true,
      derived_from_episodes: true,
      series_terminal: false,
      valid_until: 500,
      timestamp: 100,
    },
  };

  assert.deepEqual(selectSeriesWatchedReconciliationCandidates(watched, 499), []);
  const expired = selectSeriesWatchedReconciliationCandidates(watched, 500);
  assert.equal(expired.length, 1);
  assert.equal(expired[0].seriesId, '41');
  assert.match(expired[0].signature, /summary:100:500:active/);

  const repeatedBeforeExpiry = [
    selectSeriesWatchedReconciliationCandidates(watched, 200),
    selectSeriesWatchedReconciliationCandidates(watched, 300),
    selectSeriesWatchedReconciliationCandidates(watched, 499),
  ];
  assert.ok(repeatedBeforeExpiry.every((value) => value.length === 0));
});

test('legacy non-terminal derived summaries without an expiry are refreshed once', () => {
  const watched = {
    tv_42_s1_e1: episode(42, 1, 1),
    tv_42: {
      id: 42,
      media_type: 'tv',
      is_series_summary: true,
      derived_from_episodes: true,
      valid_until: null,
      timestamp: 50,
    },
  };
  assert.equal(selectSeriesWatchedReconciliationCandidates(watched, 100).length, 1);
});

test('coordinator schedules expiry wake-up and foreground/recovery re-evaluation without Media Detail', () => {
  const coordinator = fs.readFileSync(
    path.resolve(__dirname, '../src/features/library/MobileWatchedSummaryCoordinator.tsx'),
    'utf8',
  );
  assert.match(coordinator, /nextSeriesWatchedSummaryExpiry/);
  assert.match(coordinator, /setTimeout/);
  assert.match(coordinator, /setReevaluationEpoch/);
  assert.match(coordinator, /AppState\.addEventListener\('change'/);
  assert.match(coordinator, /\[watched,\s*reevaluationEpoch,\s*recoveryEpoch\]/);
  assert.doesNotMatch(coordinator, /MediaDetail/);
});
