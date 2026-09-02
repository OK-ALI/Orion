'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const compiledCache = new Map();
const files = ['src/components/OfflineBanner.tsx', 'src/components/SidebarDrawer.tsx', 'src/components/mobileConnectionPresentationPolicy.ts'];
const cases = [
  { state: 'online', footer: 'Online', title: null, local: false, tone: 'success' },
  { state: 'checking', footer: 'Checking connection', title: null, local: false, tone: 'textMuted' },
  { state: 'degraded', footer: 'Service unavailable', title: 'Service unavailable', compact: 'Service unavailable', local: true, tone: 'warning' },
  { state: 'offline', footer: 'Offline mode', title: "You're offline", compact: 'Offline', local: true, tone: 'warning' },
  { state: 'reconnecting', footer: 'Trying to reconnect', title: 'Trying to reconnect', compact: 'Reconnecting', local: true, tone: 'accent' },
];
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node?.props ? [node, ...nodes(node.props.children)] : [];
}
const textNodes = (node) => nodes(node).filter((entry) => entry.type === 'Text');
const texts = (node) => textNodes(node).map((entry) => entry.props.children);
function style(value) { return Object.assign({}, ...(Array.isArray(value) ? value.flat(Infinity).filter(Boolean) : [value])); }

// Real TS components and presentation mapping; deterministic effects/timers and
// mocked native/router/context boundaries. No transport, probing, or recovery
// implementation is loaded. Real theme definitions verify light/dark treatment.
function harness({ mode = 'banner', state = 'online', latencyMs = 42, persistent = false,
  tablet = false, themeId = 'midnight-premiere', reducedMotion = false, pathname = '/' } = {}) {
  const slots = [], modules = new Map(), timers = new Map(), routes = [];
  let network = { productState: state, remoteReady: state === 'online', latencyMs, connectionType: 'wifi', restoredAt: 999, recoveryEpoch: 5 };
  let cursor = 0, dirty = false, effects = [], result, frames = [], clock = 0, timerId = 0, closes = 0;
  let drawerProps = { visible: true, persistent, onClose: () => closes++ };
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    createContext: () => ({}),
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, (next) => {
        const value = typeof next === 'function' ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) effects.push({ index, fn, deps, cleanup: slots[index]?.cleanup });
    },
  };
  const element = (type, props) => ({ type, props: props || {} });
  const themeContext = { useOrionTheme: () => ({ theme, preferences: { reducedMotion } }) };
  const responsive = { useResponsiveLayout: () => ({ isTablet: tablet }) };
  const Tabs = Object.assign(() => null, { Screen: 'Tabs.Screen' });
  const mocks = {
    react, 'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    'react-native': { ...Object.fromEntries(['View', 'Text', 'ScrollView', 'Modal', 'Pressable', 'Image'].map((name) => [name, name])),
      StyleSheet: { create: (styles) => styles, absoluteFill: {} }, Platform: { OS: 'android' } },
    '@expo/vector-icons': { Ionicons: 'Ionicons' }, 'expo-linear-gradient': { LinearGradient: 'LinearGradient' }, 'expo-blur': { BlurView: 'BlurView' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 0 }) },
    'expo-router': { useRouter: () => ({ push: (route) => routes.push(route) }), usePathname: () => pathname, Tabs },
    '@orion/shared/tokens': { spacing: Array.from({ length: 20 }, (_, index) => index * 4), fontFamilies: {}, fontSizes: {}, radii: {}, accent: {}, text: {} },
    '../context/NetworkContext': { useNetworkStatus: () => network },
    '../context/ThemeContext': themeContext, '../../src/context/ThemeContext': themeContext,
    '../context/AccountContext': { useOrionAccount: () => ({ state: { phase: 'signed-out', profile: null } }) },
    '../services/storageAdapter': { mmkvStorageAdapter: {} },
    '../services/responsive': responsive, '../../src/services/responsive': responsive,
    './SidebarDrawer': { SidebarDrawer: 'SidebarDrawer' }, '../../src/components/SidebarDrawer': { SidebarDrawer: 'SidebarDrawer' },
    '../../src/components/FloatingSidebarTrigger': { FloatingSidebarTrigger: 'FloatingSidebarTrigger' },
  };
  function load(relative) {
    const file = path.isAbsolute(relative) ? relative : path.join(root, relative);
    if (modules.has(file)) return modules.get(file).exports;
    if (!compiledCache.has(file)) compiledCache.set(file, ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: file,
    }).outputText);
    const module = { exports: {} }; modules.set(file, module);
    const requireLocal = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      assert.ok(name.startsWith('.'), 'Unexpected dependency ' + name);
      const base = path.resolve(path.dirname(file), name);
      const resolved = ['.ts', '.tsx'].map((extension) => base + extension).find((candidate) => fs.existsSync(candidate));
      assert.ok(resolved, 'Missing module ' + name); return load(resolved);
    };
    const setTimeout = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, at: clock + delay }); return id; };
    const clearTimeout = (id) => timers.delete(id);
    new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', compiledCache.get(file))(
      requireLocal, module, module.exports, setTimeout, clearTimeout);
    return module.exports;
  }
  const themes = load('src/context/ThemeContext.tsx').ORION_MOBILE_THEMES;
  let theme = themes[themeId]; assert.ok(theme);
  const Component = mode === 'banner' ? load(files[0]).OfflineBanner
    : mode === 'drawer' ? load(files[1]).SidebarDrawer
    : mode === 'trigger' ? load('src/components/FloatingSidebarTrigger.tsx').FloatingSidebarTrigger
    : load('app/(tabs)/_layout.tsx').default;
  function render() {
    let count = 0; frames = [];
    do {
      assert.ok(++count < 30, 'Render loop'); cursor = 0; dirty = false; effects = [];
      result = Component(drawerProps); frames.push(result);
      for (const effect of effects) effect.cleanup?.();
      for (const effect of effects) slots[effect.index] = { deps: effect.deps, cleanup: effect.fn() };
    } while (dirty);
    return result;
  }
  const find = (label) => nodes(result).find((node) => node.props.accessibilityLabel === label);
  render();
  return {
    routes, themes, render, find, nodes: () => nodes(result), texts: () => texts(result),
    get result() { return result; }, get frames() { return frames; }, get theme() { return theme; },
    get timers() { return timers.size; }, get closes() { return closes; },
    alert: () => nodes(result).find((node) => node.props.accessibilityRole === 'alert'),
    footer: () => nodes(result).find((node) => node.props.accessibilityLabel?.startsWith('Orion Mobile.')),
    downloads: () => nodes(result).find((node) => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel.startsWith('Downloads')),
    connect(state, values = {}) { network = { ...network, productState: state, remoteReady: state === 'online', ...values }; render(); },
    advance(ms) {
      const target = clock + ms;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        clock = next[1].at; timers.delete(next[0]); next[1].fn(); render();
      }
      clock = target;
    },
    drawer(next) { drawerProps = { ...drawerProps, ...next }; render(); },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); },
  };
}

