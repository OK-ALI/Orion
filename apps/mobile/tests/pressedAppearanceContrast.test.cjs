'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { loader } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');

const source = 'apps/mobile/src/';
const themePath = source + 'context/ThemeContext.tsx';
const noop = () => {};
const pure = loader({ react: { createContext: () => ({}) }, 'react-native': {},
  '../services/storageAdapter': {}, '../hooks/useSystemReducedMotion': {} });
const { ORION_MOBILE_THEMES, resolvePalette, resolveCustomProfile } = pure(themePath);
const { compositePaletteColor, inheritedCustomPalette, paletteContrast } =
  pure(source + 'features/appearance/customAppearancePalette.ts');
const blank = inheritedCustomPalette();
function look(profile, colors) {
  const advancedAppearanceChoices = {
    custom: { light: { ...blank }, dark: { rendering: 'adaptive', colors: { ...blank } } },
  };
  if (profile === 'light') Object.assign(advancedAppearanceChoices.custom.light, colors);
  else Object.assign(advancedAppearanceChoices.custom.dark.colors, colors);
  const { palette: theme, issues } = resolveCustomProfile(advancedAppearanceChoices, profile);
  assert.deepEqual(issues, []);
  return { theme, effectiveAppearanceThemeId: profile === 'light' ? 'custom-light' : 'custom',
    advancedAppearanceChoices };
}
const resumeRegression = look('dark', { accent: '#717C77' });
const nearThreshold = look('dark', { background: '#747474', surface: '#747474', accent: '#08001B' });
const adaptiveCases = [resumeRegression, nearThreshold,
  look('light', { accent: '#FFFF00', text: '#000000' }),
  look('dark', { accent: '#FFFF00', text: '#FFFFFF', surface: '#191522' }),
  look('light', { background: '#777777', surface: '#888888', accent: '#001408' }),
  look('light', { background: '#F8F1DC', surface: '#EDDBDB', accent: '#FF0090' }),
  look('dark', { background: '#191522', surface: '#24162C', accent: '#00FF00' })];
const legacyCases = [...Object.entries(ORION_MOBILE_THEMES).map(([id, theme]) => ({
  effectiveAppearanceThemeId: id, theme,
})), { effectiveAppearanceThemeId: 'custom', theme: resolvePalette('custom', '#285E95') }]
  .map(value => ({ ...value, advancedAppearanceChoices: { custom: { dark: { rendering: 'legacy' } } } }));

