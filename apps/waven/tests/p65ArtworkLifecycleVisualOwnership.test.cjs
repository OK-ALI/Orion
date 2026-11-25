const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const readApp = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
const readRepo = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const lifecycle = readApp('src/features/artwork/wavenArtworkLifecycle.ts');
const leaseHook = readApp('src/hooks/useWavenArtworkLease.ts');
const search = readApp('app/search.tsx');
const home = readApp('app/index.tsx');
const detail = readApp('src/components/detail/WavenMusicDetailFoundation.tsx');
const reveal = readApp('src/features/navigation/wavenEntityReveal.ts');
const revealOverlay = readApp('src/components/navigation/WavenEntityRevealOverlay.tsx');
const mini = readApp('src/components/player/WavenMiniPlayer.tsx');
const canonical = readApp('src/features/discovery/wavenCanonicalPresentation.ts');
const provider = readApp('src/infrastructure/music/providers/youtubeMusicMetadata.ts');
const artistRoute = readApp('app/artist/[provider]/[id].tsx');
const albumRoute = readApp('app/album/[provider]/[id].tsx');
const master = readRepo('docs/plans/WAVEN-V1-MASTER-PLAN.md');
const design = readRepo('docs/design/WAVEN-UIUX-REFERENCE-DESIGN-CONTRACT.md');

