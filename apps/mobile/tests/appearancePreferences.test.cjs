"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loader } = require("./helpers/animeModules.cjs");
const { hookHarness } = require("./helpers/playerHookHarness.cjs");

const LEGACY_KEY = "mobileThemePreferencesV1";
const V2_KEY = "mobileThemePreferencesV2";
const V3_KEY = "mobileThemePreferencesV3";
const { loadThemePreferences, resolveThemeSelection, loadAdvancedThemePreferences,
  editAdvancedPaletteRole, resetAdvancedPaletteProfile } = loader()(
  "apps/mobile/src/features/appearance/appearancePreferences.ts",
);

function legacy(theme, overrides = {}) {
  return JSON.stringify({ schemaVersion: 1, theme, followSystem: false, reducedMotion: true, ...overrides });
}

function createStorage(entries = {}) {
  const records = new Map(Object.entries(entries));
  const writes = [];
  const attempts = [];
  const store = {
    records,
    writes,
    attempts,
    unavailable: false,
    failWrite: false,
    failedReadKeys: new Set(),
    get(key) {
      if (store.failedReadKeys.has(key)) throw new Error("test read failure");
      return records.get(key) ?? null;
    },
    set(key, value) {
      attempts.push(key);
      if (store.failWrite) throw new Error("test write failure");
      writes.push([key, JSON.parse(value)]);
      records.set(key, value);
    },
  };
  return store;
}

function mountTheme(t, storage, scheme, systemReducedMotion = false) {
  const harness = hookHarness();
  const frames = [];
  const appearanceListeners = new Set();
  const appStateListeners = new Set();
  function subscribe(listeners, listener) {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  }
  const react = { ...harness.react, createContext: () => ({ Provider: "ThemeProvider" }) };
  const load = loader({
    react,
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
    "react-native": {
      Appearance: {
        getColorScheme: () => scheme,
        addChangeListener: (listener) => subscribe(appearanceListeners, listener),
      },
      AppState: {
        addEventListener(event, listener) {
          assert.equal(event, "change");
          return subscribe(appStateListeners, listener);
        },
      },
    },
    "../services/storageAdapter": {
      mmkvStorageAdapter: storage,
      getMobileStorageHealth: () => ({ state: storage.unavailable ? "unavailable" : "ready" }),
    },
    "../hooks/useSystemReducedMotion": { useSystemReducedMotion: () => systemReducedMotion },
  });
  const { ThemeProvider } = load("apps/mobile/src/context/ThemeContext.tsx");
  harness.start(() => {
    const result = ThemeProvider({ children: null }).props.value;
    frames.push(result.theme.id);
    return result;
  });
  t.after(() => {
    harness.dispose();
    assert.equal(appearanceListeners.size, 0);
    assert.equal(appStateListeners.size, 0);
  });
  return {
    frames,
    get current() { return harness.result; },
    async changeScheme(value, notify = true) {
      scheme = value;
      if (notify) for (const listener of appearanceListeners) listener({ colorScheme: value });
      await harness.settle();
    },
    async appState(value) {
      for (const listener of appStateListeners) listener(value);
      await harness.settle();
    },
    changeSystemMotion(value) {
      systemReducedMotion = value;
      harness.update();
    },
    settle: harness.settle,
  };
}

for (const theme of ["midnight-premiere", "amoled", "mocha", "slate", "projector-silver", "custom"]) {
  test("V1 migration keeps " + theme + ", its motion setting and any stored accent", () => {
    const raw = legacy(theme, { customAccent: "#aBc123" });
    const storage = createStorage({ [LEGACY_KEY]: raw });
    const { preferences, saveStatus } = loadThemePreferences(storage, "dark", false);
    assert.equal(saveStatus, "ready");
    assert.deepEqual(preferences, {
      schemaVersion: 2,
      manualTheme: theme,
      lightTheme: "projector-silver",
      darkTheme: "midnight-premiere",
      followSystem: false,
      customAccent: "#ABC123",
      reducedMotion: true,
    });
    assert.equal(resolveThemeSelection(preferences, "light"), theme);
    assert.equal(resolveThemeSelection(preferences, "dark"), theme);
    assert.equal(storage.get(LEGACY_KEY), raw);
    assert.equal(storage.get(V2_KEY), null);
    assert.deepEqual(storage.attempts, []);
  });
}

