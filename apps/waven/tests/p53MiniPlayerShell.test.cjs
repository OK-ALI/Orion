const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const contracts = read('src/features/playback/contracts.ts');
const nativeBridge = read(
  'src/features/playback/native/WavenPlaybackNative.ts',
);
const nativeModule = read(
  'plugins/waven-playback-native/WavenPlaybackModule.kt',
);
const nativeService = read(
  'plugins/waven-playback-native/WavenPlaybackService.kt',
);
const layout = read('app/_layout.tsx');
const miniPlayer = read(
  'src/components/player/WavenMiniPlayer.tsx',
);

test('P5.3A exposes read-only current-track presentation metadata from the existing P4 owner', () => {
  assert.match(
    contracts,
    /export interface PlaybackPresentationItem/,
  );
  assert.match(contracts, /queueId:\s*string/);
  assert.match(contracts, /title:\s*string \| null/);
  assert.match(contracts, /artistName:\s*string \| null/);
  assert.match(contracts, /albumTitle:\s*string \| null/);
  assert.match(contracts, /artworkUrl:\s*string \| null/);
  assert.match(
    contracts,
    /currentItem:\s*PlaybackPresentationItem \| null/,
  );

  assert.match(
    nativeModule,
    /val currentItem\s*=/,
  );
  assert.match(
    nativeModule,
    /val metadata = mediaItem\.mediaMetadata/,
  );
  assert.match(
    nativeModule,
    /putString\("title", metadata\.title\?\.toString\(\)\)/,
  );
  assert.match(
    nativeModule,
    /putString\("artistName", metadata\.artist\?\.toString\(\)\)/,
  );
  assert.match(
    nativeModule,
    /putString\("albumTitle", metadata\.albumTitle\?\.toString\(\)\)/,
  );
  assert.match(
    nativeModule,
    /putString\("artworkUrl", metadata\.artworkUri\?\.toString\(\)\)/,
  );
  assert.match(
    nativeModule,
    /putMap\("currentItem", currentItem\)/,
  );
});

test('P5.3A exposes play intent so buffering presentation never guesses whether playback should resume', () => {
  assert.match(
    contracts,
    /playWhenReady:\s*boolean/,
  );
  assert.match(
    nativeModule,
    /putBoolean\("playWhenReady", player\.playWhenReady\)/,
  );
});

