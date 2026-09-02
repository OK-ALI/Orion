'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const cache = new Map();
const entry = { key: 'movie_7', progress: { mediaIdentity: { id: 7, mediaType: 'movie', title: 'Local movie', year: 2026 },
  presentation: { posterPath: '/poster', backdropPath: '/backdrop' }, currentTime: 300, duration: 1200, percent: 25 } };
const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
const nameOf = (node) => typeof node.type === 'function' ? node.type.name : node.type;
const style = (value) => Object.assign({}, ...(Array.isArray(value) ? value.flat(Infinity).filter(Boolean) : [value]));
const texts = (node) => nodes(node).filter((n) => n.type === 'Text').map((n) => n.props.children);

// Real TS render functions and hooks; mocked native/context boundaries. Deferred
// API responses exercise Home, while separate rail/card renders verify unchanged
// local handlers and exact presentation defaults without native or cloud work.
function harness({ mode = 'home', state = 'offline', presentation, width = 480, height = 980, fontScale = 1,
  themeId = 'midnight-premiere', entries = [entry], savedTime = 1363, continuityMode = 'seamless' } = {}) {
  const slots = [], modules = new Map(), requests = [], routes = [], removed = [], marked = [], enriched = [], choices = [];
  let network = { productState: state, remoteReady: state === 'online', recoveryEpoch: 0 };
  let cursor = 0, dirty = false, effects = [], result, cancelled = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    createContext: () => ({}),
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, (next) => { const value = typeof next === 'function' ? next(slots[i].value) : next;
        if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; if (!slots[i]) slots[i] = { current: initial }; return slots[i]; },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: fn(), deps }; return slots[i].value; },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) effects.push({ i, fn, deps, cleanup: slots[i]?.cleanup }); },
  };
  const element = (type, props) => ({ type, props: props || {} });
  const themeContext = { useOrionTheme: () => ({ theme }) };
  const networkContext = { useNetworkStatus: () => network };
  const responsive = { useResponsiveLayout: () => ({ width, height, fontScale, shortestEdge: Math.min(width, height), isTablet: Math.min(width, height) >= 600, isLandscape: width > height }) };
  const library = { progress: {}, watched: {}, getContinueWatching: () => entries,
    enrichPlaybackMetadata: async (key) => enriched.push(key), removeProgress: (key) => removed.push(key), markProgressWatched: (key) => marked.push(key) };
  const mocks = {
    react, 'react/jsx-runtime': { jsx: element, jsxs: element },
    'react-native': { ...Object.fromEntries(['View', 'Text', 'ScrollView', 'FlatList', 'ActivityIndicator', 'Pressable', 'Image', 'Modal'].map((s) => [s, s])),
      StyleSheet: { create: (s) => s, absoluteFill: {} }, useWindowDimensions: () => ({ width, height, fontScale }) },
    'expo-router': { useRouter: () => ({ push: (route) => routes.push(route) }) },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' }, '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 0 }) },
    '@orion/shared/tokens': { spacing: Array.from({ length: 20 }, (_, i) => i * 4), fontFamilies: {}, radii: {} },
    '@orion/shared/api': { tmdbFetch: (url) => new Promise((resolve, reject) => requests.push({ url, resolve, reject })), imgUrl: (value) => value },
    '../../src/context/ThemeContext': themeContext, '../context/ThemeContext': themeContext, '../../context/ThemeContext': themeContext,
    '../../src/context/NetworkContext': networkContext, '../../context/NetworkContext': networkContext, './NetworkContext': networkContext,
    '../services/responsive': responsive, '../../services/responsive': responsive,
    '../../context/LibraryContext': { useLibrary: () => library },
    '../../context/PerformanceContext': { usePerformanceProfile: () => ({ resolvedProfile: 'balanced' }) },
    '../../src/context/PerformanceContext': { usePerformanceProfile: () => ({ resolvedProfile: 'balanced' }) },
    '../../services/listPerformance': { getRailRenderBudget: () => ({ initialNumToRender: 3 }) },
    '../../src/services/listPerformance': { getRailRenderBudget: () => ({ initialNumToRender: 3 }) },
    '../services/storageAdapter': { mmkvStorageAdapter: {} },
    '../../src/components/HeroBillboard': { HeroBillboard: 'HeroBillboard' },
    '../../src/components/HomeConnectionPanel': { HomeConnectionPanel: 'HomeConnectionPanel' },
    '../../src/components/MediaCard': { MediaCard: 'MediaCard' },
    '../../src/features/library/HomeContinueWatching': { HomeContinueWatching: 'HomeContinueWatching' },
  };
  function load(file) {
    file = path.isAbsolute(file) ? file : path.join(root, file);
    if (modules.has(file)) return modules.get(file).exports;
    if (!cache.has(file)) cache.set(file, ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: file,
    }).outputText);
    const module = { exports: {} }; modules.set(file, module);
    const requireLocal = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      assert.ok(name.startsWith('.'), 'Unexpected native/external dependency: ' + name);
      const base = path.resolve(path.dirname(file), name);
      const resolved = ['.ts', '.tsx'].map((ext) => base + ext).find((candidate) => fs.existsSync(candidate));
      assert.ok(resolved, 'Missing ' + name); return load(resolved);
    };
    new Function('require', 'module', 'exports', cache.get(file))(requireLocal, module, module.exports);
    return module.exports;
  }
  const theme = load('src/context/ThemeContext.tsx').ORION_MOBILE_THEMES[themeId];
  const Home = load('app/(tabs)/index.tsx').default;
  const Rail = load('src/features/library/HomeContinueWatching.tsx').HomeContinueWatching;
  const Card = load('src/features/library/ContinueWatchingCard.tsx').ContinueWatchingCard;
  const Panel = load('src/components/HomeConnectionPanel.tsx').HomeConnectionPanel;
  const Intro = load('src/components/HomeOfflineIntroduction.tsx').HomeOfflineIntroduction;
  const Resume = load('src/features/playback/ResumePlaybackPrompt.tsx').ResumePlaybackPrompt;
  const actions = { onOpenDownloads: () => routes.push('/(tabs)/downloads'), onOpenLibrary: () => routes.push('/(tabs)/library') };
  function render() {
    let count = 0;
    do { assert.ok(++count < 30); cursor = 0; dirty = false; effects = [];
      result = mode === 'home' ? Home() : mode === 'rail' ? Rail({ presentation }) : mode === 'intro' ? Intro(actions)
        : Resume({ title: 'Local movie', savedTime, continuityMode, onChoose: (choice) => choices.push(choice), onCancel: () => cancelled++ });
      for (const effect of effects) effect.cleanup?.();
      for (const effect of effects) slots[effect.i] = { deps: effect.deps, cleanup: effect.fn() };
    } while (dirty);
  }
  const component = (name) => nodes(result).find((n) => nameOf(n) === name);
  render();
  return { requests, routes, removed, marked, enriched, choices, theme, component, render,
    get result() { return result; }, get cancelled() { return cancelled; },
    panelUI() { const panel = Panel(component('HomeConnectionPanel').props); return nameOf(panel || {}) === 'HomeOfflineIntroduction' ? Intro(panel.props) : panel; },
    card() { const element = component('FlatList').props.renderItem({ item: entries[0] }); return Card(element.props); },
    connect(state) { network = { ...network, productState: state, remoteReady: state === 'online', recoveryEpoch: network.recoveryEpoch + (state === 'online' ? 1 : 0) }; render(); },
    async settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); render(); },
  };
}