test("missing records initialize safe defaults for the current system scheme without writing", () => {
  const storage = createStorage();
  for (const [scheme, theme] of [["light", "projector-silver"], ["dark", "midnight-premiere"], [null, "midnight-premiere"]]) {
    const { preferences, saveStatus } = loadThemePreferences(storage, scheme, false);
    assert.equal(saveStatus, "ready");
    assert.equal(preferences.manualTheme, theme);
    assert.equal(preferences.customAccent, null);
    assert.equal(preferences.reducedMotion, false);
    assert.equal(preferences.followSystem, true);
    assert.equal(resolveThemeSelection(preferences, scheme), theme);
  }
  assert.deepEqual(storage.attempts, []);
});

test("malformed records retain valid fields, prefer explicit V2 null and fall back to V1 where needed", () => {
  const rawV1 = legacy("slate", { customAccent: "#bada55", followSystem: "false" });
  const rawV2 = JSON.stringify({
    schemaVersion: 2, manualTheme: "constructor", lightTheme: "mocha", darkTheme: "amoled",
    customAccent: null, reducedMotion: "false", followSystem: false,
  });
  const storage = createStorage({ [LEGACY_KEY]: rawV1, [V2_KEY]: rawV2 });
  const { preferences } = loadThemePreferences(storage, "dark", false);
  assert.deepEqual(preferences, {
    schemaVersion: 2, manualTheme: "slate", lightTheme: "projector-silver", darkTheme: "amoled",
    customAccent: null, reducedMotion: true, followSystem: false,
  });
  assert.equal(storage.get(V2_KEY), rawV2);
  assert.equal(storage.get(LEGACY_KEY), rawV1);

  storage.records.set(V2_KEY, "{truncated");
  const recovered = loadThemePreferences(storage, "dark", false).preferences;
  assert.equal(recovered.customAccent, "#BADA55");
  assert.equal(recovered.followSystem, true);
  assert.equal(recovered.manualTheme, "slate");
  assert.equal(recovered.reducedMotion, true);

  storage.records.set(LEGACY_KEY, legacy("toString", { customAccent: {}, reducedMotion: false }));
  const defaults = loadThemePreferences(storage, "light", false).preferences;
  assert.equal(defaults.manualTheme, "projector-silver");
  assert.equal(defaults.customAccent, null);
  assert.equal(defaults.reducedMotion, false);
  assert.equal(defaults.followSystem, false);
  assert.deepEqual(storage.attempts, []);
});

test("an unsupported V2 schema stays intact and a readable V1 fallback still renders", async (t) => {
  const rawV2 = '{"schemaVersion":3,"manualTheme":"amoled","futureProfile":{"revision":4}}';
  const rawV1 = legacy("slate", { customAccent: "#ABCDEF" });
  const storage = createStorage({ [LEGACY_KEY]: rawV1, [V2_KEY]: rawV2 });
  const app = mountTheme(t, storage, "light");
  app.current.setReducedMotion(false);
  app.current.setTheme("mocha");
  await app.settle();
  assert.equal(app.current.theme.id, "slate");
  assert.equal(app.current.preferences.reducedMotion, true);
  assert.equal(app.current.preferences.customAccent, "#ABCDEF");
  assert.equal(storage.get(V2_KEY), rawV2);
  assert.equal(storage.get(LEGACY_KEY), rawV1);
  assert.deepEqual(storage.attempts, []);
  assert.match(app.current.preferenceSaveError, /different version/);
});

test("unavailable storage renders defaults and reports rejected saves without attempting a write", async (t) => {
  const storage = createStorage();
  storage.unavailable = true;
  const app = mountTheme(t, storage, "light");
  assert.equal(app.current.theme.id, "projector-silver");
  assert.equal(app.current.setCustomAccent("#101010"), false);
  await app.settle();
  assert.equal(app.current.preferences.followSystem, true);
  assert.equal(app.current.preferences.customAccent, null);
  assert.deepEqual(storage.attempts, []);
  assert.match(app.current.preferenceSaveError, /storage is unavailable/);
  app.current.dismissPreferenceSaveError();
  await app.settle();
  assert.equal(app.current.preferenceSaveError, null);
});

test("a storage read error protects both raw records and keeps readable preferences available", async (t) => {
  const rawV1 = legacy("mocha", { customAccent: "#112233" });
  const rawV2 = '{"schemaVersion":2,"manualTheme":"amoled","followSystem":false}';
  const storage = createStorage({ [LEGACY_KEY]: rawV1, [V2_KEY]: rawV2 });
  storage.failedReadKeys.add(V2_KEY);
  const app = mountTheme(t, storage, "light");
  app.current.setTheme("slate");
  await app.settle();
  assert.equal(app.current.theme.id, "mocha");
  assert.equal(app.current.preferences.customAccent, "#112233");
  assert.deepEqual(storage.attempts, []);
  assert.equal(storage.get(LEGACY_KEY), rawV1);
  assert.equal(storage.records.get(V2_KEY), rawV2);
});

