const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const layout = read('app/_layout.tsx');
const entry = read('app/entry.tsx');
const search = read('app/search.tsx');
const library = read('app/library.tsx');
const miniPlayer = read('src/components/player/WavenMiniPlayer.tsx');
const bottomNav = read('src/components/shell/WavenBottomNav.tsx');
const appShell = read('src/components/shell/WavenAppShell.tsx');
const responsive = read('src/hooks/useWavenLayout.ts');
const reducedMotion = read('src/hooks/useWavenReducedMotion.ts');

test('P5.4A makes Router transitions obey the existing Reduced Motion owner', () => {
  assert.match(layout, /useWavenReducedMotion/);
  assert.match(layout, /const reducedMotion = useWavenReducedMotion\(\)/);
  assert.match(
    layout,
    /animation:\s*reducedMotion \? 'none' : 'fade'/,
  );

  assert.match(
    reducedMotion,
    /AccessibilityInfo\.isReduceMotionEnabled\(\)/,
  );
  assert.match(reducedMotion, /reduceMotionChanged/);
});

test('P5.4A makes Entry vertically recoverable under large text or short displays', () => {
  assert.match(entry, /\bScrollView\b/);
  assert.match(entry, /contentContainerStyle=\{styles\.content\}/);
  assert.match(entry, /showsVerticalScrollIndicator=\{false\}/);
  assert.match(entry, /scroll:\s*\{\s*flex:\s*1/);
  assert.match(entry, /content:\s*\{\s*flexGrow:\s*1/);
});

test('P5.4A expands undersized chip actions without changing the locked visual chip heights', () => {
  const p54TouchFs = require('node:fs');
  const p54TouchPath = require('node:path');
  const p54TouchAssert = require('node:assert/strict');

  const p54TouchRead = (relativePath) =>
    p54TouchFs.readFileSync(
      p54TouchPath.join(__dirname, '..', relativePath),
      'utf8',
    );

  const search = p54TouchRead('app/search.tsx');
  const library = p54TouchRead('app/library.tsx');

  p54TouchAssert.match(
    search,
    /accessibilityState=\{\{ selected: active \}\}[\s\S]*?style=\{styles\.scopeTouchTarget\}/,
  );
  p54TouchAssert.match(
    search,
    /scopeTouchTarget:[\s\S]*?minHeight: wavenLayout\.minimumTouchTarget/,
  );
  p54TouchAssert.doesNotMatch(
    search,
    /accessibilityState=\{\{ selected: active \}\}[\s\S]*?hitSlop=/,
  );

  p54TouchAssert.match(
    library,
    /accessibilityState=\{\{ selected: active \}\}[\s\S]*?style=\{styles\.minimumTouchTarget\}/,
  );
  p54TouchAssert.match(
    library,
    /accessibilityLabel="Find music"[\s\S]*?style=\{styles\.minimumTouchTarget\}/,
  );
  p54TouchAssert.match(
    library,
    /minimumTouchTarget:[\s\S]*?minHeight: wavenLayout\.minimumTouchTarget/,
  );

  p54TouchAssert.doesNotMatch(
    library,
    /accessibilityState=\{\{ selected: active \}\}[\s\S]*?hitSlop=/,
  );
  p54TouchAssert.doesNotMatch(
    library,
    /accessibilityLabel="Find music"[\s\S]*?hitSlop=/,
  );

  // Keep the approved compact visuals while the actual Pressables own
  // a true minimum 48dp interaction target.
  p54TouchAssert.match(search, /scopeChip:[\s\S]*?minHeight: 38/);
  p54TouchAssert.match(library, /filterChip:[\s\S]*?minHeight: 38/);
  p54TouchAssert.match(library, /findMusicAction:[\s\S]*?minHeight: 42/);
});

test('P5.4A gives dense persistent-player text a bounded large-text budget', () => {
  const mini = read('src/components/player/WavenMiniPlayer.tsx');

  assert.match(mini, /const COMPACT_TEXT_MAX_SCALE = 1\.4/);

  const boundedCompactTextUses =
    mini.match(/maxFontSizeMultiplier=\{COMPACT_TEXT_MAX_SCALE\}/g) ?? [];

  // P5.4D uses one invisible intrinsic-measurement title, one visible title,
  // one inaccessible conveyor duplicate, and the artist. All four retain the
  // same bounded scale while only the visible title and artist are announced.
  assert.equal(boundedCompactTextUses.length, 4);

  assert.match(
    mini,
    /titleMeasurePlane[\s\S]*?accessible=\{false\}[\s\S]*?maxFontSizeMultiplier=\{COMPACT_TEXT_MAX_SCALE\}/,
  );
  assert.match(
    mini,
    /\{marqueeEnabled \? \([\s\S]*?<Text[\s\S]*?accessible=\{false\}[\s\S]*?maxFontSizeMultiplier=\{COMPACT_TEXT_MAX_SCALE\}/,
  );
});

test('P5.4A scales active bottom-nav labels while protecting compact phones', () => {
  assert.match(bottomNav, /useWindowDimensions/);
  assert.match(bottomNav, /const NAV_LABEL_MAX_SCALE = 1\.4/);
  assert.match(
    bottomNav,
    /const NAV_LABEL_COMPACT_MAX_SCALE = 1\.2/,
  );
  assert.match(
    bottomNav,
    /const labelWidth = LABEL_WIDTHS\[item\.label\] \* labelScale/,
  );
  assert.match(
    bottomNav,
    /maxFontSizeMultiplier=\{labelScale\}/,
  );
  assert.match(
    bottomNav,
    /windowWidth < wavenLayout\.compactWidth/,
  );
});

test('P5.4A preserves the existing responsive and safe-area foundations', () => {
  assert.match(appShell, /\bSafeAreaView\b/);
  assert.match(appShell, /edges=\{\['top'\]\}/);
  assert.match(appShell, /maxWidth:\s*layout\.contentMaxWidth/);

  assert.match(responsive, /useWindowDimensions/);
  assert.match(responsive, /wavenLayout\.compactWidth/);
  assert.match(responsive, /wavenLayout\.roomyWidth/);
  assert.match(responsive, /wavenLayout\.tabletWidth/);
});


test('P5.4C stacks Home section headers under large text instead of colliding labels', () => {
  const home = read('app/index.tsx');

  assert.match(home, /useWindowDimensions/);
  assert.match(home, /const \{ fontScale \} = useWindowDimensions\(\)/);
  assert.match(home, /const stackSectionHeaders = fontScale >= 1\.45/);
  assert.match(home, /stackSectionHeaders \? styles\.sectionHeaderStacked : null/);
  assert.match(
    home,
    /sectionHeaderStacked:\s*\{[\s\S]*?alignItems:\s*'flex-start'[\s\S]*?flexDirection:\s*'column'/,
  );
});


{
  const p54eTest = require('node:test');
  const p54eAssert = require('node:assert/strict');
  const p54eFs = require('node:fs');
  const p54ePath = require('node:path');

  const p54eRead = (relativePath) =>
    p54eFs.readFileSync(
      p54ePath.join(__dirname, '..', relativePath),
      'utf8',
    );

  p54eTest('P5.4E gives undersized visible controls a real 48dp Pressable target', () => {
    const search = p54eRead('app/search.tsx');
    const library = p54eRead('app/library.tsx');

    p54eAssert.match(
      search,
      /style=\{styles\.scopeTouchTarget\}/,
    );
    p54eAssert.match(
      search,
      /scopeTouchTarget:[\s\S]*?minHeight: wavenLayout\.minimumTouchTarget/,
    );
    p54eAssert.doesNotMatch(
      search,
      /hitSlop=\{\{ bottom: 5, top: 5 \}\}/,
    );

    const libraryTargetUses =
      library.match(/style=\{styles\.minimumTouchTarget\}/g) ?? [];

    p54eAssert.equal(libraryTargetUses.length, 2);
    p54eAssert.match(
      library,
      /minimumTouchTarget:[\s\S]*?minHeight: wavenLayout\.minimumTouchTarget/,
    );
    p54eAssert.match(
      library,
      /wavenColors,[\s\S]*?wavenLayout,[\s\S]*?wavenRadii/,
    );
    p54eAssert.doesNotMatch(
      library,
      /hitSlop=\{\{ bottom: 5, top: 5 \}\}/,
    );
    p54eAssert.doesNotMatch(
      library,
      /hitSlop=\{3\}/,
    );

    // Preserve the accepted visual pill heights while expanding only
    // the actual interactive Pressable geometry to the 48dp token.
    p54eAssert.match(search, /scopeChip:[\s\S]*?minHeight: 38/);
    p54eAssert.match(library, /filterChip:[\s\S]*?minHeight: 38/);
    p54eAssert.match(library, /findMusicAction:[\s\S]*?minHeight: 42/);
  });
}