function contentOrder(h) {
  return h.component('ScrollView').props.children.filter((node) => node?.props).map(nameOf);
}

test('offline Home introduces local actions first, keeps compact Continue Watching, and hides every remote section', () => {
  const h = harness(); assert.deepEqual(contentOrder(h), ['HomeConnectionPanel', 'HomeContinueWatching', 'View']);
  assert.equal(h.component('HomeContinueWatching').props.presentation, 'offline-compact');
  assert.equal(h.requests.length, 0); assert.equal(h.component('HeroBillboard'), undefined); assert.equal(h.component('MediaRow'), undefined);
  const intro = h.panelUI(); assert.ok(texts(intro).includes('AVAILABLE OFFLINE')); assert.ok(texts(intro).includes('Your local Orion is ready.'));
  for (const label of ['Open Downloads', 'Open Library']) nodes(intro).find((n) => n.props.accessibilityLabel === label).props.onPress();
  assert.deepEqual(h.routes, ['/(tabs)/downloads', '/(tabs)/library']);
  assert.equal(style(intro.props.style).borderWidth, undefined); assert.equal(style(intro.props.style).borderRadius, undefined);
});

test('online Home keeps Hero, default Continue Watching, panel and remote rows in the accepted order and geometry', async () => {
  const h = harness({ state: 'online' }); assert.equal(h.requests.length, 5);
  assert.equal(h.component('HomeContinueWatching').props.presentation, undefined);
  assert.deepEqual(style(h.component('ScrollView').props.style), { flex: 1 });
  assert.equal(h.component('ScrollView').props.contentContainerStyle, undefined);
  h.requests.forEach((request, index) => request.resolve({ results: [{ id: index + 1, poster_path: '/poster' }] })); await h.settle();
  assert.deepEqual(contentOrder(h), ['HeroBillboard', 'HomeContinueWatching', 'HomeConnectionPanel', 'View', 'View', 'View', 'View', 'View']);
  assert.equal(h.panelUI(), null); assert.deepEqual(h.component('HeroBillboard').props.items.map((item) => item.id), [1, 2]);
  h.connect('offline'); assert.equal(h.component('HeroBillboard'), undefined); assert.equal(h.component('MediaRow'), undefined);
  assert.deepEqual(contentOrder(h), ['HomeConnectionPanel', 'HomeContinueWatching', 'View']);
});