test('both components consume frozen productState and create no network/recovery authority', () => {
  for (const file of files.slice(0, 2)) {
    const source = read(file);
    assert.match(source, /useNetworkStatus\(\)/); assert.match(source, /getMobileConnectionPresentation\(network\.productState\)/);
    assert.doesNotMatch(source, /network\.online|internetReachable|network\.connectionType/);
  }
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /NetInfo|createContext|probeRemoteService|tmdbFetch|useRemoteRecoveryEffect|setInterval|setRecoveryEpoch|router\.replace/);
    assert.doesNotMatch(source, /ResumePlaybackPrompt|prePhase3UiPolish|Readiness-Audit/);
    assert.ok(source.split(/\r?\n/).length <= 800, file);
  }
  const policy = read(files[2]);
  assert.match(policy, /import type.*NetworkProductState/);
  assert.doesNotMatch(policy, /from ["']react|setTimeout|Date\.now|fetch\(/);
});

for (const entry of cases) {
  test(entry.state + ': banner copy, live-region semantics and bounded compaction', () => {
    const h = harness({ state: entry.state });
    if (!entry.title) {
      assert.equal(h.result, null); assert.equal(h.timers, 0); h.advance(10000); assert.equal(h.result, null); return;
    }
    assert.deepEqual(h.texts(), [entry.title, 'Local and downloaded content remain available.']);
    assert.equal(h.alert().props.accessibilityLiveRegion, 'polite'); assert.equal(h.alert().props.accessible, true);
    const label = h.alert().props.accessibilityLabel;
    assert.equal(label, entry.title + '. Local and downloaded content remain available.');
    assert.equal(style(h.result.props.style).top, 32); assert.equal(style(h.result.props.style).left, 72);
    assert.equal(h.timers, 1); h.advance(3999); assert.equal(h.texts()[0], entry.title);
    h.advance(1); assert.deepEqual(h.texts(), [entry.compact]); assert.equal(h.timers, 0);
    assert.equal(h.alert().props.accessibilityLabel, label, 'Compaction retains local availability for screen readers');
    if (entry.state === 'degraded') assert.doesNotMatch(JSON.stringify(h.result), /offline/i);
    if (entry.state === 'reconnecting') assert.doesNotMatch(JSON.stringify(h.result), /offline|online/i);
  });
  for (const persistent of [false, true]) {
    test(entry.state + ': ' + (persistent ? 'tablet' : 'phone') + ' footer, Downloads and all destinations stay truthful and navigable', () => {
      const h = harness({ mode: 'drawer', state: entry.state, persistent });
      const label = entry.footer + (entry.state === 'online' ? ' · 42 ms' : '');
      assert.deepEqual(texts(h.footer()), ['Orion Mobile', label]);
      assert.equal(h.footer().props.accessibilityLabel, 'Orion Mobile. ' + label);
      assert.equal(h.footer().props.accessible, true);
      const dot = nodes(h.footer()).find((node) => style(node.props.style).width === 8);
      assert.equal(style(dot.props.style).backgroundColor, h.theme[entry.tone]);
      assert.equal(style(dot.props.style).shadowColor, h.theme[entry.tone]);
      const downloads = h.downloads(); assert.deepEqual(texts(downloads), entry.local ? ['Downloads', 'LOCAL'] : ['Downloads']);
      assert.equal(downloads.props.accessibilityLabel, entry.local ? 'Downloads. Local media remains available.' : 'Downloads');
      assert.equal(h.routes.length, 0, 'Rendering never redirects');
      for (const [name, route] of [['Home', '/'], ['Discover & Search', '/discover'], ['Library', '/library'],
        ['Smart Remote', '/connect'], ['Settings', '/settings']]) {
        const button = h.find(name); assert.ok(button); assert.equal(button.props.accessibilityRole, 'button');
        assert.notEqual(button.props.disabled, true); assert.notEqual(button.props.accessibilityState?.disabled, true);
        button.props.onPress(); assert.equal(h.routes.at(-1), route);
      }
      downloads.props.onPress(); assert.equal(h.routes.at(-1), '/downloads'); assert.equal(h.closes, 6);
      assert.equal(h.nodes().some((node) => node.type === 'Modal'), !persistent);
      assert.ok(h.nodes().some((node) => node.props.accessibilityViewIsModal === !persistent));
      assert.equal(h.nodes().filter((node) => node.type === 'ScrollView').length, 1);
    });
  }
}

