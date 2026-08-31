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

test("P10.7 SAF publication is exclusive-first, single-owner, bounded, and still deeply verified", () => {
  const owner = read("plugins", "orion-cinema-webview-native", "OrionFinalizedArtifactOwner.kt");
  const policy = read("plugins", "orion-cinema-webview-native", "OrionSafPublicationWritePolicy.kt");
  const exclusive = owner.indexOf('openOutputStream(document, "w")');
  const seekable = owner.indexOf('openFileDescriptor(document, "rwt")');
  assert.ok(exclusive >= 0 && seekable > exclusive);
  assert.match(owner, /shouldFallbackToSeekable\(false, 0L\)/);
  assert.match(owner, /ParcelFileDescriptor\.AutoCloseOutputStream\(descriptor\)/);
  assert.doesNotMatch(owner, /descriptor\.use[\s\S]{0,160}FileOutputStream\(descriptor\.fileDescriptor\)/);
  assert.match(owner, /SyncOutcome\.FAILED/);
  assert.match(owner, /CloseOutcome\.FAILED/);
  assert.match(owner, /awaitDocumentInfo/);
  assert.match(owner, /awaitReadableDescriptor/);
  assert.match(owner, /DocumentInfoReadiness\.Cancelled[\s\S]{0,180}OrionFinalizedDocumentSettlement\.Cancelled/);
  assert.match(owner, /awaitDocumentInfo\(context, document, expectedBytes\)/);
  assert.match(policy, /enum class ReadinessDecision \{ READY, RETRY, FAILED, CANCELLED \}/);
  assert.match(policy, /observedBytes == expectedBytes -> ReadinessProbe\.READY/);
  assert.match(policy, /!canContinue -> ReadinessDecision\.CANCELLED/);
  assert.match(owner, /rename-fallback-created/);
  assert.match(owner, /rename-fallback-copied/);
  assert.match(owner, /verifyDocument\([\s\S]{0,350}sourceDigest/);
  assert.match(owner, /acceptsAfterDeepVerification\([\s\S]{0,160}written\.closeOutcome[\s\S]{0,80}true/);
  assert.match(owner, /finalized-artifact-\$\{OrionSafPublicationWritePolicy\.failureCode\(write\.stage\)\}/);
  assert.match(policy, /!exclusiveStreamOpened && bytesWritten == 0L/);
  assert.match(policy, /100L, 200L, 400L, 800L, 1_500L/);
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

test("P10.7 finalized MediaPlayer seeking requires frame-backed convergence and one bounded fallback", () => {
  const activity = read("plugins", "orion-cinema-webview-native", "OrionPlayerActivity.kt");
  const policy = read("plugins", "orion-cinema-webview-native", "OrionMediaPlayerSeekPolicy.kt");
  assert.match(activity, /class OrionPlayerActivity : Activity\(\), TextureView\.SurfaceTextureListener/);
  assert.match(activity, /val player = MediaPlayer\(\)/);
  assert.match(activity, /setOnSeekCompleteListener/);
  assert.match(activity, /MediaPlayer\.SEEK_CLOSEST_SYNC/);
  assert.match(activity, /MediaPlayer\.SEEK_CLOSEST/);
  assert.match(policy, /attempt == Attempt\.PRIMARY -> Mode\.CLOSEST_SYNC/);
  assert.match(policy, /else -> Mode\.CLOSEST/);
  assert.match(policy, /enum class Decision \{ WAIT, SETTLE, FALLBACK, TIMED_OUT \}/);
  assert.match(policy, /fun withFallback\(request: Request\): Request = request\.copy\(attempt = Attempt\.FALLBACK\)/);
  assert.doesNotMatch(activity, /Build\.MANUFACTURER|Build\.MODEL|Xiaomi|Redmi/i);
  assert.doesNotMatch(activity, /androidx\.media3|ExoPlayer/);

  const requestSeek = activity.slice(
    activity.indexOf("private fun requestSeek("),
    activity.indexOf("private fun issuePendingSeek("),
  );
  const issueSeek = activity.slice(
    activity.indexOf("private fun issuePendingSeek("),
    activity.indexOf("private fun handleSeekComplete("),
  );
  assert.match(requestSeek, /deadlineUptimeMs = OrionMediaPlayerSeekPolicy\.deadline\(now\)/);
  assert.match(requestSeek, /if \(player\.isPlaying\) player\.pause\(\)/);
  assert.match(requestSeek, /postDelayed\(seekTimeoutRunnable, OrionMediaPlayerSeekPolicy\.SEEK_TIMEOUT_MS\)/);
  assert.doesNotMatch(issueSeek, /postDelayed\(seekTimeoutRunnable|removeCallbacks\(seekTimeoutRunnable/);
  assert.match(activity, /onSurfaceTextureUpdated[\s\S]{0,160}surfaceFrameGeneration \+= 1L/);
  assert.match(activity, /beginObservation\([\s\S]{0,120}issued,[\s\S]{0,120}surfaceFrameGeneration/);
  assert.match(activity, /postDelayed\(observationPoll, OrionMediaPlayerSeekPolicy\.OBSERVATION_INTERVAL_MS\)/);
  assert.match(activity, /displayPosition\(actualPosition, pendingSeek\?\.targetMs\)/);
  assert.match(activity, /if \(!trackingSeekBar && duration > 0L\)/);
  assert.match(activity, /pendingSeek = OrionMediaPlayerSeekPolicy\.Request/);
  assert.match(activity, /OrionMediaPlayerSeekPolicy\.Decision\.FALLBACK/);
  assert.match(activity, /Decision\.WAIT -> scheduleSeekObservation\(player, active\)/);
  assert.match(activity, /Decision\.TIMED_OUT -> finishPendingSeek\(timedOut = true\)/);
  assert.match(activity, /private fun finishPendingSeekFromTimeout\(\)/);
  assert.match(activity, /Couldn’t seek to that time/);
  assert.match(policy, /OBSERVATION_INTERVAL_MS = 100L/);
  assert.match(policy, /PRIMARY_FALLBACK_WAIT_MS = 1_500L/);
  assert.match(policy, /callbackSurfaceFrameGeneration = callbackSurfaceFrameGeneration\.coerceAtLeast/);
  assert.match(policy, /surfaceFrameGeneration > observation\.callbackSurfaceFrameGeneration/);
  assert.match(policy, /nearSamples >= 2/);
  assert.match(policy, /stableFarSamples >= 2/);
  assert.match(policy, /deadlineUptimeMs: Long/);
  assert.match(policy, /remainingMs\(request, nowUptimeMs\)/);
  assert.match(policy, /fun displayPosition\(actualPositionMs: Long, pendingTargetMs: Long\?\): Long/);
  assert.match(policy, /\(durationMs \/ progressMax\) \* boundedProgress/);
  assert.match(activity, /updateSubtitle\(actualPosition\)/);
});

test("P10.7 pending seek coalesces latest target and fences stale native callbacks", () => {
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
  assert.match(activity, /private var issuedSeek: OrionMediaPlayerSeekPolicy\.IssuedAttempt\? = null/);
  assert.match(activity, /val playWhenSettled = pendingSeek\?\.playWhenSettled[\s\S]{0,100}player\.isPlaying/);
  assert.match(activity, /if \(issuedSeek != null\) return/);
  assert.match(activity, /val issued = issuedSeek \?: return/);
  assert.match(activity, /issuedSeek = null[\s\S]{0,320}!OrionMediaPlayerSeekPolicy\.matchesAttempt\(request, issued\)[\s\S]{0,240}issuePendingSeek\(player\)/);
  assert.match(policy, /request\.generation == issued\.generation/);
  assert.match(policy, /request\.playerGeneration == issued\.playerGeneration/);
  assert.match(policy, /request\.attempt == issued\.attempt/);
});

test("P10.7 pending seek playback intent owns the Play or Pause presentation", () => {
  const activity = read("plugins", "orion-cinema-webview-native", "OrionPlayerActivity.kt");
  const updateProgress = activity.slice(
    activity.indexOf("private fun updateProgress("),
    activity.indexOf("private fun updatePlayPausePresentation("),
  );
  const presentation = activity.slice(
    activity.indexOf("private fun updatePlayPausePresentation("),
    activity.indexOf("private fun togglePlaybackDuringPendingSeek("),
  );
  const toggle = activity.slice(
    activity.indexOf("private fun togglePlaybackDuringPendingSeek("),
    activity.indexOf("private fun requestSeek("),
  );

  assert.match(updateProgress, /updatePlayPausePresentation\(player\)/);
  assert.doesNotMatch(updateProgress, /playPauseView\.text\s*=|player\.isPlaying/);
  assert.match(presentation, /val pendingPlayIntent = pendingSeek\?\.playWhenSettled/);
  assert.match(presentation, /pendingPlayIntent != null -> if \(pendingPlayIntent\) "Pause" else "Play"/);
  assert.match(presentation, /player\.isPlaying[\s\S]{0,80}-> "Pause"/);
  assert.match(presentation, /completed -> "Replay"/);
  assert.match(presentation, /else -> "Play"/);
  assert.match(toggle, /pendingSeek = OrionMediaPlayerSeekPolicy\.withPlayIntent\(request, playWhenSettled\)/);
  assert.match(toggle, /updatePlayPausePresentation\(player\)/);
  assert.doesNotMatch(toggle, /playPauseView\.text\s*=\s*if \(playWhenSettled\)/);
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
