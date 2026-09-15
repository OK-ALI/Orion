const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const miniPlayer = fs.readFileSync(
  path.join(root, 'src/components/player/WavenMiniPlayer.tsx'),
  'utf8',
);

test('P5.4B gives the compact player deliberate vertical breathing room and optical alignment', () => {
  assert.match(miniPlayer, /panel:\s*\{[\s\S]*?minHeight:\s*84/);
  assert.match(miniPlayer, /row:\s*\{[\s\S]*?minHeight:\s*66/);
  assert.match(miniPlayer, /metadataTransition:\s*\{[\s\S]*?minHeight:\s*48/);
  assert.match(miniPlayer, /controlContainer:\s*\{[\s\S]*?marginLeft:\s*8/);
});

test('P5.4B centers a shorter waveform trail while preserving full-range progress mapping', () => {
  assert.match(
    miniPlayer,
    /waveform:\s*\{[\s\S]*?alignItems:\s*'center'[\s\S]*?height:\s*18/,
  );
  assert.match(
    miniPlayer,
    /waveViewport:\s*\{[\s\S]*?width:\s*'84%'/,
  );
  assert.match(
    miniPlayer,
    /outputRange:\s*\[0,\s*waveWidth\]/,
  );
  assert.match(
    miniPlayer,
    /justifyContent:\s*'space-between'/,
  );
});

test('P5.4B animates only overflowing song titles and makes Reduced Motion static', () => {
  const mini = require('node:fs').readFileSync(
    require('node:path').join(
      __dirname,
      '..',
      'src',
      'components',
      'player',
      'WavenMiniPlayer.tsx',
    ),
    'utf8',
  );

  assert.match(mini, /const TITLE_MARQUEE_OVERFLOW_TOLERANCE = 8/);
  assert.match(mini, /titleViewportWidth/);
  assert.match(mini, /titleMarqueeUnitWidth/);

  assert.match(
    mini,
    /const marqueeEnabled =[\s\S]*?!reducedMotion[\s\S]*?titleMarqueeUnitWidth - TITLE_MARQUEE_GAP >[\s\S]*?titleViewportWidth \+ TITLE_MARQUEE_OVERFLOW_TOLERANCE/,
  );

  assert.match(
    mini,
    /Animated\.loop\([\s\S]*?Animated\.timing\(titleMarquee,[\s\S]*?toValue: -titleMarqueeUnitWidth/,
  );

  assert.doesNotMatch(mini, /TITLE_MARQUEE_END_DELAY_MS/);
  assert.doesNotMatch(mini, /TITLE_MARQUEE_RESET_MS/);
});

test('P5.4B remains presentation-only and preserves compact-player scope', () => {
  assert.match(miniPlayer, /nativePlayback\.play\(\)/);
  assert.match(miniPlayer, /nativePlayback\.pause\(\)/);
  assert.match(miniPlayer, /maxFontSizeMultiplier=\{COMPACT_TEXT_MAX_SCALE\}/);

  assert.doesNotMatch(
    miniPlayer,
    /replaceNativeQueue|resolveNativeQueueItem|ResolvedPlaybackSource/,
  );
  assert.doesNotMatch(miniPlayer, /seekTo|seekBy/);
  assert.doesNotMatch(
    miniPlayer,
    /FFT|Analyser|audio-reactive|visualizer/i,
  );
});
