'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { loader } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const noop = () => {};
const themeSource = 'apps/mobile/src/context/ThemeContext.tsx';
const appearance = 'apps/mobile/src/features/appearance/';
const pure = loader({ react: { createContext: () => ({}) }, 'react-native': {},
  '../services/storageAdapter': {}, '../hooks/useSystemReducedMotion': {} });
const themeModule = pure(themeSource);
const { compositePaletteColor, inheritedCustomPalette, paletteContrast } = pure(appearance + 'customAppearancePalette.ts');
const { ORION_MOBILE_THEMES: historical, resolvePalette, resolveCustomProfile, resolveAppliedAppearancePalette } = themeModule;
const presetIds = Object.keys(historical);
const roles = inheritedCustomPalette();

function choices(light = {}, dark = {}, rendering = 'adaptive') {
  return { manualTheme: 'custom', lightTheme: 'custom-light', darkTheme: 'custom', followSystem: true,
    custom: { light: { ...roles, ...light }, dark: { colors: { ...roles, ...dark }, rendering } } };
}

const colors = [choices({ accent: '#FFFF00', text: '#000000' }, { accent: '#FBE288', text: '#FFFFFF' }),
  choices({ accent: '#001408', background: '#777777', surface: '#888888' },
    { accent: '#08001B', background: '#747474', surface: '#383838' }),
  choices({ accent: '#FF0090', background: '#F8F1DC', surface: '#EDDBDB', border: '#FFFFFF' },
    { accent: '#00FF00', background: '#191522', surface: '#24162C', border: '#000000' })];
const adaptiveCases = colors.flatMap(advancedAppearanceChoices =>
  ['custom-light', 'custom'].map(effectiveAppearanceThemeId => ({
    theme: resolveAppliedAppearancePalette(effectiveAppearanceThemeId, advancedAppearanceChoices),
    effectiveAppearanceThemeId, advancedAppearanceChoices, preferences: { reducedMotion: true },
    systemReducedMotion: true,
  })));
const legacyCases = [...presetIds.map(id => ({ theme: historical[id], effectiveAppearanceThemeId: id })),
  { theme: resolvePalette('custom', '#FFFF00'), effectiveAppearanceThemeId: 'custom' }]
  .map(entry => ({ ...entry, advancedAppearanceChoices: choices({}, {}, 'legacy'),
    preferences: { reducedMotion: true }, systemReducedMotion: true }));

const node = (type, props = {}) => ({ type, props });
const runtime = { jsx: node, jsxs: node, Fragment: 'Fragment' };
function descendants(root) {
  if (!root || typeof root !== 'object') return [];
  if (Array.isArray(root)) return root.flatMap(descendants);
  return [root, ...descendants(root.props?.children)];
}
function withText(tree, text) {
  const hit = descendants(tree).find(item => item.type === 'Text' &&
    (item.props.children === text || (Array.isArray(item.props.children) && item.props.children.join('') === text)));
  assert.ok(hit, text);
  return hit;
}
function flat(style) {
  return Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : style || {};
}
function contrast(foreground, background, threshold) {
  assert.ok(paletteContrast(foreground, background) >= threshold,
    `${foreground} on ${background} must reach ${threshold}:1`);
}
const sharedStubs = {
  'react/jsx-runtime': runtime,
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 20, bottom: 24, left: 0, right: 0 }) },
  '@expo/vector-icons': { Ionicons: 'Ionicons' }, 'expo-blur': { BlurView: 'BlurView' },
  'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
  '@orion/shared/api': { imgUrl: (uri, size) => `${size}:${uri}` },
};

