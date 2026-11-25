const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (record, file) => {
  record._compile(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    file,
  );
};

const {
  resolvePreviewMiniPlayerAppearance: resolve,
} = require('../src/theme/previewChromeMaterials.ts');

const base = {
  outer: { width: '100%', paddingHorizontal: 16 },
  panel: {
    backgroundColor: '#000000',
    borderRadius: 24,
    minHeight: 84,
    overflow: 'hidden',
  },
  title: { color: '#FFFFFF', fontSize: 13 },
  artist: { color: '#AAAAAA', fontSize: 12 },
  control: { width: 48, height: 48 },
  playIcon: { borderLeftColor: '#FFFFFF', borderLeftWidth: 11 },
  pauseBar: { backgroundColor: '#FFFFFF', height: 16 },
  waveBarPlayed: { backgroundColor: '#2699DF' },
  topHighlight: { height: 1 },
  artworkImage: { width: '100%', height: '100%' },
};

test('normal NOIR returns the exact original styles', () => {
  const result = resolve(base, null);

  assert.equal(result.styles, base);
  assert.equal(result.highlight, null);
});

test('day and night use adaptive materials while preserving player geometry', () => {
  const day = resolve(base, 0);
  const night = resolve(base, 1);

  assert.equal(day.styles.title.color, '#153247');
  assert.equal(night.styles.title.color, '#F2F7FF');

  assert.notEqual(
    day.styles.panel.backgroundColor,
    night.styles.panel.backgroundColor,
  );

  for (const result of [day, night]) {
    assert.equal(result.styles.panel.minHeight, 84);
    assert.equal(result.styles.panel.borderRadius, 26);
    assert.equal(result.styles.control.width, 48);
    assert.equal(result.styles.control.height, 48);
    assert.equal(result.styles.artworkImage, base.artworkImage);
    assert.equal(result.styles.outer, base.outer);
    assert.equal(result.styles.panel.borderColor, 'transparent');
    assert.equal(result.highlight.length, 2);
  }

  assert.equal(base.panel.borderRadius, 24);
});

test('mini-player materials interpolate and reverse with celestial progress', () => {
  const forward = Array.from(
    { length: 49 },
    (_, index) => resolve(base, index / 48),
  );

  const reverse = Array.from(
    { length: 49 },
    (_, index) => resolve(base, (48 - index) / 48),
  );

  assert.deepEqual(forward, reverse.reverse());

  assert.ok(
    new Set(forward.map(x => x.styles.title.color)).size > 30,
  );

  assert.ok(
    new Set(forward.map(x => x.styles.panel.backgroundColor)).size > 30,
  );

  assert.ok(
    new Set(forward.map(x => x.styles.waveBarPlayed.backgroundColor)).size > 30,
  );
});

test('actual player consumes shared material progress without another timeline', () => {
  const app = path.resolve(__dirname, '..');

  const read = relative =>
    fs.readFileSync(path.join(app, relative), 'utf8');

  const owner = read('src/theme/previewCelestialController.tsx');
  const mini = read('src/components/player/WavenMiniPlayer.tsx');
  const material = read('src/theme/previewChromeMaterials.ts');

  assert.match(
    owner,
    /WavenPreviewChromeContext\.Provider value=\{controller\.materialStep \/ 48\}/,
  );

  assert.match(mini, /useMiniPlayerAppearance\(noirStyles\)/);
  assert.match(mini, /<PreviewHighlight/);
  assert.match(mini, /EXPO_PUBLIC_WAVEN_HOME_ANIME_PREVIEW === '1'/);
  assert.match(mini, /subscribeNativePlayback/);
  assert.match(mini, /await nativePlayback\.pause\(\)/);
  assert.match(mini, /await resumeWavenNativeTrack\(\)/);
  assert.match(mini, /playedClipTranslateX/);
  assert.match(mini, /titleMarqueeUnitWidth/);

  assert.doesNotMatch(
    material,
    /withTiming|useSharedValue|setInterval|nativePlayback|trackPlayback/,
  );
});