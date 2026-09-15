const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const APP = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(APP, relativePath), 'utf8');
}

test('P5.4D uses a seamless forward-only duplicated Mini Player marquee', () => {
  const mini = read('src/components/player/WavenMiniPlayer.tsx');

  assert.match(mini, /const TITLE_MARQUEE_GAP = 28/);
  assert.match(mini, /const marqueeEnabled =/);
  assert.match(
    mini,
    /titleMarqueeUnitWidth - TITLE_MARQUEE_GAP[\s\S]*titleViewportWidth \+ TITLE_MARQUEE_OVERFLOW_TOLERANCE/,
  );
  assert.match(
    mini,
    /Animated\.loop\([\s\S]*Animated\.timing\(titleMarquee,[\s\S]*toValue: -titleMarqueeUnitWidth[\s\S]*resetBeforeIteration: true/,
  );
  assert.match(
    mini,
    /\{marqueeEnabled \? \([\s\S]*accessible=\{false\}[\s\S]*styles\.titleMarqueeUnit/,
  );
  assert.match(
    mini,
    /titleMarqueeTrack:[\s\S]*flexDirection: 'row'[\s\S]*titleMarqueeUnit:[\s\S]*flexShrink: 0/,
  );
  assert.match(
    mini,
    /titleMeasurePlane:[\s\S]*position: 'absolute'[\s\S]*width: 10000/,
  );
  assert.match(
    mini,
    /setTitleMarqueeUnitWidth\([\s\S]*event\.nativeEvent\.layout\.width \+ TITLE_MARQUEE_GAP/,
  );
  assert.match(
    mini,
    /const marqueeCycle = Animated\.loop\([\s\S]*marqueeCycle\.start\(\)/,
  );
  assert.doesNotMatch(mini, /TITLE_MARQUEE_START_DELAY_MS/);
  assert.doesNotMatch(mini, /setTimeout\(/);
  assert.doesNotMatch(mini, /clearTimeout\(/);

  assert.doesNotMatch(mini, /TITLE_MARQUEE_END_DELAY_MS/);
  assert.doesNotMatch(mini, /TITLE_MARQUEE_RESET_MS/);
  assert.doesNotMatch(mini, /TITLE_MARQUEE_EDGE_GAP/);
  assert.doesNotMatch(mini, /titleContentWidth/);
  assert.doesNotMatch(mini, /setTitleContentWidth/);
});

test('P5.4D lowers Search and Library headings and tightens the following rhythm', () => {
  for (const relativePath of ['app/search.tsx', 'app/library.tsx']) {
    const source = read(relativePath);

    assert.match(
      source,
      /heading:\s*\{[\s\S]*?marginBottom: wavenSpacing\.lg,[\s\S]*?marginTop: wavenSpacing\.md,/,
      relativePath,
    );
    assert.doesNotMatch(
      source,
      /heading:\s*\{[\s\S]*?marginBottom: wavenSpacing\.xl,/,
      relativePath,
    );
  }
});
