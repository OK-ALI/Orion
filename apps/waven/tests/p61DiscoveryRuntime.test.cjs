const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const readApp = (relativePath) =>
  fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
const readRepo = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const broker = readApp('src/features/discovery/providerRequestBroker.ts');
const runtime = readApp('src/features/discovery/wavenDiscoveryRuntime.ts');
const youtube = readApp(
  'src/infrastructure/music/providers/youtubeMusicMetadata.ts',
);
const master = readRepo('docs/plans/WAVEN-V1-MASTER-PLAN.md');

test('P6.1 adapts YouTube Music metadata and discovery without importing Desktop streaming machinery', () => {
  assert.match(youtube, /createYouTubeMusicMetadataProvider/);
  assert.match(youtube, /createYouTubeMusicDashboardProvider/);
  assert.match(youtube, /music\/get_search_suggestions/);
  assert.match(youtube, /browseId: 'FEmusic_home'/);
  assert.match(youtube, /continueSearch/);
  assert.doesNotMatch(
    youtube,
    /yt-dlp|ytdlp|child_process|binaryPath|resolveCandidate|playbackUrl|http_headers|requested_downloads/,
  );
});

test('P6.1 provider broker owns bounded timeout, cancellation, sanitized failures, and health only', () => {
  assert.match(broker, /class WavenProviderHealthBook/);
  assert.match(broker, /new AbortController\(\)/);
  assert.match(broker, /Promise\.race/);
  assert.match(broker, /cleanProviderError/);
  assert.match(broker, /authentication_required/);
  assert.match(broker, /rate_limited/);
  assert.match(broker, /unavailable/);
  assert.doesNotMatch(
    broker,
    /AsyncStorage|SecureStore|MMKV|sqlite|Orion Cloud|writePortableProfile|AudioEngine|NativeModules/,
  );
});

test('P6.1 discovery runtime composes shared music providers without inventing a second music domain', () => {
  assert.match(runtime, /MusicMetadataProvider/);
  assert.match(runtime, /MusicDashboardProvider/);
  assert.match(runtime, /queryMusicProviders/);
  assert.match(runtime, /wavenDiscoveryRuntime/);
  assert.match(runtime, /getProviderDescriptors/);
  assert.match(runtime, /continueSearch/);
  assert.match(runtime, /getSuggestions/);
  assert.match(runtime, /getDashboard/);
  assert.doesNotMatch(
    runtime,
    /interface\s+MusicTrack|interface\s+MusicArtist|interface\s+MusicAlbum|interface\s+MusicPlaylist/,
  );
  assert.doesNotMatch(
    runtime,
    /expo-audio|AudioEngine|MediaPlayer|writePortableProfile|Orion Cloud|AsyncStorage|SecureStore|MMKV/,
  );
});

test('P6.1 records a provider-runtime foundation without advancing WAVEN completion or later phases', () => {
  assert.match(master, /P6\.1 Provider runtime foundation/);
  assert.match(master, /YouTube Music metadata\/dashboard adapter/);
  assert.match(master, /request broker with bounded timeout, cancellation, sanitized failure text, and provider-health classification/);
  assert.match(master, /Current authoritative WAVEN v1 completion: 45%/);
  assert.match(master, /Phase 7 and every later phase remain \*\*NOT AUTHORIZED\*\*/);
  assert.match(master, /`P6\.2` owns the first product Search wiring/);
});
