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