for (const [scheme, storedTheme, expected] of [
  ["light", "midnight-premiere", "projector-silver"],
  ["dark", "projector-silver", "midnight-premiere"],
]) {
  test("the first themed frame follows " + scheme + " despite the formerly saved effective palette", async (t) => {
    const storage = createStorage({ [LEGACY_KEY]: legacy(storedTheme, { followSystem: true }) });
    const app = mountTheme(t, storage, scheme);
    assert.equal(app.frames[0], expected);
    await app.settle();
    assert.ok(app.frames.every((frame) => frame === expected));
    assert.deepEqual(storage.attempts, []);
  });
}

test("system changes, missed events and foreground refresh resolve without storage writes", async (t) => {
  const rawV2 = JSON.stringify({
    schemaVersion: 2, manualTheme: "mocha", lightTheme: "projector-silver", darkTheme: "amoled",
    followSystem: true, customAccent: "#445566", reducedMotion: true,
  });
  const storage = createStorage({ [V2_KEY]: rawV2 });
  const app = mountTheme(t, storage, "light");
  await app.changeScheme("dark");
  assert.equal(app.current.theme.id, "amoled");
  await app.appState("background");
  await app.changeScheme("light", false);
  assert.equal(app.current.theme.id, "amoled");
  await app.appState("active");
  assert.equal(app.current.theme.id, "projector-silver");
  await app.changeScheme("unspecified");
  assert.equal(app.current.theme.id, "amoled");
  await app.changeScheme(null);
  assert.equal(app.current.theme.id, "amoled");
  assert.equal(app.current.preferences.reducedMotion, true);
  assert.equal(storage.get(V2_KEY), rawV2);
  assert.deepEqual(storage.attempts, []);

  app.current.setFollowSystem(false);
  await app.settle();
  assert.equal(app.current.theme.id, "mocha");
  await app.changeScheme("light");
  await app.appState("active");
  assert.equal(app.current.theme.id, "mocha");
  assert.deepEqual(storage.attempts, [V3_KEY]);
  assert.equal(storage.writes[0][1].darkTheme, "amoled");
  assert.equal(storage.writes[0][1].custom.dark.colors.accent, "#445566");
  assert.equal(storage.get(V2_KEY), rawV2);
});

test("a saved manual selection survives Follow System, OS changes and restart", async (t) => {
  const rawV1 = legacy("slate", { customAccent: "#00ff00" });
  const storage = createStorage({ [LEGACY_KEY]: rawV1 });
  const first = mountTheme(t, storage, "dark");
  first.current.setFollowSystem(true);
  await first.changeScheme("light");
  assert.equal(first.current.theme.id, "projector-silver");

  const restarted = mountTheme(t, storage, "dark");
  assert.equal(restarted.frames[0], "midnight-premiere");
  restarted.current.setFollowSystem(false);
  await restarted.settle();
  assert.equal(restarted.current.theme.id, "slate");
  assert.equal(restarted.current.preferences.reducedMotion, true);
  assert.equal(restarted.current.preferences.customAccent, "#00FF00");
  assert.equal(storage.get(LEGACY_KEY), rawV1);
  assert.deepEqual(storage.attempts, [V3_KEY, V3_KEY]);

  const custom = restarted.current.setCustomAccent("#00ff00");
  assert.equal(custom, true);
  await restarted.settle();
  assert.equal(restarted.current.theme.accent, "#00FF00");
  assert.equal(restarted.current.theme.accentSoft, "rgba(0,255,0,0.16)");
  assert.equal(restarted.current.theme.onAccent, "#000000");
  assert.equal(restarted.current.setCustomAccent("#bad"), false);
  assert.deepEqual(storage.attempts, [V3_KEY, V3_KEY, V3_KEY]);
});

test("unresolved and changing system motion stay separate from the user's motion preference", async (t) => {
  const rawV1 = legacy("slate", { reducedMotion: false });
  const storage = createStorage({ [LEGACY_KEY]: rawV1 });
  const app = mountTheme(t, storage, "dark", null);
  assert.equal(app.current.systemReducedMotion, null);
  assert.equal(app.current.preferences.reducedMotion, false);
  app.changeSystemMotion(true);
  assert.equal(app.current.systemReducedMotion, true);
  assert.equal(app.current.preferences.reducedMotion, false);
  assert.deepEqual(storage.attempts, []);

  app.current.setReducedMotion(true);
  await app.settle();
  app.changeSystemMotion(false);
  assert.equal(app.current.preferences.reducedMotion, true);
  assert.equal(app.current.systemReducedMotion, false);
  assert.deepEqual(storage.attempts, [V3_KEY]);
  assert.equal(storage.get(LEGACY_KEY), rawV1);
});

