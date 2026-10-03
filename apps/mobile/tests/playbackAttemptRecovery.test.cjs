const test = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const { jsx } = require('./helpers/sourceContinuityHarness.cjs');
function clock() {
  let now = 100000, id = 0; const timers = new Map();
  const originals = { now: Date.now, set: global.setTimeout, clear: global.clearTimeout };
  Date.now = () => now; global.setTimeout = (fn, delay) => { timers.set(++id, { fn, at: now + delay }); return id; };
  global.clearTimeout = key => timers.delete(key);
  return { tick(ms) { const end = now + ms; let next;
    while ((next = [...timers].sort((a, b) => a[1].at - b[1].at).find(([, timer]) => timer.at <= end))) {
      now = next[1].at; timers.delete(next[0]); next[1].fn();
    } now = end;
  }, get size() { return timers.size; }, restore() { Date.now = originals.now; global.setTimeout = originals.set; global.clearTimeout = originals.clear; } };
}
function find(tree, name, result = []) {
  if (!tree || typeof tree !== 'object') return result;
  if (tree.type === name || tree.type?.name === name) result.push(tree.props);
  for (const child of [tree.props?.children].flat(Infinity)) find(child, name, result);
  return result;
}
function surfaceFixture(patch = {}) {
  const harness = hookHarness(), failures = [], captures = [], released = [], injections = [], attempts = [], records = [];
  const controller = { state: { overlay: 'none', hudState: 'visible-explicit', presentation: 'fit', playback: { playing: false }, loadingState: null },
    setLoading(value) { controller.state.loadingState = value; }, registerSurface: () => () => {},
    updatePlayback(value) { controller.state.playback = value; controller.state.loadingState = value.state === 'buffering' ? 'buffering' : null; },
    openOverlay(value) { controller.state.overlay = value; }, closeOverlay() { controller.state.overlay = 'none'; }, reveal() {}, dismiss() {}, toggleChromeFromUserTap() {} };
  const load = loader({ react: harness.react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Platform: { OS: 'android' }, View: 'View', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 800, height: 450 }) },
    '../../components/player/SourcesSheet': { SourcesSheet: 'SourcesSheet' },
    '../../components/player/PresentationSheet': { PresentationSheet: 'PresentationSheet' },
    '../../components/player/PlayerStateOverlay': { PlayerStateOverlay: 'PlayerStateOverlay' },
    '../../context/LibraryContext': { useLibraryPlaybackActions: () => ({ recordPlayback: r => records.push(r) }) },
    '../../services/mobileDiagnostics': { clearMobileDiagnosticError() {}, reportMobileDiagnosticError() {}, updateMobileDiagnostics() {} },
    '../../services/sourceHealth': { markMobileSourceFailure: (...args) => { failures.push(args); return { state: 'failed' }; },
      markMobileSourceSuccess: () => ({ state: 'ready' }), getMobileSourceHealth: () => null, getMobileSourceHealthV2: () => null },
    './playbackRepository': { recordRecentOpen() {}, removeRecentOpen() {} },
    './OrionCinemaWebView': { OrionCinemaWebView: 'WebView' },
    './subtitleDiscovery': { clearSubtitleSession() {}, getInternalSubtitleTrack: () => null },
    './ResumePlaybackPrompt': { ResumePlaybackPrompt: 'ResumePlaybackPrompt' },
    './MobilePlayerController': { useMobilePlayerController: () => controller },
    './presentationPreferences': { getEmbeddedPresentationModes: () => ['fit', 'fill', 'provider'], getPresentationPreference: () => 'fit', savePresentationPreference() {} },
    './immersiveSystemUi': { usePlayerImmersiveSystemUi() {} }, './EmbeddedPlayerHud': { EmbeddedPlayerHud: 'EmbeddedPlayerHud' },
    './ProviderControlsReturn': { ProviderControlsReturn: 'ProviderControlsReturn' },
    '../downloads/downloadCandidateCapture': { beginMobileDownloadCaptureSessionV1: value => { captures.push(value); return () => released.push(value.playbackSessionId); } },
    '../downloads/useDownloadSourceAutoReturn': { useDownloadSourceAutoReturnV1() {} } });
  const props = { embedUrl: '', sourceId: 'aniembed', animeVariant: 'sub', title: 'Title', id: '9', type: 'tv', season: '1', episode: '1',
    onSourceChange: () => false, canAutomaticFailover: () => false, onAutomaticFailover: () => { attempts.push('switch'); return false; },
    onResumeAttempt() {}, onExit() {}, ...patch };
  harness.start(load('apps/mobile/src/features/playback/EmbedPlayerSurface.tsx').EmbedPlayerSurface, props);
  const attach = () => { const view = find(harness.result, 'WebView')[0]; if (view) view.ref.current = { injectJavaScript: value => injections.push(value) }; return view; };
  attach();
  return { harness, props, failures, captures, released, injections, attempts, controller, records, attach,
    get status() { return find(harness.result, 'PlayerStateOverlay'); }, get watchdog() { return find(harness.result, 'WatchdogWarning')[0]; } };
}
test('empty URL mounts no provider and arms no capture/readiness/watchdog or provider-health failure', async () => {
  const time = clock(); const f = surfaceFixture();
  try {
    const watchdog = hookHarness(); watchdog.start(loader({ react: watchdog.react })('apps/mobile/src/components/player/WatchdogWarning.tsx').WatchdogWarning, f.watchdog);
    assert.equal(time.size, 0); assert.deepEqual(f.captures, []); assert.equal(f.watchdog.isBuffering, false);
    time.tick(60000); await f.harness.settle(); assert.deepEqual(f.failures, []); assert.deepEqual(f.attempts, []);
    assert.equal(f.status[0].state, null); watchdog.dispose();
    f.harness.update({ ...f.props, embedUrl: 'https://aniembed.se/e/21175/1?lang=sub&t=0' }); await f.harness.settle();
    assert.equal(f.captures.length, 1); assert.equal(f.captures[0].diagnosticOnly, true);
    f.harness.dispose(); assert.equal(f.released.length, 1);
  } finally { f.harness.dispose(); time.restore(); }
});
test('rejected AniEmbed automatic switching does not release audio or claim a switch; readiness has one failure owner', async () => {
  const time = clock(); const f = surfaceFixture({ embedUrl: 'https://aniembed.se/e/21175/1?lang=sub&t=0' });
  try {
    assert.equal(find(f.harness.result, 'EmbeddedPlayerHud')[0].sourceLabel, 'AniEmbed \u00b7 Sub');
    assert.equal(f.watchdog.onFailover(), false); assert.equal(f.injections.length, 0); assert.deepEqual(f.attempts, []);
    assert.equal(f.watchdog.isBuffering, false, 'bounded Anime readiness owns initial startup');
    time.tick(35000); await f.harness.settle();
    assert.equal(f.failures.length, 1); assert.equal(f.status.length, 1); assert.equal(f.status[0].state, 'failed');
    assert.equal(find(f.harness.result, 'WebView').length, 0);
    time.tick(35000); await f.harness.settle(); assert.equal(f.failures.length, 1);
    f.controller.openOverlay('sources'); f.harness.update(f.props);
    assert.equal(f.status[0].state, null, 'Sources owns visible recovery while its sheet is open');
  } finally { f.harness.dispose(); time.restore(); }
});
test('one native error is attributed once; duplicate callbacks cannot stack failures', async () => {
  const time = clock(), f = surfaceFixture({ sourceId: 'vidlink', embedUrl: 'https://vidlink.pro/tv/9/1/1' });
  try {
    const view = f.attach(); view.onError({ nativeEvent: { description: 'Connection failed' } });
    view.onHttpError({ nativeEvent: { statusCode: 502 } }); await f.harness.settle();
    assert.equal(f.failures.length, 1); assert.equal(f.status.length, 1); assert.equal(f.status[0].state, 'failed');
  } finally { f.harness.dispose(); time.restore(); }
});

