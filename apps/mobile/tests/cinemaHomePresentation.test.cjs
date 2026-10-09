'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
const texts = (node) => nodes(node).filter((n) => n.type === 'Text').map((n) => n.props.children);
const style = (value) => Object.assign({}, ...(Array.isArray(value) ? value.flat(Infinity).filter(Boolean) : [value]));
const theme = { text: 'text', textSecondary: 'secondary', accent: 'accent', background: 'background', surface: 'surface', border: 'border' };

// Real presentation components with deterministic hooks/time; remote API and
// mutation dependencies are deliberately absent from this boundary.
function harness({ component = 'local', state = 'degraded', pathname = '/', saved = {}, savedOrder = [], entries = [],
  reduced = false, systemReduced = false, width = 400, height = 900, isTablet = false, props = {} } = {}) {
  const slots = [], modules = new Map(), timers = new Map(), routes = [], keyboard = new Map(), animations = [];
  let cursor = 0, dirty = false, effects = [], result, now = 0, nextTimer = 0;
  let network = { productState: state, remoteReady: state === 'online' };
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, (next) => { const value = typeof next === 'function' ? next(slots[i].value) : next;
        if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; if (!slots[i]) slots[i] = { current: initial }; return slots[i]; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) effects.push({ i, fn, deps, cleanup: slots[i]?.cleanup }); },
  };
  class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } }
  const element = (type, props, key) => ({ type, props: props || {}, key });
  const themeContext = { useOrionTheme: () => ({ theme, preferences: { reducedMotion: reduced }, systemReducedMotion: systemReduced }) };
  const networkContext = { useNetworkStatus: () => network };
  const library = { useLibrary: () => ({ saved, savedOrder, getContinueWatching: () => entries }) };
  const mocks = {
    react, 'react/jsx-runtime': { jsx: element, jsxs: element },
    'react-native': { ...Object.fromEntries(['View', 'Text', 'ScrollView', 'FlatList', 'Pressable', 'ActivityIndicator'].map((s) => [s, s])),
      StyleSheet: { create: (s) => s }, useWindowDimensions: () => ({ width, height }),
      Keyboard: { addListener: (name, fn) => { keyboard.set(name, fn); return { remove: () => keyboard.delete(name) }; } },
      Animated: { View: 'Animated.View', Value, timing: (_v, options) => { animations.push(options); return {}; }, parallel: () => ({ start: (fn) => fn() }) } },
    'expo-router': { usePathname: () => pathname, useRouter: () => ({ push: (route) => routes.push(route), setParams: (params) => routes.push(params) }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' }, 'expo-blur': { BlurView: 'BlurView' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16, right: 0 }) },
    '@orion/shared/tokens': { spacing: Array.from({ length: 20 }, (_, i) => i * 4), radii: { md: 12, xl: 20, full: 999 } },
    '../../context/ThemeContext': themeContext, '../context/ThemeContext': themeContext,
    '../context/NetworkContext': networkContext,
    '../../context/LibraryContext': library,
    '../../context/PerformanceContext': { usePerformanceProfile: () => ({ resolvedProfile: 'balanced' }) },
    '../../services/listPerformance': { getRailRenderBudget: () => ({ initialNumToRender: 3, maxToRenderPerBatch: 3, windowSize: 3 }) },
    '../services/responsive': { useResponsiveLayout: () => ({ width, isTablet, isLandscape: width > height }) },
    '../../components/MediaCard': { MediaCard: 'MediaCard' },
    './HomeLocalLibrary': { HomeLocalLibrary: 'HomeLocalLibrary' },
    './homeLayoutPreferences': { HOME_RAIL_LABELS: { 'trending-movies': 'Trending Movies', 'trending-tv': 'Trending TV Shows', upcoming: 'Coming Soon' } },
  };
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const requireLocal = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      assert.ok(name.startsWith('.'), 'Unexpected dependency: ' + name);
      const base = path.resolve(path.dirname(file), name);
      const resolved = ['.ts', '.tsx'].map((ext) => base + ext).find((candidate) => fs.existsSync(candidate));
      assert.ok(resolved, 'Missing dependency: ' + name); return load(resolved);
    };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext('(function(require,module,exports){' + code + '})', {
      setTimeout: (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, at: now + delay }); return id; },
      clearTimeout: (id) => timers.delete(id),
    })(requireLocal, module, module.exports);
    return module.exports;
  }
  const files = {
    local: ['src/features/home/HomeLocalLibrary.tsx', 'HomeLocalLibrary'],
    loading: ['src/features/home/HomeCatalogPlaceholder.tsx', 'HomeCatalogPlaceholder'],
    search: ['src/components/GlobalSearchShortcut.tsx', 'GlobalSearchShortcut'],
    header: ['src/components/MobilePageHeader.tsx', 'MobilePageHeader'],
    panel: ['src/components/HomeConnectionPanel.tsx', 'HomeConnectionPanel'],
  };
  const [file, name] = files[component], Component = load(path.join(root, file))[name];
  const defaults = component === 'local' ? { showContinueWatching: true }
    : component === 'loading' ? { railIds: ['trending-movies', 'trending-tv', 'upcoming'], showContinueWatching: true }
      : component === 'header' ? { title: 'Cinema', compact: true, reserveFloatingTriggerInLandscape: true }
        : component === 'panel' ? { state, loading: false, error: null, compact: true } : {};
  function render() {
    let count = 0;
    do { assert.ok(++count < 20); cursor = 0; dirty = false; effects = []; result = Component({ ...defaults, ...props });
      for (const effect of effects) effect.cleanup?.();
      for (const effect of effects) slots[effect.i] = { deps: effect.deps, cleanup: effect.fn() };
    } while (dirty);
  }
  render();
  return { routes, animations, timers, keyboard, render, get result() { return result; },
    find: (label) => nodes(result).find((n) => n.props.accessibilityLabel === label),
    connect(next) { network = { productState: next, remoteReady: next === 'online' }; render(); },
    advance(ms) { now += ms; for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.fn(); } render(); },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); },
  };
}

