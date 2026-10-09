const test = require('node:test');
const assert = require('node:assert/strict');
const { loader, read } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const frames = new Map(); let nextFrame = 0;
global.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
global.cancelAnimationFrame = id => frames.delete(id);
const flushFrames = () => { const batch = [...frames.values()]; frames.clear(); for (const callback of batch) callback(); };

function fixture({ state = 'active', focused = true, os = 'android', blockLock = false, autoLayout = true, autoAppear = true, rejectLock = false } = {}) {
  const listeners = new Map(), calls = [], pending = [];
  const appearanceListeners = new Set();
  const navigation = { addListener(name, fn) { assert.equal(name, 'transitionEnd'); appearanceListeners.add(fn);
    return () => appearanceListeners.delete(fn); } };
  const appear = (closing = false) => { for (const fn of [...appearanceListeners]) fn({data: {closing}}); };
  const app = { currentState: state, addEventListener(name, fn) {
    if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn);
    return { remove: () => listeners.get(name).delete(fn) };
  } };
  const harness = hookHarness(); let focusCleanup, focusCallback;
  const load = loader({ react: harness.react, 'react-native': { AppState: app, Platform: { OS: os } },
    'expo-router': { useNavigation: () => navigation, useFocusEffect(fn) { harness.react.useEffect(() => {
      focusCallback = fn; if (focused) focusCleanup = fn();
      return () => { focusCleanup?.(); focusCleanup = null; focusCallback = null; };
    }, [fn]); } },
    'expo-screen-orientation': { OrientationLock: { LANDSCAPE: 5, PORTRAIT_UP: 3 },
      lockAsync(mode) { calls.push(mode); return rejectLock ? Promise.reject(Error('orientation unavailable'))
        : blockLock ? new Promise(resolve => pending.push(resolve)) : Promise.resolve(); },
      unlockAsync() { calls.push('release'); return Promise.resolve(); } } });
  const hook = load('apps/mobile/src/features/playback/usePlayerOrientation.ts').usePlayerOrientation;
  harness.start(hook, {});
  if (autoAppear) appear();
  const layout = (width = 400, height = 800) => harness.result.onPlayerLayout({ nativeEvent: { layout: { width, height } } });
  if (autoLayout) { layout(); flushFrames(); }
  return { harness, calls, app, pending, listeners, appearanceListeners, appear,
    emit(name, next) { if (name === 'change') app.currentState = next; for (const fn of [...listeners.get(name) || []]) fn(next); },
    blur() { focused = false; focusCleanup?.(); focusCleanup = null; },
    focus() { focused = true; if (!focusCleanup) focusCleanup = focusCallback(); },
    layout, get controls() { return harness.result; }, settle: async () => { flushFrames(); flushFrames(); await harness.settle(); }, dispose: () => harness.dispose() };
}

test('active Player leases landscape; Resize preserves the existing portrait/landscape intent', async () => {
  const f = fixture(); try {
    await f.settle(); assert.deepEqual(f.calls, [5]); assert.equal(f.controls.isLandscape, true);
    await f.controls.toggleOrientation(); await f.settle(); assert.deepEqual(f.calls, [5, 3]); assert.equal(f.controls.isLandscape, false);
    f.emit('change', 'background'); await f.settle(); assert.equal(f.calls.at(-1), 'release');
    f.emit('change', 'active'); await f.settle(); assert.equal(f.calls.at(-1), 3);
  } finally { f.dispose(); await f.settle(); }
});

test('background and inactive each release before foreground can reacquire the current lease', async () => {
  const f = fixture(); try {
    await f.settle(); f.emit('change', 'inactive'); await f.settle(); assert.equal(f.calls.at(-1), 'release');
    f.emit('change', 'background'); await f.settle(); assert.equal(f.calls.at(-1), 'release');
    f.emit('change', 'active'); await f.settle(); assert.equal(f.calls.at(-1), 5);
  } finally { f.dispose(); await f.settle(); }
});

test('route blur and Android window blur release; background focus cannot acquire orientation', async () => {
  const f = fixture(); try {
    await f.settle(); f.blur(); await f.settle(); assert.equal(f.calls.at(-1), 'release');
    f.emit('change', 'active'); await f.settle(); assert.equal(f.calls.at(-1), 'release');
    f.focus(); await f.settle(); assert.equal(f.calls.at(-1), 5);
    f.emit('blur'); await f.settle(); assert.equal(f.calls.at(-1), 'release');
    f.emit('change', 'background'); f.emit('focus'); await f.settle(); assert.equal(f.calls.at(-1), 'release');
    f.emit('change', 'active'); await f.settle(); assert.equal(f.calls.at(-1), 5);
  } finally { f.dispose(); await f.settle(); }
});