test("appearance and Reduced Motion changes from one render compose against the last successful write", async (t) => {
  const storage = createStorage({ [LEGACY_KEY]: legacy("slate") });
  const app = mountTheme(t, storage, "light");
  const { setTheme, setReducedMotion, setFollowSystem, setCustomAccent } = app.current;
  setTheme("mocha");
  setReducedMotion(false);
  setFollowSystem(true);
  assert.equal(setCustomAccent("#FFFFFF"), true);
  await app.settle();
  assert.equal(app.current.theme.id, "custom");
  assert.equal(app.current.theme.onAccent, "#000000");
  assert.equal(app.current.preferences.reducedMotion, false);
  assert.deepEqual(storage.writes.map(([, value]) => [value.manualTheme, value.reducedMotion, value.followSystem]), [
    ["mocha", true, false], ["mocha", false, false], ["mocha", false, true], ["custom", false, false],
  ]);
  assert.equal(app.current.setCustomAccent("#FFFFFF"), true);
  assert.equal(storage.attempts.length, 4);
});

test("failed writes leave saved and active appearance untouched and later retries use the committed state", async (t) => {
  const rawV1 = legacy("slate", { customAccent: "#AA1133" });
  const storage = createStorage({ [LEGACY_KEY]: rawV1 });
  const app = mountTheme(t, storage, "light");
  storage.failWrite = true;
  assert.equal(app.current.setCustomAccent("#FFFFFF"), false);
  app.current.setReducedMotion(false);
  await app.settle();
  assert.equal(app.current.theme.id, "slate");
  assert.equal(app.current.preferences.customAccent, "#AA1133");
  assert.equal(app.current.preferences.reducedMotion, true);
  assert.equal(storage.get(LEGACY_KEY), rawV1);
  assert.equal(storage.get(V2_KEY), null);
  assert.match(app.current.preferenceSaveError, /Try again/);

  storage.failWrite = false;
  app.current.setTheme("mocha");
  await app.settle();
  assert.equal(app.current.theme.id, "mocha");
  assert.equal(app.current.preferences.reducedMotion, true);
  assert.equal(app.current.preferenceSaveError, null);
  assert.equal(app.current.setCustomAccent("#FFFFFF"), true);
  await app.settle();
  assert.equal(app.current.theme.id, "custom");
  assert.equal(JSON.parse(storage.get(V3_KEY)).custom.dark.colors.accent, "#FFFFFF");
  assert.equal(storage.get(V2_KEY), null);
  assert.equal(storage.get(LEGACY_KEY), rawV1);
});

function v2Record(extra = {}) {
  return JSON.stringify({ schemaVersion: 2, manualTheme: 'custom', lightTheme: 'projector-silver',
    darkTheme: 'custom', followSystem: false, reducedMotion: true, customAccent: '#254DA8', ...extra });
}

const blankColors = { accent: null, background: null, surface: null, text: null, border: null };
const setupV3 = (storage = createStorage()) => loadAdvancedThemePreferences(storage, 'dark', false).preferences;

test('Fresh, V1 and V2 become independent in-memory V3 without writing', () => {
  for (const records of [{}, { [LEGACY_KEY]: legacy('custom', { customAccent: '#Abc987' }) },
    { [V2_KEY]: v2Record({ manualTheme: 'slate', followSystem: true }) }]) {
    const storage = createStorage(records);
    const loaded = setupV3(storage);
    const old = loadThemePreferences(storage, 'dark', false).preferences;
    assert.deepEqual(loaded, {
      schemaVersion: 3, manualTheme: old.manualTheme, lightTheme: old.lightTheme, darkTheme: old.darkTheme,
      followSystem: old.followSystem, reducedMotion: old.reducedMotion,
      custom: { light: blankColors, dark: { colors: { ...blankColors, accent: old.customAccent }, rendering: 'legacy' } },
    });
    assert.deepEqual([...storage.records], Object.entries(records));
    assert.deepEqual(storage.attempts, []);
  }
});

