const test = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers/animeModules.cjs');
const { clock, nodes, playbackFixture } = require('./helpers/postPhysicalPlaybackHarness.cjs');
const { memoryStorage, libraryFixture } = require('./helpers/sourceContinuityHarness.cjs');
const load = loader();
const { shouldPresentContinuityWarning: present } = load('apps/mobile/src/features/playback/continuityWarningPresentation.ts');
const sources = load('packages/shared/src/sources/registry.ts').ALL_CINEMA_SOURCES;
const movie = { id: '9', type: 'movie', title: 'Movie' }, target = 600, duration = 8000;
const provisional = (sourceId, patch = {}) => ({ targetSourceId: sourceId, status: 'unconfirmed',
  reason: 'return', failureCode: 'TARGET_NOT_CONFIRMED', ...patch });
const overlay = f => nodes(f.surface.result, 'PlayerStateOverlay')[0].props;
const handoffState = f => f.updates.filter(row => row.handoffState).at(-1)?.handoffState;
function saved(sourceId) {
  const storage = memoryStorage(), seed = libraryFixture(storage);
  seed.library.recordPlayback({ item: { id: 9, title: movie.title }, mediaType: 'movie', sourceId,
    currentTime: target, duration, evidence: 'provider-message', sessionId: 'saved' });
  seed.harness.dispose(); return storage;
}
async function start(sourceId) {
  const f = playbackFixture(movie, saved(sourceId));
  f.find('ResumePlaybackPrompt').onChoose('resume'); await f.settle(); return f;
}
const jsx = (type, props) => ({ type, props });
const renderOverlay = loader({
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: value => value } },
  '@expo/vector-icons': { Ionicons: 'Icon' },
  '../../context/ThemeContext': { useOrionTheme: () => ({ theme: {}, preferences: {}, systemReducedMotion: false }) },
})('apps/mobile/src/components/player/PlayerStateOverlay.tsx').PlayerStateOverlay;
function assertRecovery(props) {
  assert.equal(props.state, 'failed');
  assert.equal(typeof props.onRetry, 'function'); assert.equal(typeof props.onSwitchSource, 'function');
  const labels = nodes(renderOverlay(props), 'Text').map(row => row.props.children);
  assert.ok(labels.includes('Retry')); assert.ok(labels.includes('Switch source'));
}

