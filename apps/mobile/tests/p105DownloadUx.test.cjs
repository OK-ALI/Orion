const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');

const read = (...parts) =>
  fs.readFileSync(path.join(mobileRoot, ...parts), 'utf8');

test('P10.5-A1 exposes mirrored safe-area top controls', () => {
  const screen = read(
    'src',
    'features',
    'media-detail',
    'MediaDetailScreen.tsx'
  );

  const styles = read(
    'src',
    'features',
    'media-detail',
    'mediaDetailStyles.ts'
  );

  assert.match(screen, /useSafeAreaInsets/);
  assert.match(screen, /const insets = useSafeAreaInsets\(\)/);

  const safeTopMatches =
    screen.match(/Math\.max\(insets\.top \+ 8, 16\)/g) || [];

  assert.equal(
    safeTopMatches.length,
    2,
    'Back and Download must share the same safe-area vertical anchor'
  );

  assert.match(screen, /styles\.topDownloadButton/);
  assert.match(screen, /BlurView/);
  assert.match(screen, /Download episodes of/);

  assert.match(styles, /topDownloadButton:\s*\{/);
  assert.match(styles, /right:\s*20/);
  assert.match(styles, /topDownloadGlass:\s*\{/);

  assert.doesNotMatch(
    styles,
    /top:\s*Platform\.OS === 'ios' \? 50 : 25/
  );
});

test('P10.5-A1 keeps episode download and retires More-sheet download', () => {
  const screen = read(
    'src',
    'features',
    'media-detail',
    'MediaDetailScreen.tsx'
  );

  assert.match(
    screen,
    /accessibilityLabel=\{`Download Episode \$\{ep\.episode_number\}`\}/
  );

  assert.match(
    screen,
    /handleTabChange\('episodes'\)/
  );

  assert.doesNotMatch(
    screen,
    /accessibilityLabel="Mobile download options"/
  );

  assert.doesNotMatch(
    screen,
    /Downloads resolve the active source inside the player/
  );
});