const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const readApp = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
const readRepo = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const revealRuntime = readApp('src/features/navigation/wavenEntityReveal.ts');
const revealAnchor = readApp('src/components/navigation/WavenEntityRevealAnchor.tsx');
const revealOverlay = readApp('src/components/navigation/WavenEntityRevealOverlay.tsx');
const detailPrefetch = readApp('src/features/discovery/wavenDetailPrefetch.ts');
const layout = readApp('app/_layout.tsx');
const home = readApp('app/index.tsx');
const search = readApp('app/search.tsx');
const artistRoute = readApp('app/artist/[provider]/[id].tsx');
const albumRoute = readApp('app/album/[provider]/[id].tsx');
const detail = readApp('src/components/detail/WavenMusicDetailFoundation.tsx');
const heroVisual = readApp('src/components/detail/WavenDetailHeroVisual.tsx');
const shell = readApp('src/components/shell/WavenAppShell.tsx');
const provider = readApp('src/infrastructure/music/providers/youtubeMusicMetadata.ts');
const wavenPackage = readApp('package.json');
const design = readRepo('docs/design/WAVEN-UIUX-REFERENCE-DESIGN-CONTRACT.md');
const master = readRepo('docs/plans/WAVEN-V1-MASTER-PLAN.md');

test('P6.4D owns an origin-aware reversible Artist and Album entity reveal', () => {
  assert.match(revealRuntime, /registerWavenEntityRevealAnchor/);
  assert.match(revealRuntime, /beginWavenEntityReveal\(/);
  assert.match(revealRuntime, /beginWavenEntityRevealExit/);
  assert.match(revealRuntime, /markWavenEntityRevealHandoffReady/);
  assert.match(revealRuntime, /commitWavenEntityRevealExit/);
  assert.match(revealRuntime, /histories\.set/);
  assert.match(revealRuntime, /refreshedOrigin/);
  assert.match(revealAnchor, /measureInWindow/);
  assert.match(revealOverlay, /useSharedValue/);
  assert.match(revealOverlay, /useAnimatedStyle/);
  assert.match(revealOverlay, /withTiming/);
  assert.match(revealOverlay, /borderRadius: Math\.min\(width, height\) \* radiusRatio/);
  assert.doesNotMatch(revealOverlay, /useNativeDriver:\s*false/);
});

test('P6.4D seeds the reveal from real artwork on Home Search and Artist releases', () => {
  assert.match(home, /WavenEntityRevealAnchor/);
  assert.match(home, /beginWavenEntityReveal/);
  assert.match(search, /WavenEntityRevealAnchor/);
  assert.match(search, /beginWavenEntityReveal/);
  assert.match(artistRoute, /WavenDetailReleaseRail/);
  assert.match(artistRoute, /beginWavenEntityReveal/);
  assert.match(detail, /role="origin"/);
  assert.match(detail, /onAlbumPress/);
});

test('P6.4D detail destinations remove the floating artwork card and reveal into a full-bleed hero', () => {
  assert.match(detail, /WavenFullBleedArtwork/);
  assert.match(detail, /role="destination"/);
  assert.match(detail, /marginHorizontal: -layout\.gutter/);
  assert.match(detail, /Animated\.event/);
  assert.match(detail, /translateY: parallax/);
  assert.match(detail, /Animated\.stagger/);
  assert.doesNotMatch(detail, /heroArtworkFrame|artworkSheen|heroSignal/);
  assert.match(provider, /bestThumb\(thumbnailList\(header\), 1200\)/);
});

test('P6.4D disables competing detail animation without changing the root startup route', () => {
  assert.match(layout, /WavenEntityRevealOverlay/);
  assert.match(layout, /initialRouteName:\s*'index'/);
  assert.match(layout, /ENTITY_DETAIL_ROUTE_NAMES\.has\(route\.name\)/);
  assert.doesNotMatch(layout, /<Stack\.Screen\s+name="artist\/\[provider\]\/\[id\]"/);
  assert.doesNotMatch(layout, /<Stack\.Screen\s+name="album\/\[provider\]\/\[id\]"/);
  assert.match(home, /useWavenReducedMotion/);
  assert.match(search, /useWavenReducedMotion/);
  assert.match(artistRoute, /useWavenReducedMotion/);
  assert.match(detail, /useWavenReducedMotion/);
  assert.match(shell, /Animated\.ScrollView/);
});

test('P6.4D direct detail routes fail safely to Home and Back never assumes navigator history', () => {
  for (const routeSource of [artistRoute, albumRoute]) {
    assert.match(routeSource, /hasRouteIdentity = Boolean\(provider && id\)/);
    assert.match(routeSource, /if \(hasRouteIdentity\) return;\s*router\.replace\('\/'\)/s);
    assert.match(routeSource, /router\.canGoBack\(\)/);
    assert.match(routeSource, /router\.replace\('\/'\)/);
    assert.match(routeSource, /onBack=\{handleBack\}/);
  }
});


test('P6.4D motion repair keeps one authoritative artwork owner through the forward handoff', () => {
  assert.match(revealRuntime, /handoffReady: boolean/);
  assert.match(revealOverlay, /function revealEnterDestination\(transitionToken: number\)/);
  assert.match(revealOverlay, /markWavenEntityRevealHandoffReady\(transitionToken\)/);
  assert.match(revealRuntime, /visualReady: false/);
  assert.match(revealRuntime, /destinationVisualReady: false/);
  assert.match(revealRuntime, /markWavenEntityRevealVisualReady/);
  assert.match(revealRuntime, /markWavenEntityRevealDestinationVisualReady/);
  assert.match(revealAnchor, /transition\.phase === 'enter' && transition\.visualReady/);
  assert.match(revealOverlay, /if \(!transition\.visualReady\) return/);
  assert.match(revealOverlay, /artworkLease\.onLoad\(\);[\s\S]*revealOverlayVisual\(transition\.token\)/);
  assert.match(revealOverlay, /transition\.destinationReady && transition\.destinationVisualReady/);
  assert.match(revealOverlay, /handoffProgress\.value = withTiming/);
  assert.match(revealOverlay, /scheduleOnRN\(completeTransition, transition\.token\)/);
  assert.match(detail, /enteringThisEntity/);
  assert.match(detail, /enterHandoffReady/);
  assert.match(detail, /hideSharpArtwork/);
  assert.match(detail, /enteringThisEntity && !enterHandoffReady/);
  assert.match(detail, /markWavenEntityRevealDestinationVisualReady/);
  assert.match(detail, /onLoad=\{onSharpLoad\}/);
  assert.match(detail, /const hideSharpArtwork = enteringThisEntity && !enterHandoffReady/);
  assert.doesNotMatch(detail, /exitingThisEntity \|\| \(enteringThisEntity && !enterHandoffReady\)/);
  assert.match(revealAnchor, /overlayOwnsOrigin/);
  assert.match(revealAnchor, /opacity:\s*0/);
  assert.doesNotMatch(detail, /requestAnimationFrame\(onBack\)/);
});

test('P6.4D motion repair uses one UI and Android system Back exit controller', () => {
  assert.match(detail, /const requestEntityBack = useCallback/);
  assert.match(detail, /BackHandler\.addEventListener\('hardwareBackPress'/);
  assert.match(detail, /void requestEntityBack\(\)/);
  assert.match(detail, /onPress=\{\(\) => void requestEntityBack\(\)\}/);
  assert.match(detail, /beginWavenEntityRevealExit\(\s*entityKey,\s*\(\) => onBackRef\.current\(\),\s*artworkUrl/s);
});

test('P6.4D motion repair keeps seed artwork authoritative through handoff and crossfades quality later', () => {
  assert.match(detail, /const baseArtworkUrl = normalizedSeedArtworkUrl \|\| normalizedArtworkUrl/);
  assert.match(detail, /const qualityArtworkUrl =/);
  assert.match(detail, /Image\.prefetch\(qualityArtworkUrl\)/);
  assert.match(detail, /allowQualityUpgrade/);
  assert.match(detail, /qualityOpacity/);
  assert.match(detail, /duration: 180/);
  assert.match(detail, /!enteringThisEntity && !exitingThisEntity && !revealTransition/);
  assert.match(detail, /WAVEN_DETAIL_HERO_SHARP_OPACITY/);
  assert.match(detail, /WavenDetailHeroGradients/);
});

test('P6.4D Transition Scene remeasures the restored source before reverse contraction and crossfades landing', () => {
  assert.match(revealRuntime, /exitOriginReady: boolean/);
  assert.match(revealRuntime, /originHandoffReady: boolean/);
  assert.match(revealRuntime, /captureStableRegistered/);
  assert.match(revealRuntime, /refreshWavenEntityRevealExitOrigin/);
  assert.match(revealOverlay, /EXIT_OWNERSHIP_MS = 72/);
  assert.match(revealOverlay, /EXIT_DEPARTURE_PROGRESS = 0\.08/);
  assert.match(revealOverlay, /EXIT_DEPARTURE_MS = 140/);
  assert.match(revealOverlay, /travelProgress\.value = withTiming\(\s*EXIT_DEPARTURE_PROGRESS/s);
  assert.match(revealOverlay, /EXIT_LANDING_HANDOFF_MS = 96/);
  assert.match(revealOverlay, /refreshExitOrigin/);
  assert.match(revealOverlay, /transition\.exitOriginReady/);
  assert.match(revealOverlay, /markWavenEntityRevealOriginHandoffReady/);
  assert.match(revealAnchor, /!transition\.originHandoffReady/);
  assert.doesNotMatch(revealOverlay, /EXIT_ROUTE_SETTLE_MS/);
});

test('P6.4D Transition Scene keeps geometry and crop interpolation on the Reanimated UI thread', () => {
  assert.match(revealOverlay, /from 'react-native-reanimated'/);
  assert.match(revealOverlay, /travelProgress\.value = withTiming/);
  assert.match(revealOverlay, /Easing\.inOut\(Easing\.cubic\)/);
  assert.match(revealOverlay, /function coverScale/);
  assert.match(revealOverlay, /function normalizedRadius/);
  assert.match(revealOverlay, /Math\.min\(0\.5, radius \/ Math\.max\(1, Math\.min\(width, height\)\)\)/);
  assert.match(revealOverlay, /function artistRadiusMorphProgress/);
  assert.match(revealOverlay, /\[0, 0\.12, 0\.5, 0\.72, 1\]/);
  assert.match(revealOverlay, /\[0, 0\.04, 0\.76, 0\.96, 1\]/);
  assert.match(revealOverlay, /\[0, 0\.5, 0\.72, 0\.9, 1\]/);
  assert.match(revealOverlay, /\[0, 0\.04, 0\.28, 0\.78, 1\]/);
  assert.match(revealOverlay, /transition\?\.kind === 'artist'/);
  assert.match(revealOverlay, /phase\.value === 1/);
  assert.match(revealOverlay, /const radiusRatio = interpolate/);
  assert.match(revealOverlay, /Math\.min\(width, height\) \* radiusRatio/);
  assert.match(home, /sourceBorderRadius = isArtist\s*\? discoveryMediaArtworkSize \/ 2\s*: wavenRadii\.md/s);
  assert.match(home, /circular=\{isArtist\}/);
  assert.match(revealOverlay, /toRadius\.value = target\.borderRadius/);
  assert.match(revealOverlay, /toRadius\.value = transition\.to\.borderRadius/);
  assert.match(revealOverlay, /artworkWidth\.value/);
  assert.match(revealOverlay, /artworkHeight\.value/);
  assert.match(revealOverlay, /renderedWidth/);
  assert.match(revealOverlay, /renderedHeight/);
  assert.match(revealOverlay, /resizeMode="stretch"/);
  assert.match(revealOverlay, /styles\.artworkCanvas/);
  assert.match(revealOverlay, /overflow: 'hidden'/);
  assert.doesNotMatch(revealOverlay, /useNativeDriver:\s*false/);
});

test('P6.4D Transition Scene finishes the visual destination before forward navigation commits', () => {
  assert.match(revealRuntime, /pendingEnterCommit/);
  assert.match(revealRuntime, /destinationReady: false/);
  assert.match(revealOverlay, /ENTER_TRAVEL_MS = 520/);
  assert.match(revealOverlay, /scheduleOnRN\(commitEnterTransition, transition\.token\)/);
  assert.match(revealOverlay, /sceneBackdropStyle/);
  assert.match(revealOverlay, /heroOverlayStyle/);
  assert.match(revealOverlay, /kindStyle/);
  assert.match(revealOverlay, /titleStyle/);
  assert.doesNotMatch(revealOverlay, /ENTER_SOURCE_CONTEXT_MS/);
  for (const routeSource of [home, search, artistRoute]) {
    assert.match(routeSource, /beginWavenEntityReveal\([\s\S]*?\(\) => router\.push/);
    assert.match(routeSource, /if \(started\) return;/);
  }
});

test('P6.4D Transition Scene releases only after stable destination geometry and pixel-matched hero ownership', () => {
  assert.match(revealRuntime, /captureStableRegistered/);
  assert.match(revealRuntime, /rectsMatch/);
  assert.match(revealRuntime, /destinationReady: true/);
  assert.match(revealOverlay, /transition\.destinationReady/);
  assert.match(revealOverlay, /ENTER_HANDOFF_MS = 140/);
  assert.match(revealOverlay, /requestAnimationFrame\(\(\) => requestAnimationFrame\(beginHandoff\)\)/);
  assert.match(revealOverlay, /WavenDetailHeroGradients/);
  assert.match(revealOverlay, /wavenDetailHeroCopyStyles/);
  assert.match(detail, /wavenDetailHeroCopyStyles/);
  assert.match(heroVisual, /WAVEN_DETAIL_HERO_BLUR_OPACITY = 0\.5/);
  assert.match(heroVisual, /WAVEN_DETAIL_HERO_BLUR_SCALE = 1\.15/);
  assert.match(heroVisual, /WAVEN_DETAIL_HERO_SHARP_OPACITY = 1/);
  assert.match(heroVisual, /WAVEN_DETAIL_HERO_SUBTITLE_SLOT_HEIGHT = 30/);
  assert.match(home, /borderRadius=\{sourceBorderRadius\}/);
  assert.match(search, /borderRadius=\{circular \? 29 : 10\}/);
});

test('P6.4D Transition Scene primes provider detail during motion and suppresses a flash-loading handoff', () => {
  assert.match(detailPrefetch, /primeWavenArtistDetail/);
  assert.match(detailPrefetch, /primeWavenAlbumDetail/);
  assert.match(detailPrefetch, /readWavenArtistDetailPrefetch/);
  assert.match(detailPrefetch, /readWavenAlbumDetailPrefetch/);
  assert.match(detailPrefetch, /readWavenArtistDetailSnapshot/);
  assert.match(detailPrefetch, /readWavenAlbumDetailSnapshot/);
  assert.match(detailPrefetch, /10 \* 60_000/);
  assert.match(home, /primeWavenArtistDetail/);
  assert.match(home, /primeWavenAlbumDetail/);
  assert.match(search, /primeWavenArtistDetail/);
  assert.match(search, /primeWavenAlbumDetail/);
  assert.match(artistRoute, /readWavenArtistDetailPrefetch/);
  assert.match(artistRoute, /primeWavenAlbumDetail\(album\)/);
  assert.match(albumRoute, /readWavenAlbumDetailPrefetch/);
  assert.match(detail, /showLoadingState/);
  assert.match(detail, /setTimeout\(\(\) => setShowLoadingState\(true\), 720\)/);
  assert.match(detail, /function WavenDetailLoadingPulse/);
  assert.match(detail, /styles\.loadingPulseTrack/);
  assert.doesNotMatch(detail, /Bringing the music into focus/);
  assert.doesNotMatch(detail, /ActivityIndicator/);
});

test('P6.4D Transition Scene choreographs destination body without compounded float', () => {
  assert.match(detail, /createContext<WavenDetailMotionContextValue>/);
  assert.match(detail, /function useWavenDetailEntrance/);
  assert.match(detail, /ready: status === 'ready' && !enteringThisEntity && !exitingThisEntity/);
  assert.match(detail, /bodyHandoff/);
  assert.match(detail, /outputRange: \[4, 0\]/);
  assert.match(detail, /48 \+ revealIndex \* 44/);
  assert.match(detail, /76 \+ Math\.min\(revealIndex, 8\) \* 24/);
  assert.match(detail, /88 \+ Math\.min\(revealIndex, 7\) \* 26/);
  assert.match(detail, /controlsReveal/);
  assert.match(detail, /WavenAnimatedReleaseCard/);
});

test('P6.4D remains presentation-only with no dependency or later-phase ownership expansion', () => {
  assert.doesNotMatch(`${detail}\n${revealRuntime}\n${revealOverlay}\n${artistRoute}\n${albumRoute}`, /favorite|follow|download|add to playlist|MediaSession|resolveCandidate|playbackUrl|streamUrl|writePortableProfile|Orion Cloud/i);
  assert.doesNotMatch(wavenPackage, /expo-blur/);
  assert.match(design, /P6\.4D Entity Reveal \+ full-bleed detail motion contract/);
  assert.match(master, /P6\.4D Entity Reveal \+ full-bleed detail motion/);
  assert.match(master, /completion remains \*\*45%\*\*/);
  assert.match(master, /Phase 7 and every later phase remain \*\*NOT AUTHORIZED\*\*/);
});
