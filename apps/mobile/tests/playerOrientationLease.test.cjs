const test = require('node:test');
const assert = require('node:assert/strict');
const { loader, read } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');

function fixture({ state = 'active', focused = true, os = 'android', blockLock = false } = {}) {
  const listeners = new Map(), calls = [], pending = [];
  const app = { currentState: state, addEventListener(name, fn) {
    if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn);
    return { remove: () => listeners.get(name).delete(fn) };
  } };
  const harness = hookHarness(); let focusCleanup, focusCallback;
  const load = loader({ react: harness.react, 'react-native': { AppState: app, Platform: { OS: os } },
    'expo-router': { useFocusEffect(fn) { harness.react.useEffect(() => {
      focusCallback = fn; if (focused) focusCleanup = fn();
      return () => { focusCleanup?.(); focusCleanup = null; focusCallback = null; };
    }, [fn]); } },
    'expo-screen-orientation': { OrientationLock: { LANDSCAPE: 5, PORTRAIT_UP: 3 },
      lockAsync(mode) { calls.push(mode); return blockLock ? new Promise(resolve => pending.push(resolve)) : Promise.resolve(); },
      unlockAsync() { calls.push('release'); return Promise.resolve(); } } });
  const hook = load('apps/mobile/src/features/playback/usePlayerOrientation.ts').usePlayerOrientation;
  harness.start(hook, {});
  return { harness, calls, app, pending, listeners,
    emit(name, next) { if (name === 'change') app.currentState = next; for (const fn of [...listeners.get(name) || []]) fn(next); },
    blur() { focused = false; focusCleanup?.(); focusCleanup = null; },
    focus() { focused = true; if (!focusCleanup) focusCleanup = focusCallback(); },
    get controls() { return harness.result; }, settle: () => harness.settle(), dispose: () => harness.dispose() };
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
  const react = new Proxy({}, { get: (_, name) => (...args) => current.react[name](...args) });
  const load = loader({ react, 'react-native': { Platform: { OS: 'android' }, AppState: {
    currentState: 'active', addEventListener(name, fn) { listeners.add(fn); return { remove: () => listeners.delete(fn) }; } } },
    'expo-router': { useFocusEffect(fn) { react.useEffect(fn, [fn]); } },
    'expo-screen-orientation': { OrientationLock: { LANDSCAPE: 5, PORTRAIT_UP: 3 },
      lockAsync(mode) { calls.push(mode); return Promise.resolve(); }, unlockAsync() { calls.push('release'); return Promise.resolve(); } } });
  const hook = load('apps/mobile/src/features/playback/usePlayerOrientation.ts').usePlayerOrientation;
  const older = hookHarness(), newer = hookHarness();
  older.start(() => { current = older; return hook(); }, {});
  newer.start(() => { current = newer; return hook(); }, {});
  await newer.settle(); assert.deepEqual(calls, [5]);
  const stale = older.result.toggleOrientation; older.dispose(); await newer.settle(); await stale();
  assert.deepEqual(calls, [5]);
  newer.dispose(); await newer.settle(); assert.deepEqual(calls, [5, 'release']); assert.equal(listeners.size, 0);
});
