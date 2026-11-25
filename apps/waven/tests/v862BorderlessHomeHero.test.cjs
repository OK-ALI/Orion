const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(
  path.resolve(__dirname, '../app/index.tsx'),
  'utf8'
);

function style(name) {
  const pattern = new RegExp(
    '^  ' + name + ': \\{[\\s\\S]*?^  \\},',
    'm'
  );

  const result = home.match(pattern);
  assert.ok(result, `Missing style: ${name}`);

  return result[0];
}

test('Home Hero removes visible enclosure without changing layout', () => {
  const hero = style('hero');

  assert.match(hero, /backgroundColor: 'transparent'/);
  assert.match(hero, /borderColor: 'transparent'/);
  assert.match(hero, /padding: wavenSpacing\.md/);
  assert.match(hero, /borderWidth: StyleSheet\.hairlineWidth/);

  assert.match(style('heroPhone'), /alignItems: 'center'/);
  assert.match(style('heroCopy'), /alignItems: 'center'/);
  assert.match(style('heroTitle'), /textAlign: 'center'/);
  assert.match(style('heroBody'), /textAlign: 'center'/);
});

test('Home retains genuine artwork and latest-play actions', () => {
  assert.match(home, /WavenLibraryHeroArtwork track=\{latestPlay\}/);
  assert.match(home, /styles\.stackLayerBack/);
  assert.match(home, /styles\.stackLayerMiddle/);
  assert.match(home, /styles\.heroBadge/);

  assert.match(home, /LAST PLAYED/);
  assert.match(home, /YOUR LATEST PLAY/);
  assert.match(home, /Replay Song/);
  assert.match(home, /Explore Music/);

  assert.match(home, /trackPlayback\.play\(latestPlay\)/);
  assert.match(home, /router\.navigate\('\/search'\)/);
  assert.match(home, /library\.state\.history\.slice\(0, 5\)/);
  assert.match(home, /Recently Played/);
  assert.match(home, /Trending Now/);
  assert.match(home, /New Releases/);

  assert.doesNotMatch(
    home,
    /glassTopHighlight\} \/>\s*<View\s+style=\{\[\s*styles\.heroVisual,/
  );
});