const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { clock, nodes, playbackFixture } = require('./helpers/postPhysicalPlaybackHarness.cjs');
const { libraryFixture, memoryStorage } = require('./helpers/sourceContinuityHarness.cjs');
const { loader } = require('./helpers/animeModules.cjs');
const load = loader(), registry = load('packages/shared/src/sources/registry.ts');
const { createEmbeddedTelemetryScript } = load('apps/mobile/src/features/playback/embeddedTelemetry.ts');
const { createCineSrcResumeScript } = load('apps/mobile/src/features/playback/mobileAdBlocker.ts');
const policy = load('apps/mobile/src/features/playback/handoffPolicy.ts');
const { vidsrcIrFrameHost } = require('./helpers/vidsrcIrFrameHarness.cjs');
const movie = { id: '9', type: 'movie', title: 'Movie A' }, duration = 8000;
function saved(sourceId, currentTime) {
  const storage = memoryStorage(), seed = libraryFixture(storage);
  seed.library.recordPlayback({ item: { id: 9, title: movie.title }, mediaType: 'movie', sourceId,
    currentTime, duration, sessionId: 'saved', evidence: 'provider-message' });
  seed.harness.dispose(); return storage;
}
const warning = f => nodes(f.surface.result, 'PlayerStateOverlay')[0].props.state === 'failed';
function runtime(origin, onNative = () => {}) {
  const listeners = new Map(), commands = [], messages = [], received = [], videoSeeks = []; let playRequests = 0, video = null;
  const window = { location: { origin }, ReactNativeWebView: { postMessage(raw) { messages.push(JSON.parse(raw)); onNative(raw); } },
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    postMessage(data, targetOrigin) { commands.push({ data, targetOrigin }); } };
  const context = vm.createContext({ window, Date, setTimeout, clearTimeout, setInterval: () => 1, clearInterval() {},
    document: { querySelectorAll: () => [], querySelector: () => video } });
  return { window, context, commands, messages, listeners, received, videoSeeks, get playRequests() { return playRequests; },
    enableVideo(position) { let currentTime = position; video = { duration, readyState: 4,
      get currentTime() { return currentTime; }, set currentTime(next) { currentTime = next; videoSeeks.push(next); },
      play() { playRequests++; return Promise.resolve(); } }; },
    send(data, messageOrigin = origin, source = window) { received.push(data.type); for (const fn of [...(listeners.get('message') || [])]) fn({ data, origin: messageOrigin, source }); },
    inject(script) { vm.runInContext(script, context); } };
}
function provider(f) {
  const view = nodes(f.surface.result, 'WebView')[0].props;
  const origin = new URL(f.props.embedUrl).origin;
  if (f.props.sourceId === 'vidsrc-ir') {
    const received = [], r = vidsrcIrFrameHost(view.injectedJavaScriptBeforeContentLoaded,
      raw => nodes(f.surface.result, 'WebView')[0].props.onMessage({ nativeEvent: { data: raw } }), view.source.uri);
    return { ...r, commands: [], videoSeeks: [], playRequests: 0, received,
      async observe(data, messageOrigin) { received.push(data.type); r.send(data, messageOrigin); await f.settle(); },
      webViewKey: view.key, sessionId: view.shieldSessionId };
  }
  const r = runtime(origin, raw => nodes(f.surface.result, 'WebView')[0].props.onMessage({ nativeEvent: { data: raw } }));
  r.inject(createEmbeddedTelemetryScript({ sessionId: view.shieldSessionId, sourceId: f.props.sourceId,
    strategy: registry.getRegisteredSource(f.props.sourceId).progressStrategy, expectedOrigins: [origin] }));
  const original = view.ref.current.injectJavaScript;
  view.ref.current.injectJavaScript = script => { original(script); if (script.includes('ORION_RESUME_RESULT')) r.inject(script); };
  return { ...r, get playRequests() { return r.playRequests; }, async observe(data, messageOrigin) { r.send(data, messageOrigin); await f.settle(); },
    webViewKey: view.key, sessionId: view.shieldSessionId };
}
const ir = (position, status = 'playing') => ({ type: 'PLAYER_EVENT', data: {
  player_info: { tmdb: 9, mediaType: 'movie' }, player_status: status, player_progress: position, player_duration: duration } });
