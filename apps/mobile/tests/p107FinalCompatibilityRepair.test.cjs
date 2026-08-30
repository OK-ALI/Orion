"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("P10.7 production Android bundling fails closed without every required public runtime value", () => {
  const config = require(path.join(root, "scripts", "orion-google-production-config.cjs"));
  const google = "1234567890-orion_test.apps.googleusercontent.com";
  const tmdb = "eyJ0ZXN0IjoidG1kYiJ9.eyJhdWQiOiJvcmlvbiJ9.c2lnbmF0dXJl";
  const environment = {
    EXPO_PUBLIC_ORION_GOOGLE_WEB_CLIENT_ID: google,
    EXPO_PUBLIC_TMDB_READ_TOKEN: tmdb,
  };
  assert.deepEqual(config.requireMobileProductionConfig(root, environment), {
    googleWebClientId: google,
    tmdbReadToken: tmdb,
  });
  assert.equal(environment.EXPO_PUBLIC_ORION_GOOGLE_WEB_CLIENT_ID, google);
  assert.equal(environment.EXPO_PUBLIC_TMDB_READ_TOKEN, tmdb);
  assert.deepEqual(config.REQUIRED_MOBILE_BUNDLED_ENV, [
    "EXPO_PUBLIC_ORION_GOOGLE_WEB_CLIENT_ID",
    "EXPO_PUBLIC_TMDB_READ_TOKEN",
  ]);
  const emptyProject = fs.mkdtempSync(path.join(os.tmpdir(), "orion-google-env-"));
  try {
    assert.throws(
      () => config.requireMobileProductionConfig(emptyProject, {}),
      /must contain a valid Google Web OAuth client ID/,
    );
    assert.throws(
      () => config.requireMobileProductionConfig(emptyProject, {
        EXPO_PUBLIC_ORION_GOOGLE_WEB_CLIENT_ID: google,
      }),
      /must contain a valid TMDB API read token/,
    );
  } finally {
    fs.rmSync(emptyProject, { recursive: true, force: true });
  }
  assert.throws(
    () => config.requireMobileProductionConfig(root, {
      EXPO_PUBLIC_ORION_GOOGLE_WEB_CLIENT_ID: "not-a-client",
      EXPO_PUBLIC_TMDB_READ_TOKEN: tmdb,
    }),
    /must contain a valid Google Web OAuth client ID/,
  );

  const standalone = read("scripts", "build-android-standalone.cjs");
  const syncExit = standalone.indexOf('process.argv.includes("--sync-native-only")');
  const requireConfig = standalone.indexOf("requireMobileProductionConfig(projectDirectory)");
  const bundle = standalone.indexOf('"export:embed"');
  const verify = standalone.indexOf("verifyMobileProductionConfigEmbedded(embeddedBundle, mobileProductionConfig)");
  assert.ok(syncExit >= 0 && requireConfig > syncExit && bundle > requireConfig && verify > bundle);
  assert.doesNotMatch(standalone, /console\.(?:log|error)\([^\n]*(?:googleWebClientId|tmdbReadToken)/);
});

test("P10.7 verifies Google and TMDB configuration in the embedded bundle without logging values", () => {
  const config = require(path.join(root, "scripts", "orion-google-production-config.cjs"));
  const google = "1234567890-orion_test.apps.googleusercontent.com";
  const tmdb = "eyJ0ZXN0IjoidG1kYiJ9.eyJhdWQiOiJvcmlvbiJ9.c2lnbmF0dXJl";
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "orion-google-bundle-"));
  const bundle = path.join(directory, "index.android.bundle");
  try {
    fs.writeFileSync(bundle, Buffer.from(`prefix:${google}:${tmdb}:suffix`, "utf8"));
    assert.doesNotThrow(() => config.verifyMobileProductionConfigEmbedded(bundle, {
      googleWebClientId: google,
      tmdbReadToken: tmdb,
    }));
    fs.writeFileSync(bundle, Buffer.from("missing", "utf8"));
    assert.throws(
      () => config.verifyMobileProductionConfigEmbedded(bundle, {
        googleWebClientId: google,
        tmdbReadToken: tmdb,
      }),
      /missing a required Orion public runtime configuration value/,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }

  const context = read("src", "context", "AccountContext.tsx");
  const settings = read("src", "features", "settings", "AccountSettingsContent.tsx");
  const layout = read("app", "_layout.tsx");
  assert.match(layout, /process\.env\.EXPO_PUBLIC_TMDB_READ_TOKEN/);
  assert.doesNotMatch(layout, /DEFAULT_TMDB_TOKEN|eyJhbGciOiJIUzI1NiJ9/);
  assert.match(context, /GOOGLE_CLIENT_ID_MISSING/);
  assert.match(context, /This Orion build is missing its Google sign-in configuration/);
  assert.match(settings, /This Orion build is missing its Google sign-in configuration/);
});

