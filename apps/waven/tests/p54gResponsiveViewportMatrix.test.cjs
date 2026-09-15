const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const tokens = read('src/theme/tokens.ts');
const layoutHook = read('src/hooks/useWavenLayout.ts');
const appShell = read('src/components/shell/WavenAppShell.tsx');
const bottomNav = read('src/components/shell/WavenBottomNav.tsx');
const miniPlayer = read('src/components/player/WavenMiniPlayer.tsx');
const entry = read('app/entry.tsx');
const home = read('app/index.tsx');
const search = read('app/search.tsx');
const library = read('app/library.tsx');

function numericToken(name) {
  const match = tokens.match(new RegExp('\\b' + name + ':\\s*(\\d+(?:\\.\\d+)?)'));
  assert.ok(match, 'Missing numeric layout token: ' + name);
  return Number(match[1]);
}

const layout = {
  compactWidth: numericToken('compactWidth'),
  roomyWidth: numericToken('roomyWidth'),
  tabletWidth: numericToken('tabletWidth'),
  contentMaxWidth: numericToken('contentMaxWidth'),
  navCompactMaxWidth: numericToken('navCompactMaxWidth'),
  gutterCompact: numericToken('gutterCompact'),
  gutter: numericToken('gutter'),
  gutterRoomy: numericToken('gutterRoomy'),
  gutterTablet: numericToken('gutterTablet'),
};

function resolve(width) {
  const isCompact = width < layout.compactWidth;
  const isRoomy = width >= layout.roomyWidth;
  const isTabletLike = width >= layout.tabletWidth;

  const gutter = isCompact
    ? layout.gutterCompact
    : isTabletLike
      ? layout.gutterTablet
      : isRoomy
        ? layout.gutterRoomy
        : layout.gutter;

  return {
    width,
    isCompact,
    isRoomy,
    isTabletLike,
    gutter,
    contentWidth: Math.min(width - gutter * 2, layout.contentMaxWidth),
  };
}

test('P5.4G covers compact, standard, roomy and tablet-like viewport classes', () => {
  assert.equal(layout.compactWidth, 360);
  assert.equal(layout.roomyWidth, 430);
  assert.equal(layout.tabletWidth, 700);
  assert.equal(layout.contentMaxWidth, 760);

  assert.deepEqual(resolve(320), {
    width: 320,
    isCompact: true,
    isRoomy: false,
    isTabletLike: false,
    gutter: 16,
    contentWidth: 288,
  });

  assert.deepEqual(resolve(390), {
    width: 390,
    isCompact: false,
    isRoomy: false,
    isTabletLike: false,
    gutter: 20,
    contentWidth: 350,
  });

  assert.deepEqual(resolve(480), {
    width: 480,
    isCompact: false,
    isRoomy: true,
    isTabletLike: false,
    gutter: 24,
    contentWidth: 432,
  });

  assert.deepEqual(resolve(800), {
    width: 800,
    isCompact: false,
    isRoomy: true,
    isTabletLike: true,
    gutter: 32,
    contentWidth: 736,
  });

  assert.deepEqual(resolve(1024), {
    width: 1024,
    isCompact: false,
    isRoomy: true,
    isTabletLike: true,
    gutter: 32,
    contentWidth: 760,
  });

  assert.match(layoutHook, /const isCompact = width < wavenLayout\.compactWidth/);
  assert.match(layoutHook, /const isRoomy = width >= wavenLayout\.roomyWidth/);
  assert.match(layoutHook, /const isTabletLike = width >= wavenLayout\.tabletWidth/);
  assert.match(
    layoutHook,
    /const gutter = isCompact[\s\S]*?gutterCompact[\s\S]*?isTabletLike[\s\S]*?gutterTablet[\s\S]*?isRoomy[\s\S]*?gutterRoomy[\s\S]*?wavenLayout\.gutter/,
  );
});