test('latency is optional online, including zero, and never leaks into any other state', () => {
  const h = harness({ mode: 'drawer', latencyMs: null });
  assert.deepEqual(texts(h.footer()), ['Orion Mobile', 'Online']);
  h.connect('online', { latencyMs: 0 }); assert.deepEqual(texts(h.footer()), ['Orion Mobile', 'Online · 0 ms']);
  for (const entry of cases.filter((entry) => entry.state !== 'online')) {
    h.connect(entry.state, { latencyMs: 900 }); assert.deepEqual(texts(h.footer()), ['Orion Mobile', entry.footer]);
  }
});

test('online/checking hide immediately on transitions and cancel old presentation timers', () => {
  for (const state of ['online', 'checking']) {
    const h = harness({ state: 'offline' }); h.advance(2000); h.connect(state);
    assert.ok(h.frames.every((frame) => frame === null), 'No stale warning even before effects');
    assert.equal(h.timers, 0); h.advance(10000); assert.equal(h.result, null);
    h.connect('offline'); assert.equal(h.texts()[0], "You're offline"); assert.equal(h.timers, 1);
  }
});

test('product-state transitions re-expand truthful copy and restart only the bounded presentation delay', () => {
  const h = harness({ state: 'offline' }); h.advance(4000); assert.deepEqual(h.texts(), ['Offline']);
  h.connect('degraded'); assert.equal(h.texts()[0], 'Service unavailable'); assert.equal(h.texts().length, 2);
  h.advance(3000); h.connect('reconnecting'); assert.equal(h.texts()[0], 'Trying to reconnect');
  h.advance(1000); assert.equal(h.texts().length, 2, 'Old degraded timer cannot compact the reconnecting state');
  h.advance(3000); assert.deepEqual(h.texts(), ['Reconnecting']);
  h.connect('online'); assert.equal(h.result, null); assert.equal(h.timers, 0);
});

