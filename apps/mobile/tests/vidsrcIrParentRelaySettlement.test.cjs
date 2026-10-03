const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loader } = require('./helpers/animeModules.cjs');
const { clock, nodes, playbackFixture } = require('./helpers/postPhysicalPlaybackHarness.cjs');
const { memoryStorage, libraryFixture } = require('./helpers/sourceContinuityHarness.cjs');
const load = loader(), registry = load('packages/shared/src/sources/registry.ts');
const helper = load('apps/mobile/src/features/playback/providerEmbedSupport.ts');
const bridge = load('apps/mobile/src/features/playback/embeddedTelemetry.ts');
const ir = registry.getRegisteredSource('vidsrc-ir');
const event = (position, status = 'playing') => ({ type: 'PLAYER_EVENT', data: {
  player_info: { tmdb: 9, mediaType: 'movie' }, player_status: status, player_progress: position, player_duration: 8000,
} });
function host(script, onNative = () => {}) {
  const listeners = new Set(), messages = [], selected = {}, nested = {}, stale = {};
  const window = { location: { origin: 'https://orion.local' },
    ReactNativeWebView: { postMessage(raw) { messages.push(JSON.parse(raw)); onNative(raw); } },
    addEventListener(_type, fn) { listeners.add(fn); }, removeEventListener(_type, fn) { listeners.delete(fn); } };
  const context = vm.createContext({ window, Date, setInterval: () => 1, clearInterval() {},
    document: { getElementById: id => id === 'orion-provider-frame' ? { contentWindow: selected } : null,
      querySelectorAll: () => [], querySelector: () => null } });
  vm.runInContext(script, context);
  const send = (data, origin = 'https://vidsrc.ir', source = selected) => { for (const fn of listeners) fn({ data, origin, source }); };
  return { messages, send, selected, nested, stale, window };
}
test('VidSrc.ir uses the existing wrapper with navigation-only synthetic origin and unchanged qualification boundaries', () => {
  assert.equal(ir.releaseStatus, 'candidate'); assert.equal(ir.routingMode, 'manual-only'); assert.equal(ir.supportsDownloads, true);
  assert.ok(!registry.AUTOMATIC_PLAYER_SOURCES.some(source => source.id === ir.id));
  const url = registry.getSourceUrl(ir.id, 'movie', { tmdbId: 9 }, 1, 1, registry.getSourceResumeParams(ir.id, 5, 'movie'));
  assert.equal(new URL(url).searchParams.get('startAt'), '5');
  const source = helper.createProviderWebViewSource(ir, url), shield = helper.getProviderShieldManifest(ir.id, ir);
  assert.equal(source.baseUrl, 'https://orion.local/player/');
  assert.match(source.html, /frame-src https:\/\/vidsrc.ir"/);
  assert.match(source.html, /id="orion-provider-frame"/);
  assert.doesNotMatch(source.html, /frame-src[^";]*\*|script-src|connect-src/);
  assert.deepEqual([...shield.allowedNavigationOrigins].sort(), [...ir.allowedNavigationOrigins].sort());
  assert.deepEqual(shield.requiredOrigins, ['https://vidsrc.ir']); assert.deepEqual(shield.mediaOrigins, []);
  for (const url of ['http://vidsrc.ir/embed/movie/9', 'https://vidsrc.ir.evil/embed/movie/9', 'https://u:p@vidsrc.ir/embed/movie/9']) {
    assert.deepEqual(helper.createProviderWebViewSource(ir, url), { uri: 'about:blank' });
  }
  const legacy = helper.createProviderIframeDocument('https://player.videasy.to/movie/9');
  assert.match(legacy, /frame-src https:\/\/player.videasy.net https:\/\/player.videasy.to/);
  for (const id of ['vixsrc', 'vidsrc', 'cinesrc']) {
    const source = registry.getRegisteredSource(id);
    assert.deepEqual(helper.createProviderWebViewSource(source, 'https://example.org/test'), { uri: 'https://example.org/test' });
    if (!source.requestManifest) assert.deepEqual(helper.getProviderShieldManifest(id, source).requiredOrigins, source.expectedOrigins);
  }
});
for (const target of [5, 600]) test(`physical topology at ${target}s reproduces missing proof; actual wrapper settles and clears the warning owner`, async () => {
  const time = clock(), storage = memoryStorage(), seed = libraryFixture(storage);
  seed.library.recordPlayback({ item: { id: 9, title: 'Movie' }, mediaType: 'movie', sourceId: target === 5 ? 'vixsrc' : ir.id, currentTime: target,
    duration: 8000, evidence: 'provider-message', sessionId: 'saved' }); seed.harness.dispose();
  const f = playbackFixture({ id: '9', type: 'movie', title: 'Movie' }, storage);
  try {
    if (target === 5) {
      await f.settle();
      f.find('ResumePlaybackPrompt')?.onChoose('start-over'); await f.settle();
      await f.emit('playing', 4, 8000); time.tick(1000); await f.emit('playing', 5, 8000);
      const old = nodes(f.surface.result, 'WebView')[0].props;
      assert.equal(f.props.onSourceChange(ir.id, { sessionId: old.shieldSessionId, sourceId: 'vixsrc', currentTime: 5,
        duration: 8000, state: 'playing', observedAt: Date.now(), evidence: 'provider-video-event' }, 'manual'), true);
    } else f.find('ResumePlaybackPrompt').onChoose('resume');
    await f.settle();
    const view = nodes(f.surface.result, 'WebView')[0].props, mounts = f.mounted, key = view.key;
    const injectionCount = f.injections.length;
    const direct = host(bridge.createEmbeddedTelemetryScript({ sessionId: view.shieldSessionId, sourceId: ir.id,
      strategy: ir.progressStrategy, expectedOrigins: ir.expectedOrigins }));
    // Public relay condition: window.parent !== window. Top-level parent is self.
    const directRelay = { parent: null }; directRelay.parent = directRelay;
    for (const position of [5, 10.4, 15.8]) {
      direct.send(event(position), 'https://nested.example', direct.nested);
      if (directRelay.parent !== directRelay) direct.send(event(position));
    }
    assert.equal(direct.messages.length, 0, 'healthy inner video cannot create trusted outer proof in the old topology');
    time.tick(15000); await f.settle(); assert.ok(f.props.continuityError);
    assert.equal(f.traces.some(row => row.event === 'settlement' && row.sourceId === ir.id), false);
    assert.equal(view.source.uri, undefined); assert.match(view.source.html, /https:\/\/vidsrc.ir/);
    assert.match(view.injectedJavaScriptBeforeContentLoaded, /"frameOrigin":"https:\/\/vidsrc.ir"/);
    const offset = view.injectedJavaScript.indexOf('\n    (function() {\n      var config'); assert.ok(offset >= 0);
    const runtime = host(view.injectedJavaScript.slice(offset), raw => {
      nodes(f.surface.result, 'WebView')[0].props.onMessage({ nativeEvent: { data: raw } });
    });
    for (const position of [target, target + 5.4, target + 10.8, target + 16.2]) {
      // Selected relay is embedded, so its trusted origin forwards to Orion.
      runtime.send(event(position)); await f.settle(); time.tick(5400);
    }
    assert.equal(f.props.continuityError, undefined); assert.equal(f.props.activeHandoffId, null);
    assert.equal(nodes(f.surface.result, 'PlayerStateOverlay')[0].props.state, null);
    assert.ok(f.traces.some(row => row.event === 'settlement' && row.reason === 'settled'));
    assert.ok(f.traces.some(row => row.event === 'warning-clear' && row.reason === 'settled'));
    assert.equal(f.library.library.getPlaybackProgress('movie', 9).currentTime, target + 16.2);
    assert.equal(f.library.library.getPlaybackSourcePreference('movie', 9).sourceId, ir.id);
    assert.equal(f.mounted, mounts); assert.equal(nodes(f.surface.result, 'WebView')[0].props.key, key);
    assert.equal(f.props.sourceId, ir.id); assert.equal(f.injections.length, injectionCount, 'URL resume must not gain a command seek');
  } finally { f.dispose(); time.restore(); }
});
test('wrapper telemetry requires exact selected frame and provider origin; malformed, unrelated and stale messages cannot provide proof', () => {
  const r = host(bridge.createEmbeddedTelemetryScript({ sessionId: 'current', sourceId: ir.id, strategy: ir.progressStrategy,
    expectedOrigins: ir.expectedOrigins, frameOrigin: 'https://vidsrc.ir' }));
  for (const origin of ['https://orion.local', 'https://vidsrc.ir.evil', 'http://vidsrc.ir', 'null']) r.send(event(5), origin);
  r.send(event(5), 'https://vidsrc.ir', r.stale); r.send(event(5), 'https://vidsrc.ir', r.nested);
  for (const value of ['bad json', {}, { type: 'UNKNOWN' }, event(NaN), event(5, 'unsupported')]) r.send(value);
  assert.equal(r.messages.length, 0);
  r.send(event(5)); assert.equal(r.messages.length, 1);
  r.send(event(8000, 'completed')); assert.equal(r.messages.at(-1).state, 'ended');
  const context = { sessionId: 'current', sourceId: ir.id, expectedOrigins: ir.expectedOrigins, lastSequence: 0 };
  assert.ok(bridge.parseEmbeddedTelemetryMessage(r.messages[0], context));
  assert.equal(bridge.parseEmbeddedTelemetryMessage(r.messages[0], { ...context, lastSequence: 1 }), null);
  assert.equal(bridge.parseEmbeddedTelemetryMessage({ ...r.messages[0], sessionId: 'stale' }, context), null);
  assert.equal(bridge.parseEmbeddedTelemetryMessage({ ...r.messages[0], observedAt: Date.now() - 20000 }, context), null);
});
test('settlement diagnostics remain observable after telemetry budget and never export raw owners', () => {
  const diagnostics = loader({ 'expo-constants': { default: {} }, './storageAdapter': { getMobileStorageHealth: () => ({}) } })('apps/mobile/src/services/mobileDiagnostics.ts');
  const rows = [], previous = console.info; console.info = (_prefix, raw) => rows.push(JSON.parse(raw));
  try {
    const fields = { sourceId: ir.id, attemptId: 'private-attempt', sessionId: 'private-session' };
    for (let i = 0; i < 150; i++) diagnostics.traceMobilePlayback('telemetry', { ...fields, state: 'playing', reason: 'accepted', position: i });
    diagnostics.traceMobilePlayback('settlement', { ...fields, reason: 'target-outside-tolerance', verified: true, warningVisible: true });
    diagnostics.traceMobilePlayback('warning-clear', { ...fields, reason: 'settled' });
    assert.equal(rows.length, 130); assert.equal(rows.at(-2).warningOwner, 'handoff');
    assert.equal(rows.at(-2).reason, 'target-outside-tolerance'); assert.equal(rows.at(-1).reason, 'settled');
    assert.doesNotMatch(JSON.stringify(rows), /private-|https:|cookie|token/);
  } finally { console.info = previous; }
});
