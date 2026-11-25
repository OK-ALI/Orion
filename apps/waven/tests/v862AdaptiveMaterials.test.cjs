const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const appRoot = path.resolve(__dirname, '..');

const source = fs.readFileSync(
  path.join(appRoot, 'src/theme/adaptiveMaterials.ts'),
  'utf8',
);

const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText;

const exportsObject = {};

new Function('exports', compiled)(exportsObject);

const {
  resolveWavenMaterial,
  wavenMaterialGeometry,
} = exportsObject;

const themes = ['noir', 'hikari', 'hikari-night'];
const roles = ['panel', 'floating', 'navigation', 'sheet'];

function rgb(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

function luminance(channels) {
  const linear = channels.map(value => {
    const s = value / 255;
    return s <= 0.04045
      ? s / 12.92
      : ((s + 0.055) / 1.055) ** 2.4;
  });

  return (
    linear[0] * 0.2126 +
    linear[1] * 0.7152 +
    linear[2] * 0.0722
  );
}

function contrast(left, right) {
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) /
    (Math.min(a, b) + 0.05);
}

test('each identity provides distinct adaptive material colors', () => {
  const bases = themes.map(
    theme => resolveWavenMaterial(theme, 'navigation').base,
  );

  assert.equal(new Set(bases).size, 3);

  assert.equal(
    resolveWavenMaterial('hikari', 'navigation').base,
    '#F4FAFF',
  );
});

test('rounded geometry stays consistent between themes', () => {
  for (const role of roles) {
    for (const theme of themes) {
      assert.equal(
        resolveWavenMaterial(theme, role).radius,
        wavenMaterialGeometry[role],
      );
    }
  }

  assert.equal(wavenMaterialGeometry.minimumTouchTarget, 48);
  assert.equal(wavenMaterialGeometry.navigation, 999);
  assert.ok(wavenMaterialGeometry.panel >= 20);
});

test('solid rendering is the default and unknown inputs fail safely', () => {
  const defaultMaterial = resolveWavenMaterial('noir', 'panel');

  assert.equal(defaultMaterial.opacity, 1);
  assert.equal(defaultMaterial.background, defaultMaterial.base);
  assert.ok(Object.isFrozen(defaultMaterial));

  const fallback = resolveWavenMaterial(
    'unknown', 'unknown', 'unknown',
  );

  assert.equal(fallback.theme, 'noir');
  assert.equal(fallback.role, 'panel');
  assert.equal(fallback.rendering, 'solid');
});

test('text roles meet contrast targets over extreme backdrops', () => {
  for (const theme of themes) {
    for (const role of roles) {
      for (const rendering of ['solid', 'translucent']) {
        const material = resolveWavenMaterial(
          theme, role, rendering,
        );

        // Model composition over both black and white.
        // Also include the maximum decorative highlight alpha.
        const highlight = material.highlight
          .match(/rgba\(([^)]+)\)/)[1]
          .split(',')
          .map(Number);

        for (const backdrop of [0, 255]) {
          const composite = rgb(material.base).map(
            channel =>
              channel * material.opacity +
              backdrop * (1 - material.opacity),
          );

          const highlighted = composite.map(
            (channel, i) =>
              channel * (1 - highlight[3]) +
              highlight[i] * highlight[3],
          );

          for (const foreground of [
            material.text,
            material.secondaryText,
            material.accent,
          ]) {
            for (const background of [composite, highlighted]) {
              const ratio = contrast(rgb(foreground), background);

              assert.ok(
                ratio >= 4.5,
                `${theme}/${role}/${rendering}: ${ratio}`,
              );
            }
          }
        }
      }
    }
  }
});

test('native material primitives preserve decorative boundaries', () => {
  const component = fs.readFileSync(
    path.join(
      appRoot,
      'src/components/surfaces/WavenAdaptiveSurface.tsx',
    ),
    'utf8',
  );

  assert.match(component, /export function WavenAdaptiveSurface/);
  assert.match(component, /export function WavenMaterialFade/);
  assert.match(component, /borderRadius: material.radius/);
  assert.match(component, /material.transparent/);
  assert.match(component, /pointerEvents="none"/);
  assert.match(component, /StyleSheet.absoluteFill/);

  assert.doesNotMatch(
    component,
    /absoluteFillObject|BlurView|expo-blur|backdropFilter|setInterval/,
  );
});