const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("P4.2 persists only stable queue intent and never playback leases", () => {
  const contract = read("plugins/waven-playback-native/WavenPlaybackContract.kt");
  const store = read("plugins/waven-playback-native/WavenPlaybackRecoveryStore.kt");

  assert.match(contract, /EXTRA_RECOVERY_ITEM_JSON/);
  assert.match(contract, /streamingProvider/);
  assert.match(store, /getSharedPreferences\(PREFERENCES_NAME, Context\.MODE_PRIVATE\)/);
  assert.match(store, /WavenPlaybackContract\.recoveryJson/);
  assert.match(store, /WavenPlaybackContract\.recoveryMediaItem/);

  assert.doesNotMatch(store, /EXTRA_SOURCE_URI|EXTRA_SOURCE_HEADERS|sourceLeases|ResolvedPlaybackSource/);
  assert.doesNotMatch(store, /RoomDatabase|SQLite|Orion Cloud|writePortableProfile/i);
});

test("P4.2 restores queue position and policy paused with fresh source resolution required", () => {
  const service = read("plugins/waven-playback-native/WavenPlaybackService.kt");

  assert.match(service, /recoveryStore\.restore\(\)/);
  assert.match(service, /restored\.mediaItems/);
  assert.match(service, /restored\.currentIndex/);
  assert.match(service, /restored\.positionMs/);
  assert.match(service, /activePlayer\.repeatMode = restored\.repeatMode/);
  assert.match(service, /activePlayer\.shuffleModeEnabled = restored\.shuffleEnabled/);
  assert.match(service, /activePlayer\.playWhenReady = false/);
  assert.match(service, /WAVEN_SOURCE_UNRESOLVED/);
  assert.match(service, /POSITION_CHECKPOINT_MS = 5_000L/);
});

test("P4.2 exposes recovery intent to JS without introducing a second playback owner", () => {
  const module = read("plugins/waven-playback-native/WavenPlaybackModule.kt");
  const native = read("src/features/playback/native/WavenPlaybackNative.ts");
  const contracts = read("src/features/playback/contracts.ts");

  assert.match(module, /fun getRecoveryStateJson\(promise: Promise\)/);
  assert.match(native, /getPersistedPlaybackRecoveryState/);
  assert.match(native, /PlaybackRecoveryState/);
  assert.match(contracts, /interface PlaybackRecoveryState/);
  assert.match(contracts, /wasPlayWhenReady: boolean/);

  assert.doesNotMatch(module, /ExoPlayer\.Builder|MediaSession\.Builder/);
});

test("P4.2 classifies recovery actions instead of flattening every failure to unknown", () => {
  const module = read("plugins/waven-playback-native/WavenPlaybackModule.kt");
  const contracts = read("src/features/playback/contracts.ts");

  for (const code of [
    "source-unresolved",
    "source-expired",
    "network",
    "http",
    "not-found",
    "format",
    "permission",
    "authentication",
    "restricted",
    "decoder",
  ]) {
    assert.ok(module.includes(`\"${code}\"`), `native taxonomy missing ${code}`);
    assert.ok(contracts.includes(`\"${code}\"`), `TS taxonomy missing ${code}`);
  }

  assert.match(module, /"source-unresolved", "source-expired" -> "resolve-source"/);
  assert.match(module, /"network", "http" -> "retry"/);
  assert.match(module, /"authentication" -> "reauthenticate"/);
  assert.match(module, /putString\("retryAction", retryAction\)/);
});

test("P4.2 config plugin copies the recovery owner into generated Android output", () => {
  const plugin = read("plugins/withWavenPlayback.js");

  assert.match(plugin, /"WavenPlaybackRecoveryStore\.kt"/);
  assert.equal((plugin.match(/MEDIA3_VERSION/g) || []).length >= 2, true);
});
