const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const previousLoader = require.extensions['.ts'];

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const result = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  module._compile(result.outputText, filename);
};

let appearance, storageModule, legacy;

try {
  appearance = require('../src/theme/appearance.ts');
  storageModule = require('../src/theme/appearanceStore.ts');
  legacy = require('../src/theme/tokens.ts');
} finally {
  if (previousLoader) {
    require.extensions['.ts'] = previousLoader;
  } else {
    delete require.extensions['.ts'];
  }
}

const {
  DEFAULT_WAVEN_APPEARANCE: defaults,
  WAVEN_THEME_IDENTITIES: identities,
  WAVEN_NOIR_COLORS,
  resolveWavenTheme,
  resolveWavenMotion,
  validateWavenAppearance,
  decodeWavenAppearance,
} = appearance;

const {
  WavenAppearanceStore,
  WAVEN_APPEARANCE_STORAGE_ID,
} = storageModule;

function fixture(initial = null) {
  let raw = initial;
  let writes = 0;

  return {
    storage: {
      get: () => raw,
      set: (_, value) => {
        writes++;
        raw = value;
      },
    },
    raw: () => raw,
    writes: () => writes,
    external: value => { raw = value; },
  };
}

test('V8.6.1 preserves the accepted NOIR palette and official identities', () => {
  assert.deepEqual(WAVEN_NOIR_COLORS, legacy.wavenColors);
  assert.equal(defaults.theme, 'noir');
  assert.equal(defaults.followSystem, false);
  assert.equal(identities.noir.name, 'WAVEN NOIR');
  assert.equal(identities.hikari.name, 'WAVEN HIKARI');
  assert.equal(identities['hikari-night'].name, 'WAVEN HIKARI NIGHT');
  assert.ok(Object.isFrozen(WAVEN_NOIR_COLORS));
});

test('V8.6.1 Follow System maps light and dark deterministically', () => {
  const settings = { ...defaults, followSystem: true };
  assert.equal(resolveWavenTheme(settings, 'light'), 'hikari');
  assert.equal(resolveWavenTheme(settings, 'dark'), 'hikari-night');
  assert.equal(resolveWavenTheme(settings, null), 'noir');
});

test('V8.6.1 manual themes are never overridden by system appearance', () => {
  for (const theme of Object.keys(identities)) {
    const settings = { ...defaults, theme };
    for (const system of ['light', 'dark', null]) {
      assert.equal(resolveWavenTheme(settings, system), theme);
    }
  }
});

test('V8.6.1 system accessibility overrides expressive motion', () => {
  const settings = { ...defaults, motion: 'expressive' };
  assert.equal(resolveWavenMotion(settings, true), 'reduced');
  assert.equal(resolveWavenMotion(settings, null), 'reduced');
  assert.equal(resolveWavenMotion(settings, false), 'expressive');
  assert.equal(resolveWavenMotion(defaults, false), 'subtle');
  assert.equal(resolveWavenMotion({
    ...defaults, motion: 'reduced',
  }, false), 'reduced');
});

test('V8.6.1 validates the exact versioned preference contract', () => {
  assert.deepEqual(validateWavenAppearance(defaults), defaults);
  assert.equal(validateWavenAppearance({ ...defaults, version: 2 }), null);
  assert.equal(validateWavenAppearance({ ...defaults, theme: 'pink' }), null);
  assert.equal(validateWavenAppearance({ ...defaults, motion: 'fast' }), null);
  assert.equal(validateWavenAppearance({ ...defaults, performance: 'unknown' }), null);
  assert.equal(validateWavenAppearance({ ...defaults, followSystem: 1 }), null);
  assert.equal(validateWavenAppearance({ ...defaults, extra: true }), null);
  assert.equal(decodeWavenAppearance('invalid-json'), null);
  assert.equal(decodeWavenAppearance('x'.repeat(5000)), null);
});

test('V8.6.1 missing preferences preserve NOIR without writing on startup', () => {
  const f = fixture();
  const store = new WavenAppearanceStore(f.storage);
  assert.equal(store.getSnapshot().status, 'ready');
  assert.deepEqual(store.getSnapshot().preferences, defaults);
  assert.equal(f.writes(), 0);
  assert.equal(WAVEN_APPEARANCE_STORAGE_ID, 'waven.appearance');
});

test('V8.6.1 verified preferences survive restart and notify subscribers', () => {
  const f = fixture();
  const store = new WavenAppearanceStore(f.storage);

  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);

  const next = {
    ...defaults,
    theme: 'hikari-night',
    motion: 'expressive',
    performance: 'enhanced',
  };

  assert.equal(store.replace(next), true);
  assert.equal(notifications, 1);
  assert.equal(f.writes(), 1);

  const restarted = new WavenAppearanceStore(f.storage);
  assert.deepEqual(restarted.getSnapshot().preferences, next);

  const snapshot = store.getSnapshot();

  assert.equal(store.replace(next), true);
  assert.equal(store.getSnapshot(), snapshot);
  assert.equal(f.writes(), 1);
  assert.equal(notifications, 1);

  unsubscribe();
  assert.equal(store.replace(defaults), true);
  assert.equal(notifications, 1);
});

test('V8.6.1 invalid preference changes cannot write storage', () => {
  const f = fixture();
  const store = new WavenAppearanceStore(f.storage);
  assert.equal(store.replace({ ...defaults, theme: 'invalid' }), false);
  assert.equal(f.writes(), 0);
  assert.deepEqual(store.getSnapshot().preferences, defaults);
});

test('V8.6.1 corrupt and future records remain untouched and blocked', () => {
  for (const raw of [
    '{broken',
    JSON.stringify({ ...defaults, version: 2 }),
  ]) {
    const f = fixture(raw);
    const store = new WavenAppearanceStore(f.storage);

    assert.equal(store.getSnapshot().status, 'blocked');
    assert.equal(store.replace(defaults), false);
    assert.equal(f.raw(), raw);
    assert.equal(f.writes(), 0);
  }
});

test('V8.6.1 unavailable storage falls back safely without false success', () => {
  const store = new WavenAppearanceStore({
    get: () => { throw Error('unavailable'); },
    set: () => { throw Error('must not write'); },
  });

  assert.equal(store.getSnapshot().status, 'unavailable');
  assert.deepEqual(store.getSnapshot().preferences, defaults);
  assert.equal(store.replace(defaults), false);
});

test('V8.6.1 unexpected preimage changes are not overwritten', () => {
  const f = fixture();
  const store = new WavenAppearanceStore(f.storage);

  f.external('external-change');

  assert.equal(store.replace(defaults), false);
  assert.equal(store.getSnapshot().status, 'blocked');
  assert.equal(f.raw(), 'external-change');
  assert.equal(f.writes(), 0);
});

test('V8.6.1 failed or unverified writes retain last confirmed preferences', () => {
  for (const set of [
    () => {},
    () => { throw Error('write-failed'); },
  ]) {
    const store = new WavenAppearanceStore({
      get: () => null,
      set,
    });

    assert.equal(store.replace({ ...defaults, theme: 'hikari' }), false);
    assert.equal(store.getSnapshot().status, 'unconfirmed');
    assert.deepEqual(store.getSnapshot().preferences, defaults);
    assert.equal(store.replace(defaults), false);
  }
});