test('unfocused or background mount never acquires a landscape lease', async () => {
  for (const options of [{ focused: false }, { state: 'background' }]) {
    const f = fixture(options); try { await f.settle(); assert.ok(!f.calls.includes(5)); }
    finally { f.dispose(); await f.settle(); }
  }
});

test('queued landscape and stale Resize callbacks cannot resurrect an exited Player', async () => {
  const f = fixture(); const stale = f.controls.toggleOrientation;
  flushFrames();
  f.dispose(); await f.settle(); await stale(); await f.settle();
  assert.ok(!f.calls.includes(5)); assert.equal(f.calls.at(-1), 'release');
  assert.ok([...f.listeners.values()].every(set => set.size === 0));
});

test('in-flight lock settles before background release; stale queued toggles are discarded', async () => {
  const f = fixture({ blockLock: true }); try {
    await f.settle(); assert.deepEqual(f.calls, [5]);
    void f.controls.toggleOrientation(); f.emit('change', 'background');
    f.pending.shift()(); await f.settle(); assert.deepEqual(f.calls, [5, 'release']);
    const count = f.calls.length; await f.controls.toggleOrientation(); await f.settle(); assert.equal(f.calls.length, count);
  } finally { f.dispose(); await f.settle(); }
});

test('explicit exit remains released on late active/focus notifications and stale controls', async () => {
  const f = fixture(); try {
    await f.settle(); await f.controls.releaseOrientation();
    const count = f.calls.length; f.emit('change', 'active'); f.emit('focus'); await f.controls.toggleOrientation(); await f.settle();
    assert.ok(f.calls.slice(count).every(value => value === 'release'));
  } finally { f.dispose(); await f.settle(); }
});

test('provider fullscreen messages have no orientation authority; global settings and fullscreen rewrites are absent', () => {
  const hook = read('apps/mobile/src/features/playback/usePlayerOrientation.ts');
  assert.doesNotMatch(hook, /fullscreenchange|DeviceEventEmitter|Settings\.System|USER_ROTATION|ACCELEROMETER_ROTATION/);
  assert.doesNotMatch(read('apps/mobile/src/features/playback/aniLinkTelemetry.ts'), /ScreenOrientation|requestedOrientation|lockAsync/);
  assert.doesNotMatch(read('apps/mobile/src/features/playback/embeddedTelemetry.ts'), /ScreenOrientation|requestedOrientation|lockAsync/);
});

test('older Player cleanup and pending commands cannot release a newer Player lease', async () => {
  let current;
  const calls = [], listeners = new Set();
  const appearanceListeners = new Set();
  const navigation = { addListener(name, fn) { appearanceListeners.add(fn); return () => appearanceListeners.delete(fn); } };
  const appear = () => { for (const fn of [...appearanceListeners]) fn({data: {closing: false}}); };
  const react = new Proxy({}, { get: (_, name) => (...args) => current.react[name](...args) });
  const load = loader({ react, 'react-native': { Platform: { OS: 'android' }, AppState: {
    currentState: 'active', addEventListener(name, fn) { listeners.add(fn); return { remove: () => listeners.delete(fn) }; } } },
    'expo-router': { useNavigation: () => navigation, useFocusEffect(fn) { react.useEffect(fn, [fn]); } },
    'expo-screen-orientation': { OrientationLock: { LANDSCAPE: 5, PORTRAIT_UP: 3 },
      lockAsync(mode) { calls.push(mode); return Promise.resolve(); }, unlockAsync() { calls.push('release'); return Promise.resolve(); } } });
  const hook = load('apps/mobile/src/features/playback/usePlayerOrientation.ts').usePlayerOrientation;
  const older = hookHarness(), newer = hookHarness();
  older.start(() => { current = older; return hook(); }, {});
  appear();
  older.result.onPlayerLayout({ nativeEvent: { layout: { width: 400, height: 800 } } }); flushFrames();
  newer.start(() => { current = newer; return hook(); }, {});
  appear();
  newer.result.onPlayerLayout({ nativeEvent: { layout: { width: 400, height: 800 } } }); flushFrames();
  flushFrames();
  await newer.settle(); assert.deepEqual(calls, [5]);
  const stale = older.result.toggleOrientation; older.dispose(); await newer.settle(); await stale();
  assert.deepEqual(calls, [5]);
  newer.dispose(); await newer.settle(); assert.deepEqual(calls, [5, 'release']); assert.equal(listeners.size, 0);
  assert.equal(appearanceListeners.size, 0);
});