const cine = (event, currentTime) => ({ type: `cinesrc:${event}`, currentTime, duration });
function timeline(f, action, p) {
  const ids = new Map(); const id = raw => { if (!raw) return null; if (!ids.has(raw)) ids.set(raw, ids.size + 1); return ids.get(raw); };
  console.log('[transaction-proof]', JSON.stringify({ provider: f.props.sourceId, action,
    urlBuilds: f.urlBuilds.length, distinctUrls: new Set(f.urlBuilds).size, surfaces: f.mounted,
    seekCommands: p ? p.commands.filter(c => c.data.command === 'seek').length + p.videoSeeks.length : null,
    playCommands: p ? p.commands.filter(c => c.data.command === 'play' || c.data.command === 'pause').length + p.playRequests : null,
    readinessEvents: p?.received.filter(type => ['cinesrc:ready', 'cinesrc:loadedmetadata'].includes(type)).length || 0,
    targetApplied: p?.messages.filter(m => m.type === 'ORION_RESUME_RESULT' && m.status === 'applied').length || 0,
    events: f.traces.map(row => ({ event: row.event, provider: row.sourceId, attempt: id(row.attemptId), session: id(row.sessionId),
      state: row.state, target: row.target, position: row.position, reason: row.reason, verified: row.verified, persistenceEligible: row.persistenceEligible })) }));
}

for (const delay of [15000, 45000]) test(`documented VidSrc.ir status cadence settles the same Movie transaction after ${delay}ms`, async () => {
  const time = clock(), storage = saved('vidsrc-ir', 2700), f = playbackFixture(movie, storage); let reopened;
  try {
    f.find('ResumePlaybackPrompt').onChoose('resume'); await f.settle(); const p = provider(f);
    const attempt = f.props.activeHandoffId, url = f.props.embedUrl, mounts = f.mounted, builds = f.urlBuilds.length;
    assert.equal(new URL(url).searchParams.get('startAt'), '2700');
    time.tick(delay); await f.settle(); assert.ok(warning(f));
    await p.observe(ir(2700)); assert.ok(warning(f), 'an accepted target without verified forward playback cannot settle');
    assert.equal(f.library.library.getPlaybackProgress('movie', 9).currentTime, 2700);
    time.tick(1000); await p.observe(ir(2700, 'buffering')); assert.ok(warning(f));
    time.tick(4400); await p.observe(ir(2705.4));
    time.tick(5400); await p.observe(ir(2710.8));
    assert.equal(warning(f), false); assert.equal(f.props.continuityError, undefined);
    assert.equal(f.props.sourceId, 'vidsrc-ir'); assert.equal(f.mounted, mounts); assert.equal(f.urlBuilds.length, builds);
    assert.equal(f.props.embedUrl, url); assert.equal(nodes(f.surface.result, 'WebView')[0].props.key, p.webViewKey);
    assert.equal(nodes(f.surface.result, 'WebView')[0].props.shieldSessionId, p.sessionId);
    time.tick(5400); await p.observe(ir(2716.2));
    assert.equal(f.library.library.getPlaybackProgress('movie', 9).currentTime, 2716.2);
    assert.equal(f.library.library.getPlaybackSourcePreference('movie', 9).sourceId, 'vidsrc-ir');
    assert.ok(f.traces.some(row => row.reason === 'target-observation-retained' && row.attemptId === attempt));
    timeline(f, `resume-${delay}`, p);
    f.dispose(); reopened = playbackFixture(movie, storage); reopened.find('ResumePlaybackPrompt').onChoose('resume'); await reopened.settle();
    assert.equal(reopened.props.sourceId, 'vidsrc-ir'); assert.equal(reopened.props.initialResumeTime, 2716.2);
  } finally { f.dispose(); reopened?.dispose(); time.restore(); }
});

