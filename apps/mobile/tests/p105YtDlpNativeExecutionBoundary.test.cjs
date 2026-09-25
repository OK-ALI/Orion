const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const plugin = fs.readFileSync(path.join(ROOT, 'plugins', 'withOrionCinemaWebView.js'), 'utf8');
const runtime = fs.readFileSync(path.join(ROOT, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpRuntime.kt'), 'utf8');
const owner = fs.readFileSync(path.join(ROOT, 'plugins', 'orion-cinema-webview-native', 'OrionFinalizedArtifactOwner.kt'), 'utf8');
const planner = fs.readFileSync(path.join(ROOT, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadFragmentPlanner.kt'), 'utf8');
const broker = fs.readFileSync(path.join(ROOT, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadRequestContextBroker.kt'), 'utf8');
const hlsGateway = fs.readFileSync(path.join(ROOT, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpHlsGateway.kt'), 'utf8');
const transfer = fs.readFileSync(path.join(ROOT, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadTransferRuntime.kt'), 'utf8');

test('P10.5 Candidate 2 keeps the native-only fixed yt-dlp process boundary without routing production transfers', () => {
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
  assert.match(runtime, /authority\.rootUrl/);
  assert.match(runtime, /authority\.safeGlobalHeaders/);
  assert.match(runtime, /OrionFinalizedArtifactOwner\.stagingOutput/);
  assert.match(owner, /OrionDownloadOwnershipPolicy\.canonicalContained/);
  assert.doesNotMatch(runtime, /addCommands\(/);
  assert.doesNotMatch(runtime, /updateYoutubeDL/);
  assert.doesNotMatch(runtime, /com\.facebook\.react/);
  assert.doesNotMatch(runtime, /NativeModules/);
  assert.doesNotMatch(runtime, /response\.(?:out|err|command)/);
  assert.match(runtime, /stage=yt-dlp exit=/);
  assert.doesNotMatch(runtime, /Log\.[a-z]+\([^\n]*(?:response\.(?:out|err)|rootUrl|safeGlobalHeaders)/);
});


test('HLS readiness descends wrapper playlists and never treats an init map as episode media', () => {
  assert.match(planner, /val mediaFragmentCount: Int/);
  assert.match(planner, /fun firstMediaFragment\(\)/);
  assert.match(broker, /probeFirstHlsMedia/);
  assert.match(planner, /isHlsPlaylistBody/);
  assert.match(broker, /OrionDownloadFragmentPlanner\.isHlsPlaylistBody/);
  assert.match(hlsGateway, /OrionDownloadFragmentPlanner\.isHlsPlaylistBody/);
  assert.match(broker, /hls-nested-playlist-limit/);
  assert.match(hlsGateway, /resolveNestedMediaPlaylist/);
  assert.match(hlsGateway, /plan\.mediaFragmentCount > 0/);
  assert.match(hlsGateway, /outcome=descend/);
  assert.match(transfer, /plan\.mediaFragmentCount <= 0/);
  assert.doesNotMatch(hlsGateway, /Log\.[a-z]+\([^\n]*(?:currentUrl|startUrl|onlyMedia\.url|rootUrl)/);
});


test('HLS playlist identity tolerates a UTF-8 BOM without turning the header into a media route', () => {
  assert.match(planner, /it == '\\uFEFF'/);
  assert.match(planner, /normalizeHlsLine/);
  assert.match(planner, /trimStart\('\\uFEFF'\)/);
  assert.match(hlsGateway, /removePrefix\("\\uFEFF"\)/);
  assert.doesNotMatch(hlsGateway, /fetchText\(bound, currentUrl, onlyMedia\.url\)[\s\S]{0,120}\?: return ResolvedMediaPlaylist/);
  assert.match(broker, /OrionDownloadFragmentPlanner\.isHlsPlaylistBody/);
});
