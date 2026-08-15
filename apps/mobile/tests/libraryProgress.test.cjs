"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  normalizePlaybackProgress,
  selectContinueWatching,
  selectLatestHistory,
  markProgressRecordWatched,
  withoutHistoryEntry,
  withoutProgressRecord,
} = require("../src/features/library/playbackLibrary.ts");

const {
  isEpisodeWatchedRecord,
  isSeasonWatchedCollection,
  withSeasonWatched,
  withSeriesWatchedSummary,
  withoutSeasonWatched,
  isSavedItemFullyWatched,
  savedItemWatchState,
} = require("../src/features/library/watchedState.ts");

function record(overrides = {}) {
  return {
    schemaVersion: 2,
    media: { id: 7, mediaType: "movie", title: "Seven", year: 2026 },
    currentTime: 90,
    duration: 300,
    percent: 30,
    sourceId: "videasy",
    evidence: "provider-video-event",
    sessionId: "session-7",
    completed: false,
    updatedAt: 1000,
    ...overrides,
  };
}

test("V2 progress normalizes to V3 without losing verified timing", () => {
  const normalized = normalizePlaybackProgress("movie_7", record());
  assert.equal(normalized.schemaVersion, 3);
  assert.equal(normalized.key, "movie_7");
  assert.equal(normalized.currentTime, 90);
  assert.equal(normalized.percent, 30);
  assert.equal(normalized.mediaIdentity.title, "Seven");
  assert.equal(normalized.startedAt, 1000);
});

test("Continue includes verified unknown duration but excludes opened-only and completion", () => {
  const selected = selectContinueWatching({
    movie_1: record({ media: { id: 1, mediaType: "movie", title: "Unknown" }, currentTime: 45, duration: 0, percent: null }),
    movie_2: record({ media: { id: 2, mediaType: "movie", title: "Opened" }, evidence: "opened-only" }),
    movie_3: record({ media: { id: 3, mediaType: "movie", title: "Done" }, currentTime: 95, duration: 100, completed: true }),
    movie_4: record({ media: { id: 4, mediaType: "movie", title: "Too soon" }, currentTime: 29, duration: 100 }),
  });
  assert.deepEqual(selected.map((item) => item.key), ["movie_1"]);
  assert.equal(selected[0].displayProgress, "elapsed");
});

test("Continue retains only the latest episode per series", () => {
  const selected = selectContinueWatching({
    tv_9_s1_e1: record({ media: { id: 9, mediaType: "tv", title: "Series", season: 1, episode: 1 }, updatedAt: 1000 }),
    tv_9_s1_e2: record({ media: { id: 9, mediaType: "tv", title: "Series", season: 1, episode: 2 }, updatedAt: 2000 }),
    tv_10_s2_e4: record({ media: { id: 10, mediaType: "tv", title: "Other", season: 2, episode: 4 }, updatedAt: 1500 }),
  });
  assert.deepEqual(selected.map((item) => item.key), ["tv_9_s1_e2", "tv_10_s2_e4"]);
});

test("watched state removes only its matching Continue record", () => {
  const progress = { movie_7: record(), movie_8: record({ media: { id: 8, mediaType: "movie", title: "Eight" } }) };
  assert.deepEqual(selectContinueWatching(progress, { movie_7: { id: 7 } }).map((item) => item.key), ["movie_8"]);
});

test("History keeps the latest movie or exact episode entry", () => {
  const history = selectLatestHistory([
    { id: 1, media_type: "movie", title: "Old", updatedAt: 100 },
    { id: 1, media_type: "movie", title: "New", updatedAt: 200 },
    { id: 2, media_type: "tv", season: 1, episode: 1, updatedAt: 300 },
    { id: 2, media_type: "tv", season: 1, episode: 2, updatedAt: 250 },
  ]);
  assert.deepEqual(history.map((item) => item.title || `E${item.episode}`), ["E1", "E2", "New"]);
});

