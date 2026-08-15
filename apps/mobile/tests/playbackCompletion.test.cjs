"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  NEXT_EPISODE_COUNTDOWN_SECONDS,
  PLAYBACK_COMPLETION_REMAINING_SECONDS,
  getNextReleasedEpisode,
  isVerifiedPlaybackCompletion,
} = require("../src/features/playback/playbackCompletion.ts");

test("Post-P7.2 completion requires verified near-end playback truth, not a generic percentage", () => {
  assert.equal(PLAYBACK_COMPLETION_REMAINING_SECONDS, 20);
  assert.equal(isVerifiedPlaybackCompletion({
    verified: false,
    state: "playing",
    currentTime: 95,
    duration: 100,
  }), false);
  assert.equal(isVerifiedPlaybackCompletion({
    verified: true,
    state: "paused",
    currentTime: 95,
    duration: 100,
  }), false);
  assert.equal(isVerifiedPlaybackCompletion({
    verified: true,
    state: "playing",
    currentTime: 79,
    duration: 100,
  }), false);
  assert.equal(isVerifiedPlaybackCompletion({
    verified: true,
    state: "playing",
    currentTime: 80,
    duration: 100,
  }), true);
  assert.equal(isVerifiedPlaybackCompletion({
    verified: true,
    state: "ended",
    currentTime: 100,
    duration: 100,
  }), true);
  assert.equal(isVerifiedPlaybackCompletion({
    verified: true,
    state: "playing",
    currentTime: 80,
    duration: null,
  }), false);
});

test("Post-P7.2 next episode stays in the current season and refuses unreleased or missing episodes", () => {
  const episodes = [
    { episode_number: 1, name: "One", air_date: "2026-08-01" },
    { episode_number: 2, name: "Two", still_path: "/two.jpg", air_date: "2026-08-02" },
    { episode_number: 3, name: "Three", air_date: "2026-08-20" },
  ];
  assert.deepEqual(getNextReleasedEpisode(episodes, 1, 1, "2026-08-15"), {
    seasonNumber: 1,
    episodeNumber: 2,
    name: "Two",
    stillPath: "/two.jpg",
    airDate: "2026-08-02",
  });
  assert.equal(getNextReleasedEpisode(episodes, 1, 2, "2026-08-15"), null);
  assert.equal(getNextReleasedEpisode(episodes, 1, 3, "2026-08-15"), null);
});

test("Post-P7.2 controller and library promote only verified completion into watched truth", () => {
  const controller = fs.readFileSync(
    path.resolve(__dirname, "../src/features/playback/usePlaybackTelemetryController.ts"),
    "utf8",
  );
  const library = fs.readFileSync(
    path.resolve(__dirname, "../src/context/LibraryContext.tsx"),
    "utf8",
  );
  assert.match(controller, /isVerifiedPlaybackCompletion/);
  assert.match(controller, /completionVerified:/);
  assert.match(controller, /onVerifiedCompletion\?\.\(snapshot\)/);
  assert.match(library, /completionVerified = false/);
  assert.match(library, /if \(completionVerified\)/);
  assert.match(library, /markProgressRecordWatched\(nextProgress, watchedRef\.current, key, updatedAt\)/);
  assert.match(library, /canPersistVerifiedPlayback\(evidence, sessionId\)/);
});

test("Post-P7.2 next episode overlay uses five seconds, Play Now, Cancel, and stack-replacing episode navigation", () => {
  assert.equal(NEXT_EPISODE_COUNTDOWN_SECONDS, 5);
  const prompt = fs.readFileSync(
    path.resolve(__dirname, "../src/features/playback/NextEpisodePrompt.tsx"),
    "utf8",
  );
  const screen = fs.readFileSync(
    path.resolve(__dirname, "../src/features/playback/PlayerScreen.tsx"),
    "utf8",
  );
  assert.match(prompt, /UP NEXT/);
  assert.match(prompt, /Play Now/);
  assert.match(prompt, /Cancel/);
  assert.match(prompt, /NEXT_EPISODE_COUNTDOWN_SECONDS/);
  assert.match(prompt, /episode\.stillPath/);
  assert.match(prompt, /compactHeroRow/);
  assert.match(prompt, /stillFrameCompact/);
  assert.doesNotMatch(prompt, /!compactLandscape &&/);
  assert.match(screen, /onVerifiedPlaybackCompletion: handleVerifiedPlaybackCompletion/);
  assert.match(screen, /tmdbFetch<any>\(`\/tv\/\$\{id\}\/season\/\$\{seasonNumber\}`\)/);
  assert.match(screen, /if \(next\) setNextEpisodePrompt\(next\)/);
  assert.match(screen, /router\.replace\(\{/);
  assert.match(screen, /nextSourceId: sourceId/);
});