test('Partial V3 recovers only the missing and invalid roles and differentiates default HEX from null', () => {
  const old = v2Record({ customAccent: '#1abccd' });
  const storage = createStorage({ [V2_KEY]: old });
  const data = setupV3(storage);
  for (const [condition, value, expected] of [
    ['missing', undefined, '#1ABCCD'], ['invalid', '#Bad', '#1ABCCD'],
    [null, null, null], [null, '#e50914', '#E50914'],
  ]) {
    data.custom.light.accent = '#a11111';
    data.custom.dark.colors.accent = value;
    if (value === undefined) delete data.custom.dark.colors.accent;
    storage.records.set(V3_KEY, JSON.stringify(data));
    const { preferences, recoveries, saveStatus } = loadAdvancedThemePreferences(storage, 'dark', false);
    assert.equal(preferences.custom.light.accent, '#A11111');
    assert.equal(preferences.custom.dark.colors.accent, expected);
    assert.equal(preferences.custom.dark.rendering, 'legacy');
    assert.deepEqual(recoveries, condition ? [{ path: 'custom.dark.colors.accent', reason: condition }] : []);
    assert.equal(saveStatus, 'ready');
  }
  assert.equal(storage.get(V2_KEY), old);
  assert.deepEqual(storage.attempts, []);
});

test('Invalid Dark mode recovers saved advanced roles without writing or letting an unreadable profile render', async t => {
  const storage = createStorage({ [V2_KEY]: v2Record() });
  const preferences = setupV3(storage);
  preferences.custom.dark.colors = { ...blankColors, background: '#161B24', text: '#000000' };
  delete preferences.custom.dark.rendering;
  const raw = JSON.stringify(preferences);
  storage.records.set(V3_KEY, raw);
  const app = mountTheme(t, storage, 'dark');
  assert.equal(app.current.theme.id, 'custom');
  assert.notEqual(app.current.theme.text, '#000000');
  assert.notEqual(app.current.theme.background, '#161B24');
  assert.deepEqual(app.current.appearanceRecoveries, [{ path: 'custom.dark.rendering', reason: 'missing' }]);
  const opening = app.current.advancedAppearanceChoices;
  assert.equal(opening.custom.dark.rendering, 'adaptive');
  assert.equal(opening.custom.dark.colors.text, '#000000');
  assert.equal(opening.custom.dark.colors.background, '#161B24');
  assert.equal(storage.get(V3_KEY), raw);
  assert.deepEqual(storage.attempts, []);

  const edited = editAdvancedPaletteRole(opening, 'dark', 'text', '#F4F5F9');
  assert.deepEqual(app.current.applyAdvancedAppearanceChoices(opening, edited), { ok: true });
  await app.settle();
  assert.equal(app.current.theme.text, '#F4F5F9');
  assert.equal(app.current.theme.background, '#161B24');
  assert.deepEqual(storage.attempts, [V3_KEY]);
});

test('A complete supported V3 skips older keys and wins after a downgrade wrote to V2', () => {
  const storage = createStorage({ [V2_KEY]: v2Record({ customAccent: '#444444' }) });
  const preferences = setupV3(storage);
  preferences.custom.dark.colors.accent = '#ABCDE0';
  preferences.custom.light.accent = '#EB7305';
  storage.records.set(V3_KEY, JSON.stringify(preferences));
  storage.failedReadKeys.add(V2_KEY);
  storage.failedReadKeys.add(LEGACY_KEY);
  const result = loadAdvancedThemePreferences(storage, 'dark', false);
  assert.equal(result.saveStatus, 'ready');
  assert.deepEqual(result.preferences, preferences);
  assert.deepEqual(storage.attempts, []);
});

test('Malformed, empty and future V3 payloads render a fallback and protect the saved bytes', async (t) => {
  for (const [raw, message] of [['{truncated', /could not be read/], ['', /could not be read/],
    ['{"schemaVersion":4,"newSetting":"keep me"}', /different version/]]) {
    const old = v2Record();
    const storage = createStorage({ [V3_KEY]: raw, [V2_KEY]: old });
    const app = mountTheme(t, storage, 'dark');
    assert.equal(app.current.theme.accent, '#254DA8');
    assert.match(app.current.appearanceSaveBlock, message);
    assert.equal(app.current.setCustomAccent('#999999'), false);
    await app.settle();
    assert.match(app.current.preferenceSaveError, message);
    assert.equal(storage.get(V3_KEY), raw);
    assert.equal(storage.get(V2_KEY), old);
    assert.deepEqual(storage.attempts, []);
  }
});

function mockAndroidStorage(records, failSet = () => {}) {
  const load = loader({
    'react-native': { Platform: { OS: 'android' } },
    'react-native-mmkv': { createMMKV: () => ({
      getString: key => records.get(key),
      set(key, value) { failSet(key); records.set(key, value); },
      remove: key => records.delete(key),
    }) },
    '@orion/shared/api': {},
    '../glimpse/glimpseBuild': { GLIMPSE_INTERNAL_PREVIEW: true },
  });
  return { load, storage: load('apps/mobile/src/services/storageAdapter.ts').mmkvStorageAdapter };
}