const node = (type, props) => ({ type, props });
const flat = style => Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : style || {};
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const named = (root, label) => nodes(root).find(n => n.props.accessibilityLabel === label);
const textColor = (root, label) => flat(nodes(root).find(n => n.type === 'Text' && n.props.children === label)?.props.style).color;
const ionColor = (root, name) => nodes(root).find(n => n.type === 'Icon' && n.props.name === name)?.props.color;
const styleAt = (button, pressed = false) => flat(button.props.style({ pressed }));
const overlay = button => nodes(button).find(n => n.props.pointerEvents === 'none' && flat(n.props.style).borderWidth === 2);
const email = 'fixture@example.invalid';
const accountCloud = 'Disconnect Orion Cloud';
const paths = {
  ContinueWatchingCard: 'features/library/ContinueWatchingCard.tsx',
  SidebarDrawer: 'components/SidebarDrawer.tsx',
  AccountSettingsContent: 'features/settings/AccountSettingsContent.tsx',
};
function render(component, context, input, options = {}) {
  const h = hookHarness();
  const absolute = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
  const storageWrites = [];
  const storage = { mmkvStorageAdapter: { set: (...args) => storageWrites.push(args) } };
  const theme = { useOrionTheme: () => context };
  const profile = { email, accountId: 'fixture-google', displayName: 'Orion' };
  const account = { useOrionAccount: () => ({ state: { phase: 'signed-in', profile },
    googleConfigured: true, nativeGoogleAvailable: true, signOut: options.signOut || noop }) };
  const mocks = {
    react: h.react, 'react/jsx-runtime': { jsx: node, jsxs: node, Fragment: 'Fragment' },
    'react-native': {
      StyleSheet: { create: x => x, absoluteFill: absolute, hairlineWidth: 1 },
      useWindowDimensions: () => ({ fontScale: 1 }), Platform: { OS: 'android' },
      ...Object.fromEntries(['View', 'Text', 'Pressable', 'Image', 'Modal', 'ScrollView', 'ActivityIndicator']
        .map(id => [id, id])),
    },
    'expo-router': { usePathname: () => '/', useRouter: () => ({ push: options.push || noop }) },
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
    '@orion/shared/api': {}, '@orion/shared/types': {},
    '@orion/shared/tokens': { fontFamilies: {}, fontSizes: { sm: 14 }, radii: { md: 10, xl: 16 },
      spacing: { 2: 8, 3: 12, 4: 16 }, text: {}, accent: {} },
    '../context/ThemeContext': theme, '../../context/ThemeContext': theme,
    '../context/AccountContext': account, '../../context/AccountContext': account,
    '../../services/storageAdapter': storage, '../services/storageAdapter': storage,
    '../../services/responsive': { useResponsiveLayout: () => ({ width: 390, shortestEdge: 390 }) },
    './useContinueWatchingArtwork': { useContinueWatchingArtwork: () => null },
    '../context/NetworkContext': { useNetworkStatus: () => ({ productState: 'online', latencyMs: 7 }) },
    './mobileConnectionPresentationPolicy': { getMobileConnectionPresentation: () => ({ tone: 'success' }) },
    '../features/glimpse/glimpsePreview': { isGlimpsePreviewEnabled: () => false },
    '../../components/OrionDialog': { OrionDialog: 'Dialog' },
    '../account/nativeGoogleDriveAuthorization': {
      isNativeGoogleDriveAuthorizationAvailable: () => true,
      checkGoogleDriveAppDataAuthorization: async () => ({ authorized: true }),
      revokeGoogleDriveAppData: options.revoke || noop,
    },
    '../account/googleDriveCloudProfileStore': {},
    './MyListEnrollmentPreflight': { MyListEnrollmentPreflight: 'MyListEnrollmentPreflight' },
    './WatchedSyncControl': { WatchedSyncControl: 'WatchedSyncControl' },
    './ViewingActivitySyncControl': { ViewingActivitySyncControl: 'ViewingActivitySyncControl' },
  };
  h.start(loader(mocks)(source + paths[component])[component], input);
  return Object.assign(h, { storageWrites });
}
function card(context, callbacks = {}) {
  return render('ContinueWatchingCard', context, {
    entry: { progress: { mediaIdentity: { title: 'Fixture', mediaType: 'movie' }, presentation: {},
      currentTime: 7, duration: 100, percent: 7 } },
    onResume: callbacks.resume || noop, onRemove: noop, onMarkWatched: noop, onOpenDetails: callbacks.open,
  });
}
function drawer(context, options = {}) {
  return render('SidebarDrawer', context, { visible: true, persistent: true, onClose: options.close || noop }, options);
}
function fade(color, backdrop, opacity) {
  if (opacity === 1) return color;
  const rgb = /^#(..)(..)(..)$/.exec(color).slice(1).map(value => parseInt(value, 16));
  return compositePaletteColor('rgba(' + rgb.join(',') + ',' + opacity + ')', backdrop);
}
function ratio(foreground, background, minimum) {
  const value = paletteContrast(foreground, background);
  assert.ok(value >= minimum, foreground + ' on ' + background + ': ' + value + ' < ' + minimum);
  return value;
}
function measureResume(view, button, pressed) {
  const cardBacking = flat(view.result.props.style).backgroundColor;
  const { backgroundColor, opacity = 1 } = styleAt(button, pressed);
  const background = fade(backgroundColor, cardBacking, opacity);
  const contrast = (color, minimum) => ratio(fade(color, cardBacking, opacity), background, minimum);
  const label = contrast(textColor(button, 'Resume'), 4.5);
  contrast(ionColor(button, 'play'), 3);
  if (overlay(button)) contrast(flat(overlay(button).props.style).borderColor, 3);
  return label;
}
function evidence(t, pair, before, after) {
  assert.ok(before < 4.5);
  t.diagnostic('PRESSED_CONTRAST ' + JSON.stringify({ pair, before, after, target: 4.5 }));
}

