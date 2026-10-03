const test = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const { jsx } = require('./helpers/sourceContinuityHarness.cjs');
const { nodes } = require('./helpers/postPhysicalPlaybackHarness.cjs');
const layout = loader()('apps/mobile/src/components/player/playerDrawerLayout.ts');
const zero = { top: 0, right: 0, bottom: 0, left: 0 };
const theme = { text: '#eee', textSecondary: '#aaa', elevated: '#222', border: '#333', surface: '#111', accentSoft: '#555', warning: '#da3', danger: '#f44', success: '#4f4' };
function drawerFixture(input = {}) {
  const h = hookHarness(), calls = [];
  let dimensions = { width: 780, height: 360 }, props = { controlsVisible: false, onPress: open => calls.push(open), children: null, ...input };
  const controller = { state: { overlay: 'none', activeSessionId: 'episode-1' } };
  class Value { stopAnimation() {} interpolate(value) { return value; } }
  const load = loader({ react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Animated: { Value, View: 'AnimatedView', timing: () => ({ start: fn => fn({ finished: true }), stop() {} }) },
      AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }) },
      View: 'View', ScrollView: 'ScrollView', StyleSheet: { create: value => value, absoluteFill: {} }, useWindowDimensions: () => dimensions },
    'react-native-safe-area-context': { useSafeAreaInsets: () => zero },
    '../../context/ThemeContext': { useOrionTheme: () => ({ theme }) },
    '../../features/playback/MobilePlayerController': { useMobilePlayerController: () => controller }, './PlayerChromeHandle': { PlayerChromeHandle: 'Grip' } });
  h.start(load('apps/mobile/src/components/player/PlayerEdgeDrawer.tsx').PlayerEdgeDrawer, props);
  return { h, calls, controller, get grip() { return nodes(h.result, 'Grip')[0]?.props; },
    get bodies() { return nodes(h.result, 'AnimatedView').filter(value => value.props.accessibilityElementsHidden !== undefined); },
    update(next = {}) { props = { ...props, ...next }; h.update(props); },
    rotate(value) { dimensions = value; h.update(props); } };
}
test('generic HUD reveals, provider taps, seeks and recovery never open drawer; only grip opens/closes', async () => {
  const f = drawerFixture();
  try {
    for (const controlsVisible of [true, false, true, true]) {
      f.update({ controlsVisible }); await f.h.settle();
      assert.equal(f.grip.controlsVisible, false); assert.equal(f.bodies.length, 0);
    }
    f.grip.onPress(); await f.h.settle(); assert.deepEqual(f.calls, [true]); assert.equal(f.grip.controlsVisible, true);
    assert.equal(f.bodies.length, 1); assert.equal(f.bodies[0].props.pointerEvents, 'auto');
    f.update({ controlsVisible: false }); await f.h.settle(); assert.equal(f.bodies.length, 0);
    f.update({ controlsVisible: true }); await f.h.settle(); assert.equal(f.grip.controlsVisible, false);
    f.grip.onPress(); await f.h.settle(); f.grip.onPress(); await f.h.settle();
    assert.deepEqual(f.calls, [true, true, false]); assert.equal(f.bodies.length, 0);
  } finally { f.h.dispose(); }
});
test('sheets and episode ownership close the drawer; rotation keeps bounded connected grip and body', async () => {
  const f = drawerFixture({ controlsVisible: true });
  try {
    f.grip.onPress(); await f.h.settle(); f.rotate({ width: 360, height: 780 });
    const body = f.bodies[0].props.style[1]; assert.ok(body.width <= 248); assert.ok(body.left + body.width <= 360);
    f.controller.state.overlay = 'subtitles'; f.update(); await f.h.settle(); assert.equal(f.h.result, null);
    f.controller.state.overlay = 'none'; f.update(); await f.h.settle(); assert.equal(f.grip.controlsVisible, false);
    f.grip.onPress(); await f.h.settle(); f.controller.state.activeSessionId = 'episode-2'; f.update(); await f.h.settle();
    assert.equal(f.grip.controlsVisible, false); assert.equal(f.bodies.length, 0);
  } finally { f.h.dispose(); }
});
for (const [width, height, insets] of [[240, 320, zero], [780, 360, zero], [2400, 1080, zero], [780, 360, { ...zero, right: 64, left: 8 }]]) {
  test(`content-driven compact width and safe open/closed hit regions at ${width}x${height}`, () => {
    const short = layout.resolvePlayerDrawerLayout(width, height, insets, [], 100);
    const content = layout.resolvePlayerDrawerLayout(width, height, insets, [], 210);
    const long = layout.resolvePlayerDrawerLayout(width, height, insets, [], 10000);
    assert.ok(short.body.width <= content.body.width); assert.ok(content.body.width <= long.body.width);
    assert.ok(long.body.width <= 248); assert.equal(short.body.width, 160);
    for (const result of [short, content, long]) {
      const openHit = { ...result.hit, x: result.hit.x + (result.edge === 'right' ? -result.body.width : result.body.width) };
      assert.equal(result.hit.width, 44); assert.equal(result.hit.height, 44);
      for (const rect of [result.hit, openHit, result.body]) {
        assert.ok(rect.x >= insets.left); assert.ok(rect.x + rect.width <= width - insets.right);
        assert.ok(rect.y >= insets.top); assert.ok(rect.y + rect.height <= height - insets.bottom);
      }
    }
  });
}
test('collision tests reserve body plus both grip positions and fail closed when neither edge is safe', () => {
  const base = layout.resolvePlayerDrawerLayout(780, 360, zero, [], 180);
  const openGrip = { x: base.hit.x - base.body.width, y: 0, width: 44, height: 360 };
  const safe = layout.resolvePlayerDrawerLayout(780, 360, zero, [openGrip], 180);
  assert.equal(safe.edge, 'left'); assert.equal(safe.available, true);
  assert.equal(layout.intersects(safe.body, openGrip), false);
  assert.equal(layout.resolvePlayerDrawerLayout(780, 360, zero, [{ x: 0, y: 0, width: 780, height: 360 }], 180).available, false);
});
test('embedded drawer measures visible labels and counter, retaining theme and accessible action wording', async () => {
  const h = hookHarness(), calls = [];
  const Hud = loader({ react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: value => value } },
    '@expo/vector-icons': { Ionicons: 'Ionicons' }, '../../context/ThemeContext': { useOrionTheme: () => ({ theme }) },
    '../../components/player/PlayerEdgeDrawer': { PlayerEdgeDrawer: 'Drawer' },
    '../../components/player/PresentationSheet': { presentationModeLabel: () => 'Fit' },
  })('apps/mobile/src/features/playback/EmbeddedPlayerHud.tsx').EmbeddedPlayerHud;
  try {
    const props = { visible: true, title: 'Long title', sourceLabel: 'VidLink', presentation: 'fit', shieldState: 'limited', blockedRequests: 0,
      onReveal: () => calls.push('reveal'), onCollapse: () => calls.push('dismiss') };
    h.start(Hud, props);
    const label = nodes(h.result, 'Text').find(value => value.props.children === 'Use provider controls');
    label.props.onTextLayout({ nativeEvent: { lines: [{ width: 120 }, { width: 20 }] } }); await h.settle();
    const drawer = nodes(h.result, 'Drawer')[0].props; assert.equal(drawer.contentWidth, 226);
    drawer.onPress(true); drawer.onPress(false); assert.deepEqual(calls, ['reveal', 'dismiss']);
    assert.ok(nodes(h.result, 'Pressable').some(value => value.props.accessibilityLabel === 'Resize picture. Current mode Fit.'));
    nodes(h.result, 'Text').find(value => value.props.children === 'Protection limited').props.onTextLayout({ nativeEvent: { lines: [{ width: 300 }] } });
    await h.settle(); assert.equal(nodes(h.result, 'Drawer')[0].props.contentWidth, 382);
    h.update({ ...props, shieldState: 'verified' }); await h.settle();
    assert.equal(nodes(h.result, 'Drawer')[0].props.contentWidth, 226, 'obsolete protection labels cannot keep the healthy drawer wide');
  } finally { h.dispose(); }
});

