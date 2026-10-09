const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const { loader, read } = require('./helpers/animeModules.cjs');
const load = loader(), diagnostic = load('apps/mobile/src/features/playback/aniEmbedRuntimeDiagnostics.ts');
const bridge = load('apps/mobile/src/features/playback/embeddedTelemetry.ts');
const support = load('apps/mobile/src/features/playback/providerEmbedSupport.ts');
const client = read('apps/mobile/plugins/orion-cinema-webview-native/OrionCinemaWebViewClient.kt');
const nativeScript = /private val WRAPPER_DIAGNOSTIC_SCRIPT = """([\s\S]+?)"""\.trimIndent\(\)/.exec(client)[1];
const plain = value => JSON.parse(JSON.stringify(value));
function video(patch = {}) {
  return { currentTime: 45, duration: 1440, paused: false, seeking: false, isConnected: true,
    readyState: 4, networkState: 2, error: null, getBoundingClientRect: () => ({width: 1280, height: 720}), ...patch };
}
function host(videos = [video()]) {
  const document = { readyState: 'complete', contentType: 'text/html', body: {children: []},
    getElementById: () => null, querySelector: () => videos[0] || null,
    querySelectorAll: selector => selector === 'video' ? videos : [] };
  const window = { location: new URL('https://aniembed.se/e/21175/1?lang=sub&t=0') };
  const context = vm.createContext({window, document, URL});
  vm.runInContext(diagnostic.createAniEmbedRuntimeDiagnosticScript(), context);
  window.__orionPlaybackTelemetry = { sourceId: 'aniembed', diagnostics: context.aniEmbedDiagnostics };
  return { context, window, document, diag: context.aniEmbedDiagnostics, videos };
}
test('passive media observation reports the opening loop without issuing playback or seek commands', () => {
  const current = video({ paused: true, seeking: true, error: {code: 3} });
  for (const name of ['play', 'pause', 'load', 'addEventListener']) current[name] = () => assert.fail(name);
  let time = 45;
  Object.defineProperty(current, 'currentTime', {get: () => time, set: () => assert.fail('seek')});
  const h = host([current]);
  h.diag.observe(current, 'pause'); time = 0; h.diag.observe(current, 'seeking'); time = 45; h.diag.observe(current, 'seeked');
  const result = plain(h.diag.snapshot());
  assert.deepEqual(result.history.map(row => [row.event, row.time]), [['pause',45],['seeking',0],['seeked',45]]);
  assert.equal(result.hostSeekRequests, 0); assert.equal(result.videos[0].error, 3);
  assert.equal(result.videos[0].ready, 4); assert.equal(result.videos[0].network, 2);
});
test('media identity stays stable and replacement is distinguishable from repeated events', () => {
  const h = host(), first = h.diag.snapshot();
  h.diag.observe(h.videos[0], 'seeking');
  assert.equal(h.diag.snapshot().firstChanges, first.firstChanges);
  h.videos[0] = video(); const next = h.diag.snapshot();
  assert.notEqual(next.firstId, first.firstId); assert.equal(next.firstChanges, first.firstChanges + 1);
  h.videos.length = 0; assert.equal(h.diag.snapshot().firstId, 0);
});
test('numeric diagnostics are bounded and never read media URLs, payload text, credentials or storage', () => {
  const current = video({currentTime: Infinity, duration: -1, readyState: 99, networkState: NaN,
    error: {code: 999, message: 'PRIVATE'}, getBoundingClientRect: () => ({width: -1, height: Infinity})});
  for (const key of ['src', 'currentSrc', 'innerHTML', 'textContent']) Object.defineProperty(current, key, {get: () => assert.fail(key)});
  const h = host(Array(8).fill(current));
  for (let i = 0; i < 100; i++) { h.diag.observe(current, 'pause'); h.diag.noteHostSeek(123); }
  h.diag.observe(current, 'PRIVATE_EVENT');
  const result = plain(h.diag.snapshot());
  assert.equal(result.videos.length, 4); assert.equal(result.history.length, 6);
  assert.deepEqual(result.events, {pause:64}); assert.equal(result.hostSeekRequests, 64); assert.equal(result.lastHostTarget, 123);
  for (const key of ['time','duration','ready','network','error','width','height']) assert.equal(result.videos[0][key], null);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|currentSrc|cookie|token|url/i);
  h.diag.observe(video({getBoundingClientRect: () => {throw Error('PRIVATE');}}), 'pause');
});
test('actual native snapshot exposes AniEmbed media only for its selected bridge and exact HTTPS origin', () => {
  const h = host();
  const snapshot = () => JSON.parse(vm.runInContext(nativeScript, h.context));
  assert.equal(snapshot().media.videos[0].time, 45); assert.equal(snapshot().selectedBridge, true);
  for (const origin of ['http://aniembed.se', 'https://aniembed.se.evil.invalid', 'https://orion.local']) {
    h.window.location = new URL(origin); assert.equal(snapshot().media, undefined);
  }
  h.window.location = new URL('https://aniembed.se');
  h.window.__orionPlaybackTelemetry.sourceId = 'vixsrc'; assert.equal(snapshot().media, undefined);
});
test('host seek counter prefix preserves the original resume script and cannot seek or play by itself', () => {
  const original = load('apps/mobile/src/features/playback/mobileAdBlocker.ts').createVerifiedResumeScript(120, 'attempt');
  const script = support.createProviderResumeScript('aniembed', 120, 'attempt');
  assert.ok(script.endsWith(original)); const prefix = script.slice(0, -original.length);
  const h = host(); vm.runInContext(prefix, h.context);
  assert.equal(h.diag.snapshot().hostSeekRequests, 1); assert.equal(h.diag.snapshot().lastHostTarget, 120);
  assert.equal(h.videos[0].currentTime, 45); assert.equal(h.window.owner, undefined);
  h.window.__orionPlaybackTelemetry.sourceId = 'anilink'; vm.runInContext(prefix, h.context);
  assert.equal(h.diag.snapshot().hostSeekRequests, 1);
  delete h.window.__orionPlaybackTelemetry; vm.runInContext(prefix, h.context);
  for (const id of ['anilink','vixsrc','vidsrc','vidsrc-ir','vidlink','vidnest'])
    assert.equal(support.createProviderResumeScript(id, 120, 'attempt'), original);
});
test('diagnostic additions keep existing telemetry lifecycle and message output unchanged', () => {
  const h = host(); let timer, stopped = false; const messages = [], listeners = new Map();
  h.videos[0].addEventListener = (name, callback) => listeners.set(name, callback);
  h.window.ReactNativeWebView = {postMessage: raw => messages.push(JSON.parse(raw))};
  h.window.addEventListener = () => {}; h.window.removeEventListener = () => {};
  h.context.setInterval = callback => {timer = callback; return 1;}; h.context.clearInterval = () => {stopped = true;};
  const script = bridge.createEmbeddedTelemetryScript({sessionId:'current', sourceId:'aniembed', strategy:'frame-video', expectedOrigins:['https://aniembed.se']});
  vm.runInContext(script, h.context); assert.equal(messages[0].state, 'playing');
  const owner = h.window.__orionPlaybackTelemetry; vm.runInContext(script, h.context);
  assert.equal(h.window.__orionPlaybackTelemetry, owner); assert.equal(messages.length, 1);
  h.videos[0].paused = true; listeners.get('pause')(); timer();
  assert.deepEqual(messages.map(row => row.state), ['playing','paused','paused']);
  assert.deepEqual(messages.map(row => row.sequence), [1,2,3]);
  assert.equal(owner.diagnostics.snapshot().events.pause, 1);
  owner.stop(); assert.equal(stopped, true);
});
test('native capture keeps bounded redaction, session cleanup and download-disabled admission', () => {
  assert.match(client, /it\.sourceId in listOf\("anilink", "aniembed"\) && it\.downloadCaptureEnabled && !it\.downloadAllowed/);
  assert.match(client, /diagnosticRows >= 96/); assert.match(client, /text\.length > 4096/);
  assert.match(client, /generation != diagnosticGeneration \|\| session != manifest\?\.sessionId/);
  assert.match(client, /samples < 20/); assert.match(client, /removeCallbacks\(it\)/);
  const sanitizer = client.slice(client.indexOf('private fun sanitizeMediaDiagnostic'), client.indexOf('override fun onRenderProcessGone'));
  assert.match(sanitizer, /"videos" to 4, "history" to 6/); assert.match(sanitizer, /isFinite\(\)/);
  assert.doesNotMatch(sanitizer, /loadUrl|loadData|currentTime\s*=|\.play\(|\.pause\(|headers|cookie|token|sourceUrl/);
});