test('focused and laid-out Player cannot rotate until its own native opening completes', async () => {
  const f = fixture({autoAppear: false}); try {
    await f.settle(); assert.deepEqual(f.calls, []); assert.equal(frames.size, 0);
    f.appear(true); await f.settle(); assert.deepEqual(f.calls, []);
    f.appear(); await f.harness.settle(); assert.deepEqual(f.calls, []);
    flushFrames(); await f.harness.settle(); assert.deepEqual(f.calls, []);
    await f.settle(); assert.deepEqual(f.calls, [5]);
    f.appear(); await f.settle(); assert.deepEqual(f.calls, [5]);
  } finally { f.dispose(); await f.settle(); }
});

test('late native appearance cannot resurrect cancelled, unfocused or disposed Player entry', async () => {
  for (const cancel of [f => f.controls.releaseOrientation(), f => f.blur(), f => f.dispose()]) {
    const f = fixture({autoAppear: false}); try {
      const stale = [...f.appearanceListeners][0];
      await cancel(f); stale({data: {closing: false}}); await f.settle();
      assert.ok(!f.calls.includes(5));
    } finally { f.dispose(); await f.settle(); assert.equal(f.appearanceListeners.size, 0); }
  }
});

test('entry waits for a usable Player root layout and a completed shell frame before acquiring landscape', async () => {
  const f = fixture({autoLayout: false}); try {
    await f.harness.settle(); assert.deepEqual(f.calls, []); assert.equal(f.controls.entryReady, false);
    for (const [width, height] of [[0, 800], [400, 0], [NaN, 800], [400, Infinity]]) f.layout(width, height);
    await f.settle(); assert.deepEqual(f.calls, []);
    f.layout(); await f.harness.settle(); assert.deepEqual(f.calls, []);
    flushFrames(); await f.harness.settle(); assert.deepEqual(f.calls, []); assert.equal(f.controls.entryReady, false);
    await f.settle(); assert.deepEqual(f.calls, [5]); assert.equal(f.controls.entryReady, false);
    f.layout(800, 400); await f.settle(); assert.equal(f.controls.entryReady, true);
    f.layout(800, 400); await f.settle(); assert.deepEqual(f.calls, [5]);
  } finally { f.dispose(); await f.settle(); }
});

test('Back, route blur, screen lock and unmount reject stale callbacks at both entry frame boundaries', async () => {
  for (const shellFrameStarted of [false, true]) {
  for (const cancel of [f => f.controls.releaseOrientation(), f => f.blur(), f => f.emit('blur'), f => f.dispose()]) {
    const f = fixture({autoLayout: false}); try {
      f.layout(); if (shellFrameStarted) flushFrames();
      const callback = [...frames.values()][0]; assert.equal(typeof callback, 'function');
      await cancel(f); callback(); await f.settle(); assert.ok(!f.calls.includes(5));
      f.layout(800, 400); await f.settle(); assert.ok(!f.calls.includes(5));
    } finally { f.dispose(); await f.settle(); }
  }
  }
});

test('background during entry invalidates its frame and foreground requires a fresh current frame', async () => {
  const f = fixture({autoLayout: false}); try {
    f.layout(); const stale = [...frames.values()][0];
    f.emit('change', 'background'); await f.settle(); assert.deepEqual(f.calls, []);
    f.emit('change', 'active'); stale(); await f.harness.settle(); assert.deepEqual(f.calls, []);
    await f.settle(); assert.deepEqual(f.calls, [5]);
    f.emit('change', 'background'); await f.settle(); assert.equal(f.calls.at(-1), 'release');
  } finally { f.dispose(); await f.settle(); }
});

test('layout received before route focus cannot acquire until the Player actually owns navigation', async () => {
  const f = fixture({autoLayout: false, focused: false}); try {
    f.layout(); await f.settle(); assert.deepEqual(f.calls, []);
    f.focus(); await f.settle(); assert.deepEqual(f.calls, [5]);
  } finally { f.dispose(); await f.settle(); }
});

test('already-landscape entry and web entry become usable without an extra lease or a portrait-only dead end', async () => {
  for (const os of ['android', 'web']) {
    const f = fixture({autoLayout: false, os}); try {
      f.layout(os === 'android' ? 800 : 400, os === 'android' ? 400 : 800); await f.settle();
      assert.equal(f.controls.entryReady, true); assert.deepEqual(f.calls, os === 'android' ? [5] : []);
    } finally { f.dispose(); await f.settle(); }
  }
});

test('native orientation rejection reveals the existing Player without an artificial timeout', async () => {
  const f = fixture({rejectLock: true}); try {
    await f.settle(); assert.deepEqual(f.calls, [5]); assert.equal(f.controls.entryReady, true);
    assert.doesNotMatch(read('apps/mobile/src/features/playback/usePlayerOrientation.ts'), /setTimeout|setInterval/);
  } finally { f.dispose(); await f.settle(); }
});
