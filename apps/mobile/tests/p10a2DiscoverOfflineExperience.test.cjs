"use strict";

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const mobileRoot = path.resolve(__dirname, '..');
const discoverRoot = path.join(mobileRoot, 'src/features/discover');
const read = (name) => fs.readFileSync(path.join(discoverRoot, name), 'utf8');
const screen = read('DiscoverScreen.tsx');
const gate = read('useDiscoverRemoteGate.ts');
const search = read('useDiscoverSearchResults.ts');
const region = read('useDiscoverRegionResults.ts');
const copies = {
  offline: 'Cinema browsing is unavailable offline. Your local Orion remains available.',
  degraded: 'Cinema is temporarily unavailable. Orion will refresh when the service returns.',
  reconnecting: 'Reconnecting to Orion Cinema. Results will refresh automatically.',
  checking: 'Checking Cinema connection. Results will appear when it is ready.',
};

// Execute the real screen and hooks with deterministic effects, timers, and deferred API
// responses. Native presentation is represented as element data; no network is contacted.
function createHarness(productState = 'online', recoveryEpoch = 0) {
  const slots = [];
  const timers = new Map();
  const requests = [];
  const modules = new Map();
  const errors = [];
  let network = { productState, remoteReady: productState === 'online', recoveryEpoch };
  let cursor = 0;
  let dirty = false;
  let effects = [];
  let tree;
  let timerId = 0;
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, (next) => {
        const value = typeof next === 'function' ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) slots[index] = { value: factory(), deps };
      return slots[index].value;
    },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) {
        effects.push({ index, effect, deps, cleanup: slots[index]?.cleanup });
      }
    },
  };
  const element = (type, props, key) => ({ type, props: props || {}, key });
  const router = { push() { throw new Error('Unexpected navigation during remote work'); }, setParams() {} };
  const theme = {};
  function request(kind, input) {
    return new Promise((resolve, reject) => requests.push({ kind, input, resolve, reject }));
  }
  const mocks = {
    react,
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    'react-native': {
      ...Object.fromEntries(['View', 'Text', 'TextInput', 'FlatList', 'ActivityIndicator', 'ScrollView', 'Pressable', 'Modal'].map((key) => [key, key])),
      StyleSheet: { absoluteFill: {} },
      Animated: { View: 'Animated.View', Value: class { interpolate() { return 1; } setValue() {} } },
    },
    '@orion/shared/tokens': { spacing: Array.from({ length: 20 }, (_, i) => i * 4) },
    '@orion/shared/api': {
      fetchSearch: (query) => request('search', query),
      tmdbFetch: (url) => request('discover', url),
      isAnimeContent: (item) => item.genre_ids?.includes(16),
    },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': { useRouter: () => router, useLocalSearchParams: () => ({}) },
    '../../context/NetworkContext': { useNetworkStatus: () => network },
    './NetworkContext': { useNetworkStatus: () => network },
    '../../context/ThemeContext': { useOrionTheme: () => ({ theme, preferences: { reducedMotion: true } }) },
    '../../context/PerformanceContext': { usePerformanceProfile: () => ({ resolvedProfile: 'balanced' }) },
    '../../services/responsive': { useResponsiveLayout: () => ({ isPhone: true, isTablet: false, isLandscape: false }) },
    '../../services/listPerformance': { getGridRenderBudget: () => ({}), getRailRenderBudget: () => ({}) },
    './discoverStyles': { createDiscoverStyles: () => ({}) },
    '../../components/MediaCard': { MediaCard: 'MediaCard' },
    '../../components/PersonCard': { PersonCard: 'PersonCard' },
    '../../components/MobilePageHeader': { MobilePageHeader: 'MobilePageHeader' },
  };
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const source = fs.readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: filename,
    }).outputText;
    const module = { exports: {} };
    modules.set(filename, module);
    const localRequire = (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      assert.ok(specifier.startsWith('.'), `Unmocked external module: ${specifier}`);
      const base = path.resolve(path.dirname(filename), specifier);
      return load(['.ts', '.tsx'].map((ext) => base + ext).find((candidate) => fs.existsSync(candidate)));
    };
    new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', 'console', compiled)(
      localRequire, module, module.exports,
      (callback) => { timers.set(++timerId, callback); return timerId; },
      (id) => timers.delete(id), { error: (...args) => errors.push(args) },
    );
    return module.exports;
  }
  const renderScreen = load(path.join(discoverRoot, 'DiscoverScreen.tsx')).default;
  function render() {
    let iterations = 0;
    do {
      assert.ok(++iterations < 30, 'Effects must settle without a render loop');
      cursor = 0;
      dirty = false;
      effects = [];
      tree = renderScreen();
      for (const effect of effects) effect.cleanup?.();
      for (const { index, effect, deps } of effects) slots[index] = { deps, cleanup: effect() };
    } while (dirty);
    return tree;
  }
  function nodes(root) {
    if (Array.isArray(root)) return root.flatMap(nodes);
    if (!root || typeof root !== 'object' || !root.props) return [];
    const footer = root.type === 'FlatList' ? nodes(root.props.ListFooterComponent) : [];
    const empty = root.type === 'FlatList' && !root.props.data.length ? nodes(root.props.ListEmptyComponent) : [];
    return [root, ...nodes(root.props.children), ...footer, ...empty];
  }
  function find(label) {
    const result = nodes(tree).find((node) => node.props.accessibilityLabel === label);
    assert.ok(result, `Missing control: ${label}`);
    return result;
  }
  function textContent(root) {
    if (Array.isArray(root)) return root.map(textContent).join('');
    if (typeof root === 'string' || typeof root === 'number') return String(root);
    return root?.props ? textContent(root.props.children) : '';
  }
  render();
  tree.props.onLayout({ nativeEvent: { layout: { width: 400 } } });
  render();
  return {
    requests, errors, render,
    press(label) { find(label).props.onPress(); render(); },
    control: find,
    query(value) { find('Search Orion').props.onChangeText(value); render(); },
    connect(state, epoch = network.recoveryEpoch) {
      network = { ...network, productState: state, remoteReady: state === 'online', recoveryEpoch: epoch };
      render();
    },
    timers() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((callback) => callback()); render(); },
    async settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); render(); },
    text() { return nodes(tree).filter((node) => node.type === 'Text').map(textContent).join('\n'); },
    data() { return nodes(tree).filter((node) => node.type === 'FlatList').flatMap((node) => node.props.data); },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); },
  };
}
const item = (id) => ({ id, title: `Title ${id}`, media_type: 'movie', poster_path: '/poster.jpg', popularity: id });
const response = (ids = [], pages = 1) => ({ results: ids.map(item), total_pages: pages });
const enter = (harness, mode) => {
  if (mode === 'search') harness.query('Orion');
  if (mode === 'genre') harness.press('Browse Action');
  if (mode === 'region') harness.press('Region Hollywood');
  harness.timers();
};

