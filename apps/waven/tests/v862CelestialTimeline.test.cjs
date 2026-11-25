const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(
  path.join(__dirname, '../src/theme/celestialTimeline.ts'),
  'utf8',
);

const route = fs.readFileSync(
  path.join(__dirname, '../app/celestial-preview.tsx'),
  'utf8',
);

const record = { exports: {} };

new Function(
  'module',
  'exports',
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
)(record, record.exports);

const {
  celestialDuration,
  celestialFrame,
} = record.exports;

test('Celestial timeline provides slow expressive and subtle timing', () => {
  assert.equal(celestialDuration('layered'), 2400);
  assert.equal(celestialDuration('celestial'), 1500);
  assert.equal(celestialDuration('crossfade'), 800);
  assert.equal(celestialDuration('instant'), 0);
});

test('Celestial duration scales with remaining transition distance', () => {
  assert.equal(celestialDuration('layered', 0.5), 1200);
  assert.equal(celestialDuration('layered', -0.5), 1200);
  assert.equal(celestialDuration('layered', 0), 0);
  assert.equal(celestialDuration('instant', 0.5), 0);
});

test('Celestial timeline has correct daylight and nighttime endpoints', () => {
  const day = celestialFrame(0);
  const night = celestialFrame(1);

  assert.equal(day.sunOpacity, 1);
  assert.equal(day.moonOpacity, 0);
  assert.equal(day.nightOpacity, 0);

  assert.equal(night.sunOpacity, 0);
  assert.equal(night.moonOpacity, 1);
  assert.equal(night.nightOpacity, 1);
});

test('Celestial timeline is deterministic and bounded throughout', () => {
  for (let i = 0; i <= 100; i++) {
    const p = i / 100;
    const frame = celestialFrame(p);

    assert.deepEqual(frame, celestialFrame(p));

    for (const key of [
      'nightOpacity', 'twilightOpacity',
      'sunOpacity', 'moonOpacity',
      'starsOpacity', 'sunGlow', 'moonGlow',
    ]) {
      assert.ok(frame[key] >= 0 && frame[key] <= 1);
    }
  }

  assert.equal(celestialFrame(-1).progress, 0);
  assert.equal(celestialFrame(2).progress, 1);
  assert.equal(celestialFrame(NaN).progress, 0);
});

test('Celestial prototype remains isolated and respects motion policy', () => {
  assert.match(route, /if \(!__DEV__\) return <Redirect/);
  assert.match(route, /useWavenReducedMotion\(true\)/);
  assert.match(route, /onPress=\{toggleTheme\}/);
  assert.match(route, /cancelAnimation\(progress\)/);
  assert.match(route, /next - progress\.value/);
  assert.match(route, /withTiming\(next/);
  assert.match(route, /subscription\.remove\(\)/);
  assert.doesNotMatch(route, /trackPlayback|appearanceStore|Media3/);
});