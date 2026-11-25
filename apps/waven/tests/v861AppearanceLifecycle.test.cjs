const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');

function fixture({ unavailable = false } = {}) {
  const data = new Map();
  const schemeListeners = new Set();
  const motionListeners = new Set();

  let scheme = 'light';
  let reduced = false;
  let writes = 0;

  const native = {
    Platform: { OS: 'android' },

    useColorScheme() {
      return React.useSyncExternalStore(
        listener => {
          schemeListeners.add(listener);
          return () => schemeListeners.delete(listener);
        },
        () => scheme,
      );
    },

    AccessibilityInfo: {
      isReduceMotionEnabled: async () => reduced,

      addEventListener: (event, listener) => {
        assert.equal(event, 'reduceMotionChanged');
        motionListeners.add(listener);

        return {
          remove: () => motionListeners.delete(listener),
        };
      },
    },
  };

  const mmkv = {
    createMMKV(options) {
      assert.equal(options.id, 'waven.appearance');

      if (unavailable) throw Error('Unavailable storage');

      return {
        getString: key => data.get(key),

        set: (key, value) => {
          writes++;
          data.set(key, value);
        },
      };
    },
  };

  function load() {
    const previousLoad = Module._load;
    const previousTs = require.extensions['.ts'];
    const previousTsx = require.extensions['.tsx'];

    const compile = (module, filename) => {
      const source = fs.readFileSync(filename, 'utf8');

      const result = ts.transpileModule(source, {
        fileName: filename,
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      });

      module._compile(result.outputText, filename);
    };

    require.extensions['.ts'] = compile;
    require.extensions['.tsx'] = compile;

    Module._load = function(request, ...args) {
      if (request === 'react-native') return native;
      if (request === 'react-native-mmkv') return mmkv;
      return previousLoad.call(this, request, ...args);
    };

    try {
      for (const relative of [
        '../src/theme/appearanceProvider.tsx',
        '../src/theme/appearanceRuntime.ts',
        '../src/hooks/useWavenReducedMotion.ts',
      ]) {
        delete require.cache[require.resolve(relative)];
      }

      return {
        ...require('../src/theme/appearanceProvider.tsx'),
        ...require('../src/theme/appearanceRuntime.ts'),
        ...require('../src/theme/appearance.ts'),
      };
    } finally {
      Module._load = previousLoad;

      if (previousTs) require.extensions['.ts'] = previousTs;
      else delete require.extensions['.ts'];

      if (previousTsx) require.extensions['.tsx'] = previousTsx;
      else delete require.extensions['.tsx'];
    }
  }

  return {
    load,
    writes: () => writes,

    setScheme(value) {
      scheme = value;
      for (const listener of [...schemeListeners]) listener();
    },

    setReduced(value) {
      reduced = value;
      for (const listener of [...motionListeners]) listener(value);
    },

    listenerCount: () => schemeListeners.size + motionListeners.size,
  };
}

test('V8.6.1B native adapter uses isolated storage and restores preferences', () => {
  const f = fixture();
  const a = f.load();

  const store = a.getWavenAppearanceStore();

  assert.equal(a.getWavenAppearanceStore(), store);
  assert.equal(f.writes(), 0);

  const next = {
    ...a.DEFAULT_WAVEN_APPEARANCE,
    theme: 'hikari',
    followSystem: true,
    motion: 'expressive',
  };

  assert.equal(store.replace(next), true);
  assert.equal(f.writes(), 1);

  const restarted = f.load();

  assert.deepEqual(
    restarted.getWavenAppearanceStore().getSnapshot().preferences,
    next,
  );

  assert.equal(f.writes(), 1);
});

test('V8.6.1B unavailable native storage retains safe NOIR defaults', () => {
  const f = fixture({ unavailable: true });
  const a = f.load();
  const store = a.getWavenAppearanceStore();

  assert.equal(store.getSnapshot().status, 'unavailable');
  assert.equal(store.getSnapshot().preferences.theme, 'noir');
  assert.equal(store.replace(a.DEFAULT_WAVEN_APPEARANCE), false);
  assert.equal(f.writes(), 0);
});

test('V8.6.1B reactive appearance changes preserve the mounted child and clean up observers', async () => {
  const f = fixture();
  const a = f.load();
  const store = a.getWavenAppearanceStore();

  const dom = new JSDOM(
    '<!doctype html><div id="root"></div>',
    { url: 'http://localhost/' },
  );

  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousAct = global.IS_REACT_ACT_ENVIRONMENT;

  global.window = dom.window;
  global.document = dom.window.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;

  const container = dom.window.document.getElementById('root');
  const root = createRoot(container);

  let latest;
  let mounts = 0;
  let unmounts = 0;

  function Child() {
    latest = a.useWavenAppearance();

    React.useEffect(() => {
      mounts++;
      return () => { unmounts++; };
    }, []);

    return React.createElement('span', null, latest.requestedTheme);
  }

  try {
    await React.act(async () => {
      root.render(
        React.createElement(
          a.WavenAppearanceProvider,
          null,
          React.createElement(Child),
        ),
      );
    });

    assert.equal(latest.requestedTheme, 'noir');
    assert.equal(latest.renderedTheme, 'noir');
    assert.equal(mounts, 1);

    await React.act(async () => {
      assert.equal(store.replace({
        ...a.DEFAULT_WAVEN_APPEARANCE,
        followSystem: true,
        motion: 'expressive',
      }), true);
    });

    assert.equal(latest.requestedTheme, 'hikari');
    assert.equal(latest.renderedTheme, 'noir');
    assert.equal(latest.effectiveMotion, 'expressive');

    await React.act(async () => {
      f.setScheme('dark');
      f.setReduced(true);
    });

    assert.equal(latest.requestedTheme, 'hikari-night');
    assert.equal(latest.effectiveMotion, 'reduced');
    assert.equal(latest.renderedTheme, 'noir');
    assert.equal(latest.colors, a.WAVEN_NOIR_COLORS);

    await React.act(async () => {
      f.setScheme('light');
      f.setReduced(false);
    });

    assert.equal(latest.requestedTheme, 'hikari');
    assert.equal(latest.effectiveMotion, 'expressive');

    for (const unknown of ['unspecified', null]) {
      await React.act(async () => {
        f.setScheme(unknown);
      });

      assert.equal(latest.systemAppearance, null);
      assert.equal(latest.requestedTheme, 'noir');
      assert.equal(latest.renderedTheme, 'noir');
      assert.equal(latest.effectiveMotion, 'expressive');
    }

    assert.equal(mounts, 1);
    assert.equal(unmounts, 0);
  } finally {
    await React.act(async () => root.unmount());

    global.window = previousWindow;
    global.document = previousDocument;
    global.IS_REACT_ACT_ENVIRONMENT = previousAct;
    dom.window.close();
  }

  assert.equal(unmounts, 1);
  assert.equal(f.listenerCount(), 0);
});

test('V8.6.1B root keeps one stable navigation subtree without a theme key', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../app/_layout.tsx'),
    'utf8',
  );

  assert.match(
    source,
    /<WavenAppearanceProvider>\s*<WavenRootNavigation\s*\/>\s*<\/WavenAppearanceProvider>/,
  );

  assert.equal(
    (source.match(/<WavenRootNavigation\s*\/>/g) || []).length,
    1,
  );

  assert.doesNotMatch(
    source,
    /<WavenAppearanceProvider[^>]*\bkey=/,
  );

  assert.match(source, /<WavenMiniPlayer\s*\/>/);
  assert.match(source, /<WavenBottomNav\s*\/>/);
});