test('different attempt, source aliases, session, stale, future or implausible target observations cannot settle', () => {
  const attempt = policy.createPlaybackHandoff({ reason: 'return', fromSourceId: 'vidsrc-ir', fromSessionId: null,
    targetSourceId: 'vidsrc-ir', requestedTime: 2700, strategy: 'url-param', now: 1000 });
  const late = policy.updateHandoffStatus(attempt, 'unconfirmed', 'TARGET_NOT_CONFIRMED', 13000);
  const targetObservation = { attemptId: attempt.id, sessionId: 'same', sourceId: 'vidsrc-ir', currentTime: 2700, observedAt: 45000 };
  const snapshot = { sessionId: 'same', sourceId: 'vidsrc-ir', currentTime: 2705.4, duration, evidence: 'provider-message',
    observedAt: 50400, state: 'playing', targetObservation };
  const anchor = policy.confirmPlaybackHandoff(late, snapshot, 50400); assert.ok(anchor);
  assert.equal(policy.confirmPlaybackHandoff(anchor, { ...snapshot, currentTime: 2710.8, observedAt: 55800 }, 55800).status, 'confirmed');
  for (const patch of [{ attemptId: 'unrelated' }, { sessionId: 'other' }, { sourceId: 'vidsrcir' }, { sourceId: 'VidSrc.ir' },
    { sourceId: 'vidsrc.ir' }, { observedAt: 500 }, { observedAt: 10000 }, { observedAt: 50500 }, { currentTime: 2 }]) {
    assert.equal(policy.confirmPlaybackHandoff(late, { ...snapshot, targetObservation: { ...targetObservation, ...patch } }, 50400), null);
  }
  assert.equal(policy.confirmPlaybackHandoff({ ...late, targetSessionId: 'other' }, snapshot, 50400), null);
  assert.equal(policy.confirmPlaybackHandoff(late, { ...snapshot, currentTime: 7000 }, 50400), null);
  assert.equal(policy.confirmPlaybackHandoff(late, { ...snapshot, state: 'buffering' }, 50400), null);
  assert.equal(policy.confirmPlaybackHandoff({ ...attempt, reason: 'automatic' }, snapshot, 50400), null);
});

test('VidSrc.ir refreshes expired target timing after long buffering without widening the proof window', async () => {
  const time = clock(), f = playbackFixture(movie, saved('vidsrc-ir', 2700));
  try {
    f.find('ResumePlaybackPrompt').onChoose('resume'); await f.settle(); const p = provider(f);
    await p.observe(ir(2700, 'seeked')); time.tick(1000); await p.observe(ir(2700, 'buffering'));
    time.tick(45000); await f.settle(); assert.ok(warning(f));
    await p.observe(ir(2700)); assert.ok(warning(f));
    time.tick(5400); await p.observe(ir(2705.4)); assert.ok(warning(f));
    time.tick(5400); await p.observe(ir(2710.8)); assert.equal(warning(f), false);
    assert.equal(f.props.sourceId, 'vidsrc-ir'); assert.equal(f.mounted, 1);
  } finally { f.dispose(); time.restore(); }
});

for (const [action, target] of [['resume', 600], ['replay-30', 570], ['start-over', 0]]) {
  test(`CineSrc ${action}: one command owner, stable URL and mounts, no target pinning`, async () => {
    const time = clock(), f = playbackFixture(movie, saved('cinesrc', 600));
    try {
      f.find('ResumePlaybackPrompt').onChoose(action); await f.settle(); const p = provider(f);
      const url = new URL(f.props.embedUrl), mounts = f.mounted, builds = f.urlBuilds.length;
      assert.equal(url.searchParams.has('t'), false, 'Mobile command seeking must not also send a URL start target');
      assert.equal(url.searchParams.has('time'), false);
      await p.observe(cine('timeupdate', 1)); time.tick(1000); await p.observe(cine('timeupdate', 2));
      await p.observe(cine('ready')); await p.observe(cine('loadedmetadata'));
      await p.observe(cine('waiting', 2));
      time.tick(3000); await f.settle();
      assert.equal(p.commands.filter(c => c.data.command === 'seek').length, 1, 'slow acknowledgement/readiness cannot resubmit the target');
      assert.equal(p.commands.filter(c => c.data.command === 'play' || c.data.command === 'pause').length, 0);
      assert.equal(p.commands[0].targetOrigin, 'https://cinesrc.st'); assert.deepEqual([...p.commands[0].data.args], [target]);
      await p.observe(cine('seeked', target)); time.tick(1000); await p.observe(cine('timeupdate', target + 1));
      time.tick(1000); await p.observe(cine('timeupdate', target + 2));
      time.tick(1000); await p.observe(cine('timeupdate', target + 3));
      assert.equal(f.props.continuityError, undefined); assert.equal(f.props.activeHandoffId, null);
      time.tick(12000); await f.settle(); await p.observe(cine('ready')); await p.observe(cine('timeupdate', target + 15));
      assert.equal(p.commands.length, 1); assert.equal(f.mounted, mounts); assert.equal(f.urlBuilds.length, builds);
      assert.equal(nodes(f.surface.result, 'WebView')[0].props.key, p.webViewKey);
      assert.equal(nodes(f.surface.result, 'WebView')[0].props.shieldSessionId, p.sessionId);
      assert.equal(f.props.sourceId, 'cinesrc'); assert.equal(f.library.library.getPlaybackProgress('movie', 9).currentTime, target + 15);
      assert.equal(f.library.library.getPlaybackSourcePreference('movie', 9).sourceId, 'cinesrc');
      assert.equal(f.injections.filter(s => s.includes('ORION_RESUME_RESULT')).length, 1);
      timeline(f, action, p);
    } finally { f.dispose(); time.restore(); }
  });
}