test("library mutations preserve independent collections", () => {
  const progress = { movie_7: record(), movie_8: record({ media: { id: 8, mediaType: "movie", title: "Eight" } }) };
  const history = [{ id: 7, media_type: "movie" }, { id: 8, media_type: "movie" }];
  const watched = { movie_9: { id: 9 } };
  assert.deepEqual(Object.keys(withoutProgressRecord(progress, "movie_7")), ["movie_8"]);
  assert.deepEqual(withoutHistoryEntry(history, "movie_7").map((item) => item.id), [8]);
  const marked = markProgressRecordWatched(progress, watched, "movie_7", 1234);
  assert.deepEqual(Object.keys(marked.progress), ["movie_8"]);
  assert.equal(marked.watched.movie_9.id, 9);
  assert.equal(marked.watched.movie_7.timestamp, 1234);
  assert.equal(history.length, 2);
});


test("season watched batches preserve unrelated collections and recognize legacy episode watched records", () => {
  const series = { id: 77, name: "Series 77", poster_path: "/poster.jpg", backdrop_path: "/backdrop.jpg" };
  const episodes = [
    { id: 701, season_number: 1, episode_number: 1, name: "One" },
    { id: 702, season_number: 1, episode_number: 2, name: "Two" },
  ];
  const watched = {
    movie_9: { id: 9, media_type: "movie" },
    tv_77_s1_e1: { id: 77, media_type: "tv", is_episode: true, series_id: 77, season: 1, episode: 1 },
  };

  assert.equal(isEpisodeWatchedRecord(watched, 77, episodes[0], 1), true);
  assert.equal(isSeasonWatchedCollection(watched, 77, 1, episodes), false);

  const marked = withSeasonWatched(watched, series, 1, episodes, 1234);
  assert.equal(isSeasonWatchedCollection(marked, 77, 1, episodes), true);
  assert.equal(marked.movie_9.id, 9);
  assert.equal(marked.tv_77_episode_702.timestamp, 1234);
  assert.equal(marked.tv_77_episode_702.series_id, 77);
  assert.equal(marked.tv_77_episode_702.season, 1);
  assert.equal(marked.tv_77_episode_702.episode, 2);

  const unmarked = withoutSeasonWatched(marked, 77, 1, episodes);
  assert.equal(isSeasonWatchedCollection(unmarked, 77, 1, episodes), false);
  assert.equal(unmarked.movie_9.id, 9);
  assert.equal(Object.values(unmarked).some((value) => value?.series_id === 77), false);
});

test("Home and Phase 2 presentation consume the live Orion theme", () => {
  const files = [
    "../app/(tabs)/index.tsx",
    "../src/components/HeroBillboard.tsx",
    "../src/components/MediaCard.tsx",
    "../src/features/library/HomeContinueWatching.tsx",
    "../src/features/library/ContinueWatchingCard.tsx",
    "../src/features/library/HistoryRow.tsx",
    "../src/features/library/LibraryScreen.tsx",
  ];
  for (const relative of files) {
    const source = fs.readFileSync(path.resolve(__dirname, relative), "utf8");
    assert.match(source, /useOrionTheme/);
    assert.doesNotMatch(source, /backgrounds\.base|colors\.accent/);
  }
});

test("My List watched detection is derived from watched truth and ignores future TV episodes", () => {
  const movie = { id: 5, media_type: "movie", title: "Five" };
  const show = {
    id: 77,
    media_type: "tv",
    name: "Series 77",
    status: "Returning Series",
    seasons: [
      { season_number: 0, episode_count: 3, air_date: "2020-01-01" },
      { season_number: 1, episode_count: 2, air_date: "2024-01-01" },
      { season_number: 2, episode_count: 3, air_date: "2026-01-01" },
    ],
    last_episode_to_air: { season_number: 2, episode_number: 2 },
    next_episode_to_air: { season_number: 2, episode_number: 3 },
  };
  const watched = {
    movie_5: { id: 5, media_type: "movie" },
    tv_77_s1_e1: { series_id: 77, season: 1, episode: 1 },
    tv_77_s1_e2: { series_id: 77, season: 1, episode: 2 },
    tv_77_s2_e1: { series_id: 77, season: 2, episode: 1 },
    tv_77_s2_e2: { series_id: 77, season: 2, episode: 2 },
  };

  assert.equal(savedItemWatchState(watched, movie), "watched");
  assert.equal(isSavedItemFullyWatched(watched, show), true);

  const partial = { ...watched };
  delete partial.tv_77_s2_e2;
  assert.equal(savedItemWatchState(partial, show), "unwatched");
  assert.equal(savedItemWatchState({}, movie), "unwatched");
});



