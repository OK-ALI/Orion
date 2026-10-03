const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loader } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const load = loader();
const handoff = load('apps/mobile/src/features/playback/handoffPolicy.ts');
const scripts = load('apps/mobile/src/features/playback/mobileAdBlocker.ts');
const registry = load('packages/shared/src/sources/registry.ts');
function player({ available = true, seeks = true } = {}) {
  let time = 0, writes = 0, plays = 0; const timers = [], reports = [];
  const video = { duration: 1440, readyState: 1, get currentTime() { return time; },
    set currentTime(value) { writes++; if (seeks) time = value; }, play() { plays++; return Promise.resolve(); } };
  const window = { ReactNativeWebView: { postMessage: raw => reports.push(JSON.parse(raw)) } };
  const context = vm.createContext({ window, document: { querySelector: () => available ? video : null },
    setTimeout: fn => timers.push(fn) });
  return { context, video, reports, advance: value => { time = value; },
    drain() { while (timers.length) timers.shift()(); }, get writes() { return writes; }, get plays() { return plays; } };
}
for (const [action, target] of [['Resume', 300], ['Replay last 30 seconds', 270], ['Start Over', 0]]) {
  test(`${action}: one target write/play, idempotent reinjection and natural forward progress`, () => {
    const p = player(), script = scripts.createVerifiedResumeScript(target, 'user-action');
    vm.runInContext(script, p.context); assert.equal(p.writes, 1); assert.equal(p.plays, 1);
    assert.equal(p.reports[0].status, 'applied');
    for (const time of [target + 1, target + 2, target + 3, target + 30]) {
      p.advance(time); vm.runInContext(script, p.context); p.drain(); assert.equal(p.video.currentTime, time);
    }
    assert.equal(p.writes, 1); assert.equal(p.plays, 1); assert.equal(p.reports.length, 1);
    vm.runInContext(scripts.createVerifiedResumeScript(0, 'new-explicit-action'), p.context);
    assert.equal(p.writes, 2); assert.equal(p.video.currentTime, 0);
  });
}
test('unsupported seek is bounded without repeated enforcement; stale scheduled action cannot override a new action', () => {
  const p = player({ seeks: false }); vm.runInContext(scripts.createVerifiedResumeScript(300, 'first'), p.context);
  p.drain(); assert.equal(p.writes, 1); assert.equal(p.reports[0].status, 'unavailable');
  const absent = player({ available: false }); vm.runInContext(scripts.createVerifiedResumeScript(300, 'old'), absent.context);
  vm.runInContext(scripts.createVerifiedResumeScript(270, 'new'), absent.context); absent.drain();
  assert.equal(absent.reports.length, 1); assert.equal(absent.reports[0].handoffId, 'new');
  assert.equal(absent.writes, 0);
});
test('AniEmbed has one positive-target owner; start-from-beginning retains its healthy base URL', () => {
  for (const time of [0, 270, 300, 760]) {
    const url = registry.getSourceUrl('aniembed', 'tv', { anilistId: 21175 }, 1, 1,
      { lang: 'sub', ...registry.getSourceResumeParams('aniembed', time, 'tv') });
    assert.equal(url, 'https://aniembed.se/e/21175/1?lang=sub&autoplay=1&t=0');
  }
  assert.equal(registry.sourceResumeStrategy('aniembed'), 'verified-seek');
  assert.equal(registry.getRegisteredSource('aniembed').supportsDownloads, false);
  assert.deepEqual(registry.getSourceResumeParams('vixsrc', 300, 'tv'), { startAt: 300 });
  assert.deepEqual(registry.getSourceResumeParams('vidsrc-ir', 300, 'tv'), { startAt: 300 });
  assert.deepEqual(registry.getSourceResumeParams('cinesrc', 300, 'tv'), { t: 300 });
});
test('position alone cannot settle: same target session must play forward after reaching tolerance', () => {
  const transfer = handoff.createPlaybackHandoff({ reason: 'return', fromSessionId: null, fromSourceId: 'aniembed',
    targetSourceId: 'aniembed', requestedTime: 300, strategy: 'verified-seek', now: 1000 });
  const sample = { sourceId: 'aniembed', sessionId: 'mounted', currentTime: 300, observedAt: 2000, state: 'seeking' };
  const reached = handoff.confirmPlaybackHandoff(transfer, sample, 2000);
  assert.equal(reached.status, 'seeking');
  for (const patch of [{ state: 'paused', currentTime: 302 }, { state: 'buffering', currentTime: 302 },
    { state: 'playing' }, { state: 'playing', currentTime: 300.5 }, { state: 'playing', currentTime: 302, sessionId: 'stale' },
    { state: 'playing', currentTime: 302, observedAt: 2000 }]) {
    assert.equal(handoff.confirmPlaybackHandoff(reached, { ...sample, observedAt: 3000, ...patch }, 3000), null);
  }
  const settled = handoff.confirmPlaybackHandoff(reached, { ...sample, state: 'playing', currentTime: 302, observedAt: 3000 }, 3000);
  assert.equal(settled.status, 'confirmed'); assert.equal(handoff.handoffIsPending(settled), false);
  assert.equal(handoff.confirmPlaybackHandoff(settled, { ...sample, currentTime: 400, observedAt: 4000 }, 4000), null);
  assert.equal(handoff.handoffTargetMissedPosition(reached, { ...sample, currentTime: 400, observedAt: 6000 }, 6000), false);
});
test('wrong source, stale/future telemetry and missed target cannot settle a fresh transaction', () => {
  const transfer = handoff.createPlaybackHandoff({ reason: 'manual', fromSessionId: 'old', fromSourceId: 'vidsrc',
    targetSourceId: 'vixsrc', requestedTime: 300, strategy: 'url-param', now: 1000 });
  const sample = { sourceId: 'vixsrc', sessionId: 'new', currentTime: 300, observedAt: 2000, state: 'playing' };
  for (const patch of [{ sourceId: 'vidsrc' }, { currentTime: NaN }, { currentTime: 290 }, { observedAt: 999 }, { observedAt: 20000 }]) {
    assert.equal(handoff.confirmPlaybackHandoff(transfer, { ...sample, ...patch }, 2000), null);
  }
  assert.equal(handoff.confirmPlaybackHandoff(transfer, sample, 10000), null);
});

