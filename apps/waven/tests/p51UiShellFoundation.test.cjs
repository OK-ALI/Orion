const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const tokens = read('src/theme/tokens.ts');
const layout = read('app/_layout.tsx');
const shell = read('src/components/shell/WavenAppShell.tsx');
const nav = read('src/components/shell/WavenBottomNav.tsx');
const wordmark = read('src/components/brand/WavenWordmark.tsx');
const accentTitle = read('src/components/typography/WavenAccentTitle.tsx');
const fallback = read('src/components/artwork/WavenArtworkFallback.tsx');
const home = read('app/index.tsx');
const search = read('app/search.tsx');
const library = read('app/library.tsx');
const cloudDebug = read('app/cloud-debug.tsx');


test('P5.1 establishes semantic WAVEN theme, layout, typography, glass, and motion tokens without replacing legacy keys', () => {
  assert.match(tokens, /brandBlue/);
  assert.match(tokens, /interactionBlue/);
  assert.match(tokens, /navGlass/);
  assert.match(tokens, /glassSoft/);
  assert.match(tokens, /wavenTypography/);
  assert.match(tokens, /wavenLayout/);
  assert.match(tokens, /wavenMotion/);
  assert.match(tokens, /black:\s*'#000000'/);
  assert.match(tokens, /silver:\s*'#C5CAD1'/);
  assert.match(tokens, /activeBlue:\s*'#2699DF'/);
});


test('P5.1 centralizes the WAVEN wordmark and reusable blue-accent page titles', () => {
  assert.match(wordmark, /<Text>WA<\/Text>/);
  assert.match(wordmark, /<Text style=\{styles\.accent\}>V<\/Text>/);
  assert.match(wordmark, /<Text>EN<\/Text>/);
  assert.match(wordmark, /wavenColors\.interactionBlue/);
  assert.match(accentTitle, /WavenAccentTitle/);
  assert.match(accentTitle, /wavenColors\.interactionBlue/);
  assert.match(home, /<WavenAppShell brandTagline>/);
  assert.match(shell, /Where /);
  assert.match(shell, /taglineAccent/);
  assert.match(shell, />Music</);
  assert.match(shell, / Lives/);
  assert.match(search, /before="Find Your " accent="Sound"/);
  assert.match(library, /before="Your " accent="Library"/);
});


test('P5.1 protects dark route continuity with one persistent primary-navigation substrate', () => {
  assert.match(layout, /SafeAreaProvider style=\{styles\.provider\}/);
  assert.match(layout, /backgroundColor:\s*wavenColors\.canvas/);
  assert.match(layout, /stackFrame/);
  assert.match(layout, /PRIMARY_PATHS/);
  assert.match(layout, /showPrimaryNavigation/);
  assert.match(layout, /WavenBottomNav/);
  assert.match(layout, /animation:\s*reducedMotion \? 'none' : 'fade'/);
  assert.doesNotMatch(shell, /WavenBottomNav/);
  assert.match(shell, /pageContent/);
  assert.match(nav, /router\.navigate/);
});


test('P5.1 Revision 4 uses one rounded animated WAVEN selection pill instead of raw active rectangles', () => {
  assert.match(nav, /navGlass/);
  assert.match(nav, /selectionPill/);
  assert.match(nav, /selectionIndex/);
  assert.match(nav, /Animated\.timing/);
  assert.match(nav, /wavenMotion\.deliberateMs/);
  assert.match(nav, /borderRadius:\s*wavenRadii\.pill/);
  assert.match(nav, /activeProgress/);
  assert.doesNotMatch(nav, /itemActive/);
  assert.doesNotMatch(nav, /itemContainerActive/);
});


test('P5.1 fallback artwork is a deterministic WAVEN signal family rather than fabricated album covers', () => {
  assert.match(fallback, /WAVEN fallback artwork/);
  assert.match(fallback, /signalHeights/);
  assert.match(fallback, /seed/);
  assert.match(fallback, /interactionBlue/);
  assert.match(fallback, /ringOuter/);
  assert.doesNotMatch(fallback, />V<\/Text>/);
});


test('P5.1 Home foundation stays product-safe and music-first as later P5 revisions evolve its hierarchy', () => {
  assert.doesNotMatch(home, /DEVELOPMENT TOOLS/);
  assert.doesNotMatch(home, /playback-debug/);
  assert.doesNotMatch(home, /cloud-debug/);
  assert.doesNotMatch(home, /Nothing here yet/);
  assert.doesNotMatch(home, /Find something worth pressing play on/);
  assert.match(home, /homeBody/);
  assert.match(home, /brandTagline/);
  assert.match(shell, /paddingBottom:\s*42/);
  assert.match(home, /Recently Played/);
  assert.match(home, /Your first plays will collect here/);
  assert.match(home, /Open Your Library/);
  assert.match(cloudDebug, /if \(!__DEV__\) return null/);
});


test('P5.1 Search and Library make empty product states interactive without claiming production provider data', () => {
  assert.match(search, /TextInput/);
  assert.match(search, /SEARCH_SCOPES/);
  assert.match(search, /setScope/);
  assert.match(search, /scopeChipActive/);
  assert.match(search, /WavenArtworkFallback/);
  assert.match(library, /FILTERS/);
  assert.match(library, /setFilter/);
  assert.match(library, /Find Music/);
  assert.match(library, /router\.navigate\('\/search'\)/);
  assert.doesNotMatch(search, /fetch\(|axios|providerRegistry|searchProvider/i);
  assert.doesNotMatch(library, /SQLite|MMKV|OrionCloud|persist/i);
});