// Structural contracts also guard ownership and the exact UI wiring.
test('Discover consumes shared connection/recovery contracts without another owner', () => {
  assert.match(screen, /useDiscoverRemoteGate\(\)/);
  assert.match(gate, /useNetworkStatus\(\)/);
  assert.match(gate, /useRemoteRecoveryEffect\(/);
  for (const source of [screen, gate, search, region]) {
    assert.doesNotMatch(source, /NetInfo|createContext|probeRemoteService|PROBE_INTERVAL_MS|setInterval\s*\(|setRecoveryEpoch/);
    assert.doesNotMatch(source, /Updates\.reload|restart|router\.replace/);
  }
  for (const source of [gate, search, region]) assert.doesNotMatch(source, /useRouter|router\.|fetch\s*\(/);
});

test('all three request paths gate before API execution and fence after completion', () => {
  const genre = screen.slice(screen.indexOf('const fetchDiscoverResults'), screen.indexOf('const handlePress'));
  for (const [source, api] of [[search, 'fetchSearch(trimmedQuery)'], [genre, 'tmdbFetch<TmdbPaginatedResponse>'], [region, 'tmdbFetch<TmdbPaginatedResponse>']]) {
    assert.ok(source.indexOf('!remoteReadyRef.current') < source.indexOf(api));
    assert.match(source, /generation === generationRef\.current && remoteReadyRef\.current/);
    assert.match(source.slice(source.indexOf(api)), /isCurrent\(\)/);
  }
  assert.match(search, /cancelled = true/);
  assert.match(region, /cancelled = true/);
  assert.match(genre, /genreRequestRef\.current \+= 1/);
  assert.match(screen, /disabled=\{loadingMore \|\| !network\.remoteReady\}/);
  assert.match(screen.slice(screen.indexOf('const handleLoadMore')), /remoteReadyRef\.current/);
});

test('the slice stays bounded and does not import protected or unrelated surfaces', () => {
  assert.ok(screen.split(/\r?\n/).length <= 800);
  for (const source of [screen, gate, search, region]) {
    assert.doesNotMatch(source, /ResumePlaybackPrompt|prePhase3UiPolish|Readiness-Audit|features\/downloads|offlinePlayer|HomeContinueWatching/);
  }
  assert.match(screen, /searchSucceeded \? `No results found for/);
  assert.match(screen, /genreOutcome\?\.status === 'success' \? 'No titles match/);
  assert.match(screen, /regionSucceeded \? 'No trending titles/);
});

for (const mode of ['search', 'genre', 'region']) {
  test(`${mode}: every unavailable state blocks requests and displays truthful copy`, () => {
    const h = createHarness('offline');
    enter(h, mode);
    for (const [state, copy] of Object.entries(copies)) {
      h.connect(state);
      h.timers();
      assert.equal(h.requests.length, 0);
      assert.ok(h.text().includes(copy), `${mode}/${state}: ${h.text()}`);
      assert.doesNotMatch(h.text(), /No results found|No titles match|No trending titles/);
    }
    h.unmount();
  });

  test(`${mode}: late online mount, each recovery, and checking-to-online load once`, async () => {
    const h = createHarness('online', 7);
    enter(h, mode);
    assert.equal(h.requests.length, 1, 'Late mount must not replay a historical recovery');
    h.requests[0].resolve(response([1]));
    await h.settle();
    h.connect('online', 7);
    h.timers();
    assert.equal(h.requests.length, 1);
    h.connect('offline', 7);
    h.connect('reconnecting', 7);
    h.connect('online', 8);
    h.timers();
    assert.equal(h.requests.length, 2, 'Recovery should refresh the active view exactly once');
    h.connect('online', 8);
    h.timers();
    assert.equal(h.requests.length, 2);
    h.connect('checking', 8);
    h.connect('online', 8);
    h.timers();
    assert.equal(h.requests.length, 3, 'Readiness can return without a new epoch');
    h.connect('degraded', 8);
    h.connect('online', 9);
    h.timers();
    assert.equal(h.requests.length, 4, 'Subsequent service recovery should refresh once');
    h.unmount();
  });

  test(`${mode}: initial checking-to-online starts active work once`, () => {
    const h = createHarness('checking');
    enter(h, mode);
    h.connect('online', 0);
    h.timers();
    assert.equal(h.requests.length, 1);
    h.connect('online', 0);
    h.timers();
    assert.equal(h.requests.length, 1);
    h.unmount();
  });

  test(`${mode}: pre-loss responses cannot overwrite recovered results`, async () => {
    const h = createHarness();
    enter(h, mode);
    h.connect('offline');
    h.connect('online', 1);
    h.timers();
    assert.equal(h.requests.length, 2);
    h.requests[1].resolve(response([2]));
    await h.settle();
    h.requests[0].resolve(response([1]));
    await h.settle();
    assert.deepEqual(h.data().map((result) => result.id), [2]);
    h.unmount();
  });

  test(`${mode}: failed requests are not empty successes; successful empty responses are`, async () => {
    const h = createHarness();
    enter(h, mode);
    assert.doesNotMatch(h.text(), /No results found|No titles match|No trending titles/);
    h.requests[0].reject(new Error('Controlled failure'));
    await h.settle();
    assert.match(h.text(), /Cinema results could not be loaded/);
    assert.doesNotMatch(h.text(), /No results found|No titles match|No trending titles/);
    h.connect('degraded');
    h.connect('online', 1);
    h.timers();
    h.requests[1].resolve(response());
    await h.settle();
    assert.match(h.text(), /No results found|No titles match|No trending titles/);
    h.unmount();
  });
}

test('search cancels changed/cleared queries, including requests already in flight', async () => {
  const h = createHarness();
  h.query('old');
  h.timers();
  h.query('new');
  h.timers();
  h.requests[1].resolve(response([2]));
  await h.settle();
  h.requests[0].resolve(response([1]));
  await h.settle();
  assert.deepEqual(h.data().map((result) => result.id), [2]);
  h.query('pending');
  h.timers();
  h.query('');
  h.requests[2].resolve(response([3]));
  await h.settle();
  assert.deepEqual(h.data(), []);
  h.query('debounced');
  h.query('');
  h.timers();
  assert.equal(h.requests.length, 3);
  h.unmount();
});

test('search filters locally without issuing another request', async () => {
  const h = createHarness();
  enter(h, 'search');
  h.requests[0].resolve({ results: [item(1), { ...item(2), media_type: 'person' }] });
  await h.settle();
  h.press('Filter search results by Movies');
  assert.deepEqual(h.data().map((result) => result.id), [1]);
  assert.equal(h.requests.length, 1);
  h.unmount();
});

test('changed genre and region selections fence older responses while online', async () => {
  for (const mode of ['genre', 'region']) {
    const h = createHarness();
    enter(h, mode);
    if (mode === 'genre') {
      h.press('Back to genres');
      h.press('Browse Comedy');
    } else h.press('Region Bollywood');
    assert.equal(h.requests.length, 2);
    h.requests[1].resolve(response([2]));
    await h.settle();
    h.requests[0].resolve(response([1]));
    await h.settle();
    assert.deepEqual(h.data().map((result) => result.id), [2]);
    h.unmount();
  }
});

test('Load More deduplicates rapid taps, blocks offline, and fences old pages after recovery', async () => {
  const h = createHarness();
  enter(h, 'genre');
  h.requests[0].resolve(response([1], 3));
  await h.settle();
  const loadMore = h.control('Load more titles').props.onPress;
  loadMore();
  loadMore();
  h.render();
  assert.equal(h.requests.length, 2);
  assert.match(h.requests[1].input, /page=2/);
  h.connect('offline');
  assert.equal(h.control('Load more titles').props.disabled, true);
  loadMore();
  assert.equal(h.requests.length, 2);
  h.connect('online', 1);
  assert.equal(h.requests.length, 3);
  assert.match(h.requests[2].input, /page=1/);
  h.requests[2].resolve(response([3], 2));
  await h.settle();
  h.requests[1].resolve(response([2], 3));
  await h.settle();
  assert.deepEqual(h.data().map((result) => result.id), [3]);
  h.press('Load more titles');
  h.requests[3].resolve(response([3, 4], 2));
  await h.settle();
  assert.deepEqual(h.data().map((result) => result.id), [3, 4]);
  h.unmount();
});