test('latency and native-transport changes cannot restart the banner delay or replace product truth', () => {
  const h = harness({ state: 'degraded' }); h.advance(3000);
  h.connect('degraded', { latencyMs: 12, online: true, internetReachable: true, connectionType: 'cellular' });
  h.advance(1000); assert.deepEqual(h.texts(), ['Service unavailable']);
  h.connect('degraded', { online: false, internetReachable: false }); assert.deepEqual(h.texts(), ['Service unavailable']);
  const drawer = harness({ mode: 'drawer' }); drawer.connect('online', { online: false, internetReachable: false });
  assert.deepEqual(texts(drawer.footer()), ['Orion Mobile', 'Online · 42 ms']);
});

test('unmount cancels the one UI timer without leaving network work', () => {
  const h = harness({ state: 'offline' }); assert.equal(h.timers, 1); h.unmount(); assert.equal(h.timers, 0);
});

test('restoration acknowledgement is intentionally absent on mount and later restoration', () => {
  const h = harness(); assert.equal(h.result, null); assert.equal(h.timers, 0);
  h.connect('offline'); h.connect('online', { restoredAt: 1000, recoveryEpoch: 6 }); assert.equal(h.result, null);
  assert.doesNotMatch(read(files[0]), /restoredAt|recoveryEpoch|Connection restored/);
});

for (const themeId of ['midnight-premiere', 'amoled', 'mocha', 'slate', 'projector-silver', 'custom']) {
  test(themeId + ': banner, footer and LOCAL badge consume existing semantic theme values', () => {
    for (const entry of cases.filter((entry) => entry.local)) {
      const h = harness({ state: entry.state, themeId });
      assert.equal(style(h.alert().props.style).backgroundColor, h.theme.surface);
      assert.equal(style(h.alert().props.style).borderColor, h.theme.border);
      assert.equal(style(textNodes(h.result)[0].props.style).color, h.theme.text);
      assert.equal(style(textNodes(h.result)[1].props.style).color, h.theme.textSecondary);
      assert.equal(h.nodes().find((node) => node.type === 'Ionicons').props.color, h.theme[entry.tone]);
      h.unmount();
      const drawer = harness({ mode: 'drawer', state: entry.state, themeId });
      const badge = textNodes(drawer.downloads()).find((node) => node.props.children === 'LOCAL');
      assert.equal(style(badge.props.style).color, drawer.theme.text);
      assert.equal(style(badge.props.style).backgroundColor, drawer.theme.elevated);
      assert.equal(style(badge.props.style).borderColor, drawer.theme.border);
      assert.equal(style(drawer.footer().props.style).backgroundColor, drawer.theme.surface);
      assert.equal(style(drawer.footer().props.style).borderColor, drawer.theme.border);
    }
  });
}

