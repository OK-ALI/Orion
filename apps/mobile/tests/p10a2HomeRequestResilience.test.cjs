'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const homeFile = path.join(root, 'app/(tabs)/index.tsx');
const homeSource = fs.readFileSync(homeFile, 'utf8');
const compiledCache = new Map();
const endpoints = [
  '/trending/movie/week',
  '/trending/tv/week',
  '/discover/tv?with_original_language=ko&with_genres=18&sort_by=popularity.desc&vote_count.gte=80&page=1',
  '/movie/top_rated?page=1',
  '/tv/top_rated?page=1',
];
const labels = ['Trending Movies', 'Trending TV Shows', 'K-Dramas Spotlight', 'Top Rated Masterpieces'];
const failure = () => new Error('HTTP 503: internal provider detail must never reach Home');
function responses(seed = 0) {
  return [3, 3, 2, 2, 3].map((count, source) => ({ results: Array.from({ length: count }, (_, index) => ({
    id: seed + (source + 1) * 100 + index, title: 'Title ' + index, poster_path: '/poster',
  })) }));
}
const ids = (items) => items.map((item) => item.id);
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node?.props ? [node, ...nodes(node.props.children)] : [];
}
const nameOf = (node) => typeof node.type === 'function' ? node.type.name : node.type;

// Execute the real Home screen, shared recovery hook/policy, and panel with
// deterministic React effects and deferred API requests. Native UI and the
// unrelated Continue Watching internals are mocked; no network/native work runs.
function harness({ state = 'online', epoch = 0 } = {}) {
  const slots = [], requests = [], routes = [], modules = new Map();
  let network = { productState: state, remoteReady: state === 'online', recoveryEpoch: epoch };
  let cursor = 0, dirty = false, effects = [], result;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, (next) => {
        const value = typeof next === 'function' ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index]; },
    useMemo(fn, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { value: fn(), deps };
      return slots[index].value;
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) effects.push({ index, fn, deps, cleanup: slots[index]?.cleanup });
    },
  };
  const element = (type, props) => ({ type, props: props || {} });
  const themeContext = { useOrionTheme: () => ({ theme: {} }) };
  const mocks = {
    react, 'react/jsx-runtime': { jsx: element, jsxs: element },
    'react-native': { ...Object.fromEntries(['View', 'Text', 'ScrollView', 'FlatList', 'ActivityIndicator', 'Pressable'].map((name) => [name, name])),
      StyleSheet: { create: (styles) => styles, absoluteFill: {} }, useWindowDimensions: () => ({ width: 400 }) },
    'expo-router': { useRouter: () => ({ push: (route) => routes.push(route) }) },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' }, '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@orion/shared/tokens': { spacing: Array.from({ length: 20 }, (_, index) => index * 4), fontFamilies: {} },
    '@orion/shared/api': { tmdbFetch: (url) => new Promise((resolve, reject) => requests.push({ url, resolve, reject })) },
    '../../src/context/ThemeContext': themeContext, '../context/ThemeContext': themeContext,
    '../../src/context/NetworkContext': { useNetworkStatus: () => network }, './NetworkContext': { useNetworkStatus: () => network },
    '../../src/context/PerformanceContext': { usePerformanceProfile: () => ({ resolvedProfile: 'balanced' }) },
    '../../src/services/listPerformance': { getRailRenderBudget: () => ({}) },
    '../../src/components/HeroBillboard': { HeroBillboard: 'HeroBillboard' },
    '../../src/components/HomeConnectionPanel': { HomeConnectionPanel: 'HomeConnectionPanel' },
    '../../src/components/MediaCard': { MediaCard: 'MediaCard' },
    '../../src/features/library/HomeContinueWatching': { HomeContinueWatching: 'HomeContinueWatching' },
  };
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    if (!compiledCache.has(file)) compiledCache.set(file, ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: file,
    }).outputText);
    const module = { exports: {} }; modules.set(file, module);
    const requireLocal = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      assert.ok(name.startsWith('.'), 'Unexpected external module ' + name);
      const base = path.resolve(path.dirname(file), name);
      const resolved = ['.ts', '.tsx'].map((extension) => base + extension).find((candidate) => fs.existsSync(candidate));
      assert.ok(resolved, 'Missing local module ' + name);
      return load(resolved);
    };
    new Function('require', 'module', 'exports', compiledCache.get(file))(requireLocal, module, module.exports);
    return module.exports;
  }
  const Screen = load(homeFile).default;
  const Panel = load(path.join(root, 'src/components/HomeConnectionPanel.tsx')).HomeConnectionPanel;
  function render() {
    let count = 0;
    do {
      assert.ok(++count < 30, 'Render loop'); cursor = 0; dirty = false; effects = []; result = Screen();
      for (const effect of effects) effect.cleanup?.();
      for (const effect of effects) slots[effect.index] = { deps: effect.deps, cleanup: effect.fn() };
    } while (dirty);
  }
  const component = (name) => nodes(result).find((node) => nameOf(node) === name);
  const panel = () => component('HomeConnectionPanel').props;
  render();
  return {
    requests, routes, render, component, panel, panelUI: () => Panel(panel()),
    rows() {
      return Object.fromEntries(nodes(result).flatMap((node) => {
        const children = Array.isArray(node.props.children) ? node.props.children : [];
        const title = children.find((child) => child && nameOf(child) === 'SectionTitle');
        const row = children.find((child) => child && nameOf(child) === 'MediaRow');
        return title && row ? [[title.props.title + ' ' + title.props.highlight, row.props.items]] : [];
      }));
    },
    hero: () => component('HeroBillboard')?.props.items || [],
    retry() { panel().onRetry(); render(); },
    connect(state, epoch = network.recoveryEpoch) {
      network = { productState: state, remoteReady: state === 'online', recoveryEpoch: epoch }; render();
    },
    finish(batch = 0, failed = [], data = responses()) {
      const group = requests.slice(batch * 5, batch * 5 + 5);
      assert.deepEqual(group.map((request) => request.url), endpoints, 'One complete Home fan-out');
      group.forEach((request, index) => failed.includes(index) ? request.reject(failure()) : request.resolve(data[index]));
    },
    async settle() { for (let index = 0; index < 8; index++) await Promise.resolve(); render(); },
  };
}

