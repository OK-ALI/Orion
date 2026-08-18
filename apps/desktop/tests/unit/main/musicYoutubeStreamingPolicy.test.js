const test = require("node:test");
const assert = require("node:assert/strict");

const {
  YOUTUBE_STREAMING_PLAYER_CLIENT,
  buildYoutubeMusicResolveArgs,
} = require("../../../src/main/music/providers/ytmusic");

test("Music streaming isolates the current YouTube workaround to the normal Android client", () => {
  assert.equal(YOUTUBE_STREAMING_PLAYER_CLIENT, "android");

  const args = buildYoutubeMusicResolveArgs("5Eqb_-j3FDA");
  const extractorIndex = args.indexOf("--extractor-args");

  assert.ok(extractorIndex >= 0);
  assert.equal(args[extractorIndex + 1], "youtube:player_client=android");
});

test("Music streaming keeps the existing resolution and format contract", () => {
  const args = buildYoutubeMusicResolveArgs("5Eqb_-j3FDA");

  assert.equal(args[0], "https://music.youtube.com/watch?v=5Eqb_-j3FDA");
  assert.ok(args.includes("--dump-single-json"));
  assert.ok(args.includes("--skip-download"));
  assert.ok(args.includes("--no-playlist"));
  assert.ok(args.includes("--no-warnings"));

  const formatIndex = args.indexOf("--format");
  assert.ok(formatIndex >= 0);
  assert.equal(args[formatIndex + 1], "bestaudio[ext=m4a]/bestaudio/best");
});
