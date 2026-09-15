const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const read = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('P5.4F preserves Android Back history for user-driven primary navigation', () => {
  const home = read('app/index.tsx');
  const library = read('app/library.tsx');
  const bottomNav = read('src/components/shell/WavenBottomNav.tsx');
  const rootLayout = read('app/_layout.tsx');

  const homeSearchNavigate =
    home.match(/router\.navigate\('\/search'\)/g) ?? [];
  const homeLibraryNavigate =
    home.match(/router\.navigate\('\/library'\)/g) ?? [];

  assert.equal(homeSearchNavigate.length, 2);
  assert.equal(homeLibraryNavigate.length, 1);
  assert.doesNotMatch(home, /router\.replace\('\/(search|library)'\)/);

  assert.match(
    library,
    /accessibilityLabel="Find music"[\s\S]*?router\.navigate\('\/search'\)/,
  );
  assert.doesNotMatch(library, /router\.replace\('\/search'\)/);

  assert.match(
    bottomNav,
    /if \(!active\) router\.navigate\(item\.href\);/,
  );
  assert.doesNotMatch(
    bottomNav,
    /router\.replace\(item\.href\)/,
  );

  // Redirects are different from user navigation: first-run handoff should
  // still replace Home so Android Back cannot reopen the startup gate.
  assert.match(rootLayout, /router\.replace\('\/entry'\)/);
});
