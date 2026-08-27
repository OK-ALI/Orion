const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const plugin = fs.readFileSync(path.join(ROOT, 'plugins', 'withOrionCinemaWebView.js'), 'utf8');
const runtime = fs.readFileSync(path.join(ROOT, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpRuntime.kt'), 'utf8');

test('P10.5 Candidate 2 adds a native-only fixed yt-dlp process boundary without routing production transfers', () => {
  assert.match(plugin, /'OrionDownloadYtDlpRuntime\.kt'/);
  assert.match(runtime, /internal object OrionDownloadYtDlpRuntime/);
  assert.match(runtime, /FFmpeg\.getInstance\(\)\.init\(appContext\)/);
  assert.match(runtime, /YoutubeDL\.getInstance\(\)\.init\(appContext\)/);
  assert.match(runtime, /YoutubeDLRequest\(rootUrl\)/);
  assert.match(runtime, /\.execute\(request, processId, false\)/);
  assert.match(runtime, /destroyProcessById\(processId\)/);
  assert.match(runtime, /orion-downloads\/partial\/\$\{cleanJobId\(jobId\) \?: "invalid"\}-ytdlp/);
  assert.match(runtime, /--socket-timeout/);
  assert.match(runtime, /--fragment-retries/);
  assert.match(runtime, /--concurrent-fragments/);
  assert.match(runtime, /--add-header/);
  assert.match(runtime, /bound\.root/);
  assert.match(runtime, /OrionDownloadOwnershipPolicy\.canonicalContained/);
  assert.doesNotMatch(runtime, /addCommands\(/);
  assert.doesNotMatch(runtime, /updateYoutubeDL/);
  assert.doesNotMatch(runtime, /com\.facebook\.react/);
  assert.doesNotMatch(runtime, /NativeModules/);
  assert.doesNotMatch(runtime, /response\.(?:out|err|command)/);
  assert.doesNotMatch(runtime, /Log\./);
});