test('actual native single/double taps seek normally while shared drawer stays closed until grip', async () => {
  const h = hookHarness(), gestures = [], seeks = []; let visible = false;
  const f = drawerFixture(); const player = { status: 'readyToPlay', playing: true, duration: 3000, currentTime: 120, seekBy: value => seeks.push(value) };
  const builder = () => { const value = { count: 1, onEnd(fn) { this.end = fn; return this; }, numberOfTaps(n) { this.count = n; return this; }, onStart() { return this; }, onUpdate() { return this; } }; gestures.push(value); return value; };
  const Hud = loader({ react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Platform: { OS: 'web' }, View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: value => value, absoluteFill: {} }, useWindowDimensions: () => ({ width: 780, height: 360 }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' }, expo: { useEvent: (_player, _name, initial) => initial }, 'expo-blur': { BlurView: 'BlurView' },
    'react-native-gesture-handler': { Gesture: { Tap: builder, Pan: builder, Exclusive: (...values) => values }, GestureDetector: 'GestureDetector' },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, useSharedValue: value => ({ value }), useAnimatedStyle: fn => fn(), withTiming: value => value, runOnJS: fn => fn },
    'expo-brightness': {}, 'react-native-volume-manager': { VolumeManager: {} }, '../../context/ThemeContext': { useOrionTheme: () => ({ theme }) },
    './PlayerEdgeDrawer': { PlayerEdgeDrawer: 'Drawer' },
  })('apps/mobile/src/components/player/PlayerHUD.tsx').PlayerHUD;
  const props = () => ({ player, title: 'Title', controlsVisible: visible, onBack() {}, onOpenSources() {}, onOpenSubtitles() {}, onOpenPresentation() {},
    onReveal: () => { visible = true; }, onDismiss: () => { visible = false; }, onToggle: () => { visible = !visible; } });
  const sync = async () => { h.update(props()); f.update(nodes(h.result, 'Drawer')[0].props); await f.h.settle(); };
  try {
    h.start(Hud, props()); const [single, left, right] = gestures;
    single.end(); await sync(); assert.equal(f.grip.controlsVisible, false);
    for (let i = 0; i < 3; i++) { right.end(); left.end(); await sync(); assert.equal(f.grip.controlsVisible, false); }
    assert.deepEqual(seeks, [10, -10, 10, -10, 10, -10]);
    f.grip.onPress(); await sync(); assert.equal(f.grip.controlsVisible, true);
    nodes(h.result, 'Text').find(value => value.props.children === 'Subtitles').props.onTextLayout({ nativeEvent: { lines: [{ width: 180 }] } });
    await h.settle(); await sync();
    assert.equal(nodes(h.result, 'Drawer')[0].props.contentWidth, 254);
    assert.equal(f.bodies[0].props.style[1].width, 248, 'native large-font label measurement obeys the shared cap');
  } finally { h.dispose(); f.h.dispose(); }
});
