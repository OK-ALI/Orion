const test = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers/animeModules.cjs');
const { clock, nodes, playbackFixture } = require('./helpers/postPhysicalPlaybackHarness.cjs');
const { memoryStorage, libraryFixture } = require('./helpers/sourceContinuityHarness.cjs');
const { vidsrcIrFrameHost: host } = require('./helpers/vidsrcIrFrameHarness.cjs');
const load = loader(), registry = load('packages/shared/src/sources/registry.ts');
const helper = load('apps/mobile/src/features/playback/providerEmbedSupport.ts');
const bridge = load('apps/mobile/src/features/playback/embeddedTelemetry.ts');
const ir = registry.getRegisteredSource('vidsrc-ir');
const event = (position, status = 'playing', info = { tmdb: 9, mediaType: 'movie' }) => ({ type: 'PLAYER_EVENT', data: {
  player_info: info, player_status: status, player_progress: position, player_duration: 8000,
} });
const script = (sessionId = 'current', url = 'https://vidsrc.ir/embed/movie/9') => bridge.createEmbeddedTelemetryScript({
  sessionId, sourceId: ir.id, strategy: ir.progressStrategy, expectedOrigins: ir.expectedOrigins,
  pageContext: helper.getProviderTelemetryPageContext(ir.id, url),
});
test('VidSrc.ir restores the known-working direct URI; telemetry never replaces provider topology or broadens authority', () => {
  assert.equal(ir.releaseStatus, 'candidate'); assert.equal(ir.routingMode, 'manual-only'); assert.equal(ir.supportsDownloads, true);
  assert.notEqual(ir.requiresIframeWrapper, true); assert.ok(!registry.AUTOMATIC_PLAYER_SOURCES.some(source => source.id === ir.id));
  const url = registry.getSourceUrl(ir.id, 'movie', { tmdbId: 9 }, 1, 1, registry.getSourceResumeParams(ir.id, 12, 'movie'));
  assert.equal(new URL(url).searchParams.get('startAt'), '12');
  assert.deepEqual(helper.createProviderWebViewSource(ir, url), { uri: url });
  const shield = helper.getProviderShieldManifest(ir.id, ir);
  assert.deepEqual(shield.allowedNavigationOrigins, ['https://vidsrc.ir']);
  assert.deepEqual(shield.requiredOrigins, ['https://vidsrc.ir']); assert.deepEqual(shield.mediaOrigins, []);
  for (const invalid of ['http://vidsrc.ir/embed/movie/9', 'https://vidsrc.ir.evil/embed/movie/9', 'https://u:p@vidsrc.ir/embed/movie/9', 'https://vidsrc.ir/embed/tv/9']) {
    assert.equal(helper.getProviderTelemetryPageContext(ir.id, invalid), undefined);
  }
  const context = helper.getProviderTelemetryPageContext(ir.id, url + '&private-test-only=hidden');
  assert.deepEqual(context, { origin: 'https://vidsrc.ir', pathname: '/embed/movie/9', mediaType: 'movie', id: '9', season: null, episode: null });
  assert.doesNotMatch(JSON.stringify(context), /private|hidden|startAt/);
  assert.doesNotMatch(script(), /createElement|appendChild|\.src\s*=|localStorage|document\.cookie|\.currentTime\s*=/);
  const legacy = helper.createProviderIframeDocument('https://player.videasy.to/movie/9');
  assert.match(legacy, /frame-src https:\/\/player.videasy.net https:\/\/player.videasy.to/);
  for (const id of ['vixsrc', 'vidsrc', 'vidlink', 'cinesrc']) {
    assert.deepEqual(helper.createProviderWebViewSource(registry.getRegisteredSource(id), 'https://example.org/test'), { uri: 'https://example.org/test' });
  }
});
for (const target of [5, 12, 600]) test(`direct playback at ${target}s keeps one surface and settles late current-frame proof; no evidence cannot fake success`, async () => {
  const time = clock(), storage = memoryStorage(), seed = libraryFixture(storage), short = target < 30;
  seed.library.recordPlayback({ item: { id: 9, title: 'Movie' }, mediaType: 'movie', sourceId: short ? 'vixsrc' : ir.id,
    currentTime: target, duration: 8000, evidence: 'provider-message', sessionId: 'saved' }); seed.harness.dispose();
  const f = playbackFixture({ id: '9', type: 'movie', title: 'Movie' }, storage);
  try {
    if (short) {
      await f.settle(); f.find('ResumePlaybackPrompt')?.onChoose('start-over'); await f.settle();
      await f.emit('playing', target - 1, 8000); time.tick(1000); await f.emit('playing', target, 8000);
      const old = nodes(f.surface.result, 'WebView')[0].props;
      assert.equal(f.props.onSourceChange(ir.id, { sessionId: old.shieldSessionId, sourceId: 'vixsrc', currentTime: target,
        duration: 8000, state: 'playing', observedAt: Date.now(), evidence: 'provider-video-event' }, 'manual'), true);
    } else f.find('ResumePlaybackPrompt').onChoose('resume');
    await f.settle(); const view = nodes(f.surface.result, 'WebView')[0].props, mounts = f.mounted, key = view.key, injectionCount = f.injections.length;
    assert.equal(view.source.uri, f.props.embedUrl); assert.equal(view.source.html, undefined); assert.equal(view.source.baseUrl, undefined);
    assert.match(view.injectedJavaScriptBeforeContentLoaded, /"pageContext":/); assert.doesNotMatch(view.injectedJavaScriptBeforeContentLoaded, /"frameOrigin":/);
    view.onLoadStart(); view.onLoadEnd(); await f.settle();
    assert.equal(f.injections.length, injectionCount + 1); assert.equal(f.injections.at(-1), view.injectedJavaScript);
    time.tick(15000); await f.settle(); assert.ok(f.props.continuityError);
    assert.equal(f.traces.some(row => row.event === 'settlement' && row.sourceId === ir.id), false);
    const runtime = host(view.injectedJavaScriptBeforeContentLoaded, raw => {
      nodes(f.surface.result, 'WebView')[0].props.onMessage({ nativeEvent: { data: raw } });
    }, view.source.uri);
    runtime.frame.src = ''; runtime.send(event(target), 'https://vidsrc.ir'); assert.equal(runtime.messages.length, 0, 'blank bootstrap frame cannot settle');
    runtime.frame.src = 'https://player.example.net/player'; runtime.style.display = 'none'; runtime.send(event(target));
    assert.equal(runtime.messages.length, 0, 'hidden selected frame cannot fake playback'); runtime.style.display = 'block';
    for (const position of [target, target + 5.4, target + 10.8, target + 16.2]) {
      runtime.send(event(position)); await f.settle(); time.tick(5400);
    }
    assert.equal(f.props.continuityError, undefined); assert.equal(f.props.activeHandoffId, null);
    assert.equal(nodes(f.surface.result, 'PlayerStateOverlay')[0].props.state, null);
    assert.ok(f.traces.some(row => row.event === 'settlement' && row.reason === 'settled'));
    assert.ok(f.traces.some(row => row.event === 'warning-clear' && row.reason === 'settled'));
    assert.equal(f.library.library.getPlaybackProgress('movie', 9).currentTime, target + 16.2);
    assert.equal(f.library.library.getPlaybackSourcePreference('movie', 9).sourceId, ir.id);
    assert.equal(f.mounted, mounts); assert.equal(nodes(f.surface.result, 'WebView')[0].props.key, key);
    assert.equal(f.props.sourceId, ir.id); assert.equal(f.injections.length, injectionCount + 1, 'only existing load bridge injection; no command seek');
  } finally { f.dispose(); time.restore(); }
});
test('only current visible selected frame, exact HTTPS origin, current page and content can provide proof', () => {
  const r = host(script());
  for (const origin of ['https://orion.local', 'https://vidsrc.ir', 'https://player.example.net.evil', 'http://player.example.net', 'null']) r.send(event(5), origin);
  r.send(event(5), undefined, r.stale); r.send(event(5), undefined, r.nested);
  for (const value of ['bad json', {}, { type: 'UNKNOWN' }, event(NaN), event(5, 'unsupported'), event(5, 'playing', { tmdb: 10, mediaType: 'movie' }), event(5, 'playing', { tmdb: 9, mediaType: 'tv' })]) r.send(value);
  r.send({ ...event(5), type: 'cinesrc:play' });
  for (const value of [null, '5', Infinity, -1, 9000]) { const payload = event(value); r.send(payload); }
  const old = r.replaceFrame(); r.send(event(5), undefined, old.contentWindow);
  r.duplicates(2); r.send(event(5)); r.duplicates(1);
  r.frame.isConnected = false; r.send(event(5)); r.frame.isConnected = true;
  const originalSrc = r.frame.src;
  for (const src of ['', 'about:blank', 'http://player.example.net/player', 'https://u:p@player.example.net/player', 'https://127.0.0.1/player', 'https://192.168.1.1/player', 'https://[::1]/player', 'https://host.local/player']) {
    r.frame.src = src; r.send(event(5), src ? new URL(src).origin : 'https://vidsrc.ir');
  }
  r.frame.src = originalSrc;
  for (const field of ['display', 'visibility', 'opacity']) { const previous = r.style[field]; r.style[field] = field === 'opacity' ? '0' : field === 'display' ? 'none' : 'hidden'; r.send(event(5)); r.style[field] = previous; }
  r.window.top = {}; r.send(event(5)); r.window.top = r.window;
  r.window.location = new URL('https://vidsrc.ir/embed/movie/10'); r.send(event(5)); r.window.location = new URL('https://vidsrc.ir/embed/movie/9');
  assert.equal(r.messages.length, 0);
  r.send(event(5)); assert.equal(r.messages.length, 1); assert.equal(r.messages[0].origin, 'https://vidsrc.ir');
  r.send(event(8000, 'completed')); assert.equal(r.messages.at(-1).state, 'ended');
  const context = { sessionId: 'current', sourceId: ir.id, expectedOrigins: ir.expectedOrigins, lastSequence: 0 };
  assert.ok(bridge.parseEmbeddedTelemetryMessage(r.messages[0], context));
  assert.equal(bridge.parseEmbeddedTelemetryMessage(r.messages[0], { ...context, lastSequence: 1 }), null);
  assert.equal(bridge.parseEmbeddedTelemetryMessage({ ...r.messages[0], sessionId: 'stale' }, context), null);
  assert.equal(bridge.parseEmbeddedTelemetryMessage({ ...r.messages[0], observedAt: Date.now() - 20000 }, context), null);
});
test('documented IMDb and TV identity is independently verified; script cleanup removes stale listeners', () => {
  const url = 'https://vidsrc.ir/embed/tv/tt0944947/2/3', r = host(script('episode', url), undefined, url);
  for (const info of [{ imdb: 'tt0944947', mediaType: 'tv', season: 1, episode: 3 }, { imdb: 'tt0944947', mediaType: 'tv', season: 2, episode: 4 }, { imdb: 'tt0000000', mediaType: 'tv', season: 2, episode: 3 }]) r.send(event(5, 'playing', info));
  assert.equal(r.messages.length, 0); r.send(event(5, 'playing', { imdb: 'tt0944947', mediaType: 'tv', season: 2, episode: 3 })); assert.equal(r.messages.length, 1);
  const staleListener = [...r.listeners][0]; r.run(script('replacement', url));
  staleListener({ data: event(6, 'playing', { imdb: 'tt0944947', mediaType: 'tv', season: 2, episode: 3 }), origin: new URL(r.frame.src).origin, source: r.frame.contentWindow });
  assert.equal(r.messages.length, 1); assert.equal(r.listeners.size, 1);
  r.window.__orionPlaybackTelemetry.stop(); assert.equal(r.listeners.size, 0);
});
test('settled VidSrc.ir affinity survives exit/recreated Movie Resume and old native envelopes cannot settle the new session', async () => {
  const time = clock(), storage = memoryStorage(), seed = libraryFixture(storage);
  seed.library.recordPlayback({ item: { id: 9, title: 'Movie' }, mediaType: 'movie', sourceId: ir.id, currentTime: 600, duration: 8000, evidence: 'provider-message', sessionId: 'saved' }); seed.harness.dispose();
  let f = playbackFixture({ id: '9', type: 'movie', title: 'Movie' }, storage);
  try {
    f.find('ResumePlaybackPrompt').onChoose('resume'); await f.settle(); let view = nodes(f.surface.result, 'WebView')[0].props;
    const runtime = host(view.injectedJavaScriptBeforeContentLoaded, raw => nodes(f.surface.result, 'WebView')[0].props.onMessage({ nativeEvent: { data: raw } }), view.source.uri);
    for (const value of [600, 605.4, 610.8, 616.2]) { runtime.send(event(value)); await f.settle(); time.tick(5400); }
    const stale = runtime.messages.at(-1); f.dispose(); f = playbackFixture({ id: '9', type: 'movie', title: 'Movie' }, storage);
    f.find('ResumePlaybackPrompt').onChoose('resume'); await f.settle(); view = nodes(f.surface.result, 'WebView')[0].props;
    assert.equal(f.props.sourceId, ir.id); assert.equal(f.props.initialResumeTime, 616.2);
    assert.equal(new URL(view.source.uri).searchParams.get('startAt'), '616'); assert.notEqual(view.shieldSessionId, stale.sessionId);
    view.onMessage({ nativeEvent: { data: JSON.stringify(stale) } }); await f.settle();
    assert.ok(f.props.activeHandoffId); assert.equal(f.traces.some(row => row.event === 'settlement' && row.reason === 'settled'), false);
  } finally { f.dispose(); time.restore(); }
});
test('settlement diagnostics remain observable after telemetry budget and never export raw owners', () => {
  const diagnostics = loader({ 'expo-constants': { default: {} }, './storageAdapter': { getMobileStorageHealth: () => ({}) } })('apps/mobile/src/services/mobileDiagnostics.ts');
  const rows = [], previous = console.info; console.info = (_prefix, raw) => rows.push(JSON.parse(raw));
  try {
    const fields = { sourceId: ir.id, attemptId: 'private-attempt', sessionId: 'private-session' };
    for (let i = 0; i < 150; i++) diagnostics.traceMobilePlayback('telemetry', { ...fields, state: 'playing', reason: 'accepted', position: i });
    diagnostics.traceMobilePlayback('settlement', { ...fields, reason: 'target-outside-tolerance', verified: true, warningVisible: true });
    diagnostics.traceMobilePlayback('warning-clear', { ...fields, reason: 'settled' });
    assert.equal(rows.length, 130); assert.equal(rows.at(-2).warningOwner, 'handoff'); assert.equal(rows.at(-2).reason, 'target-outside-tolerance');
    assert.doesNotMatch(JSON.stringify(rows), /private-|https:|cookie|token/);
  } finally { console.info = previous; }
});