test('P5.3A extends observation only and preserves the single Media3 playback owner', () => {
  assert.match(
    nativeService,
    /class WavenPlaybackService : MediaSessionService\(\)/,
  );
  assert.match(
    nativeBridge,
    /subscribeNativePlayback/,
  );
  assert.match(
    nativeBridge,
    /nativePlayback\s*=/,
  );

  assert.doesNotMatch(
    contracts,
    /resolvedSource\s*:\s*ResolvedPlaybackSource/,
  );
  assert.doesNotMatch(
    nativeModule,
    /ExoPlayer\.Builder|MediaPlayer|expo-audio|new Audio\(/,
  );
});

test('P5.3A does not pull provider, Cloud, Library persistence, offline, or final-player ownership forward', () => {
  const combined = [
    contracts,
    nativeModule,
  ].join('\n');

  assert.doesNotMatch(
    combined,
    /OrionCloud|GoogleDrive|PortableProfile|MMKV|SQLite|lyrics|visualizer/i,
  );
});
test('P5.3B mounts one persistent Mini Player above primary navigation', () => {
  assert.match(
    layout,
    /import \{ WavenMiniPlayer \} from '\.\.\/src\/components\/player\/WavenMiniPlayer'/,
  );

  assert.match(
    layout,
    /\{showPrimaryNavigation \? <WavenMiniPlayer \/> : null\}\s+\{showPrimaryNavigation \? <WavenBottomNav \/> : null\}/,
  );
});

test('P5.3B observes and controls only the existing P4 Media3 owner', () => {
  assert.match(miniPlayer, /subscribeNativePlayback/);
  assert.match(miniPlayer, /nativePlayback\.getSnapshot/);
  assert.match(miniPlayer, /nativePlayback\.play\(\)/);
  assert.match(miniPlayer, /nativePlayback\.pause\(\)/);

  assert.doesNotMatch(
    miniPlayer,
    /replaceNativeQueue|resolveNativeQueueItem|ResolvedPlaybackSource/,
  );

  assert.doesNotMatch(
    miniPlayer,
    /ExoPlayer|MediaPlayer|expo-audio|new Audio\(/,
  );
});

test('P5.3B translates Reference 03 into truthful compact playback presentation', () => {
  assert.match(miniPlayer, /currentItem/);
  assert.match(miniPlayer, /item\.artworkUrl/);
  assert.match(miniPlayer, /WavenArtworkFallback/);
  assert.match(miniPlayer, /item\.title/);
  assert.match(miniPlayer, /item\.artistName/);
  assert.match(miniPlayer, /PROGRESS_HEIGHTS/);
  assert.match(miniPlayer, /snapshot\.positionMs/);
  assert.match(miniPlayer, /snapshot\.durationMs/);
  assert.match(miniPlayer, /wavenColors\.interactionBlue/);
  assert.match(miniPlayer, /wavenLayout\.navCompactMaxWidth/);
});

test('P5.3B remains safe in Expo Go or any build without the native playback bridge', () => {
  assert.match(
    miniPlayer,
    /try \{\s+subscription = subscribeNativePlayback/,
  );

  assert.match(
    miniPlayer,
    /catch \{\s+\/\/ Expo Go and builds without WAVEN's native playback bridge/,
  );

  assert.match(
    miniPlayer,
    /setSnapshot\(null\)/,
  );

  assert.match(
    miniPlayer,
    /if \(\s+snapshot == null \|\|\s+item == null \|\|\s+snapshot\.queueIds\.length === 0\s+\) \{\s+return null;/,
  );
});

test('P5.3B preserves accessibility, Reduced Motion, and P5-safe progress behavior', () => {
  assert.match(miniPlayer, /useWavenReducedMotion/);
  assert.match(miniPlayer, /reducedMotion/);
  assert.match(miniPlayer, /accessibilityRole="button"/);
  assert.match(miniPlayer, /accessibilityRole="progressbar"/);
  assert.match(miniPlayer, /accessibilityValue=/);
  assert.match(miniPlayer, /numberOfLines=\{1\}/);

  assert.doesNotMatch(
    miniPlayer,
    /FFT|Analyser|audio-reactive|visualizer/i,
  );
});

test('P5.3C makes Reference 03 progress continuous without changing playback ownership', () => {
  assert.match(miniPlayer, /visualProgress/);
  assert.match(miniPlayer, /Animated\.timing\(visualProgress/);
  assert.match(miniPlayer, /easing:\s*Easing\.linear/);
  assert.match(miniPlayer, /playedClip/);
  assert.match(miniPlayer, /activePulse/);
  assert.match(miniPlayer, /bufferTravel/);
  assert.match(miniPlayer, /controlMotion/);
  assert.match(miniPlayer, /snapshot\.positionMs/);
  assert.match(miniPlayer, /snapshot\.durationMs/);

  assert.doesNotMatch(
    miniPlayer,
    /replaceNativeQueue|resolveNativeQueueItem|ResolvedPlaybackSource/,
  );

  assert.doesNotMatch(
    miniPlayer,
    /ExoPlayer|MediaPlayer|expo-audio|new Audio\(/,
  );
});

test('P5.3C keeps active and buffering motion reduced-motion safe and non audio-reactive', () => {
  assert.match(miniPlayer, /useWavenReducedMotion/);
  assert.match(miniPlayer, /reducedMotion \|\|/);
  assert.match(miniPlayer, /bufferingActive && !reducedMotion/);
  assert.match(miniPlayer, /useNativeDriver:\s*false/);
  assert.match(miniPlayer, /useNativeDriver:\s*true/);

  assert.doesNotMatch(
    miniPlayer,
    /FFT|Analyser|audio-reactive|visualizer/i,
  );
});

test('P5.3D maps played progress across the visible waveform with no centered dead zone', () => {
  assert.match(miniPlayer, /const WAVE_BAR_WIDTH = 3/);
  assert.match(
    miniPlayer,
    /waveBarsLayer:\s*\{[\s\S]*?justifyContent:\s*'space-between'/,
  );
  assert.match(
    miniPlayer,
    /playedBarsLayer:\s*\{[\s\S]*?justifyContent:\s*'space-between'/,
  );
  assert.match(
    miniPlayer,
    /waveBar:\s*\{[\s\S]*?width:\s*WAVE_BAR_WIDTH/,
  );
  assert.doesNotMatch(miniPlayer, /maxWidth:\s*5/);
  assert.doesNotMatch(miniPlayer, /minWidth:\s*2/);
});