function component(look, name, extra = {}) {
  const h = hookHarness();
  const rn = {
    StyleSheet: { create: x => x, absoluteFill: { position: 'absolute', top: 0, bottom: 0, right: 0, left: 0 } },
    useWindowDimensions: () => ({ width: 390, height: 840 }),
    Dimensions: { get: () => ({ width: 390 }) },
    AppState: { currentState: 'active', addEventListener: () => ({ remove: noop }) },
    Keyboard: { addListener: () => ({ remove: noop }) },
    AccessibilityInfo: { setAccessibilityFocus: noop },
    Animated: { Value: class { setValue() {} }, View: 'AnimatedView' },
    Platform: { OS: 'android' },
    ...Object.fromEntries(['View', 'Text', 'ImageBackground', 'Pressable', 'FlatList', 'Modal', 'ScrollView',
      'ActivityIndicator', 'Image'].map(key => [key, key])),
  };
  const loaded = loader({
    ...sharedStubs, react: h.react,
    '../context/ThemeContext': { useOrionTheme: () => look, ORION_MOBILE_THEMES: historical },
    '../context/LibraryContext': { useLibraryVisual: () => ({ isSaved: () => false, toggleSave: extra.toggleSave || noop }) },
    'react-native': rn,
    'expo-router': { usePathname: () => extra.pathname || '/', useRouter: () => extra.router || {} },
    '../context/NetworkContext': { useNetworkStatus: () => ({ remoteReady: true }) },
    ...extra.mocks,
  })(`apps/mobile/src/components/${name}.tsx`);
  return { h, render: loaded[name] };
}

function hero(context, actions = {}) {
  const outer = component(context, 'HeroBillboard', actions);
  const item = { id: 1, media_type: 'movie', title: 'Fixture', overview: 'Overview',
    backdrop_path: '/bright.jpg', vote_average: 8, release_date: '2024-01-07' };
  outer.h.start(outer.render, { items: [item], onPlay: actions.play, onPress: actions.detail, onInfo: actions.info });
  const list = descendants(outer.h.result).find(x => x.type === 'FlatList');
  const slide = list.props.renderItem({ item: list.props.data[0] });
  const h = hookHarness();
  // The slide only reads context hooks mocked above, so render its actual element.
  h.start(slide.type, slide.props);
  outer.h.dispose();
  return h.result;
}

test('Hero media copy and glass actions contrast on black and white artwork while Play keeps the accent pair', () => {
  for (const look of adaptiveCases) {
    const tree = hero(look);
    const scrim = descendants(tree).find(x => flat(x.props.style).backgroundColor === 'rgba(0,0,0,0.72)');
    assert.ok(scrim);
    assert.equal(scrim.props.pointerEvents, 'none');
    for (const artwork of ['#000000', '#FFFFFF']) {
      const backing = compositePaletteColor(flat(scrim.props.style).backgroundColor, artwork);
      for (const text of ['SPOTLIGHT · MOVIE', 'Fixture', '8.0', '2024', 'Overview', 'My List', 'More Info']) {
        const { color, opacity = 1 } = flat(withText(tree, text).props.style);
        const foreground = opacity === 1 ? color : compositePaletteColor(`rgba(255,255,255,${opacity})`, backing);
        contrast(foreground, backing, 4.5);
      }
    }
    contrast(flat(withText(tree, 'Play').props.style).color, look.theme.accent, 4.5);
    assert.equal(descendants(tree).filter(x => x.type === 'LinearGradient').length, 3);
    assert.equal(flat(descendants(tree).find(x => x.type === 'Pressable' &&
      descendants(x.props.children).some(n => n.type === 'Text' && n.props.children === 'Play') &&
      typeof x.props.style === 'function').props.style({ pressed: true })).opacity, 1);
  }
});

test('Hero adaptive media scrim does not change playback, My List, info, or artwork actions', () => {
  const calls = [];
  const tree = hero(adaptiveCases[0], {
    play: () => calls.push('play'), detail: () => calls.push('detail'),
    info: () => calls.push('info'), toggleSave: () => calls.push('save'),
  });
  for (const button of descendants(tree).filter(x => x.type === 'Pressable')) button.props.onPress({ stopPropagation: noop });
  assert.deepEqual(calls, ['detail', 'play', 'save', 'info']);
  assert.equal(descendants(tree).find(x => x.type === 'ImageBackground').props.source.uri, 'original:/bright.jpg');
});