test('changed connection styling has no hard-coded state colors and text remains scalable without motion', () => {
  const banner = read(files[0]), drawer = read(files[1]);
  assert.doesNotMatch(banner + drawer + read(files[2]), /#10b981|#ef4444/);
  assert.doesNotMatch(banner, /#[0-9a-f]{3,8}|Animated|withTiming|numberOfLines|allowFontScaling=\{false\}/i);
  const h = harness({ state: 'offline', reducedMotion: true });
  assert.equal(h.texts()[0], "You're offline"); h.advance(4000); assert.deepEqual(h.texts(), ['Offline']);
  assert.ok(h.alert().props.accessibilityLabel.includes('Local and downloaded content remain available.'));
  for (const text of textNodes(h.result)) { assert.equal(text.props.numberOfLines, undefined); assert.notEqual(text.props.allowFontScaling, false); }
  const nav = harness({ mode: 'drawer', state: 'offline' });
  for (const text of [...textNodes(nav.footer()), ...textNodes(nav.downloads())]) {
    assert.equal(text.props.numberOfLines, undefined); assert.notEqual(text.props.allowFontScaling, false);
  }
  const copy = nodes(nav.downloads()).find((node) => style(node.props.style).minWidth === 0);
  assert.ok(copy); assert.equal(style(copy.props.style).flex, 1);
  const badge = textNodes(nav.downloads()).find((node) => node.props.children === 'LOCAL');
  assert.equal(style(badge.props.style).alignSelf, 'flex-start');
});

test('Downloads emphasis follows state without renaming, losing selection, or auto-navigating', () => {
  const h = harness({ mode: 'drawer', pathname: '/downloads' });
  for (const entry of cases) {
    h.connect(entry.state); assert.equal(texts(h.downloads())[0], 'Downloads');
    assert.equal(h.downloads().props.accessibilityState.selected, true);
    assert.equal(texts(h.downloads()).includes('LOCAL'), entry.local); assert.equal(h.routes.length, 0);
  }
});

test('global banner remains a single root mount under the existing NetworkProvider', () => {
  const mounts = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.tsx$/.test(entry.name)) {
        const count = (fs.readFileSync(file, 'utf8').match(/<OfflineBanner\b/g) || []).length;
        for (let index = 0; index < count; index++) mounts.push(path.relative(root, file).replaceAll('\\', '/'));
      }
    }
  }
  visit(path.join(root, 'app')); visit(path.join(root, 'src'));
  assert.deepEqual(mounts, ['app/_layout.tsx']);
  const layout = read('app/_layout.tsx'); assert.match(layout, /<NetworkProvider>[\s\S]*<ThemedApplication\s*\/>[\s\S]*<\/NetworkProvider>/);
});

test('phone trigger and tablet layout retain the existing single SidebarDrawer owner', () => {
  const phone = harness({ mode: 'trigger' });
  let drawer = phone.nodes().find((node) => node.type === 'SidebarDrawer'); assert.equal(drawer.props.visible, false);
  phone.find('Open navigation').props.onPress(); phone.render();
  drawer = phone.nodes().find((node) => node.type === 'SidebarDrawer'); assert.equal(drawer.props.visible, true);
  drawer.props.onClose(); phone.render(); assert.equal(phone.nodes().find((node) => node.type === 'SidebarDrawer').props.visible, false);
  assert.equal(harness({ mode: 'trigger', tablet: true }).result, null);
  const tablet = harness({ mode: 'tabs', tablet: true });
  const persistent = tablet.nodes().filter((node) => node.type === 'SidebarDrawer'); assert.equal(persistent.length, 1);
  assert.equal(persistent[0].props.visible, true); assert.equal(persistent[0].props.persistent, true);
  assert.equal(harness({ mode: 'tabs', tablet: false }).nodes().filter((node) => node.type === 'SidebarDrawer').length, 0);
  const actual = harness({ mode: 'drawer', persistent: true }); actual.drawer({ visible: false }); assert.equal(actual.result, null);
});
