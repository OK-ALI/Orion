const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { JSDOM } = require('jsdom');
const { transformSync } = require('esbuild');
const babel = require('@babel/core');
const app = path.resolve(__dirname, '../..');

function load(filename, mocks, flow = false, source) {
  const previous = Module._load;
  Module._load = function(name, parent, main) {
    const key = Object.keys(mocks).find(k => name === k || name.endsWith(k));
    return key ? mocks[key] : previous.call(this, name, parent, main);
  };
  try {
    const text = source ?? fs.readFileSync(filename, 'utf8');
    const code = flow
      ? babel.transformSync(text, { filename, babelrc: false, configFile: false, presets: [require.resolve('@react-native/babel-preset')] }).code
      : transformSync(text, { loader: 'tsx', format: 'cjs', jsx: 'automatic' }).code;
    const mod = new Module(filename); mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename)); mod._compile(code, filename);
    return mod.exports;
  } finally { Module._load = previous; }
}

function fixture({ source, reduced = false, width = 390, fontScale = 1 } = {}) {
  const bindings = [], timings = [], values = [], expressions = [], routes = [], pans = [];
  let pathname = '/', propsCreated = 0, reducedValue = reduced, viewport = { width, height: 844, fontScale };
  class Node {}
  class Value extends Node {
    constructor(n) { super(); this.n = n; values.push(this); }
    setValue(n) { this.n = n; }
    read() { return this.n; }
    stopAnimation(cb) { cb?.(this.n); }
    interpolate({ inputRange, outputRange }) {
      const root = this;
      const expression = new Expression(() => {
        const p = root.read(); let i = 0;
        while (i < inputRange.length - 2 && p > inputRange[i + 1]) i++;
        const t = (p - inputRange[i]) / (inputRange[i + 1] - inputRange[i]);
        return outputRange[i] + t * (outputRange[i + 1] - outputRange[i]);
      });
      expression.parentValue = root; expressions.push(expression); return expression;
    }
  }
  class Expression extends Node { constructor(fn) { super(); this.fn = fn; } read() { return this.fn(); } }
  const flatten = s => Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean).map(flatten)) : s || {};
  const memoFile = path.join(path.dirname(require.resolve('react-native/package.json')), 'src/private/animated/createAnimatedPropsMemoHook.js');
  const { createAnimatedPropsMemoHook } = load(memoFile, {
    '/AnimatedNode': Node, '/AnimatedEvent': { AnimatedEvent: class {} },
    '/AnimatedObject': { isPlainObject: x => x != null && typeof x === 'object' && [null, Object.prototype].includes(Object.getPrototypeOf(x)) },
    '/flattenStyle': flatten,
  }, true);
  // Execute the installed RN memo hook against mounted component props. Native
  // nodes/bridge are doubles; factory counts are memo decisions, not phone data.
  const usePropsMemo = createAnimatedPropsMemoHook(null);
  const View = props => {
    React.useEffect(() => { props.onLayout?.({ nativeEvent: { layout: { width: viewport.width, height: 48 } } }); }, [props.onLayout]);
    return React.createElement('div', { 'aria-label': props.accessibilityLabel, role: props.accessibilityRole }, props.children);
  };
  const AnimatedView = props => {
    usePropsMemo(() => { propsCreated++; return {}; }, props);
    bindings.push({ style: flatten(props.style), props });
    return React.createElement(View, props);
  };
  const animation = (value, config) => ({ start() { timings.push({ value, config }); }, stop() {} });
  const rn = {
    View, StyleSheet: { create: x => x, hairlineWidth: 1 }, useWindowDimensions: () => viewport,
    PanResponder: { create: handlers => { pans.push(handlers); return { panHandlers: {} }; } },
    Animated: { Value, View: AnimatedView, timing: animation, spring: animation },
  };
  const router = { navigate: p => routes.push(p) };
  const tokens = load(path.join(app, 'src/theme/tokens.ts'), {});
  const nav = load(path.join(app, 'src/components/shell/WavenBottomNav.tsx'), {
    'react-native': rn,
    'expo-router': { usePathname: () => pathname, useRouter: () => router },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '/WavenText': { WavenText: View },
    '/WavenPressable': { WavenPressable: ({ children, onPress, accessibilityLabel, accessibilityState }) => React.createElement('button', { 'aria-label': accessibilityLabel, 'aria-selected': accessibilityState.selected, onClick: onPress }, children) },
    '/useWavenReducedMotion': { useWavenReducedMotion: () => reducedValue },
    '/theme/tokens': tokens,
  }, false, source).WavenBottomNav;
  return { nav, bindings, timings, values, expressions, routes, pans, memoFile,
    get propsCreated() { return propsCreated; },
    route: p => { pathname = p; }, reduced: p => { reducedValue = p; }, viewport: patch => { viewport = { ...viewport, ...patch }; },
    read: v => v instanceof Node ? v.read() : v,
  };
}

async function mount(t, Component) {
  const dom = new JSDOM('<div id="root"></div>'), old = { window: global.window, document: global.document, act: global.IS_REACT_ACT_ENVIRONMENT };
  global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
  const root = require('react-dom/client').createRoot(document.getElementById('root')); let commits = 0;
  const render = () => React.act(async () => { root.render(React.createElement(React.Profiler, { id: 'nav', onRender: () => commits++ }, React.createElement(Component))); await new Promise(r => setImmediate(r)); });
  await render();
  t.after(async () => { await React.act(async () => root.unmount()); dom.window.close(); global.window = old.window; global.document = old.document; global.IS_REACT_ACT_ENVIRONMENT = old.act; });
  return { render, container: document.getElementById('root'), get commits() { return commits; } };
}
module.exports = { fixture, mount, React };