test('Historical Hero, Search, and dialog retain their existing styles for every preset and a legacy saved accent', () => {
  for (const look of legacyCases) {
    const tree = hero(look);
    assert.equal(flat(withText(tree, 'Fixture').props.style).color, look.theme.onAccent);
    assert.equal(flat(withText(tree, 'SPOTLIGHT · MOVIE').props.style).color, look.theme.accent);
    assert.equal(descendants(tree).filter(x => flat(x.props.style).backgroundColor === 'rgba(0,0,0,0.72)').length, 0);
    const search = component(look, 'GlobalSearchShortcut');
    search.h.start(search.render, {});
    assert.ok(descendants(search.h.result).some(x => x.type === 'BlurView'));
    search.h.dispose();
    const dialog = component(look, 'OrionDialog');
    dialog.h.start(dialog.render, { visible: true, title: 'Confirm', actions: [{ role: 'destructive', label: 'Remove', onPress: noop }], onDismiss: noop });
    assert.equal(flat(withText(dialog.h.result, 'Remove').props.style).color, look.theme.onAccent);
    dialog.h.dispose();
  }
});

test('Floating Search chooses an opaque readable backing and preserves position, accessibility and navigation', () => {
  for (const look of adaptiveCases) for (const pathname of ['/', '/discover']) {
    const calls = [];
    const search = component(look, 'GlobalSearchShortcut', { pathname, router: {
      push: args => calls.push(['push', args]), setParams: args => calls.push(['params', args]),
    } });
    search.h.start(search.render, {});
    const action = descendants(search.h.result).find(x => x.type === 'Pressable');
    const icon = descendants(action).find(x => x.type === 'Ionicons');
    for (const pressed of [false, true]) {
      const style = flat(action.props.style({ pressed }));
      assert.equal(style.backgroundColor, look.theme.surface);
      assert.match(style.backgroundColor, /^#[0-9a-f]{6}$/i);
      assert.equal(style.opacity, 1);
      contrast(icon.props.color, style.backgroundColor, 3);
      contrast(compositePaletteColor(style.borderColor, style.backgroundColor), style.backgroundColor, 3);
      assert.equal(style.width, 46);
    }
    assert.equal(action.props.accessibilityLabel, 'Search Orion');
    assert.equal(action.props.accessibilityHint, 'Opens Discover and focuses search');
    assert.equal(action.props.accessibilityRole, 'button');
    assert.equal(flat(search.h.result.props.style).bottom, 42);
    action.props.onPress();
    assert.equal(calls[0][0], pathname === '/discover' ? 'params' : 'push');
    if (pathname === '/') assert.equal(calls[0][1].pathname, '/discover');
    assert.match((calls[0][1].params || calls[0][1]).focusSearch, /^\d+$/);
    search.h.dispose();
  }
});

test('Dialog uses readable Primary and Danger pairs, a thick focus outline, and semantic disabled state', async () => {
  for (const look of adaptiveCases) {
    const calls = [];
    const dialog = component(look, 'OrionDialog');
    dialog.h.start(dialog.render, { visible: true, title: 'Confirm',
      actions: [{ label: 'Keep', role: 'primary', onPress: () => calls.push('keep') },
        { label: 'Remove', role: 'destructive', onPress: () => calls.push('remove') },
        { label: 'Unavailable', disabled: true, onPress: noop }],
      onDismiss: () => calls.push('dismiss'),
    });
    const get = label => descendants(dialog.h.result).find(x => x.props.accessibilityLabel === label);
    for (const [name, fill] of [['Keep', look.theme.accent], ['Remove', look.theme.danger]]) {
      const before = get(name);
      assert.equal(flat(before.props.style({ pressed: false })).backgroundColor, fill);
      contrast(flat(withText(before, name).props.style).color, fill, 4.5);
      before.props.onFocus();
      await dialog.h.settle();
      const active = flat(get(name).props.style({ pressed: true }));
      assert.equal(active.borderWidth, 2);
      assert.equal(active.opacity, 1);
      contrast(active.borderColor, fill, 3);
      get(name).props.onBlur();
      await dialog.h.settle();
      assert.equal(flat(get(name).props.style({ pressed: false })).borderWidth, 1);
      get(name).props.onPress();
    }
    assert.equal(get('Unavailable').props.disabled, true);
    assert.deepEqual(get('Unavailable').props.accessibilityState, { disabled: true });
    assert.equal(flat(get('Unavailable').props.style({ pressed: false })).borderStyle, 'dashed');
    contrast(flat(withText(get('Unavailable'), 'Unavailable').props.style).color, look.theme.surface, 4.5);
    assert.equal(new Set([look.theme.success, look.theme.warning, look.theme.danger]).size, 3);
    dialog.h.result.props.onRequestClose();
    assert.deepEqual(calls, ['keep', 'remove', 'dismiss']);
    dialog.h.dispose();
  }
});

test('Trailer preparation and error read over black and provider source stays independent of adaptive palette', () => {
  const candidate = { id: 'fixture', providerKey: 'abcdefghijk', name: 'Fixture', site: 'YouTube' };
  for (const look of [...adaptiveCases, ...legacyCases]) {
    let state = 'preparing';
    const preview = component(look, 'TrailerModal', { mocks: {
      'react-native-webview': { WebView: 'WebView' },
      '../services/mobileDiagnostics': { clearMobileDiagnosticError: noop, reportMobileDiagnosticError: noop },
      '../features/trailers/trailerProviders': { createYouTubeHtml: () => '<html>test provider frame</html>', createVimeoHtml: noop },
      '../features/trailers/hooks/useTrailerSession': { useTrailerSession: () => ({
        state, candidates: [candidate], activeCandidate: candidate, messageToken: 'fixture', attempt: 1,
        transport: 'html', handleMessage: noop, retry: noop, next: noop,
      }) },
      '../features/trailers/trailerExternalTarget': { exactTrailerUrl: noop, trailerExternalTarget: noop },
    } });
    const props = { title: 'Fixture', visible: true, onClose: noop, candidates: [candidate] };
    preview.h.start(preview.render, props);
    const loading = withText(preview.h.result, 'Preparing trailer…');
    const frame = descendants(preview.h.result).find(x => x.type === 'WebView');
    assert.deepEqual(frame.props.source, { html: '<html>test provider frame</html>', baseUrl: 'https://com.okali.orion' });
    assert.equal(flat(frame.props.style).backgroundColor, '#000');
    assert.equal(frame.props.mixedContentMode, 'never');
    const adaptive = adaptiveCases.includes(look);
    if (adaptive) {
      contrast(flat(loading.props.style).color, '#000000', 4.5);
      contrast(descendants(preview.h.result).find(x => x.type === 'ActivityIndicator').props.color, '#000000', 3);
    } else assert.equal(flat(loading.props.style).color, look.theme.textSecondary);
    state = 'network-error';
    preview.h.update(props);
    const error = withText(preview.h.result, 'Trailer connection failed');
    const detail = withText(preview.h.result, 'Check your connection, retry this trailer, or open it in the provider app.');
    if (adaptive) {
      contrast(flat(error.props.style).color, '#000000', 4.5);
      contrast(flat(detail.props.style).color, '#000000', 4.5);
      contrast(descendants(preview.h.result).find(x => x.props.name === 'alert-circle-outline').props.color, '#000000', 3);
    } else {
      assert.equal(flat(error.props.style).color, look.theme.text);
      assert.equal(flat(detail.props.style).color, look.theme.textSecondary);
    }
    preview.h.dispose();
  }
});

test('Representative owned app surfaces retain readable foregrounds, action pairs and boundaries', () => {
  for (const look of adaptiveCases) {
    const { theme, effectiveAppearanceThemeId, advancedAppearanceChoices } = look;
    const profile = effectiveAppearanceThemeId === 'custom-light' ? 'light' : 'dark';
    assert.equal(theme.dark, profile === 'dark');
    assert.deepEqual(resolveCustomProfile(advancedAppearanceChoices, profile).issues, []);
    for (const key of ['background','surface','elevated','input','surfaceHover']) {
      for (const text of ['text','textSecondary','accent']) contrast(theme[text], theme[key], 4.5);
      contrast(compositePaletteColor(theme.border, theme[key]), theme[key], 3);
    }
    contrast(theme.onAccent, theme.accent, 4.5);
  }
});

test('Poster rating and download badges have controlled contrast on bright and dark artwork and preserve status behavior', () => {
  const movie = { id: 1, title: 'Fixture', media_type: 'movie', vote_average: 8, poster_path: '/white.jpg' };
  const series = { id: 2, name: 'Fixture', media_type: 'tv', vote_average: 8, poster_path: '/black.jpg' };
  for (const look of [...adaptiveCases, ...legacyCases]) {
    const adaptive = adaptiveCases.includes(look);
    const calls = [];
    const card = component(look, 'MediaCard', { toggleSave: item => calls.push(item.id), mocks: {
      '../features/downloads/MobileDownloadAvailabilityContext': {
        useMobileDownloadAvailability: () => ({ downloaded: true, episodeCount: 2 }),
      },
    } });
    card.h.start(card.render, { item: movie, watched: true });
    for (const [item, artwork] of [[movie, '#FFFFFF'], [series, '#000000']]) {
      card.h.update({ item, watched: true, onPress: () => calls.push('details') });
      const button = card.h.result;
      const tree = button.props.children({ pressed: false });
      const badges = descendants(tree).filter(view =>
        view.props.children?.some?.(child => ['download-outline', 'star'].includes(child?.props?.name)));
      assert.equal(badges.length, 2);
      for (const badge of badges) {
        const foregrounds = descendants(badge).filter(node => node.type === 'Text' || node.type === 'Ionicons');
        if (adaptive) {
          assert.equal(badge.type, 'View');
          const fill = flat(badge.props.style).backgroundColor;
          assert.equal(fill, '#16161C');
          for (const node of foregrounds) {
            const isText = node.type === 'Text';
            contrast(isText ? flat(node.props.style).color : node.props.color, compositePaletteColor(fill, artwork), isText ? 4.5 : 3);
          }
        } else {
          assert.equal(badge.type, 'BlurView');
          assert.equal(badge.props.tint, look.theme.dark ? 'dark' : 'light');
          const rating = foregrounds.some(node => node.props.name === 'star');
          assert.equal(badge.props.intensity, rating ? 60 : 42);
          assert.equal(flat(badge.props.style).backgroundColor, rating ? 'rgba(0,0,0,0.6)' : 'rgba(5, 5, 10, 0.42)');
          for (const node of foregrounds.filter(node => node.type === 'Text')) {
            assert.equal(flat(node.props.style).color, look.theme.text);
          }
        }
      }
      assert.equal(descendants(tree).find(node => node.props.name === 'star').props.color, '#ffb845');
      assert.equal(descendants(tree).find(node => node.props.name === 'checkmark').props.color, look.theme.success);
      assert.equal(descendants(tree).find(node => node.type === 'Image').props.source.uri, 'w500:' + item.poster_path);
      assert.match(button.props.accessibilityLabel, /Watched/);
      assert.match(button.props.accessibilityLabel, item === movie ? /Available offline/ : /2 episodes downloaded/);
      button.props.onPress();
      button.props.onLongPress();
    }
    assert.deepEqual(calls, ['details', 1, 'details', 2]);
    card.h.dispose();
  }
});

test('Completed Downloads Play keeps icon and text contrast through press, focus and disabled states', async () => {
  const media = { id: 1, title: 'Fixture', mediaType: 'movie', libraryKind: 'movie', year: 2024 };
  const entry = { entryId: 'entry', media, groupKey: 'movie:1', primaryAssetId: 'asset', assetIds: ['asset'], updatedAt: 1 };
  const asset = { assetId: 'asset', destination: 'orion-library', availability: 'verified',
    storageTarget: { mode: 'app-private' }, actions: { open: true } };
  for (const look of [...adaptiveCases, ...legacyCases]) {
    const adaptive = adaptiveCases.includes(look);
    const calls = [], list = hookHarness(), button = hookHarness();
    let renderer = list;
    const react = Object.fromEntries(Object.keys(list.react).map(name => [name, (...args) => renderer.react[name](...args)]));
    const load = loader({
      ...sharedStubs, react,
      'react-native': { StyleSheet: { create: x => x, hairlineWidth: 1 },
        ...Object.fromEntries(['View', 'Text', 'Image', 'Pressable', 'ScrollView', 'TextInput'].map(key => [key, key])) },
      '../../context/ThemeContext': { useOrionTheme: () => look },
      '../playback/mobileSources': { MOBILE_PLAYER_SOURCES: [] },
      './nativeDownloadEngine': { cancelNativeDownloadJobV1: () => calls.push('cancel') },
      './downloadCandidateCapture': {},
    });
    const { DownloadActivityList } = load('apps/mobile/src/features/downloads/DownloadActivityList.tsx');
    list.start(DownloadActivityList, { jobs: [], assets: [asset], offlineEntries: [entry], active: false,
      onPlayInOrion: (...args) => calls.push(args), onPlayLocally: id => calls.push(['local', id]) });
    const play = descendants(list.result).find(node => node.props.label === 'Play in Orion');
    assert.ok(play);
    renderer = button;
    button.start(play.type, play.props);
    function check(pressed, focused = false, disabled = false) {
      const pressable = button.result;
      const style = flat(pressable.props.style({ pressed }));
      const label = flat(withText(pressable, 'Play in Orion').props.style).color;
      const icon = descendants(pressable).find(node => node.props.name === 'play').props.color;
      assert.equal(pressable.props.accessibilityRole, 'button');
      assert.equal(pressable.props.accessibilityLabel, 'Play Fixture in Orion');
      if (adaptive) {
        assert.equal(style.backgroundColor, disabled ? look.theme.elevated : look.theme.accent);
        contrast(label, style.backgroundColor, 4.5);
        contrast(icon, style.backgroundColor, 3);
        assert.equal(style.borderWidth, focused && !disabled ? 2 : 1);
        assert.deepEqual(pressable.props.accessibilityState, { disabled });
        if (focused && !disabled) contrast(style.borderColor, style.backgroundColor, 3);
        if (disabled) assert.equal(style.borderStyle, 'dashed');
        if (pressed && !disabled) assert.deepEqual(style.transform, [{ scale: 0.98 }]);
      } else {
        assert.equal(style.backgroundColor, pressed ? look.theme.accentSoft : look.theme.accent);
        assert.equal(style.opacity, disabled ? 0.55 : 1);
        assert.equal(label, look.theme.onAccent);
        assert.equal(icon, look.theme.onAccent);
      }
    }
    check(false);
    check(true);
    if (adaptive) {
      button.result.props.onFocus();
      await button.settle();
      check(false, true);
      check(true, true);
      button.result.props.onBlur();
      await button.settle();
      check(false);
    }
    button.result.props.onPress();
    button.update({ ...play.props, disabled: true });
    assert.equal(button.result.props.disabled, true);
    check(false, false, true);
    const localPlay = descendants(list.result).find(node => node.props.label === 'Play Locally');
    assert.ok(localPlay);
    localPlay.props.onPress();
    assert.deepEqual(calls, [[entry, asset.assetId], ['local', asset.assetId]]);
    button.dispose();
    list.dispose();
  }
});

test('Player route scopes the complete historical theme and native handoff without preference writes', () => {
  const React = require('react');
  const { RN, testing } = require('./helpers/appearanceStudioHarness.cjs');
  const { createElement: element } = React;
  const adaptive = colors[0];
  const cases = [
    ['custom-light', adaptive, true, historical['projector-silver']],
    ['custom', adaptive, true, historical.custom],
    ...presetIds.map(id => [id, choices({}, {}, 'legacy'), false, historical[id]]),
    ['custom', choices({}, { accent: '#285E95' }, 'legacy'), false, resolvePalette('custom', '#285E95')],
  ];
  for (const [id, saved, follows, expected] of cases) {
    const preferences = { schemaVersion: 3, ...saved, manualTheme: id, followSystem: follows, reducedMotion: true };
    const stored = JSON.stringify(preferences);
    const local = new Map([['mobileThemePreferencesV3', stored],
      ['mobileThemePreferencesV2', '{"schemaVersion":2}'], ['mobileThemePreferencesV1', '{"schemaVersion":1}']]);
    const originalRecords = [...local], writes = [], reads = [], launches = [];
    const appearanceListeners = new Set();
    let scheme = id === 'custom-light' ? 'light' : 'dark';
    let outer, inside, mounted = 0;
    const telemetry = { emitTelemetry: noop, getVerifiedSnapshot: noop, flush: noop };
    let context, NativeSurface;
    function AppThemeProbe() { outer = context.useOrionTheme(); return null; }
    function PlayerScreen() {
      inside = context.useOrionTheme();
      React.useEffect(() => { mounted++; }, []);
      return element(NativeSurface, {
        assetId: 'asset', id: 1, title: 'Fixture', type: 'movie', sourceId: 'local',
        initialResumeTime: 37, onExit: noop,
      });
    }
    const load = loader({
      'react-native': {
        ...RN, Appearance: { getColorScheme: () => scheme, addChangeListener: fn => {
          appearanceListeners.add(fn); return { remove: () => appearanceListeners.delete(fn) };
        } },
        AppState: { addEventListener: () => ({ remove: noop }) },
      },
      '@expo/vector-icons': { Ionicons: () => null },
      '../../src/features/playback/PlayerScreen': { __esModule: true, default: PlayerScreen },
      '../services/storageAdapter': { mmkvStorageAdapter: {
        get: key => { reads.push(key); return local.get(key) ?? null; },
        set: (key, value) => { writes.push([key, value]); local.set(key, value); },
      }, getMobileStorageHealth: () => ({ state: 'ready' }) },
      '../hooks/useSystemReducedMotion': { useSystemReducedMotion: () => false },
      '../../context/LibraryContext': { useLibraryPlaybackActions: () => ({ recordPlayback: noop }) },
      '../downloads/nativeDownloadEngine': {
        subscribeNativeFinalizedPlayerProgressV1: () => noop,
        launchNativeFinalizedPlayerV1: payload => { launches.push(payload); return new Promise(() => {}); },
      },
      './presentationPreferences': { getPresentationPreference: () => 'fill', savePresentationPreference: noop },
      './usePlaybackTelemetryController': { usePlaybackTelemetryController: () => telemetry },
    });
    context = load(themeSource);
    NativeSurface = load('apps/mobile/src/features/playback/OrionFinalizedPlayerActivitySurface.tsx').OrionFinalizedPlayerActivitySurface;
    const Route = load('apps/mobile/app/player/[id].tsx').default;
    const app = playing => element(context.ThemeProvider, null,
      element(AppThemeProbe, { key: 'app' }), playing && element(Route, { key: 'player' }));
    const view = testing.render(app(false));
    try {
      const appBefore = outer, originalTheme = outer.theme;
      assert.equal(outer.effectiveAppearanceThemeId, id);
      view.rerender(app(true));
      assert.deepEqual(inside.theme, expected, id);
      for (const key of Object.keys(outer).filter(key => key !== 'theme')) {
        assert.equal(inside[key], outer[key], id + ' ' + key);
      }
      assert.deepEqual(outer.theme, originalTheme);
      const { accent, onAccent, text, textSecondary, mediaScrim, surface, elevated, border } = expected;
      const payload = { accent, onAccent, text, textSecondary, mediaScrim, surface, elevated, border, reducedMotion: true };
      assert.deepEqual(launches, [{ assetId: 'asset', initialPositionSeconds: 37, title: 'Fixture', presentation: 'fill', theme: payload }]);
      const reference = document.createElement('span');
      reference.style.color = expected.text;
      assert.equal(view.getByText('Preparing source').style.color, reference.style.color);
      if (follows) {
        assert.notDeepEqual(inside.theme, outer.theme);
        const before = inside.advancedAppearanceChoices;
        testing.act(() => {
          scheme = scheme === 'light' ? 'dark' : 'light';
          for (const listener of appearanceListeners) listener({ colorScheme: scheme });
        });
        assert.deepEqual(inside.theme, scheme === 'light' ? historical['projector-silver'] : historical.custom);
        assert.equal(inside.advancedAppearanceChoices, before);
        assert.equal(mounted, 1);
        assert.equal(launches.length, 1);
        testing.act(() => {
          scheme = scheme === 'light' ? 'dark' : 'light';
          for (const listener of appearanceListeners) listener({ colorScheme: scheme });
        });
      } else {
        assert.equal(inside, outer);
      }
      view.rerender(app(false));
      assert.equal(view.queryByText('Preparing source'), null);
      assert.equal(outer.effectiveAppearanceThemeId, id);
      assert.deepEqual(outer.theme, originalTheme);
      assert.equal(outer.advancedAppearanceChoices, appBefore.advancedAppearanceChoices);
      assert.deepEqual(reads, ['mobileThemePreferencesV3']);
      assert.deepEqual(writes, []);
      assert.deepEqual([...local], originalRecords);
    } finally {
      view.unmount();
    }
  }
});