test('CineSrc slow acknowledgement cannot multiply retry chains, including zero', () => {
  const time = clock();
  try { for (const target of [600, 570, 0]) {
    const r = runtime('https://cinesrc.st'), script = createCineSrcResumeScript(target, `once-${target}`);
    r.inject(script); r.inject(script);
    r.send(cine('ready')); r.send(cine('loadedmetadata')); time.tick(4000);
    assert.equal(r.commands.length, 1); assert.equal(r.commands[0].data.command, 'seek');
    r.send(cine('seeked', target), 'https://unrelated.example');
    assert.equal(r.messages.filter(m => m.status === 'applied').length, 0);
    r.send(cine('seeked', target)); time.tick(10000); r.send(cine('ready'));
    assert.equal(r.commands.length, 1); assert.equal(r.messages.filter(m => m.status === 'applied').length, 1);
    assert.equal(r.listeners.get('message').size, 0);
  } } finally { time.restore(); }
});

test('CineSrc new explicit attempt cancels old listeners and results; page exit releases everything', () => {
  const time = clock(), r = runtime('https://cinesrc.st');
  try {
    r.inject(createCineSrcResumeScript(600, 'old')); r.inject(createCineSrcResumeScript(570, 'new'));
    r.send(cine('seeked', 600)); r.send(cine('seeked', 570)); time.tick(10000);
    assert.equal(r.commands.length, 2); assert.deepEqual(r.messages.filter(m => m.status === 'applied').map(m => m.handoffId), ['new']);
    r.inject(createCineSrcResumeScript(0, 'exit')); r.send({}, 'https://cinesrc.st');
    for (const fn of [...r.listeners.get('pagehide')]) fn(); time.tick(10000);
    assert.equal(r.listeners.get('message').size, 0); assert.equal(r.listeners.get('pagehide').size, 0);
    assert.equal(r.messages.some(m => m.handoffId === 'exit' && m.status === 'unavailable'), false);
  } finally { time.restore(); }
});

test('healthy VidLink Movie control retains its existing URL/seek behavior without repeated mounts', async () => {
  const time = clock(), f = playbackFixture(movie, saved('vidlink', 600));
  try {
    f.find('ResumePlaybackPrompt').onChoose('resume'); await f.settle(); const mounts = f.mounted, url = f.props.embedUrl, builds = f.urlBuilds.length;
    const p = provider(f); p.enableVideo(600);
    await f.emit('playing', 600); time.tick(1000); await f.emit('playing', 601); time.tick(1000); await f.emit('playing', 602);
    time.tick(1000); await f.emit('playing', 603);
    assert.equal(f.props.continuityError, undefined); assert.equal(f.mounted, mounts); assert.equal(f.props.embedUrl, url);
    assert.equal(f.urlBuilds.length, builds); assert.equal(f.injections.filter(s => s.includes('ORION_RESUME_RESULT')).length, 1);
    assert.equal(f.library.library.getPlaybackSourcePreference('movie', 9).sourceId, 'vidlink');
    assert.deepEqual(p.videoSeeks, [600]); assert.equal(p.playRequests, 1);
    timeline(f, 'control-resume', p);
  } finally { f.dispose(); time.restore(); }
});

