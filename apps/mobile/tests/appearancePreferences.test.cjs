"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loader } = require("./helpers/animeModules.cjs");
const { hookHarness } = require("./helpers/playerHookHarness.cjs");

const LEGACY_KEY = "mobileThemePreferencesV1";
const V2_KEY = "mobileThemePreferencesV2";
const { loadThemePreferences, resolveThemeSelection } = loader()(
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
  assert.deepEqual(storage.attempts, [V2_KEY]);
  assert.equal(storage.writes[0][1].darkTheme, "amoled");
  assert.equal(storage.writes[0][1].customAccent, "#445566");
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
  assert.deepEqual(storage.attempts, [V2_KEY, V2_KEY]);

  const custom = restarted.current.setCustomAccent("#00ff00");
  assert.equal(custom, true);
  await restarted.settle();
  assert.equal(restarted.current.theme.accent, "#00FF00");
  assert.equal(restarted.current.theme.accentSoft, "rgba(0,255,0,0.16)");
  assert.equal(restarted.current.theme.onAccent, "#000000");
  assert.equal(restarted.current.setCustomAccent("#bad"), false);
  assert.deepEqual(storage.attempts, [V2_KEY, V2_KEY, V2_KEY]);
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
  assert.deepEqual(storage.attempts, [V2_KEY]);
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
  assert.equal(JSON.parse(storage.get(V2_KEY)).customAccent, "#FFFFFF");
  assert.equal(storage.get(LEGACY_KEY), rawV1);
});