test('unavailable with My List reuses ordered saved records, existing MediaCard and existing destinations', () => {
  const saved = { movie_1: { id: 1, title: 'Movie', media_type: 'movie' }, tv_2: { id: 2, name: 'Series', media_type: 'tv' } };
  const h = harness({ saved, savedOrder: ['tv_2', 'missing', 'movie_1'] });
  assert.ok(texts(h.result).includes('My List')); assert.ok(!texts(h.result).includes('Your local Orion'));
  const list = nodes(h.result).find((n) => n.type === 'FlatList');
  assert.strictEqual(list.props.data[0], saved.tv_2); assert.strictEqual(list.props.data[1], saved.movie_1);
  assert.equal(list.props.keyExtractor(saved.tv_2), 'tv_2');
  const card = list.props.renderItem({ item: saved.tv_2 }); assert.equal(card.type, 'MediaCard'); card.props.onPress();
  assert.equal(h.routes[0].pathname, '/media/[id]'); assert.equal(h.routes[0].params.id, '2'); assert.equal(h.routes[0].params.type, 'tv');
  h.find('Open Library').props.onPress(); h.find('Open Downloads').props.onPress();
  assert.deepEqual(h.routes.slice(1), ['/(tabs)/library', '/(tabs)/downloads']);
});

test('no saved or continuing titles gets deliberate geometry and truthful local actions without claiming Downloads are empty', () => {
  const h = harness(); assert.ok(texts(h.result).includes('Your local Orion'));
  const body = nodes(h.result).find((n) => style(n.props.style).minHeight === 180); assert.ok(body);
  assert.ok(h.find('Open Library')); assert.ok(h.find('Open Downloads'));
  assert.doesNotMatch(JSON.stringify(h.result), /no downloads|no offline videos|no local content/i);
  const offline = harness({ props: { showActions: false } }); assert.equal(offline.find('Open Downloads'), undefined);
});

test('Continue Watching stays with its existing owner and is not duplicated or mislabeled as an empty Library', () => {
  const h = harness({ entries: [{ key: 'movie_1' }] });
  assert.ok(!texts(h.result).includes('Your local Orion')); assert.ok(h.find('Open Downloads'));
  assert.ok(!nodes(h.result).some((n) => n.type === 'HomeContinueWatching'));
});

