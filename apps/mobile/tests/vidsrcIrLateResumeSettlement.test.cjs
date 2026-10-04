const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { clock, nodes, playbackFixture } = require('./helpers/postPhysicalPlaybackHarness.cjs');
const { libraryFixture, memoryStorage } = require('./helpers/sourceContinuityHarness.cjs');
const { loader } = require('./helpers/animeModules.cjs');
const load = loader();
const policy = load('apps/mobile/src/features/playback/handoffPolicy.ts');
const { createEmbeddedTelemetryScript } = load('apps/mobile/src/features/playback/embeddedTelemetry.ts');
const registry = load('packages/shared/src/sources/registry.ts');
const { vidsrcIrFrameHost } = require('./helpers/vidsrcIrFrameHarness.cjs');
const movie = { id: '9', type: 'movie', title: 'Movie A' };
const target = 2700, duration = 8000;

function savedMovie(sourceId) {
  const storage = memoryStorage(), seed = libraryFixture(storage);
  seed.library.recordPlayback({ item: { id: 9, title: movie.title }, mediaType: 'movie', sourceId,
    currentTime: target, duration, sessionId: 'saved-movie', evidence: 'provider-message' });
  seed.harness.dispose(); return storage;
}
function providerBridge(f) {
  const sourceId = f.props.sourceId, origin = new URL(f.props.embedUrl).origin;
  const view = nodes(f.surface.result, 'WebView')[0].props, messages = [], listeners = new Map();
  if (sourceId === 'vidsrc-ir') {
    const runtime = vidsrcIrFrameHost(view.injectedJavaScriptBeforeContentLoaded, raw => messages.push(raw), view.source.uri);
    return { messages, async send(currentTime, event = 'timeupdate', messageOrigin) {
      const start = messages.length;
      runtime.send({ type: 'PLAYER_EVENT', data: { player_info: { tmdb: 9, mediaType: 'movie' },
        player_status: event === 'pause' ? 'paused' : event === 'seeked' ? 'seeked' : 'playing',
        player_progress: currentTime, player_duration: duration } }, messageOrigin);
      for (const raw of messages.slice(start)) view.onMessage({ nativeEvent: { data: raw } });
      await f.settle();
    }, async replay(raw) { view.onMessage({ nativeEvent: { data: raw } }); await f.settle(); } };
  }

  const window = { location: { origin }, ReactNativeWebView: { postMessage: raw => messages.push(raw) },
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const context = vm.createContext({ window, Date, document: { querySelectorAll: () => [], querySelector: () => null },
    setInterval: () => 1, clearInterval() {} });
  vm.runInContext(createEmbeddedTelemetryScript({ sessionId: view.shieldSessionId, sourceId,
    strategy: registry.getRegisteredSource(sourceId).progressStrategy, expectedOrigins: [origin] }), context);
  return { messages, async send(currentTime, event = 'timeupdate', messageOrigin = origin) {
    const start = messages.length;
    listeners.get('message')({ origin: messageOrigin, data: { type: 'PLAYER_EVENT', data: { event, currentTime, duration } } });
    for (const raw of messages.slice(start)) view.onMessage({ nativeEvent: { data: raw } });
    await f.settle();
  }, async replay(raw) { view.onMessage({ nativeEvent: { data: raw } }); await f.settle(); } };
}
const warningVisible = f => nodes(f.surface.result, 'PlayerStateOverlay')[0].props.state === 'failed';
function assertProvisional(f, message) {
  assert.match(f.props.continuityError, /saved position/, message);
  assert.equal(f.updates.filter(row => row.handoffState).at(-1).handoffState, 'unconfirmed', message);
  assert.equal(warningVisible(f), f.props.sourceId !== 'vidsrc-ir', 'control-provider warning stays visible');
}

for (const [provider, delay] of [['vidlink', 15000], ['vidsrc-ir', 15000], ['vidsrc-ir', 45000]]) {
  test(provider + ': real PLAYER_EVENT progress settles Movie Resume after ' + delay + 'ms without a play event', async () => {
    const time = clock(), storage = savedMovie(provider), f = playbackFixture(movie, storage); let reopened;
    try {
      f.find('ResumePlaybackPrompt').onChoose('resume'); await f.settle(); const bridge = providerBridge(f);
      const mounted = f.mounted, url = f.props.embedUrl;
      if (provider === 'vidsrc-ir') assert.equal(new URL(url).searchParams.get('startAt'), String(target));
      time.tick(delay); await f.settle(); assertProvisional(f);
      assert.equal(f.props.sourceId, provider); assert.match(f.props.continuityError, /saved position/);
      for (const position of [2699.8, 2700.4, 2701.2]) {
        time.tick(1000); await bridge.send(position); assertProvisional(f, 'one target or sub-second progress is insufficient');
      }
      time.tick(1000); await bridge.send(2702.0);
      assert.equal(f.updates.filter(value => value.handoffState).at(-1).handoffState, 'confirmed');
      assert.equal(f.props.continuityError, undefined); assert.equal(warningVisible(f), false);
      assert.equal(f.props.sourceId, provider); assert.equal(f.mounted, mounted); assert.equal(f.props.embedUrl, url);
      assert.ok(bridge.messages.every(raw => JSON.parse(raw).evidence === 'provider-message'));
      time.tick(1000); await bridge.send(2702.9);
      assert.equal(f.library.library.getPlaybackProgress('movie', 9).currentTime, 2702.9);
      assert.equal(f.library.library.getPlaybackSourcePreference('movie', 9).sourceId, provider);
      assert.deepEqual(f.failures, []); f.dispose();
      reopened = playbackFixture(movie, storage); reopened.find('ResumePlaybackPrompt').onChoose('resume'); await reopened.settle();
      assert.equal(reopened.props.sourceId, provider); assert.equal(reopened.props.initialResumeTime, 2702.9);
    } finally { f.dispose(); reopened?.dispose(); time.restore(); }
  });
}

test('an expired target observation needs a new bounded forward proof, not one late jump', () => {
  const pending = policy.createPlaybackHandoff({ reason: 'return', fromSessionId: null, fromSourceId: 'vidsrc-ir',
    targetSourceId: 'vidsrc-ir', requestedTime: target, strategy: 'url-param', now: 1000 });
  const sample = { sourceId: 'vidsrc-ir', sessionId: 'active', evidence: 'provider-message', currentTime: target,
    duration, observedAt: 2000, state: 'playing' };
  const reached = policy.confirmPlaybackHandoff(pending, sample, 2000);
  const timeout = policy.updateHandoffStatus(reached, 'unconfirmed', 'TARGET_NOT_CONFIRMED', 13000);
  const late = { ...sample, currentTime: 2702, observedAt: 46000 };
  const reanchored = policy.confirmPlaybackHandoff(timeout, late, 46000);
  assert.equal(reanchored?.status, 'unconfirmed'); assert.equal(reanchored?.targetReachedAt, 46000);
  assert.equal(policy.confirmPlaybackHandoff(reanchored, { ...late, currentTime: 2703.2, observedAt: 47000 }, 47000)?.status, 'confirmed');
  assert.equal(policy.confirmPlaybackHandoff(timeout, { ...late, currentTime: 5000 }, 46000), null, 'an implausible jump cannot replace target proof');
});

test('fresh late proof still rejects wrong source/session, stale/future, stalled and terminal evidence', () => {
  const pending = policy.createPlaybackHandoff({ reason: 'return', fromSessionId: null, fromSourceId: 'vidsrc-ir',
    targetSourceId: 'vidsrc-ir', requestedTime: target, strategy: 'url-param', now: 1000 });
  const timeout = policy.updateHandoffStatus(pending, 'unconfirmed', 'TARGET_NOT_CONFIRMED', 13000);
  const sample = { sourceId: 'vidsrc-ir', sessionId: 'active', evidence: 'provider-message', currentTime: target,
    duration, observedAt: 46000, state: 'playing' };
  const reached = policy.confirmPlaybackHandoff(timeout, sample, 46000); assert.ok(reached);
  assert.equal(policy.confirmPlaybackHandoff(timeout, { ...sample, currentTime: 2 }, 46000), null, 'fresh playback at the wrong target is insufficient');
  for (const patch of [{ sourceId: 'vixsrc' }, { sessionId: 'other' }, { state: 'paused' }, { state: 'buffering' },
    { state: 'loading' }, { currentTime: target }, { currentTime: target - 1 }, { observedAt: 45000 }, { observedAt: 70000 }]) {
    assert.equal(policy.confirmPlaybackHandoff(reached, { ...sample, currentTime: target + 2, observedAt: 47000, ...patch }, 47000), null);
  }
  assert.equal(policy.confirmPlaybackHandoff(reached, { ...sample, currentTime: target + 2 }, 60000), null);
  for (const patch of [{ status: 'failed' }, { status: 'confirmed' }, { reason: 'automatic' },
    { failureCode: 'SEEK_UNAVAILABLE' }, { failureCode: 'NO_CONFIRMED_TARGET' }]) {
    assert.equal(policy.confirmPlaybackHandoff({ ...timeout, ...patch }, sample, 46000), null);
  }
});

test('VidSrc.ir loads, stationary timestamps, wrong targets and buffering cannot settle the provisional transaction or persist', async () => {
  const time = clock(), storage = savedMovie('vidsrc-ir'), f = playbackFixture(movie, storage);
  try {
    f.find('ResumePlaybackPrompt').onChoose('resume'); await f.settle(); const bridge = providerBridge(f);
    time.tick(45000); await f.settle(); assertProvisional(f);
    for (const [position, event] of [[target, 'pause'], [target, 'timeupdate'], [target, 'timeupdate'], [target + 2, 'buffering']]) {
      time.tick(1000); await bridge.send(position, event); assertProvisional(f);
    }
    time.tick(1000); await bridge.send(target + 3, 'timeupdate', 'https://unrelated.example');
    assertProvisional(f); assert.equal(f.library.library.getPlaybackProgress('movie', 9).currentTime, target);
    assert.equal(f.library.library.getPlaybackSourcePreference('movie', 9).sourceId, 'vidsrc-ir');
    assert.equal(f.props.sourceId, 'vidsrc-ir'); assert.deepEqual(f.failures, []);
  } finally { f.dispose(); time.restore(); }
});

test('VidSrc.ir replayed bridge sequences and stale observations do not count as forward recovery', async () => {
  const time = clock(), storage = savedMovie('vidsrc-ir'), f = playbackFixture(movie, storage);
  try {
    f.find('ResumePlaybackPrompt').onChoose('resume'); await f.settle(); const bridge = providerBridge(f);
    time.tick(45000); await f.settle();
    for (const position of [2699.8, 2700.4]) { time.tick(1000); await bridge.send(position); }
    const raw = bridge.messages.at(-1); time.tick(1000); await bridge.replay(raw);
    await bridge.replay(JSON.stringify({ ...JSON.parse(raw), sequence: 100, currentTime: 2702, observedAt: Date.now() - 20000 }));
    assertProvisional(f); assert.equal(f.library.library.getPlaybackProgress('movie', 9).currentTime, target);
    time.tick(1000); await bridge.send(2702); assert.equal(warningVisible(f), false);
  } finally { f.dispose(); time.restore(); }
});
