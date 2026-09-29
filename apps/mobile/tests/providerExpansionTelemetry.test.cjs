'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createLoader, cohortIds, sharedSources } = require('./helpers/providerExpansionCohortA.cjs');

const load = createLoader();
const registry = load(sharedSources);
const { createEmbeddedTelemetryScript, parseEmbeddedTelemetryMessage } = load('apps/mobile/src/features/playback/embeddedTelemetry.ts');

function bridgeHarness(source, withFrame = true) {
  const messages = [];
  const handshakes = [];
  const listeners = new Map();
  const frameListeners = new Map();
  const timers = new Map();
  let timerId = 0;
  const frame = {
    src: source.buildMovieUrl(550),
    contentWindow: { postMessage: (payload, origin) => handshakes.push({ payload: JSON.parse(JSON.stringify(payload)), origin }) },
    addEventListener: (name, handler) => frameListeners.set(name, handler),
    removeEventListener: (name, handler) => { if (frameListeners.get(name) === handler) frameListeners.delete(name); },
  };
  const window = {
    location: { origin: 'https://orion.local', href: 'https://orion.local/player/' },
    ReactNativeWebView: { postMessage: raw => messages.push(JSON.parse(raw)) },
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name, handler) => { if (listeners.get(name) === handler) listeners.delete(name); },
  };
  const context = vm.createContext({
    window, URL, Date,
    document: { querySelector: name => name === 'iframe' && withFrame ? frame : null, querySelectorAll: () => [] },
    setInterval: handler => { const id = ++timerId; timers.set(id, handler); return id; },
    clearInterval: id => timers.delete(id),
  });
  const options = {
    sessionId: 'cohort-session-1', sourceId: source.id, strategy: source.progressStrategy,
    expectedOrigins: source.expectedOrigins, playerEventContract: source.playerEventContract,
    playerMessageHandshake: source.playerMessageHandshake,
  };
  const run = overrides => vm.runInContext(createEmbeddedTelemetryScript({ ...options, ...overrides }), context);
  const dispatch = (data, overrides = {}) => listeners.get('message')?.({
    data, origin: source.expectedOrigins[0], source: frame.contentWindow, ...overrides,
  });
  run();
  return { messages, handshakes, listeners, frameListeners, timers, frame, window, run, dispatch, options };
}

function providerEvent(source, name, currentTime = 12, duration = 100) {
  return {
    type: 'PLAYER_EVENT',
    data: source.playerEventContract === 'status'
      ? { player_status: name, player_progress: currentTime, player_duration: duration, player_info: { tmdb: 550, mediaType: 'movie' } }
      : { event: name, currentTime, duration, tmdbId: 550, mediaType: 'movie' },
  };
}

for (const id of cohortIds) {
  const source = registry.getRegisteredSource(id);
  test(`${id} documented iframe events become session-bound Orion telemetry`, () => {
    const bridge = bridgeHarness(source);
    const states = source.playerEventContract === 'standard'
      ? [['play', 'playing'], ['pause', 'paused'], ['seeked', 'seeking'], ['timeupdate', 'playing'], ['ended', 'ended']]
      : [['playing', 'playing'], ['paused', 'paused'], ['seeked', 'seeking'], ['completed', 'ended']];
    assert.equal(bridge.messages.length, 0);
    for (const [index, [eventName, state]] of states.entries()) {
      const payload = providerEvent(source, eventName, 12 + index);
      payload.data.untrustedMetadata = { url: 'https://fixture.example/private', headers: 'fixture-only' };
      bridge.dispatch(index % 2 ? JSON.stringify(payload) : payload);
      const envelope = bridge.messages[index];
      assert.equal(envelope.state, state);
      assert.equal(envelope.sequence, index + 1);
      assert.equal(envelope.currentTime, 12 + index);
      assert.equal(envelope.duration, 100);
      assert.equal(envelope.origin, source.expectedOrigins[0]);
      assert.equal(envelope.sourceId, id);
      assert.equal(envelope.sessionId, bridge.options.sessionId);
      assert.equal(envelope.evidence, 'provider-message');
      assert.deepEqual(Object.keys(envelope).sort(), [
        'type', 'sessionId', 'sourceId', 'sequence', 'origin', 'evidence', 'state',
        'currentTime', 'duration', 'bufferedPosition', 'observedAt',
      ].sort());
      const parsed = parseEmbeddedTelemetryMessage(JSON.stringify(envelope), {
        sessionId: bridge.options.sessionId, sourceId: id, expectedOrigins: source.expectedOrigins, lastSequence: index,
      });
      assert.equal(parsed.bridgeSequence, index + 1);
      assert.equal(parsed.input.state, state);
    }
    assert.equal(bridge.messages.length, states.length);
  });

  test(`${id} rejects wrong origins, sibling/nested frames, malformed data, and unsupported events`, () => {
    const bridge = bridgeHarness(source);
    const name = source.playerEventContract === 'standard' ? 'play' : 'playing';
    const valid = providerEvent(source, name);
    for (const origin of ['null', 'https://orion.local', 'http://' + new URL(source.expectedOrigins[0]).host,
      source.expectedOrigins[0] + '.evil.example', 'https://unselected.example', 'https://cloudorchestranova.com']) {
      bridge.dispatch(valid, { origin });
    }
    for (const sender of [null, {}, { parent: bridge.frame.contentWindow }]) bridge.dispatch(valid, { source: sender });
    for (const invalid of [null, [], 'not JSON', ' '.repeat(4097), {}, { type: 'PLAYER_EVENT' },
      { type: 'PLAYER_EVENT', data: [] }, { type: 'MEDIA_DATA', data: valid.data },
      providerEvent(source, 'unsupported'), providerEvent(source, name, -1),
      providerEvent(source, name, '12'), providerEvent(source, name, NaN),
      providerEvent(source, name, Infinity), providerEvent(source, name, 106, 100),
      providerEvent(source, name, 1, 0), providerEvent(source, name, 1, '100'),
      providerEvent(source, name, null), providerEvent(source, name, 1, null),
      { ...valid, data: { ...valid.data, bufferedPosition: -1 } }]) bridge.dispatch(invalid);
    assert.equal(bridge.messages.length, 0);
    const initialSrc = bridge.frame.src;
    bridge.frame.src = 'https://unselected.example/movie/550';
    bridge.dispatch(valid);
    assert.equal(bridge.messages.length, 0);
    bridge.frame.src = initialSrc;
    bridge.dispatch(valid);
    assert.equal(bridge.messages.length, 1);
    assert.equal(bridge.messages[0].sequence, 1);
  });
}