test('Resume preserves its accent pair and usable icon during press and focus in both adaptive profiles', async t => {
  let safeFade = 0;
  let opaquePress = 0;
  for (const context of adaptiveCases) {
    const interactions = [];
    const h = card(context, { resume: () => interactions.push('resume'), open: () => interactions.push('details') });
    const button = () => named(h.result, 'Resume Fixture');
    const pressed = styleAt(button(), true);
    const { theme } = context;
    const before = paletteContrast(fade(theme.onAccent, theme.elevated, 0.72), fade(theme.accent, theme.elevated, 0.72));
    assert.equal(pressed.opacity ?? 1, before >= 4.5 ? 0.72 : 1);
    if (pressed.opacity === 0.72) safeFade++;
    else opaquePress++;
    assert.deepEqual(JSON.parse(JSON.stringify(pressed.transform)), [{ scale: 0.985 }]);
    measureResume(h, button(), false);
    const after = measureResume(h, button(), true);
    if (context === resumeRegression) evidence(t, 'Continue Watching Resume', before, after);
    button().props.onFocus();
    await h.settle();
    assert.ok(overlay(button()));
    measureResume(h, button(), false);
    measureResume(h, button(), true);
    button().props.onBlur();
    await h.settle();
    assert.equal(overlay(button()), undefined);
    button().props.onPress();
    named(h.result, 'Open Fixture').props.onPress();
    assert.deepEqual(interactions, ['resume', 'details']);
    assert.deepEqual(h.storageWrites, []);
    h.dispose();
  }
  assert.ok(safeFade > 0 && opaquePress > 0, 'exercise both existing fade and opaque scale');
});

test('Drawer selected and inactive labels use a readable press and focus surface and preserve navigation', async t => {
  for (const context of adaptiveCases) {
    const actions = [];
    const h = drawer(context, { close: () => actions.push('close'), push: route => actions.push(route) });
    const { theme } = context;
    for (const [label, active, icon] of [['Home', true, 'home'], ['Library', false, 'library-outline']]) {
      const button = () => named(h.result, label);
      const color = () => textColor(button(), label);
      const base = styleAt(button());
      assert.equal(button().props.accessibilityState.selected, active);
      assert.equal(button().props.disabled, undefined);
      for (const backdrop of [theme.background, theme.elevated]) {
        const baseColor = base.backgroundColor === 'transparent' ? backdrop : base.backgroundColor;
        ratio(color(), compositePaletteColor(baseColor, backdrop), 4.5);
      }
      const pressed = styleAt(button(), true);
      assert.equal(pressed.backgroundColor, theme.surfaceHover);
      const after = ratio(color(), pressed.backgroundColor, 4.5);
      const iconBacking = active ? theme.accent : pressed.backgroundColor;
      ratio(ionColor(button(), icon), iconBacking, 3);
      ratio(compositePaletteColor(pressed.borderColor, pressed.backgroundColor), pressed.backgroundColor, 3);
      if (context === nearThreshold && !active) evidence(t, 'Inactive drawer label',
        paletteContrast(color(), compositePaletteColor('rgba(255,255,255,0.06)', theme.background)), after);
      button().props.onFocus();
      await h.settle();
      for (const isPressed of [false, true]) {
        const focused = styleAt(button(), isPressed);
        assert.equal(focused.borderStyle, 'dashed');
        ratio(focused.borderColor, focused.backgroundColor, 3);
        ratio(color(), focused.backgroundColor, 4.5);
        assert.equal(button().props.accessibilityState.selected, active);
      }
      button().props.onBlur();
      await h.settle();
      assert.equal(styleAt(button()).borderStyle, undefined);
    }
    named(h.result, 'Library').props.onPress();
    assert.deepEqual(actions, ['close', '/library']);
    assert.deepEqual(h.storageWrites, []);
    h.dispose();
  }
});

