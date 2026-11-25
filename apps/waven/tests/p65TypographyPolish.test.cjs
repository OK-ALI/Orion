const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8');

const packageJson = JSON.parse(read('package.json'));
const layout = read('app/_layout.tsx');
const tokens = read('src/theme/tokens.ts');
const text = read('src/components/typography/WavenText.tsx');
const sectionTitle = read('src/components/typography/WavenSectionTitle.tsx');
const accentTitle = read('src/components/typography/WavenAccentTitle.tsx');
const wordmark = read('src/components/brand/WavenWordmark.tsx');
const shell = read('src/components/shell/WavenAppShell.tsx');
const entry = read('app/entry.tsx');
const detailHero = read('src/components/detail/WavenDetailHeroVisual.tsx');
const home = read('app/index.tsx');
const search = read('app/search.tsx');


test('P6.5 V3.3.3 typography pins Manrope, Bebas Neue, and Sora through local bundled Expo font packages', () => {
  assert.equal(packageJson.dependencies['@expo-google-fonts/manrope'], '0.4.2');
  assert.equal(packageJson.dependencies['@expo-google-fonts/bebas-neue'], '0.4.1');
  assert.equal(packageJson.dependencies['@expo-google-fonts/sora'], '0.4.2');
  assert.match(layout, /Manrope_400Regular/);
  assert.match(layout, /Manrope_500Medium/);
  assert.match(layout, /Manrope_600SemiBold/);
  assert.match(layout, /Manrope_700Bold/);
  assert.match(layout, /Manrope_800ExtraBold/);
  assert.match(layout, /BebasNeue_400Regular/);
  assert.match(layout, /Sora_700Bold/);
  assert.match(layout, /Sora_800ExtraBold/);
  assert.match(layout, /useFonts\(\{/);
  assert.doesNotMatch(layout, /@expo-google-fonts\/dev/);
});


test('P6.5 typography polish gives WAVEN one functional Manrope voice with real bold-family routing', () => {
  assert.match(tokens, /regular: 'Manrope_400Regular'/);
  assert.match(tokens, /medium: 'Manrope_500Medium'/);
  assert.match(tokens, /semiBold: 'Manrope_600SemiBold'/);
  assert.match(tokens, /bold: 'Manrope_700Bold'/);
  assert.match(tokens, /extraBold: 'Manrope_800ExtraBold'/);
  assert.match(text, /numeric >= 800/);
  assert.match(text, /numeric >= 700/);
  assert.match(text, /numeric >= 600/);
  assert.match(text, /numeric >= 500/);
  assert.match(text, /fontFamily = explicitFamily \?\? familyForWeight/);
  assert.match(text, /fontWeight: 'normal'/);
});


test('P6.5 V3.3.3 reserves Bebas for the wordmark and gives complete headings one Sora voice', () => {
  assert.match(tokens, /wordmarkDisplay: 'BebasNeue_400Regular'/);
  assert.match(tokens, /headingBold: 'Sora_700Bold'/);
  assert.match(tokens, /headingExtraBold: 'Sora_800ExtraBold'/);
  assert.doesNotMatch(tokens, /accentDisplay/);
  assert.match(tokens, /wordmark:[\s\S]*fontFamily: wavenFonts\.wordmarkDisplay/);
  assert.match(tokens, /display:[\s\S]*fontFamily: wavenFonts\.headingExtraBold/);
  assert.match(tokens, /section:[\s\S]*fontFamily: wavenFonts\.headingBold/);
  assert.match(sectionTitle, /fontFamily: wavenTypography\.section\.fontFamily/);
  assert.match(accentTitle, /fontFamily: wavenTypography\.display\.fontFamily/);
  assert.doesNotMatch(sectionTitle, /toUpperCase/);
  assert.doesNotMatch(accentTitle, /toUpperCase/);
  assert.match(wordmark, /fontFamily: wavenTypography\.wordmark\.fontFamily/);
});


test('P6.5 typography polish normalizes product headings to intentional title case without changing phase ownership', () => {
  assert.match(home, /Find Your/);
  assert.match(search, /before="Find Your " accent="Sound"/);
  assert.match(search, /leading="Browse By" accent="Genre"/);
  assert.match(search, /leading="Moods &" accent="Moments"/);
  assert.doesNotMatch(search, /before="Explore Your Next "|before="Browse "|accent="Music"/);
  assert.match(entry, />Sound<\/Text>/);
  assert.match(entry, />Way\.<\/Text>/);
  assert.match(shell, />Music<\/Text>/);
  assert.match(detailHero, /fontFamily: wavenFonts\.bold/);
  assert.doesNotMatch(`${home}\n${search}`, /favorite|follow|download|add to playlist|writePortableProfile/i);
});
