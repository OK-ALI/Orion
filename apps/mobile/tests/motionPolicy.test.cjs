const test = require('node:test');
const assert = require('node:assert/strict');
const { loader, read } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const { nodes } = require('./helpers/postPhysicalPlaybackHarness.cjs');
const { resolveMotionPolicy } = loader()('apps/mobile/src/services/motionPolicy.ts');
for (const orion of [false, true]) for (const android of [false, true]) {
  test(`effective motion uses independent OR inputs: Orion=${orion}, Android=${android}`, () => {
    const policy = resolveMotionPolicy(orion, android), reduced = orion || android;
    assert.equal(policy.reduceMotion, reduced); assert.equal(policy.allowSpatialMotion, !reduced);
    assert.equal(policy.allowDecorativeMotion, !reduced); assert.equal(policy.duration(180), reduced ? 0 : 180);
    assert.equal(policy.duration(120), reduced ? 0 : 120); assert.equal(policy.screenAnimation, reduced ? 'none' : undefined);
  });
}
test('unresolved platform query suppresses decorative movement without changing stored preference', () => {
  assert.equal(resolveMotionPolicy(false, null).reduceMotion, true);
  assert.equal(resolveMotionPolicy(false, false).reduceMotion, false);
  const theme = read('apps/mobile/src/context/ThemeContext.tsx');
  assert.match(theme, /reducedMotion: false/); assert.match(theme, /persist\(\{ \.\.\.preferences, reducedMotion \}\)/);
  assert.match(theme, /systemReducedMotion = useSystemReducedMotion\(\)/);
  assert.doesNotMatch(theme, /persist\([^\n]*systemReducedMotion/);
});
test('Android motion changes are live; delayed query cannot overwrite newer event, foreground refresh and cleanup are bounded', async () => {
  const h = hookHarness(), queries = [], callbacks = {}, removed = [];
  const hook = loader({ react: h.react, 'react-native': {
    AccessibilityInfo: { isReduceMotionEnabled: () => new Promise(resolve => queries.push(resolve)),
      addEventListener: (event, fn) => { callbacks[event] = fn; return { remove: () => removed.push(event) }; } },
    AppState: { addEventListener: (event, fn) => { callbacks[event] = fn; return { remove: () => removed.push(event) }; } },
  } })('apps/mobile/src/hooks/useSystemReducedMotion.ts').useSystemReducedMotion;
  h.start(hook, {}); assert.equal(h.result, null);
  callbacks.reduceMotionChanged(true); queries.shift()(false); await h.settle(); assert.equal(h.result, true);
  callbacks.reduceMotionChanged(false); await h.settle(); assert.equal(h.result, false);
  callbacks.change('background'); assert.equal(queries.length, 0);
  callbacks.change('active'); assert.equal(queries.length, 1); queries.shift()(true); await h.settle(); assert.equal(h.result, true);
  callbacks.change('active'); h.dispose(); queries.shift()(false); await h.settle(); assert.equal(h.result, true);
  assert.deepEqual(removed.sort(), ['change', 'reduceMotionChanged']);
});
test('platform query rejection falls back safely without preventing startup', async () => {
  const h = hookHarness();
  const hook = loader({ react: h.react, 'react-native': {
    AccessibilityInfo: { isReduceMotionEnabled: () => Promise.reject(new Error('unavailable')), addEventListener: () => ({ remove() {} }) },
    AppState: { addEventListener: () => ({ remove() {} }) },
  } })('apps/mobile/src/hooks/useSystemReducedMotion.ts').useSystemReducedMotion;
  h.start(hook, {}); await h.settle(); assert.equal(h.result, false); h.dispose();
});
test('search presentation cancels replaced/unmounted motion and live reduction makes geometry stable without navigation ownership', async () => {
  const h = hookHarness(), animations = [], values = [];
  const value = { setValue: next => values.push(next), interpolate: next => next };
  const hook = loader({ react: h.react, 'react-native': { Animated: { timing: (_value, config) => {
    const animation = { config, starts: 0, stops: 0, start() { this.starts++; }, stop() { this.stops++; } };
    animations.push(animation); return animation;
  } } } })('apps/mobile/src/features/discover/useSearchArrivalAnimation.ts').useSearchArrivalAnimation;
  h.start(({ reduced }) => hook(value, reduced), { reduced: false });
  h.result.animate(); h.result.animate(); assert.equal(animations.length, 2); assert.equal(animations[0].stops, 1);
  assert.equal(animations[1].config.duration, 190); assert.equal(animations[1].config.useNativeDriver, true);
  h.update({ reduced: true }); await h.settle(); assert.ok(animations[1].stops > 0);
  assert.deepEqual(h.result.style, { opacity: 1, transform: [{ scale: 1 }] }); h.result.animate(); assert.equal(animations.length, 2);
  assert.equal(values.at(-1), 1); h.dispose();
  assert.doesNotMatch(read('apps/mobile/src/features/discover/useSearchArrivalAnimation.ts'), /router|sourceId|handoff|download|setInterval/);
});
test('drawer live OR preference changes preserve grip ownership, session, controls and callback count', async () => {
  const h = hookHarness(), calls = [], durations = [];
  let orion = false, system = false;
  const controller = { state: { overlay: 'none', activeSessionId: 'same-player' } };
  const jsx = (type, props) => ({ type, props });
  class Value { stopAnimation() {} interpolate(input) { return input; } }
  const Drawer = loader({ react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Animated: { Value, View: 'AnimatedView', timing: (_value, config) => {
      durations.push(config.duration); return { start: fn => fn({ finished: true }), stop() {} };
    } }, View: 'View', ScrollView: 'ScrollView', StyleSheet: { create: x => x, absoluteFill: {} },
      useWindowDimensions: () => ({ width: 780, height: 360 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }) },
    '../../context/ThemeContext': { useOrionTheme: () => ({ theme: {}, preferences: { reducedMotion: orion }, systemReducedMotion: system }) },
    '../../features/playback/MobilePlayerController': { useMobilePlayerController: () => controller },
    './PlayerChromeHandle': { PlayerChromeHandle: 'Grip' },
  })('apps/mobile/src/components/player/PlayerEdgeDrawer.tsx').PlayerEdgeDrawer;
  const props = { controlsVisible: true, onPress: open => calls.push(open) }; h.start(Drawer, props);
  nodes(h.result, 'Grip')[0].props.onPress(); await h.settle(); assert.deepEqual(calls, [true]); assert.equal(durations.at(-1), 180);
  for (const [nextOrion, nextSystem] of [[true, false], [false, true], [true, true], [false, false]]) {
    orion = nextOrion; system = nextSystem; h.update(props); await h.settle();
    assert.equal(nodes(h.result, 'Grip')[0].props.controlsVisible, true);
    assert.equal(durations.at(-1), orion || system ? 0 : 180); assert.deepEqual(calls, [true]);
    assert.equal(controller.state.activeSessionId, 'same-player'); assert.equal(controller.state.overlay, 'none');
  }
  h.dispose();
});
test('reduced loading communicates real state with static geometry/text and keeps retry/back actions', () => {
  const jsx = (type, props) => ({ type, props }); let reduced = true;
  const load = loader({ 'react/jsx-runtime': { jsx, jsxs: jsx }, '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native': { ActivityIndicator: 'Spinner', Pressable: 'Button', Text: 'Text', View: 'View', StyleSheet: { create: x => x } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24 }) },
    '../../context/ThemeContext': { useOrionTheme: () => ({ theme: {}, preferences: { reducedMotion: reduced }, systemReducedMotion: false }) },
  });
  const Overlay = load('apps/mobile/src/components/player/PlayerStateOverlay.tsx').PlayerStateOverlay;
  const retry = () => {}, back = () => {};
  assert.equal(nodes(Overlay({ state: 'preparing' }), 'Spinner').length, 0);
  const failed = Overlay({ state: 'failed', onRetry: retry, onBack: back });
  assert.ok(nodes(failed, 'Button').some(node => node.props.onPress === retry)); assert.ok(nodes(failed, 'Button').some(node => node.props.onPress === back));
  reduced = false; assert.equal(nodes(Overlay({ state: 'preparing' }), 'Spinner').length, 1);
  const loading = load('apps/mobile/src/features/media-detail/MediaDetailLoading.tsx');
  const detail = loading.MediaDetailLoading({ onBack: back }); assert.ok(nodes(detail, 'Button').some(node => node.props.onPress === back));
  assert.equal(detail.props.accessibilityState.busy, true); assert.equal(loading.EpisodeListLoading().props.accessibilityState.busy, true);
  assert.doesNotMatch(read('apps/mobile/src/features/media-detail/MediaDetailLoading.tsx'), /setInterval|Animated|router|sourceId|progress|fetch\(/);
});
