const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(
  path.join(__dirname, '../src/theme/celestialShift.ts'),
  'utf8',
);

const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const record = { exports: {} };
new Function('module', 'exports', output)(
  record,
  record.exports,
);

const {
  createCelestialShift,
  beginCelestialDrag,
  updateCelestialDrag,
  finishCelestialDrag,
  cancelCelestialDrag,
  resolveCelestialPolicy,
} = record.exports;

test('Celestial Shift initializes exact endpoints and excludes NOIR', () => {
  assert.equal(createCelestialShift('hikari').progress, 0);
  assert.equal(createCelestialShift('hikari-night').progress, 1);
  assert.throws(() => createCelestialShift('noir'));
});

test('Celestial Shift clamps finite drag progress', () => {
  const state = beginCelestialDrag(
    createCelestialShift('hikari'),
  );
  const g = state.generation;

  assert.equal(updateCelestialDrag(state, g, -2).progress, 0);
  assert.equal(updateCelestialDrag(state, g, 2).progress, 1);
  assert.equal(updateCelestialDrag(state, g, 0.42).progress, 0.42);
  assert.equal(state.progress, 0);
});

test('Celestial Shift rejects invalid progress', () => {
  const state = beginCelestialDrag(
    createCelestialShift('hikari'),
  );

  for (const value of [NaN, Infinity, -Infinity]) {
    assert.equal(
      updateCelestialDrag(state, state.generation, value),
      state,
    );
  }
});

test('Celestial Shift rejects obsolete gesture events', () => {
  const first = beginCelestialDrag(
    createCelestialShift('hikari'),
  );
  const second = beginCelestialDrag(first);

  assert.equal(
    updateCelestialDrag(second, first.generation, 1),
    second,
  );
  assert.equal(
    finishCelestialDrag(second, first.generation),
    second,
  );
  assert.equal(
    cancelCelestialDrag(second, first.generation),
    second,
  );
});

test('Celestial Shift settles to correct endpoints in both directions', () => {
  for (const [origin, progress, destination] of [
    ['hikari', 0.8, 'hikari-night'],
    ['hikari-night', 0.2, 'hikari'],
    ['hikari', 0.5, 'hikari'],
    ['hikari-night', 0.5, 'hikari-night'],
  ]) {
    let state = beginCelestialDrag(
      createCelestialShift(origin),
    );
    const g = state.generation;
    state = updateCelestialDrag(state, g, progress);
    state = finishCelestialDrag(state, g);

    assert.equal(state.theme, destination);
    assert.equal(state.dragging, false);
    assert.equal(
      state.progress,
      destination === 'hikari' ? 0 : 1,
    );
    assert.equal(updateCelestialDrag(state, g, 0.3), state);
  }
});

test('Celestial Shift cancellation restores original appearance', () => {
  for (const theme of ['hikari', 'hikari-night']) {
    let state = beginCelestialDrag(
      createCelestialShift(theme),
    );

    const g = state.generation;
    state = updateCelestialDrag(state, g, 0.45);
    state = cancelCelestialDrag(state, g);

    assert.equal(state.theme, theme);
    assert.equal(state.dragging, false);
    assert.equal(state.progress, theme === 'hikari' ? 0 : 1);
  }
});

test('Celestial Shift Auto defaults conservatively and accepts resolved tier', () => {
  const base = {
    preference: 'auto',
    motion: 'expressive',
    systemReducedMotion: false,
  };

  assert.equal(
    resolveCelestialPolicy(base).transition,
    'crossfade',
  );
  assert.equal(
    resolveCelestialPolicy({
      ...base,
      autoTier: 'balanced',
    }).transition,
    'celestial',
  );
  assert.equal(
    resolveCelestialPolicy({
      ...base,
      autoTier: 'enhanced',
    }).transition,
    'layered',
  );
});

test('Celestial Shift manual performance respects safety ceiling', () => {
  const base = {
    preference: 'enhanced',
    motion: 'expressive',
    systemReducedMotion: false,
  };

  const limited = resolveCelestialPolicy({
    ...base,
    safetyCeiling: 'battery-saver',
  });

  assert.equal(limited.effectiveTier, 'battery-saver');
  assert.equal(limited.transition, 'crossfade');
  assert.equal(limited.atmosphericLayers, false);

  assert.equal(
    resolveCelestialPolicy(base).transition,
    'layered',
  );
  assert.equal(
    resolveCelestialPolicy({
      ...base,
      motion: 'subtle',
    }).transition,
    'celestial',
  );
});

test('Celestial Shift Reduced Motion overrides every profile', () => {
  for (const preference of [
    'auto',
    'battery-saver',
    'balanced',
    'enhanced',
  ]) {
    for (const settings of [
      { motion: 'reduced', systemReducedMotion: false },
      { motion: 'expressive', systemReducedMotion: true },
    ]) {
      const policy = resolveCelestialPolicy({
        preference,
        autoTier: 'enhanced',
        ...settings,
      });

      assert.equal(policy.transition, 'instant');
      assert.equal(policy.atmosphericLayers, false);
      assert.equal(policy.tapDurationMs, 0);
      assert.equal(policy.settleDurationMs, 0);
    }
  }
});