for (const [state, title] of [['checking', 'Checking Cinema connection.'], ['degraded', 'Cinema is temporarily unavailable.'], ['reconnecting', 'Reconnecting to Orion Cinema.']]) {
  test(state + ' retains existing order, default rail and connection card', () => {
    const h = harness({ state }); assert.deepEqual(contentOrder(h), ['HomeContinueWatching', 'HomeConnectionPanel', 'View']);
    assert.equal(h.component('HomeContinueWatching').props.presentation, undefined);
    const panel = h.panelUI(); assert.ok(texts(panel).includes(title)); assert.equal(style(panel.props.style).borderWidth, 1);
  });
}

for (const themeId of ['midnight-premiere', 'amoled', 'mocha', 'slate', 'projector-silver', 'custom']) {
  test(themeId + ' offline introduction uses semantic text, actions and borderless page presentation', () => {
    const h = harness({ mode: 'intro', themeId }); const all = nodes(h.result);
    assert.equal(style(h.result.props.style).paddingTop, 120); assert.equal(style(h.result.props.style).paddingHorizontal, 20);
    assert.equal(style(all.find((n) => n.props.children === 'AVAILABLE OFFLINE').props.style).color, h.theme.accent);
    assert.equal(style(all.find((n) => n.props.accessibilityRole === 'header').props.style).color, h.theme.text);
    const download = all.find((n) => n.props.accessibilityLabel === 'Open Downloads');
    assert.equal(style(download.props.style({ pressed: false })).backgroundColor, h.theme.accent);
    assert.equal(style(nodes(download).find((n) => n.type === 'Text').props.style).color, h.theme.onAccent);
    assert.equal(style(download.props.style({ pressed: false })).minHeight, 44);
    for (const text of all.filter((n) => n.type === 'Text')) { assert.equal(text.props.numberOfLines, undefined); assert.notEqual(text.props.allowFontScaling, false); }
  });
}

