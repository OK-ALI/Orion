const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const previous = require.extensions['.ts'];

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(
    fs.readFileSync(filename, 'utf8'),
    {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText, filename);
};

let artwork;

try {
  artwork = require('../src/theme/previewArtwork.ts');
} finally {
  if (previous) require.extensions['.ts'] = previous;
  else delete require.extensions['.ts'];
}

const read = name => fs.readFileSync(
  path.join(__dirname, '..', name), 'utf8',
);

test('V8.6.2B-R1 preserves NOIR and provides distinct original scene assets', () => {
  assert.equal(artwork.getPreviewArtwork('noir'), null);

  const day = artwork.getPreviewArtwork('hikari');
  const night = artwork.getPreviewArtwork('hikari-night');

  assert.notEqual(day, night);

  for (const uri of [day, night]) {
    assert.ok(uri.startsWith('data:image/svg+xml;charset=utf-8,'));

    const svg = decodeURIComponent(uri.split(',')[1]);

    assert.match(svg, /<svg\b/);
    assert.match(svg, /viewBox="0 0 960 600"/);
    assert.match(svg, /<\/svg>$/);
    assert.doesNotMatch(svg, /<script|<image|foreignObject|href=/i);
  }
});

test('V8.6.2B-R1 environments contain detailed independent compositions', () => {
  const day = decodeURIComponent(
    artwork.getPreviewArtwork('hikari').split(',')[1],
  );

  const night = decodeURIComponent(
    artwork.getPreviewArtwork('hikari-night').split(',')[1],
  );

  assert.match(day, /Coastal railway perspective/);
  assert.match(night, /Deep architectural perspective/);
  assert.match(night, /Wet pavement reflections/);

  assert.ok((day.match(/<path\b/g) || []).length >= 20);
  assert.ok((night.match(/<path\b/g) || []).length >= 20);
});

test('V8.6.2B-R1 music presentation remains isolated and truthful', () => {
  const route = read('app/appearance-preview.tsx');

  assert.match(route, /SAMPLE_TRACKS/);
  assert.match(route, /SAMPLE PLAYER/);
  assert.match(route, /Design preview only/);
  assert.match(route, /Platform.OS === 'web'/);
  assert.match(route, /if \(!__DEV__\) return <Redirect/);

  assert.doesNotMatch(
    route,
    /nativePlayback|trackPlayback|getWavenAppearanceStore|libraryRuntime/,
  );
});

test('V8.6.2B-R1 art reveal supports interruption and Reduced Motion', () => {
  const route = read('app/appearance-preview.tsx');

  assert.match(route, /useWavenReducedMotion\(true\)/);
  assert.match(route, /reveal\.stopAnimation\(\)/);
  assert.match(route, /animation\.stop\(\)/);
  assert.match(route, /useNativeDriver: true/);
  assert.match(route, /if \(reducedMotion\)/);
});