test('Home retains the frozen shared owners and a single bounded fan-out within source size', () => {
  for (const marker of ['useNetworkStatus()', 'useRemoteRecoveryEffect(', 'remoteLoadGenerationRef', 'remoteReadyRef',
    'mountedRecoveryEpochRef', 'initialRemoteLoadStartedRef', 'loadRemoteHome']) assert.ok(homeSource.includes(marker), marker);
  assert.equal((homeSource.match(/useRemoteRecoveryEffect\(/g) || []).length, 1);
  assert.match(homeSource, /Promise\.allSettled\(/);
  assert.doesNotMatch(homeSource, /Promise\.all\s*\(/);
  assert.doesNotMatch(homeSource, /NetInfo|createContext|probeRemoteService|setInterval|setTimeout|setRecoveryEpoch|router\.replace|Updates\.reload/);
  assert.doesNotMatch(homeSource, /ResumePlaybackPrompt|prePhase3UiPolish|Readiness-Audit/);
  assert.ok(homeSource.split(/\r?\n/).length <= 800);
});

// Every subset of the five requests: independent rows, both Top Rated inputs,
// first-load absence, Hero availability/interleaving, and total-only error UI.
for (let mask = 0; mask < 32; mask++) {
  const failed = endpoints.map((_, index) => index).filter((index) => mask & (1 << index));
  test('initial fan-out failure subset [' + failed.join(',') + '] preserves every successful section', async () => {
    const h = harness(); assert.equal(h.panel().loading, true);
    h.finish(0, failed); await h.settle();
    const rows = h.rows();
    for (let index = 0; index < 3; index++) {
      const expected = failed.includes(index) ? [] : ids(responses()[index].results);
      assert.deepEqual(ids(rows[labels[index]] || []), expected, labels[index]);
      for (const item of rows[labels[index]] || []) assert.equal(item.media_type, index === 0 ? 'movie' : 'tv');
    }
    const movie = failed.includes(3) ? [] : [400, 401], tv = failed.includes(4) ? [] : [500, 501, 502];
    const expectedTop = [movie[0], tv[0], movie[1], tv[1], tv[2]].filter((id) => id !== undefined);
    assert.deepEqual(ids(rows[labels[3]] || []), expectedTop);
    for (const item of rows[labels[3]] || []) assert.equal(item.media_type, item.id < 500 ? 'movie' : 'tv');
    const movies = failed.includes(0) ? [] : [100, 101, 102], shows = failed.includes(1) ? [] : [200, 201, 202];
    assert.deepEqual(ids(h.hero()), [movies[0], shows[0], movies[1], shows[1], movies[2], shows[2]].filter((id) => id !== undefined).slice(0, 5));
    assert.equal(h.panel().loading, false);
    assert.equal(h.panel().error, mask === 31 ? 'Cinema content could not refresh.' : null);
    if (mask !== 31) assert.equal(h.panelUI(), null, 'Partial success must not show catalog-wide failure');
    else {
      assert.ok(nodes(h.panelUI()).some((node) => node.props.children === 'Cinema did not refresh.'));
      assert.doesNotMatch(JSON.stringify(h.panelUI()), /HTTP 503|internal provider|stack/);
    }
    assert.ok(h.component('HomeContinueWatching'));
  });
}

for (const [section, failed] of [[0, [0]], [1, [1]], [2, [2]], [3, [3, 4]]]) {
  test('recovery preserves failed ' + labels[section] + ' while other sections update', async () => {
    const h = harness(); h.finish(); await h.settle(); const previous = h.rows();
    h.connect('offline'); h.connect('online', 1); h.finish(1, failed, responses(1000)); await h.settle();
    const current = h.rows();
    assert.strictEqual(current[labels[section]], previous[labels[section]], 'Failed section state is retained');
    for (const label of labels.filter((_, index) => index !== section)) {
      assert.notStrictEqual(current[label], previous[label]);
      assert.ok(current[label].every((item) => item.id >= 1000), label + ' must use fresh results');
    }
    assert.equal(h.panel().error, null);
    if (section === 0) assert.deepEqual(ids(h.hero()), [100, 1200, 101, 1201, 102]);
    if (section === 1) assert.deepEqual(ids(h.hero()), [1100, 200, 1101, 201, 1102]);
    assert.equal(h.requests.length, 10);
  });
}

test('a later total failure preserves all prior rows and Hero, then panel Retry performs one full fan-out', async () => {
  const h = harness(); h.finish(); await h.settle(); const previous = h.rows(), hero = h.hero();
  h.retry(); h.finish(1, [0, 1, 2, 3, 4]); await h.settle();
  for (const label of labels) assert.strictEqual(h.rows()[label], previous[label]);
  assert.deepEqual(h.hero(), hero); assert.equal(h.panel().error, 'Cinema content could not refresh.');
  const retry = nodes(h.panelUI()).find((node) => node.props.accessibilityLabel === 'Retry Cinema refresh');
  assert.ok(retry); retry.props.onPress(); h.render();
  assert.equal(h.requests.length, 15); assert.equal(h.panel().loading, true); assert.equal(h.panel().error, null);
  h.finish(2, [1], responses(1000)); await h.settle();
  assert.equal(h.panelUI(), null); assert.equal(h.requests.length, 15);
  assert.strictEqual(h.rows()[labels[1]], previous[labels[1]]);
});

test('successful empty results clear only their own rows and do not count as request failures', async () => {
  const h = harness(); h.finish(); await h.settle(); const previous = h.rows();
  h.retry(); h.finish(1, [1, 2], endpoints.map(() => ({ results: [] }))); await h.settle();
  assert.deepEqual(Object.keys(h.rows()), [labels[1], labels[2]]);
  assert.strictEqual(h.rows()[labels[1]], previous[labels[1]]);
  assert.strictEqual(h.rows()[labels[2]], previous[labels[2]]);
  assert.equal(h.panel().error, null); assert.deepEqual(ids(h.hero()), [200, 201, 202]);
});

test('existing result limits, K-Drama artwork filtering, and Top Rated interleaving remain intact', async () => {
  const h = harness();
  const data = endpoints.map((_, source) => ({ results: Array.from({ length: 23 }, (_, index) => ({ id: source * 100 + index, poster_path: '/poster' })) }));
  data[2].results[0].poster_path = null;
  data[2].results[1] = { id: 201, backdrop_path: '/backdrop' };
  h.finish(0, [], data); await h.settle(); const rows = h.rows();
  assert.equal(rows[labels[0]].length, 20); assert.equal(rows[labels[1]].length, 20);
  assert.deepEqual(ids(rows[labels[2]]), Array.from({ length: 20 }, (_, index) => 201 + index));
  assert.deepEqual(ids(rows[labels[3]]), [300, 400, 301, 401, 302, 402, 303, 403, 304, 404, 305, 405, 306, 406, 307, 407]);
});

test('loading stays active until the last current-generation request settles despite an early rejection', async () => {
  const h = harness(); h.requests[0].reject(failure());
  for (let index = 1; index < 4; index++) h.requests[index].resolve(responses()[index]);
  await h.settle(); assert.equal(h.panel().loading, true); assert.equal(h.panel().error, null);
  h.requests[4].resolve(responses()[4]); await h.settle();
  assert.equal(h.panel().loading, false); assert.deepEqual(ids(h.rows()[labels[1]]), [200, 201, 202]);
});

for (const failed of [[], [0, 1, 2, 3, 4]]) {
  test('stale ' + (failed.length ? 'failures' : 'successes') + ' cannot clear newer loading, set errors, or commit rows', async () => {
    const h = harness(); h.retry(); assert.equal(h.requests.length, 10);
    h.finish(0, failed); await h.settle();
    assert.equal(h.panel().loading, true); assert.equal(h.panel().error, null); assert.deepEqual(h.rows(), {});
    h.finish(1, [], responses(1000)); await h.settle();
    assert.equal(h.panel().loading, false); assert.ok(h.rows()[labels[0]].every((item) => item.id >= 1000));
  });
}

test('pre-loss responses resolving last cannot overwrite the recovered generation', async () => {
  const h = harness(); h.connect('offline'); h.connect('online', 1);
  h.finish(1, [2], responses(1000)); await h.settle(); const current = h.rows(), hero = h.hero();
  h.finish(0); await h.settle(); assert.deepEqual(h.rows(), current); assert.deepEqual(h.hero(), hero);
  assert.equal(h.rows()[labels[2]], undefined); assert.equal(h.panel().error, null); assert.equal(h.panel().loading, false);
});

for (const failed of [[], [0, 1, 2, 3, 4]]) {
  test('connection loss blocks late ' + (failed.length ? 'errors' : 'results') + ' before any recovery starts', async () => {
    const h = harness(); h.finish(); await h.settle(); const previous = h.rows();
    h.retry(); h.connect('offline'); h.finish(1, failed, responses(1000)); await h.settle();
    assert.equal(h.panel().loading, false); assert.equal(h.panel().error, null); assert.deepEqual(h.rows(), {});
    h.connect('online', 1); // Old state must be preserved even before the new requests settle.
    for (const label of labels) assert.strictEqual(h.rows()[label], previous[label]);
    h.finish(2); await h.settle();
  });
}

for (const state of ['offline', 'degraded', 'checking', 'reconnecting']) {
  test(state + ' Home stays local-first and gates remote work and Retry', () => {
    const h = harness({ state }); assert.equal(h.requests.length, 0); assert.deepEqual(h.rows(), {}); assert.deepEqual(h.hero(), []);
    assert.ok(h.component('HomeContinueWatching')); assert.equal(h.panel().state, state); assert.equal(h.panel().loading, false);
    assert.ok(h.panelUI()); h.retry(); assert.equal(h.requests.length, 0);
    h.panel().onOpenDownloads(); h.panel().onOpenLibrary();
    assert.deepEqual(h.routes, ['/(tabs)/downloads', '/(tabs)/library']);
  });
}

test('checking to online and late online mount each start exactly one initial fan-out', async () => {
  for (const setup of [{ state: 'checking', epoch: 0 }, { state: 'online', epoch: 7 }]) {
    const h = harness(setup); h.connect('online', setup.epoch); h.render();
    assert.equal(h.requests.length, 5); h.finish(); await h.settle(); h.render(); assert.equal(h.requests.length, 5);
  }
});

test('the real shared recovery hook starts one full fan-out per legitimate epoch', async () => {
  const h = harness({ state: 'offline', epoch: 3 }); h.connect('reconnecting', 3); assert.equal(h.requests.length, 0);
  h.connect('online', 4); h.render(); h.connect('online', 4); assert.equal(h.requests.length, 5);
  h.finish(0, [2]); await h.settle(); h.render(); assert.equal(h.requests.length, 5);
  h.connect('degraded', 4); h.connect('reconnecting', 4); assert.equal(h.requests.length, 5);
  h.connect('online', 5); h.finish(1); await h.settle(); h.connect('online', 5); assert.equal(h.requests.length, 10);
});