for (const sourceId of ['vidsrc-ir', 'cinesrc']) {
  test(`${sourceId}: only current manual provisional confirmation warnings are suppressed`, () => {
    for (const failureCode of ['TARGET_NOT_CONFIRMED', 'POSITION_NOT_RESTORED']) {
      for (const reason of ['return', 'manual']) {
        const handoff = Object.freeze(provisional(sourceId, { failureCode, reason }));
        assert.equal(present(sourceId, handoff), false);
        assert.equal(handoff.status, 'unconfirmed'); assert.equal(handoff.failureCode, failureCode);
        assert.equal(present(sourceId, { ...handoff, status: 'failed' }), true);
        assert.equal(present(sourceId, { ...handoff, reason: 'automatic' }), true);
        assert.equal(present(sourceId, { ...handoff, targetSourceId: 'vidlink' }), true);
      }
    }
    for (const failureCode of [null, '', 'UNKNOWN', 'SEEK_UNAVAILABLE', 'POSITION_UNAVAILABLE', 'NO_CONFIRMED_TARGET', 'PROVIDER_FAILED']) {
      assert.equal(present(sourceId, provisional(sourceId, { failureCode })), true);
    }
    for (const status of ['preparing', 'loading', 'seeking', 'confirmed', 'cancelled']) {
      assert.equal(present(sourceId, provisional(sourceId, { status })), false);
    }
  });

  test(`${sourceId}: hidden provisional warning still blocks persistence until real settlement and preserves affinity`, async () => {
    const time = clock(), f = await start(sourceId);
    try {
      const attempt = f.props.continuityAttemptId, url = f.props.embedUrl, mounted = f.mounted;
      const view = nodes(f.surface.result, 'WebView')[0].props, key = view.key, session = view.shieldSessionId;
      time.tick(45000); await f.settle();
      assert.equal(handoffState(f), 'unconfirmed'); assert.match(f.props.continuityError, /saved position/);
      assert.equal(f.props.showContinuityWarning, false); assert.notEqual(overlay(f).state, 'failed');
      assert.doesNotMatch(String(overlay(f).detail), /saved position/);
      assert.ok(f.traces.some(row => row.event === 'handoff' && row.state === 'unconfirmed' && row.warningVisible === false));
      await f.emit('playing', target, duration);
      assert.equal(handoffState(f), 'unconfirmed'); assert.match(f.props.continuityError, /saved position/);
      assert.equal(f.library.library.getPlaybackProgress('movie', 9).currentTime, target);
      assert.ok(f.traces.some(row => row.event === 'telemetry' && row.persistenceEligible === false));
      assert.notEqual(overlay(f).state, 'failed');
      for (const position of [target + 1, target + 2, target + 3]) { time.tick(1000); await f.emit('playing', position, duration); }
      assert.equal(handoffState(f), 'confirmed'); assert.equal(f.props.continuityError, undefined);
      assert.equal(f.library.library.getPlaybackProgress('movie', 9).currentTime, target + 3);
      assert.equal(f.library.library.getPlaybackSourcePreference('movie', 9).sourceId, sourceId);
      assert.ok(f.traces.some(row => row.event === 'settlement' && row.reason === 'settled' && row.attemptId === attempt));
      assert.equal(f.props.activeHandoffId, null); assert.equal(f.props.embedUrl, url); assert.equal(f.mounted, mounted);
      const current = nodes(f.surface.result, 'WebView')[0].props;
      assert.equal(current.key, key); assert.equal(current.shieldSessionId, session);
      if (sourceId === 'cinesrc') {
        const commands = () => f.injections.filter(script => script.includes('ORION_RESUME_RESULT'));
        assert.equal(commands().length, 1); time.tick(15000); await f.settle();
        await f.emit('playing', target + 18, duration); assert.equal(commands().length, 1);
      }
    } finally { f.dispose(); time.restore(); }
  });

  for (const failure of ['load', 'http', 'playback']) test(`${sourceId}: ${failure} terminal failure stays visible with recovery controls`, async () => {
    const time = clock(), f = await start(sourceId);
    try {
      time.tick(15000); await f.settle(); assert.equal(f.props.showContinuityWarning, false);
      const view = nodes(f.surface.result, 'WebView')[0].props;
      if (failure === 'load') view.onError({ nativeEvent: { description: 'Provider failed to load' } });
      else if (failure === 'http') view.onHttpError({ nativeEvent: { statusCode: 503 } });
      else await f.emit('error', target, duration);
      await f.settle(); const props = overlay(f); assertRecovery(props);
      assert.doesNotMatch(String(props.detail), /saved position/);
      if (failure === 'load') {
        const previous = f.props.continuityAttemptId; props.onRetry(); await f.settle();
        assert.notEqual(f.props.continuityAttemptId, previous);
      } else if (failure === 'http') {
        props.onSwitchSource(); await f.settle(); assert.equal(nodes(f.surface.result, 'SourcesSheet').length, 1);
      }
    } finally { f.dispose(); time.restore(); }
  });

  test(`${sourceId}: unavailable seeking remains actionable`, async () => {
    const time = clock(), f = await start(sourceId);
    try {
      f.props.onResumeAttempt(f.props.activeHandoffId, 'unavailable'); await f.settle();
      assert.equal(handoffState(f), 'unconfirmed'); assert.equal(f.props.showContinuityWarning, true);
      assert.match(f.props.continuityError, /saved position/); assertRecovery(overlay(f));
    } finally { f.dispose(); time.restore(); }
  });
}

test('every control provider retains its previous handoff warning policy; aliases cannot opt in', () => {
  for (const sourceId of [...sources.map(source => source.id), 'aniembed', 'VidSrc.ir', 'vidsrc.ir', 'CineSrc', 'unknown']) {
    if (['vidsrc-ir', 'cinesrc'].includes(sourceId)) continue;
    for (const failureCode of ['TARGET_NOT_CONFIRMED', 'POSITION_NOT_RESTORED', 'SEEK_UNAVAILABLE', null]) {
      assert.equal(present(sourceId, provisional(sourceId, { failureCode })), true);
      assert.equal(present(sourceId, provisional(sourceId, { failureCode, status: 'failed' })), true);
    }
  }
  assert.equal(present('vidsrc-ir', null), false); assert.equal(present('cinesrc', undefined), false);
});

test('VidLink control still shows the overdue saved-position warning and recovery controls', async () => {
  const time = clock(), f = await start('vidlink');
  try {
    time.tick(15000); await f.settle(); assert.equal(handoffState(f), 'unconfirmed');
    assert.equal(f.props.showContinuityWarning, true); assert.match(overlay(f).detail, /saved position/);
    assertRecovery(overlay(f));
  } finally { f.dispose(); time.restore(); }
});

test('existing surface callers retain visible continuity errors when the new presentation flag is omitted', async () => {
  const time = clock(), f = await start('vidsrc-ir');
  try {
    time.tick(15000); await f.settle(); assert.notEqual(overlay(f).state, 'failed');
    f.surface.update({ ...f.props, showContinuityWarning: undefined }); await f.surface.settle();
    assertRecovery(overlay(f)); assert.match(overlay(f).detail, /saved position/);
  } finally { f.dispose(); time.restore(); }
});
