const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const test = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (record, filename) => record._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { ConnectivityService: Service, wavenConnectivity: globalService } = require('../src/infrastructure/connectivity/connectivityService.ts');
const { OfflineMetadataStore: Cache, METADATA_LIMITS: limits, OFFLINE_METADATA_KEY: key } = require('../src/infrastructure/connectivity/offlineMetadata.ts');
const { probeInternetEndpoint: probe, boundedConnectivityProbe: bounded } = require('../src/infrastructure/connectivity/reachabilityProbe.ts');
const { LocalLibraryRepository: Library, libraryEntityKey } = require('../src/features/library/localLibrary.ts');
const { WavenProviderHealthBook: Health, queryMusicProviders: query } = require('../src/features/discovery/providerRequestBroker.ts');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const storage = () => { const map = new Map(); return { map, get: k => map.get(k) ?? null, set: (k,v) => map.set(k,v), remove: k => map.delete(k) }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(t, overrides = {}) {
  let now = 10_000; const service = new Service(() => now, 1_000_000), calls = [];
  service.start({ internet: async () => { calls.push('internet'); return true; }, providers: async () => { calls.push('providers'); return { music: true }; }, ...overrides });
  t.after(() => service.stop());
  return { service, calls, advance: () => { now += 2001; } };
}
const connected = type => ({ connected: true, internetReachable: true, type });
const disconnected = { connected: false, internetReachable: false, type: 'none' };

test('one owner performs ordered internet/provider/Cloud/pending/metadata recovery', async t => {
  const { service: s, calls } = setup(t);
  for (const stage of ['metadata','pending','cloud']) s.registerRecovery(stage, stage, async () => { calls.push(stage); assert.equal(s.getSnapshot().remoteReady, false); });
  s.observe(connected('wifi')); await s.revalidate();
  assert.deepEqual(calls, ['internet','providers','cloud','pending','metadata']);
  assert.equal(s.getSnapshot().state, 'ONLINE'); assert.equal(s.getSnapshot().recoveryEpoch, 1);
});
test('Wi-Fi loss with validated cellular internet recovers rather than claiming offline', async t => {
  const { service: s, advance } = setup(t); s.observe(connected('wifi')); await s.revalidate(); advance();
  s.observe(connected('cellular')); assert.equal(s.getSnapshot().state, 'RECOVERING'); await s.revalidate();
  assert.equal(s.getSnapshot().state, 'ONLINE'); assert.equal(s.getSnapshot().transport, 'cellular');
});
test('no transport immediately blocks providers and Cloud without polling or probe calls', async t => {
  const { service: s, calls } = setup(t); s.observe(disconnected); await s.revalidate();
  assert.equal(s.getSnapshot().state, 'OFFLINE'); assert.deepEqual(calls, []);
  await assert.rejects(s.runRemote('orion-cloud', async () => assert.fail('must not run')), /offline/);
});
test('unknown transport and captive/unusable internet remain offline before provider work', async t => {
  const { service: s, calls } = setup(t, { internet: async () => false }); await s.revalidate();
  assert.equal(s.getSnapshot().state, 'OFFLINE'); assert.deepEqual(calls, []);
});
test('a failed independent endpoint does not negate Android validated internet', async t => {
  const { service: s } = setup(t, { internet: async () => false }); s.observe(connected('wifi')); await s.revalidate();
  assert.equal(s.getSnapshot().state, 'ONLINE');
});
test('provider outage is degraded with healthy services usable and no false offline', async t => {
  const { service: s } = setup(t, { providers: async () => ({ music: false, charts: true }) }); await s.revalidate();
  assert.equal(s.getSnapshot().state, 'DEGRADED'); assert.equal(s.canRequest('music'), false); assert.equal(s.canRequest('charts'), true);
  assert.equal(await s.runRemote('charts', async () => 'healthy'), 'healthy');
});
test('provider failure during metadata recovery remains degraded after recovery', async t => {
  const { service: s } = setup(t); s.registerRecovery('metadata', 'metadata', async () => s.reportProvider('music', false));
  await s.revalidate(); assert.equal(s.getSnapshot().state, 'DEGRADED');
});
test('background cancels remote work and foreground revalidates without owning audio', async t => {
  const { service: s, advance } = setup(t); await s.revalidate(); let release;
  const work = s.runRemote('music', () => new Promise(resolve => release = resolve)); await tick();
  s.setActive(false); assert.equal(s.canRequest(), false); release('late'); await assert.rejects(work, /unavailable|Reconnecting/);
  advance(); s.setActive(true); await s.revalidate(); assert.equal(s.getSnapshot().state, 'ONLINE');
});
test('transport loss cancels in-flight and queued calls; stale results cannot publish', async t => {
  const { service: s } = setup(t); await s.revalidate(); let release, invoked = 0;
  const a = s.runRemote('music', () => new Promise(resolve => release = resolve)); await tick();
  const b = s.runRemote('music', async () => invoked++); const checked = Promise.allSettled([a,b]);
  s.observe(disconnected); release('old'); const results = await checked;
  assert.ok(results.every(r => r.status === 'rejected')); assert.equal(invoked, 0);
});
test('parallel consumers serialize remote operations without duplicate recovery', async t => {
  const { service: s, calls } = setup(t); await Promise.all([s.revalidate(), s.revalidate(), s.revalidate()]);
  assert.deepEqual(calls, ['internet','providers']); let active = 0, max = 0;
  await Promise.all([1,2,3].map(n => s.runRemote('music', async () => { active++; max = Math.max(max, active); await tick(); active--; return n; })));
  assert.equal(max, 1);
});
test('rapid flapping rejects stale validation and accepts only the latest generation', async t => {
  let release; const { service: s, advance } = setup(t, { internet: () => new Promise(resolve => release = resolve) });
  s.observe(connected('wifi')); const old = s.revalidate(); await tick(); s.observe(disconnected); s.observe(connected('cellular')); release(true); await old;
  assert.equal(s.getSnapshot().recoveryEpoch, 0); advance();
  const next = s.revalidate(); await tick(); release(true); await next; assert.equal(s.getSnapshot().recoveryEpoch, 1);
});
test('minimum interval bounds repeated checks; offline jobs never run', async t => {
  const { service: s, calls } = setup(t); await s.revalidate(); await s.revalidate(); await s.revalidate();
  assert.deepEqual(calls, ['internet','providers']); s.observe(disconnected);
  s.registerRecovery('write', 'pending', async () => assert.fail('offline job')); await s.revalidate();
});
test('parent cancellation prevents a queued consumer from doing remote work', async t => {
  const { service: s } = setup(t); await s.revalidate(); const c = new AbortController(); c.abort();
  await assert.rejects(s.runRemote('music', async () => assert.fail('cancelled'), c.signal));
});
test('account change rejects old Cloud results without replaying writes or touching local state',async t=>{
  const {service:s}=setup(t);await s.revalidate();let release;
  const read=s.runRemote('orion-cloud',()=>new Promise(resolve=>release=resolve));await tick();
  s.cancelAccountWork();release('old account profile');await assert.rejects(read);assert.equal(s.getSnapshot().remoteReady,false);
});
test('pending public reads are durable, deduplicated and acknowledged after restart', () => {
  const store = storage(), a = new Cache(() => 100); a.configure(store); a.enqueue('home-charts'); a.enqueue('home-charts');
  const b = new Cache(() => 101); b.configure(store); assert.deepEqual(b.pendingKeys(), ['home-charts']);
  b.remember('home-charts', { result: { sections: [] } }); const c = new Cache(() => 102); c.configure(store); assert.deepEqual(c.pendingKeys(), []);
});
test('cache retains canonical metadata/artwork while stripping credentials, audio and arbitrary URLs', () => {
  const c = new Cache(() => 100); const s = storage(); c.configure(s);
  c.remember('album:catalog\0one', { detail: { album: { title: 'Album', source: { provider: 'catalog', id: 'one' }, artworkUrl: 'https://img.example/cover.jpg' }, tracks: [{ title: 'Song', source: {provider:'catalog',id:'two'}, uri:'https://audio.example/token', resolvedSource: {uri:'secret'}, headers:{Authorization:'secret'}, artworkUrl:'https://img.example/art?signature=secret' }] }, token:'secret', continuation:'private' });
  const raw = s.get(key); assert.doesNotMatch(raw, /secret|audio\.example|Authorization|continuation|resolvedSource/);
  const detail = c.read('album:catalog\0one').value.detail; assert.equal(detail.album.source.id,'one'); assert.equal(detail.album.artworkUrl,'https://img.example/cover.jpg');
});
test('cache uses freshness, bounded stale expiry and defensive copies', () => {
  let now = 100; const c = new Cache(() => now); c.configure(storage()); c.remember('artists', { artists: [{name:'Artist'}] });
  c.read('artists').value.artists[0].name = 'mutated'; assert.equal(c.read('artists').value.artists[0].name,'Artist');
  now += limits.freshMs + 1; assert.equal(c.read('artists',false),null); assert.ok(c.read('artists')); now += limits.staleMs; assert.equal(c.read('artists'),null);
});
test('cache and pending budgets evict deterministically and reject search/private keys', () => {
  let now = 0; const s = storage(), c = new Cache(() => ++now); c.configure(s);
  for (let i=0;i<80;i++) c.remember(`album:catalog\0${i}`, {title:`Album ${i}`});
  assert.equal(JSON.parse(s.get(key)).entries.length, limits.records); assert.equal(c.read('album:catalog\x000'),null);
  for (let i=0;i<40;i++) c.enqueue(`artist:catalog\0${i}`); assert.equal(c.pendingKeys().length,limits.pending);
  assert.equal(c.enqueue('home-charts-private'),false); assert.equal(c.enqueue('search:secret'),false);
  assert.ok(Buffer.byteLength(s.get(key)) <= limits.bytes);
});
test('cache enforces its byte budget even with large non-ASCII catalogue snapshots', () => {
  const s = storage(), c = new Cache(); c.configure(s); const value = {tracks:Array.from({length:250},(_,i)=>({title:'音'.repeat(4096),id:String(i)}))};
  for (let i=0;i<5;i++) c.remember(`album:catalog\0${i}`,value);
  assert.ok(Buffer.byteLength(s.get(key)) <= limits.bytes);
});
test('corrupt cache is preserved exactly in one recovery slot before repair', () => {
  const s=storage(), raw='{broken'; s.set(key,raw); const c=new Cache(); c.configure(s);
  assert.equal(s.get(`${key}.original`),raw); assert.ok(c.getNotice()); c.remember('artists',{artists:[]}); assert.equal(s.get(`${key}.original`),raw);
});
test('occupied corrupt backup and future-version cache block overwrite', () => {
  for (const raw of ['{corrupt',JSON.stringify({version:99,entries:[],pending:[]})]) {
    const s=storage(); s.set(key,raw); s.set(`${key}.original`,'prior original'); const c=new Cache(); c.configure(s);
    assert.equal(c.remember('artists',{artists:[]}),false); assert.equal(s.get(key),raw);
  }
});
test('failed verified cache write does not publish an undurable value', () => {
  const s=storage(), c=new Cache(); c.configure(s); c.remember('artists',{artists:[{name:'Before'}]}); const before=s.get(key);
  const set=s.set; s.set=(k,v)=>set(k,v===before?v:'mangled'); assert.equal(c.remember('artists',{artists:[{name:'After'}]}),false);
  assert.equal(c.read('artists').value.artists[0].name,'Before'); assert.equal(s.get(key),before);
});
test('unreadable preimage is never removed or overwritten during failed cache commit',()=>{
  const s=storage(),c=new Cache();c.configure(s);s.set(key,'original');let mutations=0;
  s.get=()=>{throw Error('read failed');};s.set=()=>mutations++;s.remove=()=>mutations++;
  assert.equal(c.remember('artists',{artists:[]}),false);assert.equal(mutations,0);
});
test('reconfiguring a cache reloads the new storage and does not carry prior pending intent',()=>{
  const c=new Cache();c.configure(storage());c.enqueue('home-charts');c.configure(storage());assert.deepEqual(c.pendingKeys(),[]);
});
test('offline favorites and ordered playlists persist independently without Cloud intent', async t => {
  const {service:s}=setup(t); s.observe(disconnected); const store=storage(), library=new Library(store,()=>100,'google:test-account');
  const track=id=>({id,title:'Song',artistName:'Artist',source:{provider:'catalog',id}});
  library.setFavorite('track',track('one'),true); const id=library.createPlaylist('Offline songs'); library.addTrack(id,track('one')); library.addTrack(id,track('two'));
  library.moveTrack(id,libraryEntityKey('track',track('two')),-1);
  const restored=new Library(store,()=>101,'google:test-account').getSnapshot().state;
  assert.equal(restored.favorites.length,1); assert.deepEqual(restored.playlists[0].tracks.map(t=>t.source.id),['two','one']); assert.equal(store.get(key),null);
});
test('provider broker suppresses offline requests and sanitizes the product error', async t => {
  globalService.start({internet:async()=>true,providers:async()=>({music:true})}); t.after(()=>globalService.stop()); globalService.observe(disconnected);
  const result=await query([{id:'music',name:'Music'}],new Health(),async()=>assert.fail('offline provider'));
  assert.equal(result.results.length,0); assert.match(result.errors.join(' '),/offline|unavailable/i); assert.doesNotMatch(result.errors.join(' '),/ENET|https/);
});
test('real HTTP reachability accepts 204 and rejects login HTML, redirects and timeouts', async t => {
  const server=http.createServer((req,res)=>{if(req.url==='/204'){res.writeHead(204);res.end();}else if(req.url==='/login'){res.end('<html>Sign in</html>');}else if(req.url==='/redirect'){res.writeHead(302,{Location:'/204'});res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); t.after(()=>{server.closeAllConnections();server.close();});
  const url=`http://127.0.0.1:${server.address().port}`, c=new AbortController();
  assert.equal(await probe(`${url}/204`,c.signal,500),true); assert.equal(await probe(`${url}/login`,c.signal,500),false);
  assert.equal(await probe(`${url}/redirect`,c.signal,500),false); assert.equal(await probe(`${url}/hang`,c.signal,25),false);
});
test('reachability and provider probes honor parent abort even when transport ignores it', async () => {
  const c=new AbortController(), ignored=()=>new Promise(()=>{}); const p=probe('http://unused',c.signal,1000,ignored); c.abort(); assert.equal(await p,false);
  await assert.rejects(bounded(ignored,new AbortController().signal,10));
});
test('product consumers share one owner and preserve playback, data and navigation ownership', () => {
  const runtime=read('src/infrastructure/connectivity/connectivityRuntime.ts'), service=read('src/infrastructure/connectivity/connectivityService.ts');
  assert.match(runtime,/AppState\.addEventListener/); assert.match(runtime,/NetInfo\.addEventListener/); assert.match(runtime,/trackPlayback\.cancel/);
  assert.doesNotMatch(service,/nativePlayback|router\.|setFavorite|createPlaylist|writePortableProfile|setInterval/);
  assert.match(read('src/features/playback/trackPlaybackRuntime.ts'),/canRequest\('ytmusic-streaming'\)[\s\S]*nativePlayback\.play/);
  assert.match(read('src/infrastructure/orionCloud/orionCloudReadOnlyProbe.ts'),/runRemote\('orion-cloud'/);
  assert.match(read('src/infrastructure/orionCloud/orionCloudControlledNoOpWriteGate.ts'),/assertRemote\('orion-cloud'\)/);
  assert.match(read('app/search.tsx'),/completedQueryRef/); assert.match(read('src/features/discovery/wavenDetailPrefetch.ts'),/else cache\.delete\(key\)/);
});

test('foreground after airplane mode stays OFFLINE until a fresh usable transport arrives', async t => {
  const { service: s, calls } = setup(t);
  s.observe(disconnected);
  s.setActive(false);
  assert.equal(s.getSnapshot().active, false);
  s.setActive(true);
  assert.equal(s.getSnapshot().active, true);
  assert.equal(s.getSnapshot().state, 'OFFLINE');
  assert.equal(s.getSnapshot().remoteReady, false);
  await s.revalidate();
  assert.deepEqual(calls, []);
});
test('foreground with mobile data revalidates after previously disconnected background', async t => {
  const { service: s, calls } = setup(t);
  s.observe(disconnected);
  s.setActive(false);
  s.observe(connected('cellular'));
  assert.equal(s.getSnapshot().active, false);
  s.setActive(true);
  assert.equal(s.getSnapshot().state, 'RECOVERING');
  await s.revalidate();
  assert.equal(s.getSnapshot().state, 'ONLINE');
  assert.equal(s.getSnapshot().transport, 'cellular');
  assert.deepEqual(calls, ['internet','providers']);
});
test('native foreground lifecycle triggers fresh NetInfo fetch even without a new event', () => {
  const runtime = read('src/infrastructure/connectivity/connectivityRuntime.ts');
  assert.match(runtime, /AppState\.addEventListener\('change',[\s\S]*if \(active\) void checkWavenConnection\(\)/);
});

// V8.2: an uncompleted recovery task may not silently mark the epoch fully healthy.
test('failed recovery job remains degraded and retries after backoff without losing healthy providers', async t => {
  const { service: s, calls, advance } = setup(t);
  let attempt = 0;
  s.registerRecovery('temporary-metadata', 'metadata', async () => {
    calls.push('metadata');
    if (++attempt === 1) throw new Error('temporary public metadata refresh failure');
  });
  await s.revalidate();
  assert.equal(s.getSnapshot().state, 'DEGRADED');
  assert.equal(s.getSnapshot().remoteReady, true);
  assert.equal(s.canRequest('music'), true);
  assert.equal(s.getSnapshot().recoveryEpoch, 1);
  advance();
  await s.revalidate();
  assert.equal(s.getSnapshot().state, 'ONLINE');
  assert.equal(s.getSnapshot().recoveryEpoch, 2);
  assert.deepEqual(calls, ['internet','providers','metadata','internet','providers','metadata']);
});

test('one failed recovery stage does not skip subsequent stages or fabricate offline transport', async t => {
  const { service: s, calls } = setup(t);
  s.registerRecovery('cloud-transient', 'cloud', async () => { calls.push('cloud'); throw Error('Cloud transient'); });
  s.registerRecovery('durable-pending', 'pending', async () => { calls.push('pending'); });
  s.registerRecovery('metadata', 'metadata', async () => { calls.push('metadata'); });
  await s.revalidate();
  assert.equal(s.getSnapshot().state, 'DEGRADED');
  assert.equal(s.getSnapshot().stage, 'ready');
  assert.equal(s.getSnapshot().remoteReady, true);
  assert.equal(s.canRequest('music'), true);
  assert.deepEqual(calls,['internet','providers','cloud','pending','metadata']);
});

// V8.3: truthful recovery status survives incidental provider-health callbacks.
test('healthy provider report cannot conceal an incomplete durable recovery job', async t => {
  const { service: s } = setup(t);
  s.registerRecovery('pending-metadata', 'metadata', async () => { throw Error('transient metadata'); });
  await s.revalidate();
  assert.equal(s.getSnapshot().state, 'DEGRADED');
  assert.equal(s.getSnapshot().remoteReady, true);
  s.reportProvider('music', true);
  assert.equal(s.getSnapshot().state, 'DEGRADED', 'pending recovery must remain visible');
  assert.equal(s.canRequest('music'), true);
});

test('successful recovery clears incomplete-work marker and allows healthy status', async t => {
  const { service: s, advance } = setup(t);
  let first = true;
  s.registerRecovery('pending-metadata', 'metadata', async () => { if (first) { first = false; throw Error('transient'); } });
  await s.revalidate();
  assert.equal(s.getSnapshot().state, 'DEGRADED');
  advance();
  await s.revalidate();
  assert.equal(s.getSnapshot().state, 'ONLINE');
  s.reportProvider('music', true);
  assert.equal(s.getSnapshot().state, 'ONLINE');
});

test('service restart may not reuse an old healthy epoch before fresh validation', async t => {
  const { service: s } = setup(t);
  s.observe(connected('wifi'));
  await s.revalidate();
  assert.equal(s.getSnapshot().state, 'ONLINE');
  s.stop();
  s.start({ internet: async () => true, providers: async () => ({ music: true }) });
  assert.equal(s.getSnapshot().state, 'RECOVERING');
  assert.equal(s.getSnapshot().remoteReady, false);
  assert.equal(s.canRequest('music'), false);
  await assert.rejects(s.runRemote('music', async () => 'unverified'), /Reconnecting|unavailable/i);
});

test('restarting with a known disconnected transport remains offline and skips probes', async t => {
  const { service: s } = setup(t);
  s.observe(connected('wifi'));
  await s.revalidate();
  s.observe(disconnected);
  s.stop();
  let calls = 0;
  s.start({ internet: async () => { calls++; return true; }, providers: async () => { calls++; return { music: true }; } });
  assert.equal(s.getSnapshot().state, 'OFFLINE');
  assert.equal(s.canRequest('music'), false);
  await s.revalidate();
  assert.equal(calls, 0);
});

// V8.5A: The diagnostic bridge must be physically limited to the isolated
// User-0 validation package. No ephemeral media URL or track identity is logged.
const p8diagFs = require('node:fs');
const p8diagPath = require('node:path');
const p8diagRoot = p8diagPath.resolve(__dirname, '..');
function p8diagRead(path) { return p8diagFs.readFileSync(p8diagPath.join(p8diagRoot, path), 'utf8'); }
test('V8.5A diagnostic bridge is isolated and fixed-schema', () => {
  const native = p8diagRead('plugins/waven-streaming-native/WavenStreamingSourceModule.kt');
  const trace = p8diagRead('src/infrastructure/connectivity/phase8ValidationTrace.ts');
  assert.match(native, /context\.applicationContext\.packageName == "com\.okali\.waven\.phase8validation"/);
  assert.match(native, /if \(!phase8ValidationOnly\(\)\) return/);
  assert.match(native, /WAVEN_P08_DIAG/);
  assert.doesNotMatch(native.match(/@ReactMethod fun traceValidation[\s\S]*?(?=private fun nativeTrace)/)?.[0] ?? '', /source\.toString\(\)|videoId|requestId|allowedHeaders/);
  assert.match(trace, /Never pass error\.message/);
  assert.match(trace, /traceProviderName/);
});
test('V8.5A instruments provider state, recovery, serialized wait and releases without altering scheduling', () => {
  const connectivity = p8diagRead('src/infrastructure/connectivity/connectivityService.ts');
  const runtime = p8diagRead('src/infrastructure/connectivity/connectivityRuntime.ts');
  const discovery = p8diagRead('src/features/discovery/wavenDiscoveryRuntime.ts');
  assert.match(connectivity, /traceP8\('queue_wait'/);
  assert.match(connectivity, /this\.remoteTail\.then/);
  assert.match(runtime, /traceP8\('probe'/);
  assert.match(runtime, /offlineMetadata\.pendingKeys\(\)\.length/);
  assert.match(discovery, /traceP8\('new_releases', 'error_count'/);
});
test('V8.5A logs Media3 state only without claiming audible audio', () => {
  const native = p8diagRead('plugins/waven-playback-native/WavenPlaybackService.kt');
  assert.match(native, /media3TraceListener/);
  assert.match(native, /Player\.STATE_READY/);
  assert.match(native, /onIsPlayingChanged/);
  assert.match(native, /packageName == "com\.okali\.waven\.phase8validation"/);
});

// V8.5A.1: Prevent a compiled-but-inert diagnostic bridge from returning again.
test('V8.5A1 binds JS diagnostic events to the Android native logging module', () => {
  const runtime = p8diagRead('src/infrastructure/connectivity/connectivityRuntime.ts');
  assert.match(runtime, /import \{ AppState, NativeModules, Platform \} from 'react-native'/);
  assert.match(runtime, /configureP8TraceBridge\(Platform\.OS === 'android' \? NativeModules\.WavenStreamingSource \?\? null : null\)/);
  assert.match(runtime, /stopRuntime = \(\) => \{[^\n]*configureP8TraceBridge\(null\)/);
  assert.ok(runtime.indexOf('configureP8TraceBridge(Platform.OS') < runtime.indexOf('wavenConnectivity.start({'),
    'Trace bridge must be installed before the provider probes begin');
});
