"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const importSource = (relative) => import(pathToFileURL(path.join(root, relative)).href);

test("candidate normalization deduplicates provider keys and ranks official trailers", async () => {
  const { normalizeTrailerCandidates } = await importSource("src/features/trailers/trailerCandidateService.ts");
  const candidates = normalizeTrailerCandidates([
    { site: "YouTube", key: "duplicate", name: "Fan reaction", type: "Trailer", official: false, iso_639_1: "en" },
    { site: "YouTube", key: "duplicate", name: "Duplicate upload", type: "Trailer", official: false, iso_639_1: "en" },
    { site: "Vimeo", key: "official", name: "Official Trailer", type: "Trailer", official: true, iso_639_1: "en", size: 1080 },
  ], [], "en", "en");
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].id, "vimeo:official");
});

test("provider classifiers map exact YouTube restrictions", async () => {
  const { classifyYouTubeError } = await importSource("src/features/trailers/trailerProviders.ts");
  assert.equal(classifyYouTubeError(5).category, "html5-playback");
  assert.equal(classifyYouTubeError(100).category, "removed");
  assert.equal(classifyYouTubeError(101).category, "embed-disabled");
  assert.equal(classifyYouTubeError(150).category, "embed-disabled");
  assert.equal(classifyYouTubeError(153).category, "client-identity");
});

test("candidate pipeline preserves YouTube and Vimeo and ranks instead of deleting", () => {
  const source = read("src/features/trailers/trailerCandidateService.ts");
  assert.match(source, /normalized === 'youtube'/);
  assert.match(source, /normalized === 'vimeo'/);
  assert.match(source, /TITLE_PENALTIES/);
  assert.match(source, /official\) value \+= 500/);
  assert.doesNotMatch(source, /continue;.*reaction/s);
});

test("YouTube errors retain official public codes", () => {
  const source = read("src/features/trailers/trailerProviders.ts");
  for (const code of [2, 5, 100, 101, 150, 153]) assert.match(source, new RegExp(`numeric === ${code}`));
  assert.match(source, /category: 'client-identity'/);
  assert.match(source, /widget_referrer/);
});

test("trailer session bounds same-candidate retries and rotates", () => {
  const source = read("src/features/trailers/hooks/useTrailerSession.ts");
  assert.match(source, /MAX_SAME_CANDIDATE_RETRIES = 1/);
  assert.match(source, /attemptedRef\.current\.add/);
  assert.match(source, /setState\('exhausted'\)/);
});

test("modal is theme aware, safe-area aware, and supports both providers", () => {
  const source = read("src/components/TrailerModal.tsx");
  assert.match(source, /useOrionTheme/);
  assert.match(source, /useSafeAreaInsets/);
  assert.match(source, /createYouTubeHtml/);
  assert.match(source, /createVimeoHtml/);
  assert.match(source, /playerWidth \* 9 \/ 16/);
  assert.doesNotMatch(source, /ANDROID_YOUTUBE_USER_AGENT/);
});
