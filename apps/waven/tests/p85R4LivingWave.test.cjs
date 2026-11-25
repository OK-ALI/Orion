const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const test = require('node:test'), ts = require('typescript'), React = require('react');
const { JSDOM } = require('jsdom');
const compile = (source, filename) => ts.transpileModule(source, { fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
require.extensions['.ts'] = require.extensions['.tsx'] = (record, filename) => record._compile(compile(fs.readFileSync(filename, 'utf8'), filename), filename);
function load(relative, overrides) {
  const filename = path.resolve(__dirname, '..', relative), previous = Module._load;
  Module._load = function(request, parent, ...args) {
    const key = Object.keys(overrides).find(key => request === key || key.startsWith('/') && request.endsWith(key));
    return key ? overrides[key] : previous.call(this, request, parent, ...args);
  };
  try { const record = new Module(filename, module); record.filename = filename; record.paths = Module._nodeModulePaths(path.dirname(filename)); record._compile(compile(fs.readFileSync(filename, 'utf8'), filename), filename); return record.exports; }
  finally { Module._load = previous; }
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
async function mount(t, element) {
  const dom = new JSDOM('<div id="root"></div>'), previous = { window: global.window, document: global.document, act: global.IS_REACT_ACT_ENVIRONMENT };
  global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
  const root = require('react-dom/client').createRoot(dom.window.document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); dom.window.close(); Object.assign(global, { window: previous.window, document: previous.document, IS_REACT_ACT_ENVIRONMENT: previous.act }); });
  await React.act(async () => root.render(element));
  return { container: dom.window.document.getElementById('root'), render: async element => React.act(async () => root.render(element)), unmount: async () => React.act(async () => root.unmount()) };
}
// Native Animated is a deterministic test double. Physical motion remains an owner gate.
function waveFixture({ reduced = false, preference, deferNativeRead = false } = {}) {
  const loops = [], values = [], reads = [], appListeners = new Set(), motionListeners = new Set();
  const node = tag => ({ children, accessibilityLabel }) => React.createElement(tag, { 'aria-label': accessibilityLabel }, children);
  const rn = {
    View: node('div'), StyleSheet: { create: x => x }, Easing: { linear: x => x },
    AppState: { currentState: 'active', addEventListener: (_, listener) => { appListeners.add(listener); return { remove: () => appListeners.delete(listener) }; } },
    AccessibilityInfo: { isReduceMotionEnabled: () => preference ?? Promise.resolve(reduced), addEventListener: (_, listener) => { motionListeners.add(listener); return { remove: () => motionListeners.delete(listener) }; } },
    Animated: { View: node('i'), Value: class {
      constructor(value) { this.value = value; this.stops = 0; this.curves = []; values.push(this); }
      interpolate(curve) { this.curves.push(curve); return curve; }
      stopAnimation(callback) { this.stops++; if(callback) { if(deferNativeRead) reads.push(() => callback(this.value)); else callback(this.value); } }
      setValue(value) { this.value = value; }
    }, modulo: (value, modulus) => ({ interpolate(curve) { value.curves.push(curve); return { curve, modulus }; } }), timing: (value, config) => ({ value, config }), loop: timing => {
      const loop = { timing, starts: 0, stops: 0, start() { this.starts++; }, stop() { this.stops++; } }; loops.push(loop); return loop;
    } },
  };
  const hook = load('src/hooks/useWavenReducedMotion.ts', { 'react-native': rn });
  const { WavenLivingWave: Wave } = load('src/components/player/WavenLivingWave.tsx', { 'react-native': rn, '/useWavenReducedMotion': hook, '/WavenText': { WavenText: node('span') } });
  return { Wave, loops, values, reads, appListeners, motionListeners, motion: value => motionListeners.forEach(f => f(value)), app: value => appListeners.forEach(f => f(value)) };
}
test('R4 Playing starts one continuous native-driver four-bar loop without a React frame timer', async t => {
  const f = waveFixture(), ui = await mount(t, React.createElement(f.Wave, { state: 'playing' }));
  assert.equal(ui.container.querySelectorAll('i').length, 4); assert.equal(f.values.length, 1); assert.equal(f.loops.length, 1);
  const loop = f.loops[0]; assert.equal(loop.starts, 1); assert.equal(loop.timing.config.useNativeDriver, true); assert.equal(loop.timing.config.isInteraction, false);
  assert.equal(loop.timing.config.duration, 1320); assert.equal(loop.timing.config.toValue, 1);
  for (const curve of f.values[0].curves) { assert.ok(new Set(curve.outputRange).size > 1); assert.equal(curve.outputRange[0], curve.outputRange.at(-1)); }
  assert.match(ui.container.innerHTML, /Currently playing/);
});
test('R4 Paused freezes the existing pose; resume and unmount stop/clean the same presentation owner', async t => {
  const f = waveFixture(), element = state => React.createElement(f.Wave, { state }); const ui = await mount(t, element('playing'));
  f.values[0].value = 0.375; await ui.render(element('paused'));
  assert.equal(f.loops[0].stops, 1); assert.equal(f.values[0].value, 0.375); assert.equal(f.values.length, 1); assert.match(ui.container.textContent, /Paused/);
  await ui.render(element('playing')); assert.equal(f.loops.length, 2); await ui.unmount();
  assert.equal(f.loops[1].stops, 1); assert.equal(f.appListeners.size, 0); assert.equal(f.motionListeners.size, 0);
});
test('R4 PREPARING, BUFFERING and FAILED remain distinct static, accessible states', async t => {
  const f = waveFixture(), element = state => React.createElement(f.Wave, { state }); const ui = await mount(t, element('preparing'));
  assert.match(ui.container.innerHTML, /Preparing audio/); assert.equal(f.loops.length, 0);
  await ui.render(element('buffering')); assert.match(ui.container.innerHTML, /Buffering audio/);
  await ui.render(element('failed')); assert.match(ui.container.innerHTML, /Playback failed. Retry/); assert.match(ui.container.textContent, /Retry/);
  assert.equal(f.loops.length, 0); await ui.render(element('available')); assert.equal(ui.container.textContent, '');
});
test('R4 system Reduced Motion holds static on mount and responds live without restarting audio', async t => {
  const f = waveFixture({ reduced: true }); await mount(t, React.createElement(f.Wave, { state: 'playing' })); assert.equal(f.loops.length, 0);
  await React.act(async () => f.motion(false)); assert.equal(f.loops.length, 1);
  await React.act(async () => f.motion(true)); assert.equal(f.loops[0].stops, 1);
  await React.act(async () => f.motion(false)); assert.equal(f.loops.length, 2);
});
test('R4 unknown motion preference stays static; late initial read cannot undo a newer system event', async t => {
  const preference = deferred(), f = waveFixture({ preference: preference.promise }); await mount(t, React.createElement(f.Wave, { state: 'playing' }));
  assert.equal(f.loops.length, 0); await React.act(async () => f.motion(true)); await React.act(async () => preference.resolve(false)); assert.equal(f.loops.length, 0);
});
test('R4 background suspends the loop; foreground restarts only while still Playing', async t => {
  const f = waveFixture(), ui = await mount(t, React.createElement(f.Wave, { state: 'playing' }));
  await React.act(async () => f.app('background')); assert.equal(f.loops[0].stops, 1);
  await ui.render(React.createElement(f.Wave, { state: 'paused' })); await React.act(async () => f.app('active')); assert.equal(f.loops.length, 1);
  await ui.render(React.createElement(f.Wave, { state: 'playing' })); assert.equal(f.loops.length, 2);
});
test('R4 semantic motion tokens can change rhythm without another playback or theme implementation', async t => {
  const f = waveFixture(), motion = { cycleMs: 1800, barWidth: 3, barHeight: 18, barGap: 2, scales: [0.3, 0.6, 0.9, 0.5] };
  await mount(t, React.createElement(f.Wave, { state: 'playing', motion })); assert.equal(f.loops[0].timing.config.duration, 1800);
});
test('R5 resume traverses one complete periodic cycle from the preserved fractional pose', async t => {
  const f = waveFixture(), element = state => React.createElement(f.Wave, { state }); const ui = await mount(t, element('playing'));
  f.values[0].value = 0.375; await ui.render(element('paused')); await ui.render(element('playing'));
  const resumed = f.loops.at(-1).timing;
  assert.equal(f.values[0].value, 0.375); assert.equal(resumed.config.toValue, 1.375);
  // Android repeats from the original start value: start/end phases must match.
  assert.equal(resumed.config.toValue % 1, f.values[0].value % 1);
  assert.equal(resumed.config.useNativeDriver, true); assert.equal(resumed.config.isInteraction, false);
});
test('R5 every bar closes its cycle without a velocity kink or out-of-bounds scale', async t => {
  const f = waveFixture(); await mount(t, React.createElement(f.Wave, { state: 'playing' }));
  assert.ok(f.values[0].curves.length >= 4);
  for(const {inputRange:x, outputRange:y} of f.values[0].curves.slice(-4)) {
    assert.equal(y[0], y.at(-1)); assert.ok(y.every(value => value >= 0.35 && value <= 1));
    const slopes = y.slice(1).map((value,i)=>(value-y[i])/(x[i+1]-x[i]));
    assert.ok(Math.abs(slopes[0]-slopes.at(-1)) <= Math.max(...slopes.map(Math.abs))*0.1, 'cycle boundary must approach the same velocity from both sides');
  }
});
test('R5 a delayed native phase read cannot start motion after pause or unmount', async t => {
  const f = waveFixture({deferNativeRead:true}), ui = await mount(t, React.createElement(f.Wave, { state: 'playing' }));
  assert.equal(f.reads.length, 1); assert.equal(f.loops.length, 0);
  await ui.render(React.createElement(f.Wave, { state: 'paused' })); await React.act(async()=>f.reads[0]()); assert.equal(f.loops.length, 0);
  await ui.render(React.createElement(f.Wave, { state: 'playing' })); assert.equal(f.reads.length, 2); await ui.unmount();
  await React.act(async()=>f.reads[1]()); assert.equal(f.loops.length, 0);
});

const track = id => ({ id, title: id, source: { provider: 'catalog', id } });
const snap = (overrides = {}) => ({ currentQueueId: 'A', queueIds: ['A','B'], state: 'playing', playing: true, buffering: false, playWhenReady: true, error: null, positionMs: 0, ...overrides });
function presentationFixture(resolveCandidate) {
  let emit, subscriptions = 0, removes = 0; const lease = { uri: 'https://example.test/audio', expiresAtMs: Date.now() + 600000 };
  const runtime = load('src/features/playback/trackPlaybackRuntime.ts', {
    '/connectivityService': { wavenConnectivity: {} }, '/youtubeMusicStreaming': { warmWavenStreamingSource() {}, youtubeMusicStreaming: { id: 'stream', searchForTrack: async t => [{ id: t.id }], resolveCandidate: resolveCandidate ?? (async () => lease) } },
    '/libraryRuntime': { getLocalLibrary: () => ({ claimQueue() {} }) },
    '/WavenPlaybackNative': { nativePlayback: { getSnapshot: () => new Promise(() => {}) }, subscribeNativePlayback: listener => { emit = listener; subscriptions++; return { remove: () => removes++ }; }, getPersistedPlaybackRecoveryState: async () => ({ queue: [ { queueId: 'A', track: track('A') }, { queueId: 'B', track: track('B') } ] }), replaceNativeQueue: async () => snap() },
  });
  return { ...runtime, emit: value => emit(value), subscriptions: () => subscriptions, removes: () => removes };
}
test('R4 100 mounted row subscribers commit only identity changes, never list-wide native ticks', async t => {
  const f = presentationFixture(), renders = new Map(), states = new Map();
  function Row({ id }) { const state = f.useWavenTrackPresentation(track(id)); renders.set(id, (renders.get(id) ?? 0) + 1); states.set(id, state); return React.createElement('span', {}, state); }
  const ui = await mount(t, React.createElement('div', {}, Array.from({ length: 100 }, (_, i) => React.createElement(Row, { key: i, id: i === 0 ? 'A' : i === 1 ? 'B' : `unrelated-${i}` }))));
  assert.equal(f.subscriptions(), 1);
  await React.act(async () => { f.emit(snap()); await tick(); }); assert.equal(states.get('A'), 'playing'); assert.equal(states.get('B'), 'available');
  const counts = new Map(renders); await React.act(async () => { for (let i = 0; i < 200; i++) f.emit(snap({ positionMs: i * 100 })); }); assert.deepEqual(renders, counts);
  await React.act(async () => f.emit(snap({ state: 'paused', playing: false, playWhenReady: false })));
  assert.equal(states.get('A'), 'paused'); assert.equal(renders.get('A'), counts.get('A') + 1);
  for (const [id, count] of counts) if (id !== 'A') assert.equal(renders.get(id), count);
  await React.act(async () => { f.emit(snap({ currentQueueId: 'B' })); await tick(); }); assert.equal(states.get('B'), 'playing'); assert.equal(states.get('A'), 'available');
  await ui.unmount(); assert.equal(f.removes(), 1);
});
test('R4 a handoff update does not rerender unrelated per-track overflow subscribers', async t => {
  const f = presentationFixture(), renders = {}, states = {};
  function Row({ id }) { const value = f.useTrackPlaybackStatus(JSON.stringify(['catalog', id])); renders[id] = (renders[id] ?? 0) + 1; states[id] = value.state; return null; }
  await mount(t, React.createElement(React.Fragment, {}, React.createElement(Row, { id: 'A' }), React.createElement(Row, { id: 'B' })));
  await React.act(async () => f.trackPlayback.play(track('A'))); assert.equal(states.A, 'started'); assert.equal(states.B, 'idle'); assert.equal(renders.B, 1);
});
test('R4 mounted failed row exposes Retry, leaves unrelated row playable, and retries without navigation', async t => {
  let attempt = 0;
  const f = presentationFixture(async candidate => {
    if (candidate.id === 'A' && !attempt++) throw Error('mock source rejected');
    return { uri: 'https://example.test/audio', expiresAtMs: Date.now() + 600000 };
  });
  const wave = waveFixture({ reduced: true });
  const node = tag => ({ children }) => React.createElement(tag, {}, children);
  const controls = load('src/components/library/WavenLibraryControls.tsx', {
    'react-native': { View: node('div'), StyleSheet: { create: x => x }, Platform: { OS: 'web' } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '/WavenText': { WavenText: node('span') }, '/WavenPressable': { WavenPressable: ({ children, onPress, disabled, accessibilityLabel }) => React.createElement('button', { onClick: onPress, disabled, 'aria-label': accessibilityLabel }, children) },
    '/WavenLivingWave': { WavenLivingWave: wave.Wave }, '/WavenArtworkFallback': {}, '/useWavenArtworkLease': {}, '/wavenArtworkLifecycle': {}, '/libraryRuntime': {},
    '/trackPlaybackRuntime': f, '/connectivityHooks': { useWavenConnectivity: () => ({ active: true, internetReady: true }) },
  });
  const ui = await mount(t, React.createElement('div', {}, ['A','B'].map(id => React.createElement(controls.WavenTrackPlayTarget, { key: id, track: track(id) }, id))));
  const buttons = () => [...ui.container.querySelectorAll('button')];
  await React.act(async () => { buttons()[0].click(); await tick(); });
  assert.match(buttons()[0].getAttribute('aria-label'), /Retry A.*failed/); assert.match(buttons()[0].textContent, /Retry/);
  assert.equal(buttons()[1].disabled, false); assert.match(buttons()[1].getAttribute('aria-label'), /Play B/);
  await React.act(async () => { buttons()[1].click(); await tick(); }); assert.equal(f.trackPlayback.getSnapshot().state, 'started');
  await React.act(async () => { buttons()[0].click(); await tick(); }); assert.equal(f.trackPlayback.getSnapshot().state, 'started');
  assert.doesNotMatch(buttons()[0].getAttribute('aria-label'), /Retry|failed/); assert.equal(attempt, 2);
});
