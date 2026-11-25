const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (record, filename) => record._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {
  fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText, filename);
const { TrackPlaybackHandoff } = require('../src/features/playback/trackPlayback.ts');
const track = id => ({id,title:'Catalog song',artistName:'Catalog artist',source:{provider:'ytmusic-metadata',id}});
const lease = () => ({uri:'https://media.googlevideo.com/audio?expire=999999',expiresAtMs:100_000,headers:{'User-Agent':'test'}});
function setup(overrides={}) {
  const calls=[], claims=[];
  const provider = {id:'ytmusic-streaming', searchForTrack:async t=>[{id:t.source.id,providerId:'ytmusic-streaming'}],resolveCandidate:async()=>lease(),...overrides};
  const owner = new TrackPlaybackHandoff(provider,{replace:async items=>{calls.push(items);return {state:'buffering'};}}, ids=>claims.push(ids),()=>1000);
  return {owner,calls,claims};
}
test('product handoff resolves fresh audio then sends stable intent plus ephemeral lease to Media3',async()=>{
  const {owner,calls,claims}=setup(); await owner.play(track('abcdefghijk'));
  assert.equal(calls.length,1);assert.equal(calls[0][0].track.source.id,'abcdefghijk');assert.equal(calls[0][0].streamingProvider.provider,'ytmusic-streaming');
  assert.equal(calls[0][0].resolvedSource.uri,lease().uri);assert.deepEqual(claims[0],[calls[0][0].queueId]);assert.equal(owner.getSnapshot().state,'started');
});
test('failed source resolution never replaces queue or fabricates a playing state',async()=>{
  const {owner,calls,claims}=setup({resolveCandidate:async()=>{throw Error('https://secret.example/token');}});await owner.play(track('abcdefghijk'));
  assert.equal(calls.length,0);assert.equal(claims.length,0);assert.equal(owner.getSnapshot().state,'error');assert.doesNotMatch(owner.getSnapshot().message,/secret|https|token/);
});
test('missing and expired candidates fail before native handoff',async()=>{
  for(const provider of [{searchForTrack:async()=>[]},{resolveCandidate:async()=>({...lease(),expiresAtMs:0})}]){
    const {owner,calls}=setup(provider);await owner.play(track('abcdefghijk'));assert.equal(calls.length,0);assert.equal(owner.getSnapshot().state,'error');
  }
});
test('rapid repeated taps dedupe the same pending identity',async()=>{
  let resolve;const pending=new Promise(r=>resolve=r);const {owner,calls}=setup({resolveCandidate:()=>pending});
  const first=owner.play(track('abcdefghijk'));await Promise.resolve();await owner.play(track('abcdefghijk'));resolve(lease());await first;assert.equal(calls.length,1);
});
test('a later song cancels stale resolution without handing off the earlier song',async()=>{
  let resolve;const pending=new Promise(r=>resolve=r);
  const {owner,calls}=setup({resolveCandidate:async c=>c.id==='abcdefghijk'?pending:lease()});
  const first=owner.play(track('abcdefghijk'));await Promise.resolve();await owner.play(track('ZYXWVUTSRQP'));resolve(lease());await first;
  assert.deepEqual(calls.map(c=>c[0].track.source.id),['ZYXWVUTSRQP']);
});
test('account/lifecycle cancellation prevents delayed source resolution from starting playback',async()=>{
  let resolve;const pending=new Promise(r=>resolve=r);const {owner,calls}=setup({resolveCandidate:()=>pending});
  const first=owner.play(track('abcdefghijk'));await Promise.resolve();owner.cancel();resolve(lease());await first;assert.equal(calls.length,0);assert.equal(owner.getSnapshot().state,'idle');
});
test('source refresh is performed on every new user play; stream URLs never become track metadata',async()=>{
  let resolves=0;const {owner,calls}=setup({resolveCandidate:async()=>{resolves++;return lease();}});
  await owner.play({...track('abcdefghijk'),resolvedSource:{uri:'https://stale'},cookie:'secret'});await owner.play(track('abcdefghijk'));
  assert.equal(resolves,2);assert.doesNotMatch(JSON.stringify(calls[0][0].track),/stale|cookie|secret|resolvedSource/);assert.notEqual(calls[0][0].queueId,calls[1][0].queueId);
});
test('native bridge failure remains retryable and never reports started',async()=>{
  const {owner}=setup();owner.bridge.replace=async()=>{throw Error('native failed');};await owner.play(track('abcdefghijk'));assert.equal(owner.getSnapshot().state,'error');
});
test('native plugin pin is idempotent and resolution excludes download/player ownership',()=>{
  const plugin=require('../plugins/withWavenStreamingSource.js');
  const gradle=plugin.applyGradle('dependencies {\n}');assert.equal(plugin.applyGradle(gradle),gradle);
  const app=plugin.applyApplication('package sample\nimport a.b\nPackageList(this).packages.apply {\n}');assert.equal(plugin.applyApplication(app),app);
  const native=fs.readFileSync(path.join(__dirname,'../plugins/waven-streaming-native/WavenStreamingSourceModule.kt'),'utf8');
  assert.match(native,/--skip-download/);assert.match(native,/--dump-single-json/);assert.doesNotMatch(native,/ExoPlayer|MediaSession|FFmpeg|--output|updateYoutubeDL/);
  assert.match(plugin.DEPENDENCY,/83f41ae27710b4a1d47f4a0095209f4325e4564f/);
});
test('resume re-resolves the source without replacing native queue or reclaiming its account',async()=>{
  const {owner,calls,claims}=setup();const resumed=[];owner.bridge.resume=async(qid,source)=>{resumed.push({qid,source});return {state:'playing'};};
  await owner.play(track('abcdefghijk'),'existing-queue-item');assert.equal(calls.length,0);assert.equal(claims.length,0);assert.equal(resumed[0].qid,'existing-queue-item');assert.equal(owner.getSnapshot().state,'started');
});
test('official extractor repair is an immutable hash-pinned bundled code asset',()=>{
  const crypto=require('node:crypto');
  const asset=fs.readFileSync(path.join(__dirname,'../plugins/waven-streaming-native/vendor/yt-dlp-2026.08.19'));
  const hash=crypto.createHash('sha256').update(asset).digest('hex');
  assert.equal(hash,'1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6');
  const native=fs.readFileSync(path.join(__dirname,'../plugins/waven-streaming-native/WavenStreamingSourceModule.kt'),'utf8');
  assert.ok(native.includes(hash)); assert.match(native,/player_client=visionos/);
  assert.match(native,/hash\(temporary\) != extractorHash/); assert.match(native,/temporary\.renameTo\(target\)/);
  assert.match(native,/source-length-unavailable/); assert.match(native,/bytes=1048576-/);
  assert.doesNotMatch(native,/player_client=android_vr|updateYoutubeDL|--cookies|--po-token/);
});
test('delayed native commands retain request order and skip an obsolete queued song',async()=>{
  const {owner,calls,claims}=setup(); let release,started;
  const began=new Promise(r=>started=r), gate=new Promise(r=>release=r);
  owner.bridge.replace=async items=>{calls.push(items);if(calls.length===1){started();await gate;}return {state:'buffering'};};
  const a=owner.play(track('abcdefghijk'));await began;
  const b=owner.play(track('ZYXWVUTSRQP'));await new Promise(r=>setImmediate(r));
  const c=owner.play(track('QWERTYUIOPA'));await new Promise(r=>setImmediate(r));
  assert.equal(calls.length,1);release();await Promise.all([a,b,c]);
  assert.deepEqual(calls.map(c=>c[0].track.source.id),['abcdefghijk','QWERTYUIOPA']);
  assert.equal(claims.length,2);assert.equal(owner.getSnapshot().trackKey,JSON.stringify(['ytmusic-metadata','QWERTYUIOPA']));
});