test('P5.4G keeps Home artwork rows inside compact and phone content budgets', () => {
  assert.match(home, /const heroArtworkSize = layout\.isCompact[\s\S]*?\? 150[\s\S]*?: layout\.isTabletLike[\s\S]*?\? 202[\s\S]*?: 172/);
  assert.match(home, /const exploreArtworkSize = layout\.isCompact \? 84 : 96/);
  assert.match(home, /exploreRow:\s*\{[\s\S]*?flexDirection:\s*'row'[\s\S]*?gap:\s*10/);
  assert.match(home, /exploreCardPressable:\s*\{[\s\S]*?flex:\s*1/);
  assert.match(home, /layout\.isTabletLike \? styles\.heroTablet : styles\.heroPhone/);

  for (const width of [320, 390, 480]) {
    const viewport = resolve(width);
    const artwork = viewport.isCompact ? 84 : 96;
    const slotWidth = (viewport.contentWidth - 20) / 3;

    assert.ok(
      slotWidth >= artwork,
      width + 'dp Explore slot (' + slotWidth + ') must fit ' + artwork + 'dp artwork',
    );
  }

  const compact = resolve(320);
  const compactHeroVisualWidth = 150 + 44;
  const heroHorizontalPadding = 16 * 2;

  assert.ok(
    compactHeroVisualWidth + heroHorizontalPadding <= compact.contentWidth,
    '320dp compact Home hero must fit its content frame',
  );
});

test('P5.4G keeps the tablet hero bounded and prevents runaway large-screen stretching', () => {
  assert.match(appShell, /maxWidth:\s*layout\.contentMaxWidth/);
  assert.match(home, /heroTablet:\s*\{[\s\S]*?flexDirection:\s*'row'[\s\S]*?gap:\s*wavenSpacing\.xl/);
  assert.match(home, /heroCopy:\s*\{[\s\S]*?flex:\s*1[\s\S]*?maxWidth:\s*420/);
  assert.match(home, /heroBody:\s*\{[\s\S]*?maxWidth:\s*300/);

  // At the exact 700dp tablet threshold:
  // content = 700 - (32 * 2) = 636
  // hero visual = 202 + 44 = 246
  // row gap = 32
  // hero surface horizontal padding = 16 * 2
  // remaining copy width = 326, still >= the 300dp body cap.
  const threshold = resolve(700);
  const remainingCopyWidth =
    threshold.contentWidth - (202 + 44) - 32 - (16 * 2);

  assert.equal(threshold.contentWidth, 636);
  assert.equal(remainingCopyWidth, 326);
  assert.ok(remainingCopyWidth >= 300);

  assert.equal(resolve(1024).contentWidth, 760);
  assert.equal(resolve(1400).contentWidth, 760);
});

test('P5.4G keeps persistent controls bounded and pages recoverable at viewport extremes', () => {
  assert.equal(layout.navCompactMaxWidth, 430);

  assert.match(
    bottomNav,
    /inner:\s*\{[\s\S]*?maxWidth:\s*wavenLayout\.navCompactMaxWidth[\s\S]*?width:\s*'100%'/,
  );
  assert.match(
    miniPlayer,
    /outer:\s*\{[\s\S]*?maxWidth:\s*wavenLayout\.navCompactMaxWidth[\s\S]*?width:\s*'100%'/,
  );

  assert.match(entry, /\bScrollView\b/);
  assert.match(entry, /content:\s*\{[\s\S]*?flexGrow:\s*1/);
  assert.match(appShell, /\bScrollView\b/);
  assert.match(appShell, /scrollContent:\s*\{[\s\S]*?flexGrow:\s*1/);

  assert.match(search, /scopeRow:\s*\{[\s\S]*?flexWrap:\s*'wrap'/);
  assert.match(library, /filterRow:\s*\{[\s\S]*?flexWrap:\s*'wrap'/);

  assert.match(
    bottomNav,
    /windowWidth < wavenLayout\.compactWidth[\s\S]*?NAV_LABEL_COMPACT_MAX_SCALE/,
  );
});
