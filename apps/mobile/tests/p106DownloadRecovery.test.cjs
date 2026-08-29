const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('P10.6-D2 makes Pause durable and cancels scheduled recovery from both app and notification paths', () => {
  const module = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadEngineModule.kt');
  const service = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadForegroundService.kt');

  assert.match(module, /fun pauseJob\(jobId: String\)[\s\S]{0,500}requestControl\(clean, "pause"\)[\s\S]{0,300}setState\(clean, "paused"\)[\s\S]{0,300}OrionDownloadRecoveryScheduler\.cancel\(reactContext, clean\)/);
  assert.match(service, /ACTION_PAUSE -> \{[\s\S]{0,500}requestControl\(jobId, "pause"\)[\s\S]{0,300}setState\(jobId, "paused"\)[\s\S]{0,300}OrionDownloadRecoveryScheduler\.cancel\(applicationContext, jobId\)/);
});

test('P10.6-D2 recovery worker and transfer launch never override persisted user pause', () => {
  const worker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRecoveryWorker.kt');
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');

  assert.match(worker, /state in setOf\("completed", "cancelled", "unsupported", "protected", "paused"\)/);
  assert.match(worker, /control == "pause"/);

  const policyCheck = worker.indexOf('OrionDownloadRecoveryPolicy.shouldRemainIdle(state, control)');
  const localFinalization = worker.indexOf('hasCompleteLocalFinalization(applicationContext, jobId)');
  const runtimeEnsure = worker.indexOf('OrionDownloadTransferRuntime.ensure(candidateId, jobId)');
  assert.ok(policyCheck >= 0 && localFinalization > policyCheck && runtimeEnsure > localFinalization);

  const runJob = runtime.indexOf('fun runJob(context: android.content.Context, jobId: String)');
  const launchFence = runtime.indexOf('OrionDownloadRecoveryPolicy.shouldRemainIdle(', runJob);
  const finalization = runtime.indexOf('runVerifiedLocalFinalization(context, jobId)', runJob);
  assert.ok(runJob >= 0 && launchFence > runJob && finalization > launchFence);
});

test('P10.6-D2 separates explicit Resume from background recovery so recovery cannot clear pause', () => {
  const service = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadForegroundService.kt');

  assert.match(service, /const val ACTION_RECOVER = "com\.okali\.orion\.download\.RECOVER"/);
  assert.match(service, /ACTION_RESUME -> \{[\s\S]{0,400}clearControl\(jobId\)[\s\S]{0,300}setState\(jobId, "recovering"\)[\s\S]{0,300}OrionDownloadRecoveryScheduler\.schedule\(applicationContext, jobId\)/);
  assert.match(service, /ACTION_RECOVER -> \{[\s\S]{0,500}OrionDownloadRecoveryPolicy\.shouldRemainIdle/);
  assert.match(service, /action = if \(recovery\) ACTION_RECOVER else ACTION_START/);
  assert.doesNotMatch(service, /action = if \(recovery\) ACTION_RESUME else ACTION_START/);
});

test('P10.6-D2 preserves truthful process-death recovery without persisting request authority', () => {
  const broker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRequestContextBroker.kt');
  const runtime = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt');
  const worker = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadRecoveryWorker.kt');

  assert.match(broker, /In-memory, native-only download request-context broker/);
  assert.match(broker, /Raw URLs, request headers, cookies and authorization material never cross the/);
  assert.match(broker, /React bridge and are never persisted/);
  assert.match(broker, /private val contexts = LinkedHashMap<String, CapturedContext>\(\)/);
  assert.match(runtime, /private val contexts = mutableMapOf<String, BoundTransferContext>\(\)/);

  const localFinalization = worker.indexOf('hasCompleteLocalFinalization(applicationContext, jobId)');
  const ensure = worker.indexOf('OrionDownloadTransferRuntime.ensure(candidateId, jobId)');
  assert.ok(localFinalization >= 0 && ensure > localFinalization);

  assert.match(worker, /if \(runtime == null\) \{[\s\S]{0,500}"request-context-refresh-required"/);
  assert.match(worker, /Open the title and start playback again to refresh the download source/);
});

test('P10.6-D2 keeps explicit notification Resume while background recovery uses its own action', () => {
  const notifications = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadNotifications.kt');
  const service = read('plugins', 'orion-cinema-webview-native', 'OrionDownloadForegroundService.kt');

  assert.match(notifications, /"paused" -> builder\.addAction\([\s\S]{0,300}"Resume"[\s\S]{0,300}ACTION_RESUME/);
  assert.match(service, /ACTION_RESUME/);
  assert.match(service, /ACTION_RECOVER/);
});

test('P10.6-D2 durable and generated recovery owners remain byte-for-byte synchronized', () => {
  const pairs = [
    [
      'plugins/orion-cinema-webview-native/OrionDownloadRecoveryWorker.kt',
      'android/app/src/main/java/com/okali/orion/playback/OrionDownloadRecoveryWorker.kt',
    ],
    [
      'plugins/orion-cinema-webview-native/OrionDownloadForegroundService.kt',
      'android/app/src/main/java/com/okali/orion/playback/OrionDownloadForegroundService.kt',
    ],
    [
      'plugins/orion-cinema-webview-native/OrionDownloadEngineModule.kt',
      'android/app/src/main/java/com/okali/orion/playback/OrionDownloadEngineModule.kt',
    ],
    [
      'plugins/orion-cinema-webview-native/OrionDownloadTransferRuntime.kt',
      'android/app/src/main/java/com/okali/orion/playback/OrionDownloadTransferRuntime.kt',
    ],
  ];

  for (const [durable, generated] of pairs) {
    assert.equal(read(...durable.split('/')), read(...generated.split('/')), `${generated} must match its durable owner`);
  }
});
