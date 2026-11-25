const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const read = file => fs.readFileSync(
  path.join(root, file), 'utf8',
).replaceAll('\r\n', '\n');

const shell = read('src/components/shell/WavenAppShell.tsx');
const scene = read('src/components/surfaces/WavenHomeScenePreview.tsx');
const laboratory = read('app/celestial-preview.tsx');
const home = read('app/index.tsx');

test('actual Home environment remains development-only', () => {
  assert.match(shell, /typeof __DEV__ !== 'undefined'/);
  assert.match(shell, /__DEV__ &&/);
  assert.match(shell, /brandTagline &&/);
  assert.match(shell, /EXPO_PUBLIC_WAVEN_HOME_ANIME_PREVIEW === '1'/);
  assert.match(shell, /environment \?\? <WavenAtmosphericCanvas \/>/);
  assert.match(shell, /return renderShell\(\)/);
});

test('approved celestial behavior and visual assets are reused', () => {
  function motion(source) {
    const start = source.indexOf('function toggleTheme()');
    const end = source.includes('function usePreviewCelestialController()')
      ? source.indexOf('useAnimatedReaction(', start)
      : source.indexOf('const nightStyle', start);

    assert.ok(start >= 0 && end > start);

    return source.slice(start, end).replace(/\s+/g, '');
  }

  const controller = read('src/theme/previewCelestialController.tsx');
  assert.equal(motion(controller), motion(laboratory));

  assert.match(scene, /hikari-environment-day\.jpg/);
  assert.match(scene, /hikari-environment-night\.jpg/);
  assert.match(scene, /resizeMode="cover"/);
  assert.match(scene, /SKY_STARS/);
  assert.match(scene, /onPress=\{toggleTheme\}/);

  assert.doesNotMatch(
    scene, /ambientSun|ambientMoon|resizeMode="stretch"/,
  );
});

test('existing music content and scroll ownership stay intact', () => {
  assert.match(home, /<WavenAppShell brandTagline>/);
  assert.match(home, /WavenLibraryHeroArtwork track=\{latestPlay\}/);
  assert.match(home, /trackPlayback\.play\(latestPlay\)/);
  assert.match(home, /library\.state\.history\.slice\(0, 5\)/);

  assert.match(shell, /ref=\{scrollRef\}/);
  assert.match(shell, /onScrollBeginDrag=\{stopRestoration\}/);
  assert.match(shell, /<WavenConnectionStatus \/>\{children\}/);

  assert.match(scene, /render\(environment, headerControl, pageMaterial\)/);
  assert.doesNotMatch(scene, /trackPlayback|libraryRuntime|SecureStore/);
});