test('offline top clearance follows safe area, font scaling and existing responsive breakpoints', () => {
  for (const [width, height, fontScale, padding] of [[340, 720, 1, 12], [980, 480, 1, 20], [800, 1200, 1, 32], [480, 980, 1.5, 20]]) {
    const h = harness({ mode: 'intro', width, height, fontScale }); const s = style(h.result.props.style);
    assert.equal(s.paddingTop, 24 + 96 * fontScale); assert.equal(s.paddingHorizontal, padding);
  }
  const source = read('src/components/HomeOfflineIntroduction.tsx');
  assert.match(source, /useSafeAreaInsets/); assert.match(source, /useResponsiveLayout/);
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}|rgba\(|theme\.warning|Samsung|S24|NetInfo|useNetworkStatus/i);
});

for (const presentation of [undefined, 'offline-compact']) {
  test((presentation || 'default') + ' rail preserves data, progress, resume, details, watched, removal and View all', () => {
    const h = harness({ mode: 'rail', presentation }); const list = h.component('FlatList');
    assert.strictEqual(list.props.data[0], entry); assert.equal(list.props.data.length, 1); assert.equal(h.enriched.length, 0);
    const card = h.card(), all = nodes(card);
    assert.ok(texts(card).includes('25% watched · 15:00 remaining'));
    for (const label of ['Resume Local movie', 'Open Local movie', 'Mark Local movie watched', 'Remove Local movie from Continue Watching']) {
      const button = all.find((n) => n.props.accessibilityLabel === label); assert.equal(button.props.accessibilityRole, 'button'); button.props.onPress();
    }
    h.component('Pressable').props.onPress();
    assert.deepEqual(h.routes, [
      { pathname: '/player/[id]', params: { id: '7', type: 'movie', title: 'Local movie', seriesTitle: undefined, year: '2026', season: undefined,
        episode: undefined, episodeTitle: undefined, posterPath: '/poster', backdropPath: '/backdrop' } },
      { pathname: '/media/[id]', params: { id: '7', type: 'movie' } }, { pathname: '/(tabs)/library', params: { tab: 'continue' } },
    ]);
    assert.deepEqual(h.removed, ['movie_7']); assert.deepEqual(h.marked, ['movie_7']);
    const artwork = all.find((n) => n.props.accessibilityLabel === 'Open Local movie');
    assert.equal(style(artwork.props.style({ pressed: false })).aspectRatio, presentation ? 2.25 : 16 / 9);
    assert.equal(style(card.props.style).width, 330); assert.equal(style(card.props.style).borderRadius, 16);
    const resume = all.find((n) => n.props.accessibilityLabel === 'Resume Local movie');
    assert.equal(style(resume.props.style({ pressed: false })).minHeight, 44);
    const content = card.props.children[1], s = style(content.props.style);
    assert.equal(s.padding, presentation ? 10 : 12); assert.equal(s.gap, presentation ? 2 : 4);
    assert.equal(style(h.result.props.style).marginBottom, presentation ? 16 : 24);
    assert.equal(style(h.result.props.children[0].props.style).minHeight, presentation ? 60 : 72);
  });
}

test('offline density changes preserve typography and touch sizes while reducing typical rail height about 15-20 percent', () => {
  // One-line title/year/progress fixture, standard font scale; derived style dimensions,
  // not a claim about native text measurement on every device.
  function footprint(presentation) {
    const h = harness({ mode: 'rail', presentation }); const card = h.card(), parts = card.props.children;
    const art = style(parts[0].props.style({ pressed: false })), content = style(parts[1].props.style);
    const children = parts[1].props.children, action = style(children[3].props.style);
    const heights = children.slice(0, 3).map((n) => { const s = style(n.props.style); return (s.lineHeight || s.fontSize * 1.2) + (s.marginTop || 0); });
    const actions = Math.max(...children[3].props.children.map((n) => { const s = style(n.props.style({ pressed: false })); return s.height || s.minHeight; }));
    return style(card.props.style).width / art.aspectRatio + content.padding * 2 + heights.reduce((a, b) => a + b, 0)
      + content.gap * 3 + action.marginTop + actions + style(h.result.props.children[0].props.style).minHeight + style(h.result.props.style).marginBottom;
  }
  const reduction = 1 - footprint('offline-compact') / footprint(undefined); assert.ok(reduction >= 0.15 && reduction <= 0.20, String(reduction));
});

