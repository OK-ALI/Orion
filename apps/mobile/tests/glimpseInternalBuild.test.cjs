'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loader, read } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const { internalPreviewTransform } = require('../scripts/glimpse-internal-transform.cjs');
const prefix = 'apps/mobile/src/features/glimpse/';

test('Stage fits complete landscape, portrait, 4:3, cinematic and arbitrary valid dimensions without cropping', () => {
  const { fitGlimpseMedia } = loader()(prefix + 'glimpseLayout.ts');
  for (const box of [{ width: 360, height: 580 }, { width: 700, height: 280 }]) {
    for (const source of [{ width: 1920, height: 1080 }, { width: 1080, height: 1920 },
      { width: 640, height: 480 }, { width: 2390, height: 1000 }, { width: 853, height: 1137 }]) {
      const fit = fitGlimpseMedia(box, source);
      assert.ok(fit.width <= box.width + 1e-9 && fit.height <= box.height + 1e-9);
      assert.ok(Math.abs(fit.width / fit.height - source.width / source.height) < 1e-9);
      assert.ok(Math.abs(fit.width - box.width) < 1e-9 || Math.abs(fit.height - box.height) < 1e-9);
    }
  }
  assert.deepEqual(fitGlimpseMedia({ width: 0, height: 800 }, { width: 4, height: 3 }), { width: 0, height: 0 });
});

test('unknown source dimensions use available provider bounds rather than inventing 16:9 or artwork geometry', () => {
  const { fitGlimpseMedia } = loader()(prefix + 'glimpseLayout.ts');
  const bounds = { width: 380, height: 610 };
  for (const unknown of [null, undefined, { width: NaN, height: 1 }, { width: 1, height: 0 }]) {
    assert.deepEqual(fitGlimpseMedia(bounds, unknown), bounds);
  }
  assert.match(read(prefix + 'GlimpseStage.tsx'), /fitGlimpseMedia\(bounds, reel.video.dimensions\)/);
  assert.doesNotMatch(read(prefix + 'GlimpseStage.tsx'), /16\s*\/\s*9|9\s*\/\s*16/);
});

test('Android window occlusion, background and foreground release media until both focus and AppState recover', async () => {
  const harness = hookHarness(); const listeners = new Map();
  const AppState = { currentState: 'active', addEventListener: (name, listener) => {
    listeners.set(name, listener); return { remove: () => listeners.delete(name) };
  } };
  const hook = loader({ react: harness.react, 'react-native': { AppState, Platform: { OS: 'android' } } })(prefix + 'useGlimpseForeground.ts').useGlimpseForeground;
  harness.start(() => hook()); assert.equal(harness.result, true);
  listeners.get('blur')(); await harness.settle(); assert.equal(harness.result, false);
  AppState.currentState = 'background'; listeners.get('change')('background'); await harness.settle();
  listeners.get('focus')(); await harness.settle(); assert.equal(harness.result, false);
  AppState.currentState = 'active'; listeners.get('change')('active'); await harness.settle(); assert.equal(harness.result, true);
  listeners.get('blur')(); AppState.currentState = 'active'; listeners.get('change')('active');
  await harness.settle(); assert.equal(harness.result, false);
  listeners.get('focus')(); await harness.settle(); assert.equal(harness.result, true);
  harness.dispose(); assert.equal(listeners.size, 0);
});

test('internal preview transform requires its explicit build condition and changes only the Glimpse build constant', () => {
  const target = path.resolve(__dirname, '../src/features/glimpse/glimpseBuild.ts');
  const args = { filename: target, src: read(prefix + 'glimpseBuild.ts'), options: { dev: false } };
  assert.equal(internalPreviewTransform(args, target, false), args);
  const internal = internalPreviewTransform(args, target, true);
  assert.match(internal.src, /GLIMPSE_INTERNAL_PREVIEW = true/);
  assert.match(args.src, /GLIMPSE_INTERNAL_PREVIEW = false/);
  const existing = { ...args, filename: path.resolve(__dirname, '../app/player/[id].tsx') };
  assert.equal(internalPreviewTransform(existing, target, true), existing);
  assert.throws(() => internalPreviewTransform({ ...args, src: args.src + args.src }, target, true));
  assert.throws(() => internalPreviewTransform({ ...args, src: 'export const GLIMPSE_INTERNAL_PREVIEW = true;' }, target, true));
});

test('normal production ignores preview environment variables; only the dedicated internal constant admits this test APK', () => {
  const previousDev = global.__DEV__;
  const previousPreview = process.env.EXPO_PUBLIC_GLIMPSE_PREVIEW;
  const previousInternal = process.env.ORION_GLIMPSE_INTERNAL_PREVIEW_BUILD;
  try {
    global.__DEV__ = false; process.env.EXPO_PUBLIC_GLIMPSE_PREVIEW = 'true'; process.env.ORION_GLIMPSE_INTERNAL_PREVIEW_BUILD = '1';
    assert.equal(loader({ './glimpseBuild': { GLIMPSE_INTERNAL_PREVIEW: false, GLIMPSE_PRODUCTION_ENABLED: false } })(prefix + 'glimpsePreview.ts').isGlimpsePreviewEnabled(), false);
    assert.equal(loader({ './glimpseBuild': { GLIMPSE_INTERNAL_PREVIEW: true } })(prefix + 'glimpsePreview.ts').isGlimpsePreviewEnabled(), true);
  } finally {
    if (previousDev === undefined) delete global.__DEV__; else global.__DEV__ = previousDev;
    if (previousPreview === undefined) delete process.env.EXPO_PUBLIC_GLIMPSE_PREVIEW; else process.env.EXPO_PUBLIC_GLIMPSE_PREVIEW = previousPreview;
    if (previousInternal === undefined) delete process.env.ORION_GLIMPSE_INTERNAL_PREVIEW_BUILD; else process.env.ORION_GLIMPSE_INTERNAL_PREVIEW_BUILD = previousInternal;
  }
});
