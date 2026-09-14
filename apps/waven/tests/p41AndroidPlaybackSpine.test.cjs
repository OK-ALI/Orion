const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("P4.1 declares one WAVEN native MediaSessionService playback owner", () => {
  const appJson = JSON.parse(read("app.json"));
  const plugin = read("plugins/withWavenPlayback.js");
  const service = read("plugins/waven-playback-native/WavenPlaybackService.kt");
  const module = read("plugins/waven-playback-native/WavenPlaybackModule.kt");

  assert.ok(appJson.expo.plugins.includes("./plugins/withWavenPlayback.js"));
  assert.match(service, /class WavenPlaybackService : MediaSessionService\(\)/);
  assert.match(service, /ExoPlayer\.Builder\(this\)/);
  assert.match(service, /MediaSession\.Builder\(this, activePlayer\)/);
  assert.match(module, /MediaController\.Builder\(reactContext, token\)\.buildAsync\(\)/);

  assert.doesNotMatch(module, /ExoPlayer\.Builder|MediaSession\.Builder/);
  assert.equal((plugin.match(/WavenPlaybackService/g) || []).length >= 1, true);
});

test("P4.1 pins the locally proven Media3 generation without touching npm dependencies", () => {
  const plugin = read("plugins/withWavenPlayback.js");
  const packageJson = JSON.parse(read("package.json"));

  assert.match(plugin, /const MEDIA3_VERSION = "1\.9\.0"/);
  assert.match(plugin, /media3-exoplayer:\$\{MEDIA3_VERSION\}/);
  assert.match(plugin, /media3-session:\$\{MEDIA3_VERSION\}/);
  assert.match(plugin, /media3-datasource:\$\{MEDIA3_VERSION\}/);
  assert.equal(packageJson.dependencies["expo-audio"], "57.0.4");
});

test("P4.1 keeps queue intent stable while resolved sources remain ephemeral", () => {
  const contracts = read("src/features/playback/contracts.ts");
  const service = read("plugins/waven-playback-native/WavenPlaybackService.kt");

  assert.match(contracts, /interface PlaybackQueueIntentItem/);
  assert.match(contracts, /interface ResolvedPlaybackSource/);
  assert.match(contracts, /resolvedSource\?: ResolvedPlaybackSource \| null/);
  assert.match(service, /ConcurrentHashMap<String, WavenPlaybackContract\.SourceLease>/);
  assert.match(service, /WAVEN_SOURCE_UNRESOLVED/);
  assert.match(service, /WAVEN_SOURCE_EXPIRED/);
  assert.match(
    service,
    /setRequestMetadata\(MediaItem\.RequestMetadata\.Builder\(\)\.build\(\)\)/,
  );
  assert.match(service, /private val sourceLeases/);

  assert.doesNotMatch(service, /SharedPreferences|RoomDatabase|SQLite|writeText|FileOutputStream/);
});

test("P4.1 allows standard next and previous commands by using a real Media3 queue", () => {
  const expoCallbackEvidence = read(
    "../../node_modules/expo-audio/android/src/main/java/expo/modules/audio/service/AudioMediaSessionCallback.kt",
  );
  const module = read("plugins/waven-playback-native/WavenPlaybackModule.kt");

  assert.match(
    expoCallbackEvidence,
    /\.remove\(Player\.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM\)/,
  );
  assert.match(
    expoCallbackEvidence,
    /\.remove\(Player\.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM\)/,
  );

  assert.match(module, /active\.seekToNextMediaItem\(\)/);
  assert.match(module, /active\.seekToPreviousMediaItem\(\)/);
  assert.match(module, /WavenPlaybackService\.registerSource\(queueId, lease\)/);
});

test("P4.1 delegates audio focus and becoming-noisy handling to ExoPlayer", () => {
  const service = read("plugins/waven-playback-native/WavenPlaybackService.kt");

  assert.match(
    service,
    /\.setAudioAttributes\([\s\S]*?true,[\s\S]*?\)/,
  );
  assert.match(service, /\.setHandleAudioBecomingNoisy\(true\)/);
  assert.match(service, /\.setWakeMode\(C\.WAKE_MODE_NETWORK\)/);
});

test("P4.1 configures targetSdk 36 foreground media playback requirements", () => {
  const plugin = read("plugins/withWavenPlayback.js");

  for (const permission of [
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
    "android.permission.WAKE_LOCK",
  ]) {
    assert.ok(plugin.includes(permission), `missing ${permission}`);
  }

  assert.match(plugin, /android:foregroundServiceType": "mediaPlayback"/);
  assert.match(plugin, /androidx\.media3\.session\.MediaSessionService/);
});

test("P4.1 does not copy Electron playback architecture or introduce Cloud writes", () => {
  const files = [
    read("src/features/playback/contracts.ts"),
    read("src/features/playback/native/WavenPlaybackNative.ts"),
    read("plugins/withWavenPlayback.js"),
    read("plugins/waven-playback-native/WavenPlaybackContract.kt"),
    read("plugins/waven-playback-native/WavenPlaybackModule.kt"),
    read("plugins/waven-playback-native/WavenPlaybackService.kt"),
  ].join("\n");

  assert.doesNotMatch(
    files,
    /electron|child_process|orion-music:\/\/|HTMLAudioElement|AudioContext|writePortableProfile/i,
  );
});
