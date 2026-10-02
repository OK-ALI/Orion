const test = require('node:test');
const assert = require('node:assert/strict');
const { loader, read } = require('./helpers/animeModules.cjs');
const load = loader();
const readiness = load('apps/mobile/src/features/playback/animeReadiness.ts');
const now = Date.now();
const sample = (patch = {}) => ({ evidence: 'provider-video-event', state: 'playing', currentTime: 2, duration: 1440, observedAt: now + 100, ...patch });

test('HTML load/one timing event/ready announcement alone cannot prove Anime playback', () => {
  const state = readiness.createAnimeReadiness('anime-session', now);
  assert.equal(state.status, 'opening');
  assert.equal(readiness.observeAnimeReadiness(state, 'anime-session', sample(), now + 100).status, 'waiting');
  assert.equal(readiness.observeAnimeReadiness(state, 'anime-session', sample({ evidence: 'opened-only' }), now + 100), state);
  assert.equal(readiness.observeAnimeReadiness(state, 'anime-session', sample({ currentTime: null, duration: null }), now + 100), state);
});
test('advancing valid player timing becomes ready and clears only the readiness deadline', () => {
  let state = readiness.createAnimeReadiness('anime-session', now);
  state = readiness.observeAnimeReadiness(state, 'anime-session', sample(), now + 100);
  state = readiness.observeAnimeReadiness(state, 'anime-session', sample({ currentTime: 3, observedAt: now + 1100 }), now + 1100);
  assert.equal(state.status, 'ready');
  assert.equal(readiness.expireAnimeReadiness(state, now + 100_000).status, 'ready');
});
test('bounded failure is terminal for late/replayed events; a new retry/session resets it', () => {
  let state = readiness.createAnimeReadiness('anime-session', now);
  state = readiness.expireAnimeReadiness(state, now + readiness.ANIME_READINESS_DEADLINE_MS);
  assert.equal(state.status, 'failed');
  assert.equal(readiness.observeAnimeReadiness(state, 'anime-session', sample(), now + 100), state);
  assert.equal(readiness.createAnimeReadiness('retry-session', now + 50_000).status, 'opening');
});
test('malformed/stale/wrong-session/zero-duration/position-after-end evidence is refused', () => {
  const state = readiness.createAnimeReadiness('anime-session', now);
  for (const patch of [{ currentTime: NaN }, { currentTime: -1 }, { duration: 0 }, { duration: Infinity },
    { currentTime: 1500 }, { observedAt: now - 10 }, { observedAt: now + 20_000 }]) {
    assert.equal(readiness.observeAnimeReadiness(state, 'anime-session', sample(patch), now + 100), state);
  }
  assert.equal(readiness.observeAnimeReadiness(state, 'old-session', sample(), now + 100), state);
  assert.equal(readiness.observeAnimeReadiness(state, 'anime-session', sample({ state: 'error' }), now + 100).status, 'failed');
});
test('new direct provider retains existing exact-origin/session/sequence telemetry fences', () => {
  const telemetry = load('apps/mobile/src/features/playback/embeddedTelemetry.ts');
  const context = { sessionId: 'anime-session', sourceId: 'aniembed', expectedOrigins: ['https://aniembed.se'], lastSequence: 0 };
  const event = { type: 'ORION_PLAYBACK_TELEMETRY', sessionId: 'anime-session', sourceId: 'aniembed', sequence: 1,
    origin: 'https://aniembed.se', evidence: 'provider-video-event', state: 'playing', currentTime: 1, duration: 1400, observedAt: Date.now() };
  assert.ok(telemetry.parseEmbeddedTelemetryMessage(event, context));
  for (const patch of [{ origin: 'https://aniembed.se.evil' }, { origin: 'https://orion.local' }, { sequence: 0 },
    { sessionId: 'old' }, { sourceId: 'vixsrc' }, { state: 'ready' }, { currentTime: -1 }]) {
    assert.equal(telemetry.parseEmbeddedTelemetryMessage({ ...event, ...patch }, context), null);
  }
});
function captureFixture() {
  const released = []; let listener;
  const capture = loader({ 'react-native': { Platform: { OS: 'android' },
    NativeModules: { OrionDownloadCapture: { releaseSession: (id) => released.push(id) } },
    DeviceEventEmitter: { addListener: (_name, fn) => { listener = fn; return { remove() {} }; } } },
  })('apps/mobile/src/features/downloads/downloadCandidateCapture.ts');
  const session = { playbackSessionId: 'anime-session', sourceId: 'aniembed', providerClass: 'experimental', itemKey: 'series:127532:s1:e1',
    media: { schemaVersion: 1, id: 127532, mediaType: 'tv', title: 'Solo Leveling', year: 2024, season: 1, episode: 1, libraryKind: 'anime' }, diagnosticOnly: true };
  const event = { schemaVersion: 1, playbackSessionId: 'anime-session', sourceId: 'aniembed', candidateId: 'candidate', requestContextId: 'opaque-context',
    manifestKind: 'hls', expiry: 'session', protection: 'clear', observedAt: Date.now(),
    capabilities: { orionLibrary: true, deviceStorage: true, resumable: true },
    preflight: { candidateId: 'candidate', state: 'ready', reachability: 'reachable', resolvedManifestKind: 'hls',
      expiry: 'session', protection: 'clear', storageRequirement: 'known', requestContextReady: true, availableQualities: [] } };
  return { capture, session, event, released, emit: (payload) => listener(payload) };
}
test('diagnostic-only native ready events cannot enter candidate storage or prepared download selection', () => {
  const { capture, session, event, released, emit } = captureFixture();
  const stop = capture.beginMobileDownloadCaptureSessionV1(session);
  emit(event);
  assert.equal(capture.normalizeMobileDownloadCandidateEventV1(event, session), null);
  assert.deepEqual(capture.getMobileDownloadCandidateSnapshotsV1(), []);
  assert.equal(capture.isMobileDownloadSourceAllowedV1('aniembed'), false);
  assert.equal(capture.selectMobileDownloadCandidateForItemV1(session.itemKey, 'auto'), null);
  stop(); assert.deepEqual(released, ['anime-session']);
});
test('diagnostic cleanup releases context even if a preparation intent happens to be pending', () => {
  const { capture, session, released } = captureFixture();
  capture.requestMobileDownloadSourceResolutionV1(session.itemKey);
  const stop = capture.beginMobileDownloadCaptureSessionV1(session);
  stop(); assert.deepEqual(released, ['anime-session']);
  capture.cancelMobileDownloadSourceResolutionV1(session.itemKey);
  assert.deepEqual(released, ['anime-session'], 'diagnostic context was never retained');
});
test('legacy capture retains its default contract and the native transfer/integrity owners are not replaced', () => {
  const { capture, session } = captureFixture();
  assert.equal(capture.isMobileDownloadSourceAllowedV1('vixsrc'), true);
  assert.equal(capture.isMobileDownloadSourceAllowedV1('vidsrc'), true);
  assert.match(read('apps/mobile/src/features/downloads/downloadCandidateCapture.ts'), /diagnosticOnly\?: boolean/);
  assert.equal(session.diagnosticOnly, true);
});