test('V8.4 one tap directly starts the existing handoff from Search, detail and Library',()=>{
  const search=fs.readFileSync(path.join(__dirname,'../app/search.tsx'),'utf8');
  const detail=fs.readFileSync(path.join(__dirname,'../src/components/detail/WavenMusicDetailFoundation.tsx'),'utf8');
  const library=fs.readFileSync(path.join(__dirname,'../src/components/library/WavenLibraryControls.tsx'),'utf8');
  assert.match(search, /<WavenTrackPlayTarget track=\{item as MusicTrack\}/);
  assert.match(detail, /<WavenTrackPlayTarget track=\{track\}/);
  assert.match(library, /kind === 'track'[\s\S]*?<WavenTrackPlayTarget track=\{entity as MusicTrack\}/);
  assert.match(library, /onPress=\{\(\) => \{ void trackPlayback\.play\(track\); \}\}/);
  assert.match(library, /accessibilityRole="button"/);
  assert.match(library, /<WavenLivingWave state=\{rowState\}/);
  assert.match(library, /busy: rowState === 'preparing' \|\| rowState === 'buffering'/);
});
test('V8.4 overflow is secondary and never traps the user while audio prepares',()=>{
  const library=fs.readFileSync(path.join(__dirname,'../src/components/library/WavenLibraryControls.tsx'),'utf8');
  assert.match(library, /Music actions for \$\{title\}/);
  assert.match(library, /setVisible\(false\);\s*void trackPlayback\.play\(entity as MusicTrack\);/);
  assert.doesNotMatch(library, /Resolving audio/);
  assert.match(library, /Preparing audio/);
});
test('V8.4 native extractor warmup is offline and serialized without claiming playback',()=>{
  const native=fs.readFileSync(path.join(__dirname,'../plugins/waven-streaming-native/WavenStreamingSourceModule.kt'),'utf8');
  const adapter=fs.readFileSync(path.join(__dirname,'../src/infrastructure/music/providers/youtubeMusicStreaming.ts'),'utf8');
  const runtime=fs.readFileSync(path.join(__dirname,'../src/features/playback/trackPlaybackRuntime.ts'),'utf8');
  assert.match(native, /fun warmUp\(promise: Promise\)[\s\S]*?executor\.execute\s*\{[\s\S]*?ensureExtractorRuntimeReady\(\)/);
  assert.match(native, /private fun ensureExtractorRuntimeReady\(\)[\s\S]*?installBundledExtractor\(\)[\s\S]*?YoutubeDL\.getInstance\(\)\.init/);
  assert.match(native, /val response = YoutubeDL\.getInstance\(\)\.execute/);
  assert.match(native, /bytes=1048576-/);
  assert.match(adapter, /export function warmWavenStreamingSource/);
  assert.match(runtime, /warmWavenStreamingSource\(\);/);
  assert.doesNotMatch(native, /ExoPlayer|MediaSession|updateYoutubeDL/);
});
test('V8.5A native diagnostic is package-gated and excludes private playback data', () => {
  const native=fs.readFileSync(path.join(__dirname,'../plugins/waven-streaming-native/WavenStreamingSourceModule.kt'),'utf8');
  assert.match(native,/if \(!phase8ValidationOnly\(\)\) return/);
  assert.match(native,/WAVEN_P08_DIAG/);
  assert.doesNotMatch(native,/Log\.i\(.*(?:videoId|requestId|source\.toString\(\)|allowedHeaders)/);
});
test('V8.4 still refreshes sources on every user play, never persists stream leases',()=>{
  const handoff=fs.readFileSync(path.join(__dirname,'../src/features/playback/trackPlayback.ts'),'utf8');
  const native=fs.readFileSync(path.join(__dirname,'../plugins/waven-streaming-native/WavenStreamingSourceModule.kt'),'utf8');
  assert.match(handoff, /this\.provider\.resolveCandidate\(candidates\[0\]/);
  assert.match(handoff, /source\.expiresAtMs! <= this\.now\(\) \+ 30_000/);
  assert.match(native, /source\.scheme != "https"/);
  assert.match(native, /source-length-unavailable/);
  assert.doesNotMatch(native, /DownloadManager|SharedPreferences|setMediaItem|MediaSession|ExoPlayer/);
});
