const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const layout = read('app/_layout.tsx');
const entry = read('app/entry.tsx');
const home = read('app/index.tsx');
const search = read('app/search.tsx');
const library = read('app/library.tsx');
const fallback = read('src/components/artwork/WavenArtworkFallback.tsx');
const mini = read('src/components/player/WavenMiniPlayer.tsx');
const nav = read('src/components/shell/WavenBottomNav.tsx');
const signal = read('src/components/entry/WavenEntrySignal.tsx');

const productSurface = [entry, home, search, library, fallback, mini, signal].join('\n');

test('P5.5 product-facing language does not expose development or implementation vocabulary', () => {
  assert.doesNotMatch(productSurface, /development build|Expo Go review|configured for this build|local entry state/i);
  assert.doesNotMatch(productSurface, /placeholder artwork|fallback artwork|cinematic living music waveform/i);
  assert.doesNotMatch(entry, /Connect your Orion identity|Nothing in Orion Cloud/i);

  assert.doesNotMatch(entry, /Sign in with Google, or continue without an account\./);
  assert.match(entry, /Continue without an account/);
  assert.match(entry, /Signing in is optional\./);
  assert.match(fallback, /WAVEN artwork/);
  assert.match(signal, /WAVEN music waveform/);
});

test('P5.5 entry completion performs an explicit atmospheric handoff before Home replacement', () => {
  assert.match(entry, /const handoffProgress = useRef\(new Animated\.Value\(0\)\)\.current/);
  assert.match(entry, /const finishEntryHandoff = async \(\) =>/);
  assert.match(entry, /Animated\.timing\(handoffProgress/);
  assert.match(entry, /duration: reducedMotion \? wavenMotion\.quickMs : wavenMotion\.deliberateMs/);
  assert.match(entry, /easing: reducedMotion \? Easing\.linear : Easing\.out\(Easing\.cubic\)/);
  assert.match(entry, /outputRange: reducedMotion \? \[0, 0\] : \[0, -10\]/);
  assert.match(entry, /await completeWavenEntryWithGoogle\(profile\);\s*await finishEntryHandoff\(\);/);
  assert.match(entry, /await completeWavenEntryLocally\(\);\s*await finishEntryHandoff\(\);/);
  assert.match(entry, /await new Promise<void>/);
  assert.match(entry, /router\.replace\('\/'\)/);
  assert.match(layout, /setEntryHandoffPending\(Boolean\(session\)\)/);
  assert.match(layout, /entryHandoffPending && showPrimaryNavigation/);
  assert.match(layout, /<WavenAtmosphericCanvas variant="entry" \/>/);
  assert.match(layout, /Animated\.timing\(entryHandoffOpacity/);
  assert.match(layout, /duration: reducedMotion \? wavenMotion\.quickMs : wavenMotion\.deliberateMs/);
  assert.match(layout, /accessibilityElementsHidden/);
  assert.match(layout, /importantForAccessibility="no-hide-descendants"/);
});

test('P5.5 keeps interactive selection surfaces WAVEN black while blue remains an accent', () => {
  assert.match(home, /heroAction:[\s\S]*?backgroundColor:\s*wavenColors\.canvas/);
  assert.match(search, /scopeChipActive:[\s\S]*?backgroundColor:\s*wavenColors\.canvas/);
  assert.match(library, /filterChipActive:[\s\S]*?backgroundColor:\s*wavenColors\.canvas/);
  assert.match(library, /findMusicAction:[\s\S]*?backgroundColor:\s*wavenColors\.canvas/);
  assert.match(mini, /control:[\s\S]*?backgroundColor:\s*wavenColors\.canvas/);
  assert.match(nav, /selectionPill:[\s\S]*?backgroundColor:\s*wavenColors\.canvas/);

  assert.match(nav, /tone=\{wavenColors\.interactionBlue\}/);
  assert.match(home, /heroActionArrow:[\s\S]*?color:\s*wavenColors\.interactionBlue/);
  assert.match(search, /scopeChipActive:[\s\S]*?borderColor:\s*wavenColors\.blueEdge/);
  assert.match(library, /filterChipActive:[\s\S]*?borderColor:\s*wavenColors\.blueEdge/);
  assert.match(mini, /control:[\s\S]*?borderColor:\s*wavenColors\.blueEdge/);
  assert.match(nav, /selectionPill:[\s\S]*?borderColor:\s*wavenColors\.blueEdge/);
});

