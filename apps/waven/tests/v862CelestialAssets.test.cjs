const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'assets', 'celestial');

const route = fs.readFileSync(
  path.join(root, 'app', 'celestial-preview.tsx'),
  'utf8',
);

test('Celestial textures are valid bundled RGBA PNGs', () => {
  const files = [
    ['celestial-sun.png', 256, 256],
    ['celestial-moon.png', 256, 256],
    ['celestial-stars.png', 768, 512],
    ['celestial-bloom.png', 256, 256],
  ];

  for (const [name, width, height] of files) {
    const png = fs.readFileSync(path.join(assets, name));

    assert.equal(
      png.subarray(0, 8).toString('hex'),
      '89504e470d0a1a0a',
    );

    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), height);
    assert.equal(png[25], 6);
    assert.ok(png.length < 1024 * 1024);
  }
});

test('Celestial preview preserves original bodies and glow with enhanced stars', () => {
  assert.match(route, /Array\.from\(\{ length: 48/);
  assert.match(route, /SKY_STARS\.map/);
  assert.match(route, /width: size/);
  assert.match(route, /height: size/);
  assert.match(route, /borderRadius: size \/ 2/);
  assert.doesNotMatch(route, /STAR_ART|resizeMode="stretch"/);

  assert.match(route, /<View style=\{styles\.sunOuter\}>/);
  assert.match(route, /<View style=\{styles\.sunCore\}/);
  assert.match(route, /<View style=\{styles\.moonOuter\}>/);
  assert.match(route, /<View style=\{styles\.moonCore\}/);


  assert.match(route, /rgba\(255,224,145,0\.12\)/);
  assert.match(route, /rgba\(125,205,255,0\.12\)/);

  assert.doesNotMatch(route, /SUN_ART|MOON_ART|BLOOM_ART/);
  assert.doesNotMatch(route, /ambientSun|ambientMoon|sunlightStyle|moonlightStyle/);
  assert.doesNotMatch(route, /Array\.from\(\{ length: 18/);
});

test('Celestial rendering preserves motion and development isolation', () => {
  assert.match(route, /onPress=\{toggleTheme\}/);
  assert.match(route, /withTiming\(next/);
  assert.match(route, /next - progress\.value/);
  assert.match(route, /useWavenReducedMotion\(true\)/);
  assert.match(route, /if \(!__DEV__\) return <Redirect/);
  assert.ok(fs.existsSync(
    path.join(assets, 'ARTWORK-CREDITS.txt'),
  ));
});