test('first load reserves only two visible rail headings and inert poster geometry, then expires without retrying requests', () => {
  const h = harness({ component: 'loading' });
  assert.deepEqual(texts(h.result), ['Trending Movies', 'Trending TV Shows']);
  assert.equal(nodes(h.result).filter((n) => style(n.props.style).width === 140 && style(n.props.style).height === 210).length, 8);
  assert.equal(h.find('Loading Cinema sections').props.accessibilityState.busy, true);
  assert.equal(h.timers.size, 1); h.advance(19999); assert.ok(h.find('Loading Cinema sections'));
  h.advance(1); assert.equal(h.find('Loading Cinema sections'), undefined); assert.equal(h.timers.size, 0);
  assert.equal(texts(h.result).length, 1); assert.match(texts(h.result)[0], /taking longer/);
  h.advance(120000); assert.equal(h.timers.size, 0); assert.deepEqual(h.routes, []);
  assert.ok(nodes(h.result).some((n) => n.type === 'HomeLocalLibrary'));
});

test('loading replacement/unmount cancels its sole presentation timer', () => {
  const h = harness({ component: 'loading', props: { railIds: ['upcoming'] } });
  assert.deepEqual(texts(h.result), ['Coming Soon']); assert.equal(h.timers.size, 1); h.unmount(); assert.equal(h.timers.size, 0);
});

for (const [reduced, systemReduced] of [[false, false], [true, false], [false, true], [true, true], [false, null]]) {
  test('bounded loading stays static with Orion/system motion inputs ' + JSON.stringify([reduced, systemReduced]), () => {
    const h = harness({ component: 'loading', reduced, systemReduced });
    assert.equal(nodes(h.result).filter((n) => style(n.props.style).height === 210).length, 8);
    assert.equal(h.animations.length, 0); assert.equal(h.timers.size, 1); h.unmount();
  });
}

for (const state of ['checking', 'degraded', 'offline', 'reconnecting']) {
  test(state + ' cannot present a dead remote-only global Search action; recovery restores the same shortcut', () => {
    const h = harness({ component: 'search', state }); assert.equal(h.result, null);
    assert.equal(h.routes.length, 0); h.connect('online'); assert.ok(h.find('Search Orion'));
    h.find('Search Orion').props.onPress(); assert.equal(h.routes[0].pathname, '/discover');
    h.unmount(); assert.equal(h.keyboard.size, 0);
  });
}

for (const [reduced, systemReduced, animated] of [[false, false, true], [true, false, false], [false, true, false]]) {
  test('healthy Search keeps existing focus handoff and respects both motion preferences ' + JSON.stringify([reduced, systemReduced]), () => {
    const h = harness({ component: 'search', state: 'online', pathname: '/discover', reduced, systemReduced });
    h.find('Search Orion').props.onPress(); assert.ok(h.routes[0].focusSearch);
    assert.equal(h.animations.length > 0, animated);
    h.keyboard.get('keyboardDidShow')(); h.render(); assert.equal(h.result, null);
    h.unmount();
  });
}

test('compact unavailable status presents one concise message; refresh and retry retain existing behavior', () => {
  const h = harness({ component: 'panel' });
  assert.deepEqual(texts(h.result), ['Cinema is temporarily unavailable.', 'Your Library and Downloads remain available.']);
  assert.equal(h.find('Open Downloads'), undefined, 'Body owns local actions');
  const loading = harness({ component: 'panel', state: 'online', props: { loading: true, initialLoad: true } });
  assert.deepEqual(texts(loading.result), ['Loading Orion Cinema.']);
  let retries = 0;
  const failure = harness({ component: 'panel', state: 'online', props: { error: 'bounded', onRetry: () => retries++ } });
  failure.find('Retry Cinema refresh').props.onPress(); assert.equal(retries, 1);
});

test('no-Hero Cinema uses the existing header safe-area and floating-control lane for phone, landscape and tablet', () => {
  for (const [width, height, isTablet, top, left] of [[400, 900, false, 88, 18], [900, 400, false, 36, 72], [800, 1200, true, 44, 32]]) {
    const h = harness({ component: 'header', width, height, isTablet });
    const layout = style(h.result.props.style); assert.equal(layout.paddingTop, top); assert.equal(layout.paddingLeft, left);
    assert.ok(texts(h.result).includes('Cinema'));
  }
});