test('a General switch rejected after audio release returns to one truthful current-source failure', async () => {
  const time = clock(), f = surfaceFixture({ sourceId: 'vidlink', embedUrl: 'https://vidlink.pro/tv/9/1/1', canAutomaticFailover: () => true });
  try {
    assert.equal(f.watchdog.onFailover(), true); await f.harness.settle();
    time.tick(240); await f.harness.settle();
    assert.equal(f.attempts.length, 1); assert.equal(f.status.length, 1); assert.equal(f.status[0].state, 'failed');
    assert.equal(f.failures.length, 1); assert.equal(find(f.harness.result, 'WebView').length, 1);
  } finally { f.harness.dispose(); time.restore(); }
});
test('failed positive continuity displays existing recovery without poisoning provider availability', async () => {
  const time = clock(), f = surfaceFixture({ embedUrl: 'https://aniembed.se/e/21175/1?lang=sub&t=0', activeHandoffId: 'resume-transaction' });
  try {
    assert.equal(f.watchdog.isBuffering, false);
    f.harness.update({ ...f.props, activeHandoffId: null, continuityError: 'Playback could not continue from the saved position.' });
    time.tick(35000); await f.harness.settle();
    assert.deepEqual(f.failures, []); assert.equal(f.status.length, 1); assert.equal(f.status[0].state, 'failed');
  } finally { f.harness.dispose(); time.restore(); }
});
for (const accepted of [false, true]) test(`shared watchdog reports only rejected timeout (switch accepted=${accepted}) and renders no competing panel`, () => {
  const time = clock(), harness = hookHarness(); let attempts = 0, failures = 0;
  const component = loader({ react: harness.react })('apps/mobile/src/components/player/WatchdogWarning.tsx').WatchdogWarning;
  try {
    harness.start(component, { isBuffering: false, onFailover: () => { attempts++; return accepted; }, onTimeout: () => failures++ });
    time.tick(15000); assert.equal(attempts, 0);
    harness.update({ isBuffering: true, onFailover: () => { attempts++; return accepted; }, onTimeout: () => failures++ });
    time.tick(15000); assert.equal(attempts, 1); assert.equal(failures, accepted ? 0 : 1); assert.equal(harness.result, null);
  } finally { harness.dispose(); time.restore(); }
});

test('extracted presentation geometry exactly preserves Original/Fit/Fill in both viewport shapes', () => {
  const geometry = loader()('apps/mobile/src/features/playback/providerEmbedSupport.ts').getEmbeddedPresentationStyle;
  for (const [width, height, wider] of [[800, 400, true], [400, 800, false]]) {
    assert.deepEqual(geometry('provider', width, height), { width: '100%', height: '100%', flex: 0, alignSelf: 'stretch' });
    for (const mode of ['fit', 'fill']) {
      const dimension = mode === 'fit' ? wider : !wider;
      assert.deepEqual(geometry(mode, width, height), { [dimension ? 'height' : 'width']: '100%', aspectRatio: 16 / 9, alignSelf: 'center', flex: 0 });
    }
    assert.equal(geometry('stretch', width, height), undefined);
  }
});