test("P10.7 SAF publication falls back only before writes and still requires the full destination proof", () => {
  const owner = read("plugins", "orion-cinema-webview-native", "OrionFinalizedArtifactOwner.kt");
  const policy = read("plugins", "orion-cinema-webview-native", "OrionSafPublicationWritePolicy.kt");
  assert.match(owner, /openFileDescriptor\(document, "rwt"\)/);
  assert.match(owner, /openOutputStream\(document, "w"\)/);
  assert.match(owner, /shouldFallbackToExclusive\(false, 0L\)/);
  assert.match(owner, /SyncOutcome\.FAILED/);
  assert.match(owner, /verifyDocument\([\s\S]{0,350}sourceDigest/);
  assert.match(owner, /acceptsAfterDeepVerification\(written\.syncOutcome, true\)/);
  assert.match(owner, /finalized-artifact-\$\{OrionSafPublicationWritePolicy\.failureCode\(write\.stage\)\}/);
  assert.match(policy, /!seekableDescriptorOpened && bytesWritten == 0L/);
  assert.doesNotMatch(policy, /Uri|content:\/\/|File\(/);
});

test("P10.7 recovering downloads expose deterministic manual Retry now instead of Pause", () => {
  const activity = read("src", "features", "downloads", "DownloadActivityList.tsx");
  const module = read("plugins", "orion-cinema-webview-native", "OrionDownloadEngineModule.kt");
  assert.match(activity, /const canPause = job\.state === 'downloading';/);
  assert.match(activity, /job\.state === 'recovering' \|\| \(FAILED_STATES\.has\(job\.state\) && job\.failure\?\.retryable\)/);
  assert.match(activity, /retryLabel: 'Retry now'/);

  const resume = module.slice(module.indexOf("fun resumeJob("), module.indexOf("fun retryJob("));
  const cancel = resume.indexOf("OrionDownloadRecoveryScheduler.cancel(reactContext, clean)");
  const local = resume.indexOf("hasCompleteLocalFinalization(reactContext, clean)");
  const service = resume.indexOf("OrionDownloadForegroundService.start(reactContext, clean, recovery = true)");
  assert.ok(cancel >= 0 && local > cancel && service > local);
});

test("P10.7 finalized MediaPlayer seeking keeps target progress authoritative until Android really settles", () => {
  const activity = read("plugins", "orion-cinema-webview-native", "OrionPlayerActivity.kt");
  const policy = read("plugins", "orion-cinema-webview-native", "OrionMediaPlayerSeekPolicy.kt");
  assert.match(activity, /setOnSeekCompleteListener/);
  assert.match(activity, /MediaPlayer\.SEEK_CLOSEST_SYNC/);
  assert.match(activity, /postDelayed\(seekTimeoutRunnable, OrionMediaPlayerSeekPolicy\.SEEK_TIMEOUT_MS\)/);
  assert.match(activity, /postDelayed\(confirmation, OrionMediaPlayerSeekPolicy\.SEEK_CONFIRMATION_DELAY_MS\)/);
  assert.match(activity, /displayPosition\(actualPosition, pendingSeek\?\.targetMs\)/);
  assert.match(activity, /if \(!trackingSeekBar && duration > 0L\)/);
  assert.match(activity, /pendingSeek = OrionMediaPlayerSeekPolicy\.Request/);
  assert.match(activity, /OrionMediaPlayerSeekPolicy\.Completion\.REISSUE/);
  assert.match(activity, /OrionMediaPlayerSeekPolicy\.Completion\.AWAIT_TIMEOUT/);
  assert.match(activity, /AWAIT_TIMEOUT ->[\s\S]{0,120}scheduleSeekConfirmation\(player, active\)/);
  assert.match(activity, /private fun finishPendingSeekFromTimeout\(\)/);
  assert.match(activity, /finishPendingSeek\(timedOut = !settled\)/);
  assert.match(activity, /Couldn’t seek to that time/);
  assert.doesNotMatch(activity, /player\.seekTo\(target\.toInt\(\)\)[\s\S]{0,120}seekingByUser = false/);
  assert.match(policy, /SEEK_CONFIRMATION_DELAY_MS = 150L/);
  assert.match(policy, /request\.reissues < MAX_REISSUES/);
  assert.match(policy, /Completion\.AWAIT_TIMEOUT/);
  assert.match(policy, /fun displayPosition\(actualPositionMs: Long, pendingTargetMs: Long\?\): Long/);
  assert.match(policy, /\(durationMs \/ progressMax\) \* boundedProgress/);
});


test("P10.7 pending seek keeps the latest explicit play or pause intent", () => {
  const activity = read("plugins", "orion-cinema-webview-native", "OrionPlayerActivity.kt");
  const policy = read("plugins", "orion-cinema-webview-native", "OrionMediaPlayerSeekPolicy.kt");
  const playControl = activity.slice(
    activity.indexOf('playPauseView = button("Play", primary = true)'),
    activity.indexOf('positionView = TextView'),
  );
  assert.match(playControl, /togglePlaybackDuringPendingSeek\(player\)/);
  const toggle = activity.slice(
    activity.indexOf("private fun togglePlaybackDuringPendingSeek("),
    activity.indexOf("private fun requestSeek("),
  );
  assert.match(toggle, /pendingSeek = OrionMediaPlayerSeekPolicy\.withPlayIntent\(request, playWhenSettled\)/);
  assert.match(toggle, /if \(!playWhenSettled\)[\s\S]*player\.pause\(\)/);
  assert.match(toggle, /resumeAfterPause = false/);
  assert.match(policy, /fun withPlayIntent\(request: Request, playWhenSettled: Boolean\): Request/);
});

test("P10.7 Locate browses the persisted tree without reopening directory-selection configuration", () => {
  const manager = read("plugins", "orion-cinema-webview-native", "OrionDownloadArtifactManager.kt");
  const locate = manager.slice(
    manager.indexOf("if (locate) {"),
    manager.indexOf("val mime =", manager.indexOf("if (locate) {")),
  );
  assert.match(locate, /launchLocate\(context, tree\)/);
  assert.match(locate, /artifact-locate-unavailable/);
  assert.doesNotMatch(locate, /launch\(context, tree/);
  assert.match(manager, /Intent\(Intent\.ACTION_OPEN_DOCUMENT\)/);
  assert.match(manager, /addCategory\(Intent\.CATEGORY_OPENABLE\)/);
  assert.match(manager, /type = "video\/mp4"/);
  assert.match(manager, /putExtra\(DocumentsContract\.EXTRA_INITIAL_URI, treeUri\)/);
  assert.doesNotMatch(manager, /ACTION_OPEN_DOCUMENT_TREE/);
});

test("P10.7 new production and JVM policy owners are included in hash-verified synchronization", () => {
  const plugin = read("plugins", "withOrionCinemaWebView.js");
  for (const owner of [
    "OrionSafPublicationWritePolicy.kt",
    "OrionMediaPlayerSeekPolicy.kt",
    "OrionSafPublicationWritePolicyTest.kt",
    "OrionMediaPlayerSeekPolicyTest.kt",
  ]) assert.match(plugin, new RegExp(owner.replaceAll(".", "\\.")));
});
