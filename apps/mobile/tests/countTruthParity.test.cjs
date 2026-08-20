"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  selectContinueWatching,
} = require("../src/features/library/playbackLibrary.ts");
const {
  resolvePlaybackRouteIdentity,
} = require("../src/features/playback/routePlaybackIdentity.ts");

function progress(id, overrides = {}) {
  return {
    schemaVersion: 3,
    key: `movie_${id}`,
    mediaIdentity: {
      id,
      mediaType: "movie",
      title: `Movie ${id}`,
      year: 2026,
      season: null,
      episode: null,
    },
    presentation: {
      posterPath: null,
      backdropPath: null,
      seriesTitle: null,
      episodeTitle: null,
    },
    currentTime: 60,
    duration: 120,
    percent: 50,
    sourceId: "videasy",
    evidence: "provider-video-event",
    sessionId: `session-${id}`,
    startedAt: 1000,
    lastPlayedAt: 1000 + Number(id),
    completed: false,
    ...overrides,
  };
}

test("TV route playback identity matches the source fallback", () => {
  assert.deepEqual(
    resolvePlaybackRouteIdentity("tv", undefined, undefined),
    { season: 1, episode: 1 },
  );
  assert.deepEqual(
    resolvePlaybackRouteIdentity("tv", "3", undefined),
    { season: 3, episode: 1 },
  );
  assert.deepEqual(
    resolvePlaybackRouteIdentity("tv", undefined, "7"),
    { season: 1, episode: 7 },
  );
  assert.deepEqual(
    resolvePlaybackRouteIdentity("tv", "2", "5"),
    { season: 2, episode: 5 },
  );
  assert.deepEqual(
    resolvePlaybackRouteIdentity("movie", "2", "5"),
    { season: null, episode: null },
  );
});

test("Mobile Continue Watching applies the canonical 30 second / 90 percent policy", () => {
  const selected = selectContinueWatching({
    movie_1: progress(1, { currentTime: 29, duration: 100, percent: 29 }),
    movie_2: progress(2, { currentTime: 30, duration: 100, percent: 30 }),
    movie_3: progress(3, { currentTime: 90, duration: 100, percent: 90, completed: false }),
    movie_4: progress(4, { currentTime: 45, duration: 0, percent: null }),
  });

  assert.deepEqual(
    selected.map((entry) => entry.key),
    ["movie_4", "movie_2"],
  );
});
