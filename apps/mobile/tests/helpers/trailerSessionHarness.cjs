const vm = require('node:vm');
const { loader } = require('./animeModules.cjs');
const { hookHarness } = require('./playerHookHarness.cjs');
const { clock, nodes } = require('./postPhysicalPlaybackHarness.cjs');
const jsx = (type, props, key) => ({ type, props: { ...props, ...(key == null ? {} : { key }) } });
function wrapper(html, receive) {
  let options; const scripts = [];
  const context = vm.createContext({ setTimeout, window: { ReactNativeWebView: { postMessage: receive } },
    document: { createElement: () => ({}), head: { appendChild: value => scripts.push(value) } },
    YT: { Player: function (_id, value) { options = value; } },
    Vimeo: { Player: function (_id, value) { options = value; this.ready = () => Promise.resolve(); this.on = () => {}; } } });
  for (const [, script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) vm.runInContext(script, context);
  context.window.onYouTubeIframeAPIReady?.();
  return { get options() { return options; }, scripts, post: (type, detail) => context.post(type, detail) };
}
function trailerFixture(candidates, overrides = {}) {
  const h = hookHarness(), opened = [], diagnostics = [];
  let theme = { theme: new Proxy({}, { get: (_, key) => String(key) }), preferences: { reducedMotion: false }, systemReducedMotion: false };
  let dimensions = { width: 420, height: 840 };
  let props = { visible: true, title: 'Trailer fixture', candidates, onClose() {}, ...overrides };
  const load = loader({ react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Modal: 'Modal', View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator',
      Platform: { OS: 'android' }, useWindowDimensions: () => dimensions, StyleSheet: { create: x => x, absoluteFill: { position: 'absolute' } },
      Linking: { canOpenURL: async () => false, openURL: async url => { opened.push(url); } } },
    'react-native-webview': { WebView: 'WebView' }, '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 20, bottom: 20 }) },
    '../context/ThemeContext': { useOrionTheme: () => theme },
    '../services/mobileDiagnostics': { clearMobileDiagnosticError() {}, reportMobileDiagnosticError: value => diagnostics.push(value) } });
  h.start(load('apps/mobile/src/components/TrailerModal.tsx').TrailerModal, props);
  const view = () => nodes(h.result, 'WebView')[0]?.props;
  const message = raw => view()?.onMessage({ nativeEvent: { data: raw } });
  return { h, opened, diagnostics, view, nodes: name => nodes(h.result, name),
    bridge() { return wrapper(view().source.html, message); },
    async emit(type, detail) { const b = this.bridge(); b.post(type, detail); await h.settle(); },
    async update(next) { props = { ...props, ...next }; h.update(props); await h.settle(); },
    async policy(orion, system) { theme = { ...theme, preferences: { reducedMotion: orion }, systemReducedMotion: system }; h.update(props); await h.settle(); },
    async orient(width, height) { dimensions = { width, height }; h.update(props); await h.settle(); },
    dispose: () => h.dispose() };
}
module.exports = { clock, nodes, wrapper, trailerFixture };
