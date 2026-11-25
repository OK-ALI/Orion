const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const route = fs.readFileSync(
  path.join(root, 'app', 'celestial-preview.tsx'), 'utf8'
);

test('paired environment assets are local and size-bounded', () => {
  for (const name of ['day', 'night']) {
    const file = path.join(
      root, 'assets', 'celestial',
      `hikari-environment-${name}.jpg`
    );

    const bytes = fs.readFileSync(file);

    assert.ok(bytes.length > 10000);
    assert.ok(bytes.length <= 1500000);
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
  }
});

test('environment is decorative, responsive and preview-only', () => {
  assert.match(route, /hikari-environment-day\.jpg/);
  assert.match(route, /hikari-environment-night\.jpg/);

  assert.equal(
    (route.match(/resizeMode="cover"/g) || []).length >= 2,
    true
  );

  assert.equal(
    (route.match(/accessible=\{false\}/g) || []).length >= 2,
    true
  );

  assert.doesNotMatch(route, /resizeMode="stretch"/);
  assert.match(route, /__DEV__/);
  assert.match(route, /SKY_STARS/);
  assert.doesNotMatch(route, /ambientSun|ambientMoon/);
});