test('Cloud Disconnect stays readable during press, focus and revocation with the same confirmation', async t => {
  for (const context of adaptiveCases) {
    const { theme } = context;
    const calls = [];
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    const h = render('AccountSettingsContent', context, {}, { revoke: value => { calls.push(value); return pending; } });
    await h.settle();
    const button = () => named(h.result, accountCloud);
    assert.equal(button().props.accessibilityRole, 'button');
    assert.equal(button().props.accessibilityState.disabled, false);
    const contextBefore = JSON.stringify(context.advancedAppearanceChoices);
    function measure(pressed) {
      const { opacity = 1, backgroundColor = theme.background } = styleAt(button(), pressed);
      assert.equal(opacity, 1);
      const value = ratio(textColor(button(), accountCloud), backgroundColor, 4.5);
      ratio(textColor(button(), 'Keep your library on this device.'), backgroundColor, 4.5);
      ratio(ionColor(button(), 'cloud-offline-outline'), backgroundColor, 3);
      ratio(ionColor(button(), 'chevron-forward'), backgroundColor, 3);
      if (overlay(button())) ratio(flat(overlay(button()).props.style).borderColor, backgroundColor, 3);
      return value;
    }
    measure(false);
    const after = measure(true);
    if (context === nearThreshold) evidence(t, 'Cloud Disconnect',
      paletteContrast(fade(theme.danger, theme.background, 0.74), theme.background), after);
    button().props.onFocus();
    await h.settle();
    assert.ok(overlay(button()));
    measure(false);
    measure(true);
    button().props.onBlur();
    await h.settle();
    assert.equal(overlay(button()), undefined);
    const dialog = () => nodes(h.result).find(n => n.type === 'Dialog');
    assert.equal(dialog().props.visible, false);
    button().props.onPress();
    await h.settle();
    assert.equal(dialog().props.visible, true);
    assert.equal(dialog().props.title, 'Disconnect Orion Cloud?');
    assert.deepEqual(calls, []);
    dialog().props.actions.find(action => action.role === 'cancel').onPress();
    await h.settle();
    assert.equal(dialog().props.visible, false);
    assert.deepEqual(calls, []);
    button().props.onPress();
    await h.settle();
    dialog().props.actions.find(action => action.role === 'destructive').onPress();
    await h.settle();
    assert.deepEqual(calls, [email]);
    assert.equal(button().props.disabled, true);
    assert.equal(button().props.accessibilityState.disabled, true);
    assert.equal(button().props.onFocus, undefined);
    assert.equal(styleAt(button(), true).transform, undefined);
    assert.equal(overlay(button()), undefined);
    ratio(textColor(button(), 'Disconnecting Orion Cloud...'), theme.background, 4.5);
    finish();
    await h.settle();
    assert.equal(button(), undefined);
    assert.equal(JSON.stringify(context.advancedAppearanceChoices), contextBefore);
    assert.deepEqual(h.storageWrites, []);
    h.dispose();
  }
});

test('Historical themes and the legacy custom accent keep their original rendered pressed styles', async () => {
  for (const context of legacyCases) {
    const h = card(context);
    const resume = named(h.result, 'Resume Fixture');
    assert.equal(styleAt(resume, true).opacity, 0.72);
    assert.equal(styleAt(resume, true).backgroundColor, context.theme.accent);
    assert.equal(textColor(resume, 'Resume'), context.theme.onAccent);
    assert.equal(resume.props.onFocus, undefined);
    h.dispose();
    const nav = drawer(context);
    const library = named(nav.result, 'Library');
    assert.equal(styleAt(library, true).backgroundColor, 'rgba(255, 255, 255, 0.06)');
    assert.equal(styleAt(library, true).borderColor, 'rgba(255, 255, 255, 0.08)');
    assert.equal(textColor(library, 'Library'), context.theme.textSecondary);
    assert.equal(library.props.onFocus, undefined);
    nav.dispose();
    const account = render('AccountSettingsContent', context, {});
    await account.settle();
    const disconnect = named(account.result, accountCloud);
    assert.equal(styleAt(disconnect, true).opacity, 0.74);
    assert.equal(styleAt(disconnect, true).backgroundColor, undefined);
    assert.equal(textColor(disconnect, accountCloud), context.theme.danger);
    assert.equal(disconnect.props.onFocus, undefined);
    account.dispose();
  }
});