test('a stale attempt callback and a replacement session cannot clear the current VidSrc.ir warning', async () => {
  const time = clock(), f = playbackFixture(movie, saved('vidsrc-ir', 2700));
  try {
    f.find('ResumePlaybackPrompt').onChoose('resume'); await f.settle(); const old = f.props;
    time.tick(15000); await f.settle(); assert.ok(warning(f));
    f.props.onContinuityRetry(); await f.settle(); time.tick(15000); await f.settle();
    const current = f.props, view = nodes(f.surface.result, 'WebView')[0].props;
    assert.notEqual(current.continuityAttemptId, old.continuityAttemptId);
    for (const position of [2700, 2702]) old.onPlaybackSnapshot({ sessionId: view.shieldSessionId, sourceId: 'vidsrc-ir',
      currentTime: position, duration, observedAt: Date.now(), state: 'playing' });
    await f.settle(); assert.ok(warning(f)); assert.ok(f.traces.some(row => row.reason === 'attempt-mismatch'));
    current.onContinuitySession(current.continuityAttemptId, 'vidsrc-ir', 'replacement');
    for (const position of [2700, 2702]) { time.tick(1000); current.onPlaybackSnapshot({ sessionId: 'replacement', sourceId: 'vidsrc-ir',
      currentTime: position, duration, observedAt: Date.now(), state: 'playing' }); }
    await f.settle(); assert.ok(warning(f)); assert.ok(f.traces.some(row => row.reason === 'session-mismatch'));
    assert.equal(f.library.library.getPlaybackProgress('movie', 9).currentTime, 2700);
  } finally { f.dispose(); time.restore(); }
});

test('settlement rejection diagnostics expose exact predicates without changing their acceptance', () => {
  const attempt = policy.createPlaybackHandoff({ reason: 'return', fromSourceId: 'vidsrc-ir', fromSessionId: null,
    targetSourceId: 'vidsrc-ir', requestedTime: 2700, strategy: 'url-param', now: 1000 });
  const sample = { sourceId: 'vidsrc-ir', sessionId: 'current', currentTime: 2700, duration, observedAt: 7000, state: 'playing' };
  for (const [patch, reason] of [[{ sourceId: 'vidsrc.ir' }, 'source-mismatch'], [{ sessionId: '' }, 'missing-session'],
    [{ currentTime: NaN }, 'invalid-position'], [{ observedAt: 1 }, 'pre-attempt-observation'],
    [{ observedAt: 10000 }, 'future-observation'], [{ currentTime: 2705.4 }, 'target-outside-tolerance']]) {
    assert.equal(policy.evaluatePlaybackHandoff(attempt, { ...sample, ...patch }, 7000).reason, reason);
  }
  assert.equal(policy.evaluatePlaybackHandoff(attempt, sample, 14000).reason, 'stale-observation');
  const reached = policy.confirmPlaybackHandoff(attempt, sample, 7000);
  assert.equal(policy.evaluatePlaybackHandoff(reached, { ...sample, state: 'buffering' }, 7000).reason, 'not-playing');
  assert.equal(policy.evaluatePlaybackHandoff({ ...attempt, status: 'confirmed' }, sample, 7000).reason, 'inactive-or-terminal');
});

test('release diagnostics cap a transaction and never print raw identity, URL, token or unknown categories', () => {
  const rows = [], original = console.info;
  console.info = (prefix, raw) => rows.push([prefix, JSON.parse(raw)]);
  try {
    const diagnostics = loader({ 'expo-constants': { default: {} }, './storageAdapter': { getMobileStorageHealth: () => ({}) } })('apps/mobile/src/services/mobileDiagnostics.ts');
    for (let i = 0; i < 150; i++) diagnostics.traceMobilePlayback('telemetry', { sourceId: 'vidsrc-ir',
      attemptId: 'private-attempt-token', sessionId: 'private-session-cookie', routeIdentity: 'private-title',
      reason: 'https://private.example/?token=secret', position: i, state: 'playing' });
    assert.equal(rows.length, 128); const serialized = JSON.stringify(rows);
    assert.doesNotMatch(serialized, /private|cookie|token|secret|https:/);
    assert.ok(rows.every(([, row]) => typeof row.attempt === 'number' && row.provider === 'vidsrc-ir' && row.reason === 'rejected-category'));
  } finally { console.info = original; }
});