test('Android adapter keeps empty V3 records distinct from missing keys and preserves older storage semantics', () => {
  const records = new Map([[V3_KEY, '']]);
  const { storage } = mockAndroidStorage(records);
  assert.equal(storage.get(V3_KEY), '');
  assert.equal(loadAdvancedThemePreferences(storage, 'light', false).saveStatus, 'corrupted');
  records.delete(V3_KEY);
  assert.equal(storage.get(V3_KEY), null);
  assert.equal(loadAdvancedThemePreferences(storage, 'light', false).saveStatus, 'ready');
  for (const key of [LEGACY_KEY, V2_KEY, 'orion.mobile.downloads.repository.v1',
    'p8.myListSyncCheckpoint.v1:test', 'p8.syncPolicy.v1:test', 'unrelated']) {
    assert.equal(storage.get(key), null, key);
    storage.set(key, '');
    assert.equal(records.get(key), '', key);
    assert.equal(storage.get(key), null, key);
    storage.set(key, '{"test":1}');
    assert.equal(storage.get(key), '{"test":1}', key);
    storage.remove(key);
    assert.equal(records.has(key), false, key);
  }
});

test('an empty internal Welcome qualification key is treated as absent on Android', () => {
  const records = new Map();
  const { load } = mockAndroidStorage(records);
  const { TEST_KEY } = load('apps/mobile/src/features/releaseWelcome/welcomeState.ts');
  const { qualificationEnabled } = load('apps/mobile/src/features/releaseWelcome/welcomeQualification.ts');
  assert.equal(qualificationEnabled(), false);
  records.set(TEST_KEY, '');
  assert.equal(qualificationEnabled(), false);
  records.set(TEST_KEY, '{}');
  assert.equal(qualificationEnabled(), true);
});

test('Android My List rollback restores populated data and treats a historical empty key as absent', () => {
  for (const previous of ['', '{"movie-1":{"id":1}}']) {
    const records = new Map([['saved', previous], ['savedOrder', '["movie-1"]']]);
    let failOnce = true;
    const { load, storage } = mockAndroidStorage(records, key => {
      if (key === 'savedOrder' && failOnce) {
        failOnce = false;
        throw new Error('second write failed');
      }
    });
    const { replacePersistedMyListV1 } = load('apps/mobile/src/features/library/myListPersistence.ts');
    assert.throws(() => replacePersistedMyListV1(storage, {}, []), /second write failed/);
    assert.equal(records.has('saved'), previous !== '');
    assert.equal(storage.get('saved'), previous || null);
    assert.equal(storage.get('savedOrder'), '["movie-1"]');
  }
});

test('V3 read failures display V2 preferences but attempt zero writes', async (t) => {
  const storage = createStorage({ [V2_KEY]: v2Record() });
  storage.failedReadKeys.add(V3_KEY);
  const app = mountTheme(t, storage, 'dark');
  assert.equal(app.current.theme.accent, '#254DA8');
  assert.match(app.current.appearanceSaveBlock, /unavailable/);
  app.current.setReducedMotion(false);
  await app.settle();
  assert.equal(app.current.preferences.reducedMotion, true);
  assert.deepEqual(storage.attempts, []);
});

const lightColors = { accent: '#545C92', background: '#FAF7EE', surface: '#ECF2FF', text: '#172238', border: '#30334A' };
const darkColors = { accent: '#ECB97B', background: '#0E141E', surface: '#242834', text: '#F4F5F9', border: '#7F91AF' };

function editAll(draft, profile, colors) {
  return Object.entries(colors).reduce((choices, [role, color]) => editAdvancedPaletteRole(choices, profile, role, color), draft);
}