test("TV completion summary lets lightweight cards inherit full-show watched truth", () => {
  const series = {
    id: 88,
    media_type: "tv",
    name: "Series 88",
    status: "Ended",
    seasons: [{ season_number: 1, episode_count: 2, air_date: "2025-01-01" }],
    number_of_episodes: 2,
  };
  const episodes = [
    { id: 8801, season_number: 1, episode_number: 1, name: "One" },
    { id: 8802, season_number: 1, episode_number: 2, name: "Two" },
  ];

  const marked = withSeasonWatched({}, series, 1, episodes, 1234);
  assert.equal(marked.tv_88.is_series_summary, true);
  assert.equal(marked.tv_88.derived_from_episodes, true);
  assert.equal(isSavedItemFullyWatched(marked, { id: 88, media_type: "tv", name: "Series 88" }), true);

  const unmarked = withoutSeasonWatched(marked, 88, 1, episodes);
  assert.equal(unmarked.tv_88, undefined);
  assert.equal(isSavedItemFullyWatched(unmarked, { id: 88, media_type: "tv", name: "Series 88" }), false);
});

test("derived TV summary expires conservatively when the next episode boundary is reached", () => {
  const series = {
    id: 99,
    media_type: "tv",
    name: "Series 99",
    status: "Returning Series",
    seasons: [{ season_number: 1, episode_count: 3, air_date: "2025-01-01" }],
    next_episode_to_air: { season_number: 1, episode_number: 3, air_date: "2099-01-01" },
    last_episode_to_air: { season_number: 1, episode_number: 2 },
  };
  const watchedEpisodes = {
    tv_99_s1_e1: { series_id: 99, season: 1, episode: 1 },
    tv_99_s1_e2: { series_id: 99, season: 1, episode: 2 },
  };
  const summarized = withSeriesWatchedSummary(watchedEpisodes, series, 1234);
  const lightweight = { id: 99, media_type: "tv", name: "Series 99" };
  assert.equal(isSavedItemFullyWatched(summarized, lightweight), true);

  const expired = {
    ...summarized,
    tv_99: { ...summarized.tv_99, valid_until: Date.now() - 1 },
  };
  assert.equal(isSavedItemFullyWatched(expired, lightweight), false);
});


test("TV card badges ignore stale direct series markers and reconcile from episode truth", () => {
  const lightweight = { id: 123, media_type: "tv", name: "Series 123" };
  const series = {
    ...lightweight,
    status: "Ended",
    seasons: [{ season_number: 1, episode_count: 2, air_date: "2025-01-01" }],
    number_of_episodes: 2,
  };
  const staleDirect = {
    tv_123: { id: 123, media_type: "tv", name: "Series 123", timestamp: 1 },
    tv_123_s1_e1: { id: 123, media_type: "tv", is_episode: true, series_id: 123, season: 1, episode: 1 },
  };

  assert.equal(isSavedItemFullyWatched(staleDirect, lightweight), false);

  const reconciledIncomplete = withSeriesWatchedSummary(staleDirect, series, 1234);
  assert.equal(reconciledIncomplete.tv_123, undefined);
  assert.equal(isSavedItemFullyWatched(reconciledIncomplete, lightweight), false);

  const completeEpisodes = {
    ...staleDirect,
    tv_123_s1_e2: { id: 123, media_type: "tv", is_episode: true, series_id: 123, season: 1, episode: 2 },
  };
  const reconciledComplete = withSeriesWatchedSummary(completeEpisodes, series, 1234);
  assert.equal(reconciledComplete.tv_123.is_series_summary, true);
  assert.equal(reconciledComplete.tv_123.derived_from_episodes, true);
  assert.equal(isSavedItemFullyWatched(reconciledComplete, lightweight), true);
});


test("Post-P7.2 series summary reconciliation follows live season watched truth", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../src/features/media-detail/useMediaDetailWatched.ts"),
    "utf8",
  );
  assert.match(
    source,
    /\[data, reconcileSeriesWatched, seasonWatched, type\]/,
  );
});
