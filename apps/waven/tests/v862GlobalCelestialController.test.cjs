const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = path.resolve(__dirname, '..');
const read = relative =>
  fs.readFileSync(path.join(app, relative), 'utf8');

const owner = read('src/theme/previewCelestialController.tsx');
const scene = read('src/components/surfaces/WavenHomeScenePreview.tsx');
const layout = read('app/_layout.tsx');

test('global preview controller owns the single celestial timeline', () => {
  assert.equal(
    (owner.match(/useSharedValue\(0\)/g) || []).length,
    1,
  );

  assert.match(owner, /function toggleTheme\(\)/);
  assert.match(owner, /cancelAnimation\(progress\)/);
  assert.match(owner, /celestialDuration/);
  assert.match(owner, /AppState\.addEventListener/);
  assert.match(owner, /useWavenReducedMotion\(true\)/);

  assert.doesNotMatch(scene, /useSharedValue\(0\)/);
  assert.doesNotMatch(scene, /function toggleTheme\(\)/);
});

test('root owner is development-only and outside navigation content', () => {
  assert.match(layout, /EXPO_PUBLIC_WAVEN_HOME_ANIME_PREVIEW === '1'/);

  assert.match(
    layout,
    /<WavenPreviewCelestialProvider>\s*<WavenRootNavigationContent \/>\s*<\/WavenPreviewCelestialProvider>/,
  );

  assert.match(
    layout,
    /return <WavenRootNavigationContent \/>/,
  );

  assert.match(
    layout,
    /\{showPrimaryNavigation \? <WavenMiniPlayer \/> : null\}/,
  );

  assert.match(
    layout,
    /\{showPrimaryNavigation \? <WavenBottomNav \/> : null\}/,
  );
});

test('Home consumes shared progress without creating new playback ownership', () => {
  assert.match(scene, /useRequiredPreviewCelestial\(\)/);
  assert.match(scene, /materialStep \/ 48/);
  assert.match(scene, /onPress=\{toggleTheme\}/);
  assert.match(owner, /export function useOptionalPreviewCelestial/);
  assert.match(owner, /createContext<PreviewCelestialController \| null>\(null\)/);

  assert.doesNotMatch(
    owner,
    /trackPlayback|nativePlayback|libraryRuntime|SecureStore|MMKV/,
  );

  assert.doesNotMatch(scene, /resizeMode="stretch"/);
});