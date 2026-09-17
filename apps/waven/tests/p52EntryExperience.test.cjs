const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const layout = read('app/_layout.tsx');
const home = read('app/index.tsx');
const search = read('app/search.tsx');
const library = read('app/library.tsx');
const entry = read('app/entry.tsx');
const signal = read('src/components/entry/WavenEntrySignal.tsx');
const atmosphericCanvas = read('src/components/surfaces/WavenAtmosphericCanvas.tsx');
const appShell = read('src/components/shell/WavenAppShell.tsx');
const session = read('src/features/account/wavenEntrySession.ts');
const identity = read('src/infrastructure/orionCloud/nativeGoogleIdentity.ts');
const contract = read('../../docs/design/WAVEN-UIUX-REFERENCE-DESIGN-CONTRACT.md');

test('P5.2 routes a first-run WAVEN launch through a local entry-session gate without changing primary navigation', () => {
  assert.match(layout, /readWavenEntrySession/);
  assert.match(layout, /router\.replace\('\/entry'\)/);
  assert.match(layout, /PRIMARY_PATHS = new Set\(\['\/', '\/search', '\/library'\]\)/);
  assert.match(layout, /WavenStartupHandoff/);
  assert.match(layout, /backgroundColor:\s*wavenColors\.canvas/);
  assert.doesNotMatch(layout, /setTimeout|sleep|delay\(/i);
});

test('P5.2 session completion updates the root gate before Entry returns Home', () => {
  assert.match(layout, /subscribeWavenEntrySession/);
  assert.match(layout, /let sessionChangeSeen = false/);
  assert.match(
    layout,
    /subscribeWavenEntrySession\(\(session\) => \{[\s\S]*sessionChangeSeen = true;[\s\S]*setEntryRequired\(!session\)/,
  );
  assert.match(layout, /if \(!mounted \|\| sessionChangeSeen\) return/);
  assert.match(layout, /unsubscribe\(\)/);

  assert.match(session, /export function subscribeWavenEntrySession/);
  assert.match(session, /wavenEntrySessionListeners\.add\(listener\)/);
  assert.match(session, /wavenEntrySessionListeners\.delete\(listener\)/);

  const persistedSessionPublications = session.match(
    /SecureStore\.setItemAsync\(WAVEN_ENTRY_SESSION_KEY, JSON\.stringify\(session\)\);\s*publishWavenEntrySession\(session\)/g,
  );
  assert.equal(persistedSessionPublications?.length, 2);

  assert.match(
    session,
    /SecureStore\.deleteItemAsync\(WAVEN_ENTRY_SESSION_KEY\);\s*publishWavenEntrySession\(null\)/,
  );

  assert.doesNotMatch(layout, /entryRedirectIssued/);
  assert.doesNotMatch(
    layout,
    /pathname !== '\/'\) return;[\s\S]*readWavenEntrySession\(\)[\s\S]*router\.replace\('\/entry'\)/,
  );
});
test('P5.2 entry inherits Reference 05 with restrained WAVEN identity, Google identity, and local-first continuation', () => {
  assert.match(entry, /WavenWordmark/);
  assert.match(entry, /WavenEntrySignal/);
  assert.match(entry, /Where <Text style=\{styles\.taglineAccent\}>Music<\/Text> Lives/);
  assert.match(entry, /Continue with Google/);
  assert.match(entry, /Continue without an account/);
  assert.match(entry, /signInToOrionCloud/);
  assert.match(entry, /completeWavenEntryWithGoogle/);
  assert.match(entry, /completeWavenEntryLocally/);
  assert.match(entry, /useWavenReducedMotion/);
  assert.match(entry, /router\.replace\('\/'\)/);
  assert.doesNotMatch(entry, /Sign in with Google, or continue without an account\./);
  assert.match(entry, /Animated\.stagger/);
  assert.match(entry, /finishEntryHandoff/);
  assert.match(entry, /handoffProgress/);
  assert.match(entry, /duration: reducedMotion \? wavenMotion\.quickMs : wavenMotion\.deliberateMs/);
  assert.match(entry, /outputRange: reducedMotion \? \[0, 0\] : \[0, -10\]/);
});

test('P5.2 sign-in presentation does not authorize Drive, read Orion Cloud, or expose the controlled write gate', () => {
  assert.doesNotMatch(entry, /nativeGoogleDriveAuthorization|authorizeOrionDrive|DriveReadAccess/);
  assert.doesNotMatch(entry, /orionCloudReadOnlyProbe|readExistingOrionPrimaryProfile/);
  assert.doesNotMatch(entry, /ControlledNoOp|prepareControlledNoOp|executePreparedControlledNoOp/);
  assert.doesNotMatch(session, /Drive|CloudProfile|PortableProfile|NoOpWrite/);
  assert.match(identity, /deliberately|signIn|accountId|email/i);
});

test('P5.2 stores only WAVEN entry/session display state in SecureStore', () => {
  assert.match(session, /expo-secure-store/);
  assert.match(session, /waven\.entry-session\.v1/);
  assert.match(session, /mode:\s*'local'/);
  assert.match(session, /mode:\s*'google'/);
  assert.match(session, /profile:\s*null/);
  assert.doesNotMatch(session, /token|authorizationCode|accessToken|refreshToken/i);
});

test('P5.2 Revision 4C makes the living waveform cinematic, fuller-width, irregular, and deeply edge-vignetted', () => {
  assert.match(signal, /WAVEN music waveform/);
  assert.match(signal, /WAVEFORM/);
  assert.match(signal, /SILVER_ACCENTS/);
  assert.match(signal, /useWindowDimensions/);
  assert.match(signal, /windowWidth - 4/);
  assert.match(signal, /edgeVignette/);
  assert.match(signal, /phaseC/);
  assert.match(signal, /barGlow/);
  assert.match(signal, /useWavenReducedMotion/);
  assert.match(signal, /Animated\.loop/);
  assert.match(signal, /138 \* amplitude/);
  assert.doesNotMatch(signal, /waveHalo|centerShimmer|haloGradient|shimmerGradient/);
  assert.doesNotMatch(signal, /sourceDot|sourceStem|vArmLeft|vArmRight|fieldEdge/);
  assert.doesNotMatch(signal, /ribbonLane|originMist|planet|orbit|purple/i);
  assert.doesNotMatch(entry, /expo-audio|Audio\.|MediaPlayer|playAsync|setAudioMode/i);

  assert.match(entry, /<Text style=\{styles\.titleSilver\}>Your <\/Text>/);
  assert.match(entry, /<Text style=\{styles\.titleBlue\}>Sound<\/Text>/);
  assert.match(entry, /<Text style=\{styles\.titleSilver\}>, Your <\/Text>/);
  assert.match(entry, /<Text style=\{styles\.titleBlue\}>Way\.<\/Text>/);

  assert.match(atmosphericCanvas, /WavenAtmosphericCanvas/);
  assert.match(atmosphericCanvas, /entry: 0\.82/);
  assert.match(entry, /WavenAtmosphericCanvas variant="entry"/);
});

test('P5.2 Revision 4D keeps one continuous atmospheric canvas behind primary content and bottom navigation', () => {
  assert.match(layout, /showPrimaryNavigation \? <WavenAtmosphericCanvas \/> : null/);
  assert.match(layout, /backgroundColor:\s*showPrimaryNavigation[\s\S]*\? 'transparent'[\s\S]*:\s*wavenColors\.canvas/);
  assert.match(layout, /showPrimaryNavigation \? <WavenBottomNav \/> : null/);
  assert.doesNotMatch(appShell, /<WavenAtmosphericCanvas \/>/);
  assert.match(appShell, /backgroundColor:\s*'transparent'/);
});

test('P5.2 Revision 4E keeps the full WAVEN brand lockup on Home and removes it from Search and Library', () => {
  assert.match(appShell, /showBrand\?: boolean/);
  assert.match(appShell, /showBrand = brandTagline/);
  assert.match(appShell, /\{showBrand \? \(/);
  assert.match(home, /<WavenAppShell brandTagline>/);
  assert.match(search, /<WavenAppShell>/);
  assert.match(library, /<WavenAppShell>/);
  assert.doesNotMatch(search, /brandTagline|showBrand/);
  assert.doesNotMatch(library, /brandTagline|showBrand/);
});

test('P5.2 Revision 4F translates Reference 02 into an artwork-led Home without fake music data', () => {
  assert.match(home, /home-reference-02-feature/);
  assert.match(home, /Find your/);
  assert.match(home, /heroTitleAccent/);
  assert.match(home, /Recently Played/);
  assert.match(home, /EXPLORE_CARDS/);
  assert.match(home, /WavenExploreIcon/);
  assert.match(home, /icon: 'songs'/);
  assert.match(home, /icon: 'artists'/);
  assert.match(home, /icon: 'albums'/);
  assert.doesNotMatch(home, /home-explore-songs|home-explore-artists|home-explore-albums/);
  assert.match(home, /Open Your Library/);
  assert.doesNotMatch(home, /Daily Mix|Top Trending|Midnight Bloom|fake artwork/i);
});

test('P5.2 Revision 4G establishes restrained WAVEN Glass while later polish may refine local hero layers', () => {
  assert.match(home, /glassTopHighlight/);
  assert.match(home, /recentState: \{[\s\S]*backgroundColor: 'rgba\(/);
  assert.match(home, /exploreCard: \{[\s\S]*backgroundColor: 'rgba\(/);
  assert.match(home, /discoveryState: \{[\s\S]*backgroundColor: 'rgba\(/);
  assert.match(home, /borderWidth: StyleSheet\.hairlineWidth/);
  assert.match(home, /heroArtworkSize = layout\.isCompact[\s\S]*\? 150[\s\S]*\? 202[\s\S]*: 172/);
  assert.match(home, /Recently Played/);
  assert.match(home, /EXPLORE_CARDS/);
  assert.match(home, /Open Your Library/);
  assert.doesNotMatch(home, /BlurView|expo-blur|backdropFilter/);
});

test('P5.2 Revision 4H removes the visible hero tint band and lets atmosphere provide the blue', () => {
  assert.match(home, /glassTopHighlight/);
  assert.doesNotMatch(home, /glassBottomTint/);
  assert.match(home, /backgroundColor: 'rgba\(5, 10, 15, 0\.5\)'/);
  assert.match(home, /Recently Played/);
  assert.match(home, /EXPLORE_CARDS/);
  assert.match(home, /Open Your Library/);
  assert.doesNotMatch(home, /backgroundColor: 'rgba\(37, 149, 216, 0\.045\)'/);
});

test('P5.2 design contract records first-run continuity, local-only use, and no Cloud music sync', () => {
  assert.match(contract, /Reference 05 — WAVEN Entry Experience/);
  assert.match(contract, /P5\.2 implementation contract/);
  assert.match(contract, /Local-only use remains supported/);
  assert.match(contract, /does not request Google Drive app-data authorization/);
  assert.match(contract, /WAVEN Orion Cloud music synchronization remains P9/);
});