test('Advanced Apply stores ten independent values once and switches profiles without persisting system events', async (t) => {
  const old = v2Record();
  const storage = createStorage({ [V2_KEY]: old });
  const app = mountTheme(t, storage, 'dark');
  const opening = app.current.advancedAppearanceChoices;
  let edited = editAll(opening, 'light', lightColors);
  assert.equal(edited.custom.dark.rendering, 'legacy');
  edited = editAll(edited, 'dark', darkColors);
  edited = { ...edited, lightTheme: 'custom-light', darkTheme: 'custom', followSystem: true };

  assert.deepEqual(storage.attempts, []);
  assert.deepEqual(app.current.applyAdvancedAppearanceChoices(opening, edited), { ok: true });
  await app.settle();
  assert.deepEqual(storage.attempts, [V3_KEY]);
  const record = JSON.parse(storage.get(V3_KEY));
  assert.deepEqual(record.custom, { light: lightColors, dark: { colors: darkColors, rendering: 'adaptive' } });
  assert.equal(record.manualTheme, 'custom');
  assert.equal(record.reducedMotion, true);
  assert.equal(storage.get(V2_KEY), old);
  assert.equal(app.current.theme.background, darkColors.background);
  assert.equal(app.current.theme.dark, true);

  const restarted = mountTheme(t, storage, 'light');
  assert.equal(restarted.current.effectiveAppearanceThemeId, 'custom-light');
  assert.equal(restarted.current.theme.id, 'projector-silver');
  assert.equal(restarted.current.theme.dark, false);
  assert.equal(restarted.current.theme.background, lightColors.background);
  await restarted.changeScheme('dark');
  assert.equal(restarted.current.effectiveAppearanceThemeId, 'custom');
  assert.equal(restarted.current.theme.background, darkColors.background);
  await restarted.changeScheme('light', false);
  await restarted.appState('active');
  assert.equal(restarted.current.effectiveAppearanceThemeId, 'custom-light');
  assert.deepEqual(storage.attempts, [V3_KEY]);
  restarted.current.setTheme('custom-light');
  await restarted.changeScheme('dark');
  assert.equal(restarted.current.effectiveAppearanceThemeId, 'custom-light');
  assert.equal(restarted.current.preferences.followSystem, false);
  assert.deepEqual(JSON.parse(storage.get(V3_KEY)).custom, record.custom);
});

test('Direct Settings HEX targets V3 Dark only, keeps rendering mode and retains save feedback', async (t) => {
  const old = v2Record();
  const storage = createStorage({ [V2_KEY]: old });
  const app = mountTheme(t, storage, 'dark');
  const initial = app.current.advancedAppearanceChoices;
  assert.deepEqual(app.current.applyAdvancedAppearanceChoices(initial, {
    ...editAll(editAll(initial, 'light', lightColors), 'dark', darkColors), lightTheme: 'custom-light', followSystem: true,
  }), { ok: true });
  await app.settle();
  assert.equal(app.current.setCustomAccent('#dadada'), true);
  await app.settle();
  const record = JSON.parse(storage.get(V3_KEY));
  assert.deepEqual(record.custom.light, lightColors);
  assert.deepEqual(record.custom.dark, { colors: { ...darkColors, accent: '#DADADA' }, rendering: 'adaptive' });
  assert.equal(record.lightTheme, 'custom-light');
  assert.equal(record.manualTheme, 'custom');
  assert.equal(record.followSystem, false);
  assert.equal(storage.get(V2_KEY), old);
  assert.equal(app.current.setCustomAccent('#bad'), false);
  storage.failWrite = true;
  assert.equal(app.current.setCustomAccent('#AAAAAA'), false);
  await app.settle();
  assert.match(app.current.preferenceSaveError, /Try again/);
  assert.deepEqual(JSON.parse(storage.get(V3_KEY)), record);
});

test('Per-role reset preserves peers and mode; full Dark reset restores historical Custom tokens', async (t) => {
  const storage = createStorage({ [V2_KEY]: v2Record() });
  const app = mountTheme(t, storage, 'dark');
  const initial = app.current.advancedAppearanceChoices;
  const resetLegacyAccent = editAdvancedPaletteRole(initial, 'dark', 'accent', null);
  assert.equal(resetLegacyAccent.custom.dark.rendering, 'legacy');
  const edited = editAll(editAll(initial, 'light', lightColors), 'dark', darkColors);
  assert.deepEqual(app.current.applyAdvancedAppearanceChoices(initial, edited), { ok: true });
  await app.settle();
  const opening = app.current.advancedAppearanceChoices;
  const perRole = editAdvancedPaletteRole(opening, 'dark', 'border', null);
  assert.deepEqual(app.current.applyAdvancedAppearanceChoices(opening, perRole), { ok: true });
  await app.settle();
  assert.deepEqual(app.current.advancedAppearanceChoices.custom.dark,
    { colors: { ...darkColors, border: null }, rendering: 'adaptive' });
  const from = app.current.advancedAppearanceChoices;
  assert.deepEqual(app.current.applyAdvancedAppearanceChoices(from, resetAdvancedPaletteProfile(from, 'dark')), { ok: true });
  await app.settle();
  const record = JSON.parse(storage.get(V3_KEY));
  assert.deepEqual(record.custom, { light: lightColors, dark: { colors: blankColors, rendering: 'legacy' } });
  assert.equal(Object.hasOwn(record, 'resetProfiles'), false);
  assert.equal(app.current.theme.accent, '#E50914');
  assert.equal(app.current.theme.border, 'rgba(255,255,255,0.10)');
  const lightStart = app.current.advancedAppearanceChoices;
  assert.deepEqual(app.current.applyAdvancedAppearanceChoices(lightStart, resetAdvancedPaletteProfile(lightStart, 'light')), { ok: true });
  await app.settle();
  assert.deepEqual(app.current.advancedAppearanceChoices.custom,
    { light: blankColors, dark: { colors: blankColors, rendering: 'legacy' } });
});

