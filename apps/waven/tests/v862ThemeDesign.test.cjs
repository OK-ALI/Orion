const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const previous = require.extensions['.ts'];

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');

  module._compile(ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText, filename);
};

let appearance, designs;

try {
  appearance = require('../src/theme/appearance.ts');
  designs = require('../src/theme/themeDesign.ts');
} finally {
  if (previous) require.extensions['.ts'] = previous;
  else delete require.extensions['.ts'];
}

const registry = designs.WAVEN_THEME_DESIGNS;
const ids = appearance.WAVEN_THEME_IDS;

const read = relative => fs.readFileSync(
  path.join(__dirname, '..', relative),
  'utf8',
);

function luminance(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i);

  const channels = hex.slice(1).match(/../g).map(value => {
    const n = parseInt(value, 16) / 255;
    return n <= 0.04045
      ? n / 12.92
      : ((n + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126
    + channels[1] * 0.7152
    + channels[2] * 0.0722;
}

function contrast(a, b) {
  const values = [luminance(a), luminance(b)]
    .sort((a, b) => b - a);

  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('V8.6.2A provides exactly the three official theme identities', () => {
  assert.deepEqual(Object.keys(registry).sort(), [...ids].sort());

  assert.equal(registry.noir.environment, 'cinematic');
  assert.equal(registry.hikari.environment, 'daylight');
  assert.equal(registry['hikari-night'].environment, 'night-city');
});

test('V8.6.2A preserves NOIR colors and all semantic token keys', () => {
  assert.equal(registry.noir.colors, appearance.WAVEN_NOIR_COLORS);

  const keys = Object.keys(registry.noir.colors).sort();

  for (const id of ids) {
    assert.deepEqual(Object.keys(registry[id].colors).sort(), keys);
  }
});

test('V8.6.2A text meets 4.5:1 contrast on opaque principal surfaces', () => {
  for (const id of ids) {
    const colors = registry[id].colors;

    for (const foreground of [
      'textPrimary', 'textSecondary', 'textMuted',
    ]) {
      for (const background of [
        'canvas', 'surfaceSoft', 'surfaceRaised',
      ]) {
        assert.ok(
          contrast(colors[foreground], colors[background]) >= 4.5,
          `${id}: ${foreground} on ${background}`,
        );
      }
    }
  }
});

test('V8.6.2A selected controls maintain readable accent foregrounds', () => {
  for (const id of ids) {
    const design = registry[id];

    assert.ok(
      contrast(design.onAccent, design.colors.interactionBlue) >= 4.5,
      `${id}: onAccent contrast`,
    );
  }
});

test('V8.6.2A theme designs and shared palettes are immutable', () => {
  assert.ok(Object.isFrozen(registry));

  for (const id of ids) {
    const design = designs.getWavenThemeDesign(id);

    assert.equal(design, registry[id]);
    assert.ok(Object.isFrozen(design));
    assert.ok(Object.isFrozen(design.colors));
    assert.ok(Object.isFrozen(design.sky));
  }

  assert.notDeepEqual(registry.hikari.sky, registry['hikari-night'].sky);
});

test('V8.6.2A preview is isolated and respects Reduced Motion', () => {
  const preview = read('app/appearance-preview.tsx');
  const provider = read('src/theme/appearanceProvider.tsx');

  assert.match(preview, /if \(!__DEV__\) return <Redirect/);
  assert.match(preview, /useWavenReducedMotion/);
  assert.match(preview, /animation\.stop\(\)/);
  assert.match(preview, /useNativeDriver: true/);
  assert.doesNotMatch(preview, /getWavenAppearanceStore|nativePlayback|trackPlayback/);

  assert.match(provider, /renderedTheme: 'noir'/);
});