test('verified seek startup cannot be reported as a missed target before the single seek was applied', () => {
  const transfer = handoff.createPlaybackHandoff({ reason: 'return', fromSessionId: null, fromSourceId: 'aniembed',
    targetSourceId: 'aniembed', requestedTime: 300, strategy: 'verified-seek', now: 1000 });
  const startup = { sourceId: 'aniembed', sessionId: 'new', currentTime: 2, observedAt: 7000, state: 'playing' };
  assert.equal(handoff.handoffTargetMissedPosition(transfer, startup, 7000), false);
  assert.equal(handoff.handoffTargetMissedPosition(handoff.updateHandoffStatus(transfer, 'seeking', null, 7000), startup, 7000), true);
});
test('unsettled continuity cannot overwrite saved progress/affinity; settled forward playback persists normally', async () => {
  const h = hookHarness(), records = [];
  const telemetry = loader({ react: h.react,
    '../../services/mobileDiagnostics': { updateMobileDiagnostics() {}, clearMobileDiagnosticError() {}, reportMobileDiagnosticError() {} },
    './playbackRepository': { removeRecentOpen() {}, recordRecentOpen() {} } })('apps/mobile/src/features/playback/usePlaybackTelemetryController.ts');
  const props = { item: { id: 9 }, media: { id: 9, mediaType: 'tv', season: 1, episode: 1, title: 'Title' },
    sourceId: 'aniembed', sourceVariant: 'sub', surface: 'embed', recordPlayback: value => records.push(value), persistEnabled: false };
  h.start(telemetry.usePlaybackTelemetryController, props);
  let now = h.result.getSession().startedAt;
  for (const [state, currentTime] of [['playing', 1], ['playing', 2], ['seeking', 300], ['playing', 302]]) {
    h.result.emitTelemetry({ state, currentTime, duration: 1440, evidence: 'provider-video-event', observedAt: ++now });
  }
  assert.equal(h.result.getVerifiedSnapshot().state, 'playing'); h.result.flush(); assert.deepEqual(records, []);
  h.update({ ...props, persistEnabled: true }); h.result.flush();
  assert.equal(records.length, 1); assert.equal(records[0].currentTime, 302); assert.equal(records[0].sourceVariant, 'sub');
  h.dispose();
});

test('unsettled target-at-end telemetry cannot mark completion or trigger Next Episode', () => {
  const h = hookHarness(), records = [], completions = [];
  const telemetry = loader({ react: h.react,
    '../../services/mobileDiagnostics': { updateMobileDiagnostics() {}, clearMobileDiagnosticError() {}, reportMobileDiagnosticError() {} },
    './playbackRepository': { removeRecentOpen() {}, recordRecentOpen() {} } })('apps/mobile/src/features/playback/usePlaybackTelemetryController.ts');
  h.start(telemetry.usePlaybackTelemetryController, { item: { id: 9 }, media: { id: 9, mediaType: 'tv', season: 1, episode: 1, title: 'Title' },
    sourceId: 'aniembed', surface: 'embed', recordPlayback: value => records.push(value), onVerifiedCompletion: value => completions.push(value), persistEnabled: false });
  let now = h.result.getSession().startedAt;
  for (const [state, currentTime] of [['playing', 1], ['playing', 2], ['seeking', 1440], ['ended', 1440]]) {
    h.result.emitTelemetry({ state, currentTime, duration: 1440, evidence: 'provider-video-event', observedAt: ++now });
  }
  h.result.flush(); assert.deepEqual(records, []); assert.deepEqual(completions, []); h.dispose();
});