test('Stellar handshake is exact-origin, frame-bound, idempotent, and cleaned up with the bridge', () => {
  const source = registry.getRegisteredSource('stellar');
  const bridge = bridgeHarness(source);
  const expected = { payload: { type: 'STELLAR_EMBED_INIT' }, origin: 'https://stellar.rip' };
  assert.deepEqual(bridge.handshakes, [expected]);
  bridge.run();
  assert.equal(bridge.handshakes.length, 1);
  bridge.dispatch({ type: 'STELLAR_EMBED_READY' }, { origin: 'https://evil.example' });
  bridge.dispatch({ type: 'STELLAR_EMBED_READY' }, { source: {} });
  assert.equal(bridge.handshakes.length, 1);
  bridge.dispatch({ type: 'STELLAR_EMBED_READY' });
  bridge.frameListeners.get('load')();
  assert.deepEqual(bridge.handshakes, [expected, expected, expected]);
  assert.equal(bridge.messages.length, 0);
  bridge.window.__orionPlaybackTelemetry.stop();
  assert.equal(bridge.listeners.size, 0);
  assert.equal(bridge.frameListeners.size, 0);
  assert.equal(bridge.timers.size, 0);
  bridge.dispatch(providerEvent(source, 'play'));
  assert.equal(bridge.messages.length, 0);
});

test('replacing a Stellar session removes the old listeners and binds telemetry to the new session', () => {
  const source = registry.getRegisteredSource('stellar');
  const bridge = bridgeHarness(source);
  const stopPrevious = bridge.window.__orionPlaybackTelemetry.stop;
  bridge.run({ sessionId: 'cohort-session-2' });
  assert.equal(bridge.listeners.size, 1);
  assert.equal(bridge.frameListeners.size, 1);
  assert.equal(bridge.timers.size, 1);
  stopPrevious();
  bridge.dispatch(providerEvent(source, 'play'));
  assert.equal(bridge.messages[0].sessionId, 'cohort-session-2');
  const base = { sessionId: 'cohort-session-2', sourceId: 'stellar', expectedOrigins: source.expectedOrigins, lastSequence: 0 };
  const envelope = bridge.messages[0];
  assert.equal(parseEmbeddedTelemetryMessage(envelope, { ...base, sessionId: 'cohort-session-1' }), null);
  assert.equal(parseEmbeddedTelemetryMessage(envelope, { ...base, sourceId: 'mapple' }), null);
  assert.equal(parseEmbeddedTelemetryMessage(envelope, { ...base, lastSequence: envelope.sequence }), null);
  assert.equal(parseEmbeddedTelemetryMessage({ ...envelope, observedAt: Date.now() - 16_000 }, base), null);
  assert.equal(parseEmbeddedTelemetryMessage({ ...envelope, origin: 'https://orion.local' }, base), null);
  assert.notEqual(parseEmbeddedTelemetryMessage(envelope, base), null);
});

test('contract messages cannot initialize or produce telemetry without the selected iframe', () => {
  const bridge = bridgeHarness(registry.getRegisteredSource('stellar'), false);
  bridge.dispatch({ type: 'STELLAR_EMBED_READY' });
  bridge.dispatch(providerEvent(registry.getRegisteredSource('stellar'), 'play'));
  assert.deepEqual(bridge.messages, []);
  assert.deepEqual(bridge.handshakes, []);
});

test('existing VixSrc and VidSrc message normalization keeps its original contracts', () => {
  const vix = bridgeHarness(registry.getRegisteredSource('vixsrc'), false);
  vix.dispatch({ type: 'PLAYER_EVENT', data: { event: 'play', currentTime: 12, duration: 100 } });
  assert.equal(vix.messages[0].state, 'playing');
  assert.equal(vix.messages[0].origin, 'https://vixsrc.to');
  const vidsrc = bridgeHarness(registry.getRegisteredSource('vidsrc'), false);
  vidsrc.dispatch({ type: 'PLAYER_EVENT', data: { player_status: 'playing', player_progress: 12, player_duration: 100 } },
    { origin: 'https://cloudorchestranova.com' });
  assert.equal(vidsrc.messages[0].state, 'playing');
  assert.equal(vidsrc.messages[0].currentTime, 12);
  assert.equal(vidsrc.messages[0].origin, 'https://cloudorchestranova.com');
  vidsrc.dispatch({ type: 'PLAYER_EVENT', data: { player_status: 'completed', player_progress: 100, player_duration: 100 } },
    { origin: 'https://cloudorchestranova.com' });
  assert.equal(vidsrc.messages.length, 1);
  assert.deepEqual(vix.handshakes, []);
  assert.deepEqual(vidsrc.handshakes, []);
});