test('empty local rail stays absent, and remote metadata enrichment still depends only on remoteReady', () => {
  assert.equal(harness({ mode: 'rail', presentation: 'offline-compact', entries: [] }).result, null);
  const missingArt = { ...entry, progress: { ...entry.progress, presentation: {} } };
  assert.equal(harness({ mode: 'rail', entries: [missingArt] }).enriched.length, 0);
  assert.deepEqual(harness({ mode: 'rail', state: 'online', entries: [missingArt] }).enriched, ['movie_7']);
});

test('the existing local resume fix renders exactly two actions per landscape row with grouped icons and unchanged choices', () => {
  const h = harness({ mode: 'resume', width: 1040, height: 424 });
  const rows = nodes(h.result).filter((n) => style(n.props.style).flexDirection === 'row' && Array.isArray(n.props.children)
    && n.props.children.every((child) => child?.type === 'Pressable'));
  assert.deepEqual(rows.map((row) => row.props.children.length), [2, 2]);
  for (const button of rows.flatMap((row) => row.props.children)) {
    assert.equal(button.props.accessibilityRole, 'button'); const s = style(button.props.style);
    assert.equal(s.justifyContent, 'center'); assert.equal(s.alignItems, 'center'); assert.equal(s.gap, 8);
    const children = Array.isArray(button.props.children) ? button.props.children : [button.props.children];
    assert.ok(children.some((child) => child.type === 'Text'));
    for (const child of children.filter((n) => n.type === 'Text')) assert.equal(style(child.props.style).flex, undefined);
    button.props.onPress();
  }
  assert.deepEqual(h.choices, ['resume', 'replay-30', 'start-over']); assert.equal(h.cancelled, 1);
  assert.deepEqual(rows[0].props.children.map((button) => button.props.children[0].props.name), ['play', 'play-back']);
  assert.equal(rows[1].props.children[0].props.children[0].props.name, 'refresh');
});

test('resume options retain their short-progress and restricted-source behavior', () => {
  for (const [savedTime, continuityMode, expected] of [[30, 'seamless', ['resume', 'start-over']], [1363, 'start-over-only', ['start-over']]]) {
    const h = harness({ mode: 'resume', width: 1040, height: 424, savedTime, continuityMode });
    nodes(h.result).filter((n) => n.type === 'Pressable').forEach((button) => button.props.onPress());
    assert.deepEqual(h.choices, expected); assert.equal(h.cancelled, 1);
  }
});


test('final offline Home polish adds 12 dp after the introduction while preserving the accepted control clearance', () => {
  const h = harness();
  assert.deepEqual(style(h.panelUI().props.style), { paddingBottom: 24, paddingTop: 120, paddingHorizontal: 20 });
  assert.equal(style(h.panelUI().props.style).paddingBottom - 12, 12);
  assert.deepEqual(contentOrder(h).slice(0, 2), ['HomeConnectionPanel', 'HomeContinueWatching']);
  // Other-state order, online geometry and all rail/card data, dimensions and actions
  // are exercised above; this gap belongs only to the offline introduction.
  for (const state of ['online', 'checking', 'degraded', 'reconnecting']) {
    const other = harness({ state });
    assert.ok(!texts(other.panelUI()).includes('Your local Orion is ready.'));
    assert.equal(other.component('HomeContinueWatching').props.presentation, undefined);
  }
});