test('Concurrent disjoint changes merge and overlapping or unsafe merged palettes never persist', async (t) => {
  const storage = createStorage({ [V2_KEY]: v2Record() });
  const app = mountTheme(t, storage, 'dark');
  const opening = app.current.advancedAppearanceChoices;
  const change = app.current.applyAdvancedAppearanceChoices;
  assert.equal(change(opening, editAdvancedPaletteRole(opening, 'dark', 'accent', '#BBCDEF')).ok, true);
  assert.equal(change(opening, editAdvancedPaletteRole(opening, 'dark', 'border', '#6C778A')).ok, true);
  assert.equal(change(opening, editAdvancedPaletteRole(opening, 'light', 'accent', '#304951')).ok, true);
  assert.match(change(opening, editAdvancedPaletteRole(opening, 'dark', 'accent', '#123456')).message, /changed while/);
  await app.settle();
  const next = app.current.advancedAppearanceChoices;
  assert.equal(change(next, editAdvancedPaletteRole(next, 'light', 'text', '#555555')).ok, true);
  const result = change(next, editAdvancedPaletteRole(next, 'light', 'surface', '#999999'));
  assert.match(result.message, /Custom Light text.*contrast/);
  const stored = JSON.parse(storage.get(V3_KEY));
  assert.equal(stored.custom.light.surface, null);
  assert.equal(stored.custom.light.text, '#555555');
  assert.equal(stored.custom.light.accent, '#304951');
  assert.equal(stored.custom.dark.colors.accent, '#BBCDEF');
  assert.equal(stored.custom.dark.colors.border, '#6C778A');
  assert.equal(stored.custom.dark.rendering, 'adaptive');
  assert.deepEqual(storage.attempts, [V3_KEY, V3_KEY, V3_KEY, V3_KEY]);
});

test('An explicit whole-profile reset rejects a concurrently edited role that was inherited when opened', async (t) => {
  const storage = createStorage({ [V2_KEY]: v2Record() });
  const app = mountTheme(t, storage, 'dark');
  const opening = app.current.advancedAppearanceChoices;
  const reset = resetAdvancedPaletteProfile(opening, 'dark');
  const apply = app.current.applyAdvancedAppearanceChoices;
  assert.equal(apply(opening, editAdvancedPaletteRole(opening, 'dark', 'border', '#626DA0')).ok, true);
  assert.match(apply(opening, reset).message, /changed while/);
  await app.settle();
  assert.equal(app.current.advancedAppearanceChoices.custom.dark.colors.border, '#626DA0');
  assert.deepEqual(storage.attempts, [V3_KEY]);
});

test('Invalid draft and failed commits leave active profiles intact while real no-ops write nothing', async (t) => {
  const storage = createStorage({ [V2_KEY]: v2Record() });
  const app = mountTheme(t, storage, 'dark');
  const opening = app.current.advancedAppearanceChoices;
  const apply = app.current.applyAdvancedAppearanceChoices;
  const changed = editAdvancedPaletteRole(opening, 'dark', 'accent', '#ABCDEF');
  const reverted = editAdvancedPaletteRole(changed, 'dark', 'accent', opening.custom.dark.colors.accent);
  assert.equal(apply(opening, reverted).ok, true);
  assert.match(apply(opening, editAdvancedPaletteRole(opening, 'light', 'accent', 'bad')).message, /HEX/);
  assert.match(apply(opening, editAdvancedPaletteRole(opening, 'dark', 'background', '#FFFFFF')).message, /range/);
  assert.deepEqual(storage.attempts, []);
  storage.failWrite = true;
  assert.match(apply(opening, changed).message, /Try again/);
  await app.settle();
  assert.equal(app.current.advancedAppearanceChoices, opening);
  assert.equal(app.current.theme.accent, '#254DA8');
  assert.equal(storage.get(V3_KEY), null);
  storage.failWrite = false;
  assert.equal(apply(opening, changed).ok, true);
  assert.equal(apply(opening, changed).ok, true);
  await app.settle();
  assert.deepEqual(storage.attempts, [V3_KEY, V3_KEY]);
  assert.equal(storage.writes.length, 1);
  assert.equal(changed.custom.dark.colors.accent, '#ABCDEF');
});