function sourcePattern(constantName) {
  const pattern = new RegExp(
    `export const WAVEN_${constantName} = new RegExp\\([\\s\\S]*?\\]\\.join\\('\\|'\\),\\s*'iu',\\s*\\);`,
  );
  const block = canonical.match(pattern)?.[0] || '';
  const parts = [...block.matchAll(/String\.raw`([^`]*)`/g)].map((match) => match[1]);
  assert.ok(parts.length > 0, `${constantName} source pattern should be readable`);
  return new RegExp(parts.join('|'), 'iu');
}

function pngSize(relativePath) {
  const file = fs.readFileSync(path.join(appRoot, relativePath));
  assert.deepEqual([...file.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return {
    bytes: file.length,
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
  };
}

test('P6.5 V3.4.6 separates successful artwork evidence from transient renderer failure', () => {
  assert.match(lifecycle, /rendered: boolean/);
  assert.match(lifecycle, /source\.rendered = true/);
  assert.match(lifecycle, /const hadRendered = source\.rendered/);
  assert.doesNotMatch(lifecycle, /source\.rendered = false/);
  assert.match(lifecycle, /shouldRetry: source\.consecutiveFailures === 1/);
  assert.match(lifecycle, /lease\.lastRenderedSourceKey = sourceKey/);
  assert.match(lifecycle, /readWavenArtworkBackupSource/);
});

test('P6.5 V3.4.6 artwork lease hook never downgrades a rendered source on onError', () => {
  assert.match(leaseHook, /if \(result\.hadRendered\) setHasRendered\(true\)/);
  assert.doesNotMatch(leaseHook, /setHasRendered\(false\)/);
  assert.match(leaseHook, /setRetryNonce\(\(value\) => value \+ 1\)/);
  assert.match(leaseHook, /readWavenArtworkBackupSource/);
  assert.match(leaseHook, /setBackupSourceKey\(null\)/);
  assert.match(leaseHook, /showFallback: !normalizedSourceKey \|\| \(!hasRendered && !backupSourceKey\)/);
});

test('P6.5 V3.4.6 removes scattered sticky failed-image latches from product artwork surfaces', () => {
  const surfaces = `${search}\n${home}\n${detail}\n${mini}`;
  assert.doesNotMatch(surfaces, /const \[failed, setFailed\]/);
  assert.doesNotMatch(surfaces, /artworkFailed|setArtworkFailed/);
  assert.doesNotMatch(surfaces, /onError=\{\(\) => setFailed\(true\)\}/);
});

test('P6.5 V3.4.6 Search and Home entity artwork use provider-keyed visual leases with resize decoding', () => {
  assert.match(search, /wavenArtworkLeaseKey\([\s\S]*presentationKindForSearchScope\(scope\)[\s\S]*item\.source\.provider[\s\S]*item\.source\.id/);
  assert.match(home, /wavenArtworkLeaseKey\([\s\S]*presentationKindForHomeType\(type\)[\s\S]*item\.source\.provider[\s\S]*item\.source\.id/);
  assert.match(search, /resizeMethod="resize"/);
  assert.match(home, /resizeMethod="resize"/);
  assert.match(search, /source=\{\{ uri: artworkLease\.backupSourceKey \}\}/);
  assert.match(home, /source=\{\{ uri: artworkLease\.backupSourceKey \}\}/);
});

test('P6.5 V3.4.6 bundled Genre and Mood artwork is recoverable rather than sticky-fallback', () => {
  assert.match(search, /Image\.resolveAssetSource\(artworkSource\)/);
  assert.match(search, /leaseKey: `bundled-discovery:\$\{seed\}`/);
  assert.match(search, /artworkLease\.showFallback/);
  assert.match(search, /onLoad=\{artworkLease\.onLoad\}/);
  assert.match(search, /onError=\{artworkLease\.onError\}/);
});

test('P6.5 V3.4.6 density-appropriate PNG masters cut bundled discovery decode pressure', () => {
  const assetDir = path.join(appRoot, 'assets', 'discovery');
  const names = fs.readdirSync(assetDir).filter((name) => name.endsWith('.png')).sort();
  assert.equal(names.length, 16);
  let decodedBytes = 0;
  let compressedBytes = 0;
  for (const name of names) {
    const info = pngSize(path.join('assets', 'discovery', name));
    compressedBytes += info.bytes;
    decodedBytes += info.width * info.height * 4;
    assert.ok(info.width <= 1024, `${name} width must be decode-disciplined`);
    assert.ok(info.height <= 768, `${name} height must be decode-disciplined`);
    assert.ok(info.bytes > 500_000, `${name} must remain a high-fidelity PNG presentation master`);
  }
  assert.ok(decodedBytes < 45 * 1024 * 1024, 'discovery RGBA footprint must remain below 45 MiB');
  assert.ok(compressedBytes < 16 * 1024 * 1024, 'bundled discovery PNG payload must remain below 16 MiB');
});

test('P6.5 V3.4.6 detail hero keeps decorative blur failure non-authoritative and releases duplicate quality layers', () => {
  assert.match(detail, /const baseLease = useWavenArtworkLease/);
  assert.match(detail, /const qualityLease = useWavenArtworkLease/);
  assert.match(detail, /const \[qualityVisualReady, setQualityVisualReady\] = useState\(false\)/);
  assert.match(detail, /const \[qualityCommitted, setQualityCommitted\] = useState\(false\)/);
  const layers = detail.match(/const renderArtworkLayers = \([\s\S]*?\n  \};/)?.[0] || '';
  const blur = layers.match(/renderBlur \? \(\s*<Animated\.Image[\s\S]*?blurRadius=[\s\S]*?\/>/)?.[0] || '';
  assert.ok(blur.length > 0);
  assert.doesNotMatch(blur, /onError=/);
  assert.match(layers, /renderSharp \? \(\s*<Animated\.Image[\s\S]*?onError=\{onSharpError\}/);
  assert.match(detail, /setQualityCommitted\(true\)/);
  assert.match(detail, /true,\s*!qualityCommitted,/);
  assert.match(detail, /qualityOpacity,[\s\S]*false,\s*true,/);
  assert.match(detail, /entityKey=\{entityKey\}/);
});

test('P6.5 V3.4.6 reveal overlay participates in the same artwork lease and retries only the sharp owner', () => {
  assert.match(revealOverlay, /useWavenArtworkLease\(/);
  assert.match(revealOverlay, /leaseKey: transition\?\.entityKey/);
  assert.match(revealOverlay, /key=\{artworkLease\.imageKey\}/);
  assert.match(revealOverlay, /artworkLease\.onLoad\(\);[\s\S]*revealOverlayVisual\(transition\.token\)/);
  assert.match(revealOverlay, /onError=\{artworkLease\.onError\}/);
});

test('P6.5 V3.4.6 Track Release and Mini Player artwork use the coherent visual lease contract', () => {
  assert.match(detail, /wavenArtworkLeaseKey\('track', track\.source\.provider, track\.source\.id\)/);
  assert.match(detail, /wavenArtworkLeaseKey\('album', album\.source\.provider, album\.source\.id\)/);
  assert.match(mini, /leaseKey: `mini-player:\$\{item\?\.queueId \|\| 'empty'\}`/);
  assert.match(mini, /onLoad=\{artworkLease\.onLoad\}/);
  assert.equal((detail.match(/source=\{\{ uri: artworkLease\.backupSourceKey \}\}/g) || []).length, 2);
  assert.match(mini, /source=\{\{ uri: artworkLease\.backupSourceKey \}\}/);
});

test('P6.5 V3.4.6 reveal and artwork identity share one entity-key format', () => {
  assert.match(reveal, /return wavenArtworkLeaseKey\(kind, provider, id\)/);
  assert.match(lifecycle, /return `\$\{kind\}:\$\{provider\}:\$\{id\}`/);
});

test('P6.5 V3.4.6 preserves source seed through Artist and nested Album destinations', () => {
  assert.match(artistRoute, /seedArtworkUrl=\{wavenEntityArtworkUrl\(presentedSeedArtist\)\}/);
  assert.match(albumRoute, /seedArtworkUrl=\{wavenEntityArtworkUrl\(presentedSeedAlbum\)\}/);
  assert.match(artistRoute, /artworkUrl: wavenEntityArtworkUrl\(presented\)/);
  assert.match(artistRoute, /beginWavenEntityReveal/);
});

test('P6.5 V3.4.6 canonical title semantics cover live-version and PLAY program wrappers', () => {
  const secondary = sourcePattern('SECONDARY_PRESENTATION_PATTERN');
  assert.equal(secondary.test('we can\'t be friends (live version)'), true);
  assert.equal(secondary.test('Song - Live Session'), true);
  assert.equal(secondary.test('Artist PLAY ▶ Song Title'), true);
  assert.equal(secondary.test('Song - Single'), false);
  assert.match(canonical, /live\\s\+\(\?:version\|session\|recording\)/);
});

test('P6.5 V3.4.6 records provider renderer provenance without changing shared music contracts', () => {
  assert.match(provider, /function nestedMusicVideoType\(value: any, depth = 0\)/);
  assert.match(provider, /normalizedRendererType !== 'MUSIC_VIDEO_TYPE_ATV'/);
  assert.match(provider, /youtube-music-view-count-renderer/);
  assert.match(provider, /rememberWavenMediaPresentationEvidence\(track/);
  assert.match(canonical, /sessionMediaPresentationEvidence/);
});

test('P6.5 V3.4.6 Songs and New Releases consume entity-level presentation evidence', () => {
  assert.match(canonical, /isWavenSecondaryEntityPresentation\(track\)/);
  assert.match(canonical, /isWavenSecondaryEntityPresentation\(album\)/);
  assert.match(provider, /function isVideoReleasePresentation\(item: MusicAlbum \| MusicTrack\)[\s\S]*isWavenSecondaryEntityPresentation\(item\)/);
  assert.match(provider, /function isLowConfidenceSearchTrack\(item: MusicTrack\)[\s\S]*isWavenLowConfidenceEntityPresentation\(item\)/);
});

test('P6.5 V3.4.6 documents physical rejection repair while preserving frozen phase boundaries', () => {
  assert.match(master, /P6\.5 V3\.4\.6 artwork lifecycle \+ visual ownership hardening/);
  assert.match(master, /transient React Native `Image\.onError`/);
  assert.match(master, /WAVEN remains \*\*45%\*\*/);
  assert.match(design, /P6\.5 V3\.4\.6 artwork-lifecycle \+ visual-ownership contract/);
  assert.match(design, /Real artwork stays real/);
  assert.match(design, /Phase 7 persistence/);
});
