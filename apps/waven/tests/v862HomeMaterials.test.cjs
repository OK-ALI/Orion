const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const app = path.resolve(__dirname, '..');

require.extensions['.ts'] = (record, file) => {
  const compiled = ts.transpileModule(
    fs.readFileSync(file, 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;

  record._compile(compiled, file);
};

const {
  resolveHomeMaterialStyles,
  mixHomeMaterialColor,
  resolveHomePageMaterial,
  normalizeHomeMaterialProgress,
} = require('../src/theme/homeMaterialPreview.ts');

const read = relative =>
  fs.readFileSync(path.join(app, relative), 'utf8');

test('outside the preview original NOIR styles remain identical', () => {
  const base = {
    heroTitle: { color: '#FFFFFF', fontSize: 28 },
    heroAction: { backgroundColor: '#000000' },
  };

  assert.equal(resolveHomeMaterialStyles(base, 'home', null), base);
});

test('day and night materials adapt without changing Hero geometry', () => {
  const base = {
    hero: {
      backgroundColor: 'transparent',
      padding: 16,
    },
    heroTitle: {
      color: '#FFFFFF',
      textAlign: 'center',
      fontSize: 28,
    },
    heroAction: {
      backgroundColor: '#000000',
      minHeight: 42,
    },
    recentState: {
      borderWidth: 1,
      padding: 10,
    },
  };

  const day = resolveHomeMaterialStyles(base, 'home', 'hikari');
  const night = resolveHomeMaterialStyles(base, 'home', 'hikari-night');

  assert.equal(day.heroTitle.color, '#153247');
  assert.equal(night.heroTitle.color, '#F2F7FF');
  assert.notEqual(day.heroAction.backgroundColor, night.heroAction.backgroundColor);

  for (const result of [day, night]) {
    assert.equal(result.hero, base.hero);
    assert.equal(result.heroTitle.textAlign, 'center');
    assert.equal(result.heroTitle.fontSize, 28);
    assert.equal(result.heroAction.minHeight, 42);
    assert.equal(result.recentState.padding, 10);
    assert.equal(result.recentState.borderColor, 'transparent');
  }

  assert.equal(base.heroTitle.color, '#FFFFFF');
});

test('connection and music typography use scoped adaptive materials', () => {
  const base = {
    title: { fontSize: 18 },
    accent: { fontSize: 18 },
    rowTitle: { fontSize: 14 },
    subtitle: { fontSize: 12 },
  };

  const day = resolveHomeMaterialStyles(base, 'section', 'hikari');
  const night = resolveHomeMaterialStyles(base, 'section', 'hikari-night');

  assert.equal(day.title.color, '#153247');
  assert.equal(night.title.color, '#F2F7FF');

  const row = resolveHomeMaterialStyles(base, 'library', 'hikari');

  assert.equal(row.rowTitle.color, '#153247');
  assert.equal(row.subtitle.color, '#3C5266');
  assert.equal(row.rowTitle.fontSize, 14);
});

test('material changes follow celestial progress and use a seamless full-width fade', () => {
  const scene = read('src/components/surfaces/WavenHomeScenePreview.tsx');
  const shell = read('src/components/shell/WavenAppShell.tsx');
  const home = read('app/index.tsx');

  const owner = read('src/theme/previewCelestialController.tsx');
  assert.match(owner, /useAnimatedReaction\(/);
  assert.match(owner, /Math\.round\([\s\S]*?progress\.value[\s\S]*?\* 48\)/);
  assert.match(owner, /runOnJS\(setMaterialStep\)\(current\)/);

  assert.match(scene, /WavenHomeMaterialContext\.Provider/);
  assert.match(scene, /<WavenMaterialFade/);
  assert.match(scene, /left: -gutter/);
  assert.match(scene, /right: -gutter/);
  assert.match(scene, /pointerEvents="none"/);

  assert.match(home, /<WavenHomeMaterialContent base=\{styles\}/);
  assert.match(home, /<WavenAppShell brandTagline>/);
  assert.match(home, /trackPlayback\.play\(latestPlay\)/);
  assert.match(home, /library\.state\.history\.slice\(0, 5\)/);

  assert.match(shell, /EXPO_PUBLIC_WAVEN_HOME_ANIME_PREVIEW === '1'/);
  assert.match(shell, /ref=\{scrollRef\}/);
  assert.doesNotMatch(scene, /trackPlayback|libraryRuntime|SecureStore/);
});

test('continuous progress preserves exact accepted theme endpoints', () => {
  const base = {
    heroTitle: { color: '#FFFFFF', fontSize: 28, textAlign: 'center' },
    heroAction: { backgroundColor: '#000000', minHeight: 42 },
    hero: { backgroundColor: 'transparent', padding: 16 },
  };

  assert.deepEqual(
    resolveHomeMaterialStyles(base, 'home', 0),
    resolveHomeMaterialStyles(base, 'home', 'hikari'),
  );

  assert.deepEqual(
    resolveHomeMaterialStyles(base, 'home', 1),
    resolveHomeMaterialStyles(base, 'home', 'hikari-night'),
  );

  const middle = resolveHomeMaterialStyles(base, 'home', 0.5);

  assert.equal(middle.heroTitle.fontSize, 28);
  assert.equal(middle.heroTitle.textAlign, 'center');
  assert.equal(middle.heroAction.minHeight, 42);
  assert.equal(middle.hero, base.hero);
});

test('material transitions are progressive and reversible', () => {
  const base = {
    heroTitle: { color: '#FFFFFF' },
    heroAction: { backgroundColor: '#000000' },
  };

  const forward = Array.from(
    { length: 49 },
    (_, index) => resolveHomeMaterialStyles(base, 'home', index / 48),
  );

  assert.ok(new Set(forward.map(x => x.heroTitle.color)).size > 30);
  assert.ok(new Set(forward.map(x => x.heroAction.backgroundColor)).size > 30);

  const reverse = Array.from(
    { length: 49 },
    (_, index) => resolveHomeMaterialStyles(base, 'home', (48 - index) / 48),
  );

  assert.deepEqual(forward, reverse.reverse());

  assert.equal(normalizeHomeMaterialProgress(-1), 0);
  assert.equal(normalizeHomeMaterialProgress(2), 1);
  assert.equal(normalizeHomeMaterialProgress(NaN), 0);
});

test('content fades retain surface hue and reveal more scenery', () => {
  assert.equal(
    mixHomeMaterialColor('transparent', '#FFFFFF', 0.5),
    'rgba(255,255,255,0.500)',
  );

  assert.equal(
    resolveHomePageMaterial(0).background,
    'rgba(244,250,255,0.84)',
  );

  assert.equal(
    resolveHomePageMaterial(1).background,
    'rgba(8,25,44,0.88)',
  );

  const middle = resolveHomePageMaterial(0.5);

  assert.notEqual(middle.background, resolveHomePageMaterial(0).background);
  assert.notEqual(middle.background, resolveHomePageMaterial(1).background);

  assert.match(middle.transparent, /,0\.000\)$/);
});


test('phone celestial composition is compact without shrinking artwork', () => {
  const scene = read('src/components/surfaces/WavenHomeScenePreview.tsx');

  assert.match(scene, /tabletLike \? null : \{ height: 124 \}/);
  assert.match(scene, /celestialTarget: \{[\s\S]*?width: 150,[\s\S]*?height: 150,/);
  assert.match(scene, /sunHalo: \{[\s\S]*?width: 124,[\s\S]*?height: 124,/);
  assert.match(scene, /moonHalo: \{[\s\S]*?width: 124,[\s\S]*?height: 124,/);

  assert.match(scene, /onPress=\{toggleTheme\}/);
  assert.match(scene, /materialStep \/ 48/);
});

test('compact header is scoped to phone anime preview only', () => {
  const shell = read('src/components/shell/WavenAppShell.tsx');
  const home = read('app/index.tsx');

  assert.match(
    shell,
    /headerControl && !layout\.isTabletLike \? \{ paddingBottom: 12 \} : null/,
  );

  assert.match(shell, /wordmarkRowWithTagline: \{[\s\S]*?paddingBottom: 42,/);
  assert.match(shell, /ref=\{scrollRef\}/);
  assert.match(home, /heroPhone: \{[\s\S]*?alignItems: 'center'/);
  assert.match(home, /trackPlayback\.play\(latestPlay\)/);
});
