const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),test=require('node:test'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup:render}=require('react-dom/server');
const compile=(source,file)=>ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
require.extensions['.ts']=require.extensions['.tsx']=(record,file)=>record._compile(compile(fs.readFileSync(file,'utf8'),file),file);
const {TrackPlaybackHandoff:Handoff}=require('../src/features/playback/trackPlayback.ts');
const {trackRowState,NativeTrackObserver}=require('../src/features/playback/trackPresentation.ts');
const {ConnectivityService:Service}=require('../src/infrastructure/connectivity/connectivityService.ts');
const {WavenDiscoveryRuntime:Runtime,ResilientWavenDiscoveryRuntime:Resilient}=require('../src/features/discovery/wavenDiscoveryRuntime.ts');
const {offlineMetadata:cache}=require('../src/infrastructure/connectivity/offlineMetadata.ts');
const storage=()=>{const m=new Map();return {get:k=>m.get(k)??null,set:(k,v)=>m.set(k,v),remove:k=>m.delete(k)};};
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const track=(id='abcdefghijk',title=`Song ${id}`)=>({id,title,artistName:'Verified Artist',source:{provider:'ytmusic-metadata',id}});
const lease=()=>({uri:'https://media.googlevideo.com/audio?expire=99999999',expiresAtMs:1000000,headers:{'User-Agent':'validation'}});
const release=(id='release-one',title='Verified Release')=>({id,title,artistName:'Verified Artist',primaryType:'Single',source:{provider:'ytmusic-metadata',id}});
const section=(items,type='albums')=>({sections:[{id:'verified-releases',title:'New Releases',type,items}]});
const snap=(overrides={})=>({state:'playing',queueIds:['q'],currentQueueId:'q',currentItem:null,currentIndex:0,positionMs:0,durationMs:180000,playing:true,playWhenReady:true,buffering:false,repeatMode:'off',shuffleEnabled:false,error:null,...overrides});
function handoff(overrides={},deadline=1000){const commands=[],claims=[];const provider={id:'ytmusic-streaming',searchForTrack:async t=>[{id:t.source.id,providerId:'ytmusic-streaming'}],resolveCandidate:async()=>lease(),...overrides};
 const owner=new Handoff(provider,{replace:async items=>{commands.push(items);return snap({currentQueueId:items[0].queueId});}},ids=>claims.push(ids),()=>1000,deadline);return {owner,commands,claims};}
function connected(t,overrides={}){let now=10000;const s=new Service(()=>now,1000000);s.start({internet:async()=>true,providers:async()=>({'ytmusic-metadata':true,'spotify-charts-dashboard':true}),...overrides});t.after(()=>s.stop());return {s,advance:()=>now+=2001};}
function discovery(getNewReleases,Class=Runtime){return new Class([],[],[{id:'ytmusic-search-discovery',name:'Discovery',getNewReleases,getCategories:async()=>[],getCategory:async c=>section([track(c.id)],'tracks')}]);}
const dom=tag=>({children,accessibilityLabel,disabled})=>React.createElement(tag,{'aria-label':accessibilityLabel,disabled},children);
function loadUi(relative,overrides={}){const file=path.resolve(__dirname,'..',relative),previous=Module._load;
 Module._load=function(request,parent,...args){
  if(request in overrides)return overrides[request];
  const key=Object.keys(overrides).find(k=>k.startsWith('/')&&request.endsWith(k));if(key)return overrides[key];
  if(request==='react-native')return {View:dom('div'),Animated:{View:dom('i'),Value:class { interpolate(){return 1;} },modulo:()=>({interpolate:()=>1})},AppState:{currentState:'active'},Easing:{linear:x=>x},ScrollView:dom('div'),FlatList:({data,renderItem,keyExtractor})=>React.createElement('div',{},data.map((item,index)=>React.createElement(React.Fragment,{key:keyExtractor(item,index)},renderItem({item,index})))),Text:dom('span'),Image:()=>null,ActivityIndicator:()=>React.createElement('span',{},'Preparing audio'),Modal:()=>null,KeyboardAvoidingView:dom('div'),TextInput:dom('input'),Platform:{OS:'web'},StyleSheet:{create:x=>x,hairlineWidth:1,absoluteFill:{}},useWindowDimensions:()=>({width:420,height:900,fontScale:1})};
  if(request==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({top:0,bottom:0})};
  if(request==='expo-router')return {useRouter:()=>({push:()=>{},navigate:()=>{}})};
  if(request.endsWith('/WavenText'))return {WavenText:dom('span')};
  if(request.endsWith('/WavenPressable'))return {WavenPressable:dom('button')};
  if(request.endsWith('/WavenAppShell'))return {WavenAppShell:dom('main')};
  if(request.endsWith('/WavenSurface'))return {WavenSurface:dom('section')};
  if(request.endsWith('/WavenSectionTitle'))return {WavenSectionTitle:({leading,accent})=>React.createElement('h2',{},`${leading} ${accent}`)};
  if(request.endsWith('/WavenEntityRevealAnchor'))return {WavenEntityRevealAnchor:dom('div')};
  if(request.endsWith('/WavenArtworkFallback'))return {WavenArtworkFallback:()=>null};
  if(request.endsWith('/useWavenLayout'))return {useWavenLayout:()=>({width:420,gutter:20,contentMaxWidth:600,isCompact:false,isTabletLike:false})};
  if(request.endsWith('/useWavenReducedMotion'))return {useWavenReducedMotion:()=>true};
  if(request.endsWith('/useWavenArtworkLease'))return {useWavenArtworkLease:()=>({showFallback:true,hasRendered:false,imageKey:'fixture'})};
  if(request.endsWith('/wavenEntityReveal'))return {wavenEntityRevealKey:(...a)=>a.join(':'),wavenReleaseRevealKind:()=> 'single',beginWavenEntityReveal:async()=>false};
  if(request.endsWith('/wavenDetailPrefetch'))return {primeWavenAlbumDetail:()=>{},primeWavenArtistDetail:()=>{}};
  return previous.call(this,request,parent,...args);
 };
 try{const record=new Module(file,module);record.filename=file;record.paths=Module._nodeModulePaths(path.dirname(file));record._compile(compile(fs.readFileSync(file,'utf8'),file),file);return record.exports;}finally{Module._load=previous;}
}
function home(runtime){return loadUi('app/index.tsx',{
 '/wavenDiscoveryRuntime':{wavenDiscoveryRuntime:runtime},
 '/libraryRuntime':{useLocalLibrary:()=>({state:{history:[]}})},
 '/trackPlaybackRuntime':{trackPlayback:{play:async()=>{}}},
 '/connectivityHooks':{useWavenConnectivity:()=>({remoteReady:true,internetReady:true,active:true,state:'ONLINE',recoveryEpoch:1})},
 '/WavenLibraryControls':{WavenLibraryHeroArtwork:()=>null,WavenLibraryRow:()=>null},
 });}
const homeHtml=runtime=>render(React.createElement(home(runtime).default));

// Deterministic integration smoke. Native audio/transport are explicitly mocked.
test('SMOKE 01 · application Home module mounts with the existing WAVEN shell',()=>{assert.match(homeHtml(discovery(async()=>({sections:[]}))),/<main>/);});
test('SMOKE 02 · empty Home renders without crashing or invented releases',()=>{const html=homeHtml(discovery(async()=>({sections:[]})));assert.doesNotMatch(html,/Verified Release/);});
test('SMOKE 03 · accepted provider releases reach the actual Home shelf and card render',async()=>{
 const r=discovery(async()=>section([release()]));await r.getSearchNewReleases();const html=homeHtml(r);assert.match(html,/New Releases/);assert.match(html,/Verified Release/);
});
test('SMOKE 04 · album/artist navigation uses canonical provider identity',()=>{
 const {albumDetailRoute,artistDetailRoute}=require('../src/features/discovery/detailNavigation.ts');
 assert.equal(albumDetailRoute(release()).params.id,'release-one');assert.equal(artistDetailRoute({id:'artist',name:'Artist',source:{provider:'ytmusic-metadata',id:'UC-artist'}}).params.id,'UC-artist');
});
for(const [n,id] of [[5,'abcdefghijk'],[6,'ZYXWVUTSRQP'],[7,'QWERTYUIOPA']])test(`SMOKE ${String(n).padStart(2,'0')} · sequential track ${n-4} reaches the sole bridge`,async()=>{
 const {owner,commands}=handoff();for(const song of ['abcdefghijk','ZYXWVUTSRQP',id])await owner.play(track(song));assert.equal(commands.at(-1)[0].track.source.id,id);assert.equal(owner.getSnapshot().state,'started');
});
test('SMOKE 08 · repeated rapid A → B → C honors latest selection without stale handoff',async()=>{
 for(let i=0;i<8;i++){const pending=new Map(),{owner,commands}=handoff({resolveCandidate:c=>{const d=deferred();pending.set(c.id,d);return d.promise;}});
  const a=owner.play(track('abcdefghijk'));await tick();const b=owner.play(track('ZYXWVUTSRQP'));await tick();const c=owner.play(track('QWERTYUIOPA'));await tick();
  pending.get('QWERTYUIOPA').resolve(lease());await c;pending.get('abcdefghijk').resolve(lease());pending.get('ZYXWVUTSRQP').resolve(lease());await Promise.all([a,b]);assert.deepEqual(commands.map(x=>x[0].track.source.id),['QWERTYUIOPA']);}
});
test('SMOKE 09 · one rejected source cannot poison another track',async()=>{
 const {owner,commands}=handoff({resolveCandidate:async c=>{if(c.id==='abcdefghijk')throw Error('403 forbidden');return lease();}});
 await owner.play(track());await owner.play(track('ZYXWVUTSRQP'));assert.equal(owner.getSnapshot().state,'started');assert.equal(commands.length,1);assert.ok(owner.getFailure(JSON.stringify(['ytmusic-metadata','abcdefghijk'])));
});
test('SMOKE 10 · failed track retries successfully without reopening a route',async()=>{
 let attempt=0;const {owner,commands}=handoff({resolveCandidate:async()=>{if(!attempt++)throw Error('403');return lease();}});await owner.play(track());await owner.play(track());assert.equal(commands.length,1);assert.equal(owner.getFailure(JSON.stringify(['ytmusic-metadata','abcdefghijk'])),null);
});
test('SMOKE 11 · row indicators follow native playing/paused/buffering/error state',()=>{
 const key='song',handoff={state:'started',trackKey:key,message:null};
 assert.equal(trackRowState(key,handoff,{trackKey:key,snapshot:snap()},null),'playing');
 assert.equal(trackRowState(key,handoff,{trackKey:key,snapshot:snap({state:'paused',playing:false,playWhenReady:false})},null),'paused');
 assert.equal(trackRowState(key,handoff,{trackKey:key,snapshot:snap({state:'buffering',playing:false,buffering:true})},null),'buffering');
 assert.equal(trackRowState(key,handoff,{trackKey:key,snapshot:snap({state:'error',playing:false})},null),'failed');
 assert.equal(trackRowState('unrelated',handoff,{trackKey:key,snapshot:snap()},null),'available');
});
test('SMOKE 12 · pause/resume/skip native events update one shared read-only observer',async()=>{
 let emit,subscriptions=0,removed=0;const observer=new NativeTrackObserver({subscribe:f=>{subscriptions++;emit=f;return()=>removed++;},snapshot:async()=>snap(),key:id=>id==='q'?'A':'B',restoreKey:async()=>null});
 const a=observer.subscribe(()=>{}),b=observer.subscribe(()=>{});await tick();assert.equal(observer.getSnapshot().trackKey,'A');emit(snap({state:'paused',playing:false}));assert.equal(observer.getSnapshot().snapshot.state,'paused');emit(snap({currentQueueId:'q2'}));assert.equal(observer.getSnapshot().trackKey,'B');a();b();assert.equal(subscriptions,1);assert.equal(removed,1);
});
test('SMOKE 13 · pending discovery recovery preserves healthy playback prerequisites',async t=>{
 const {s,advance}=connected(t);const gate=deferred();s.registerRecovery('slow-discovery','metadata',()=>gate.promise);const recovery=s.revalidate();await tick();assert.equal(s.getSnapshot().stage,'metadata');assert.equal(s.getSnapshot().remoteReady,false);assert.equal(s.canRequest('ytmusic-streaming'),true);
 gate.reject(Error('discovery deadline'));await recovery;assert.equal(s.getSnapshot().state,'DEGRADED');advance();const retry=s.revalidate();await tick();assert.equal(s.canRequest('ytmusic-streaming'),true);await retry;
});
test('SMOKE 14 · initially empty Home receives a background release notification and renders cards',async()=>{
 const r=discovery(async()=>section([release('recovered','Recovered Verified Release')]));assert.doesNotMatch(homeHtml(r),/Recovered Verified Release/);
 let accepted=0;const stop=r.subscribeDiscovery(key=>{if(key==='home-releases'){assert.ok(r.getSearchNewReleasesSessionSnapshot());accepted++;}});
 await r.getSearchNewReleases({refresh:true});assert.equal(accepted,1);assert.match(homeHtml(r),/Recovered Verified Release/);stop();
});
test('SMOKE 15 · Rock, Hip-Hop and Classical keep stable handles and cached routes',async()=>{
 const r=discovery(async()=>({sections:[]}));for(const title of ['Rock','Hip-Hop','Classical']){const c={id:title,title,group:'Genres',browseId:`genre-${title}`,params:'music'};const first=await r.getSearchDiscoveryCategory(c);const again=await r.getSearchDiscoveryCategory(c);assert.equal(first.result.sections[0].items[0].source.id,title);assert.equal(again,first);}
});
test('SMOKE 16 · hung preparation terminates; cancellation cannot overwrite the next request',async()=>{
 const {owner,commands}=handoff({resolveCandidate:async c=>c.id==='abcdefghijk'?new Promise(()=>{}):lease()},20);
 await owner.play(track());assert.equal(owner.getSnapshot().state,'error');await owner.play(track('ZYXWVUTSRQP'));assert.equal(owner.getSnapshot().state,'started');assert.equal(commands.length,1);
});
test('SMOKE 17 · repeated playback has exactly one ordered native handoff and claim per success',async()=>{
 const {owner,commands,claims}=handoff();for(let i=0;i<12;i++)await owner.play(track(i%2?'ZYXWVUTSRQP':'abcdefghijk'));assert.equal(commands.length,12);assert.equal(claims.length,12);assert.ok(commands.every(c=>c.length===1));
});
test('SMOKE 18 · local favorite/playlist data survives playback failures without profile operations',async()=>{
 const {LocalLibraryRepository:Repo}=require('../src/features/library/localLibrary.ts'),s=storage(),repo=new Repo(s);repo.setFavorite('track',track(),true);const p=repo.createPlaylist('Preserved');repo.addTrack(p,track());const before=JSON.stringify([...Object.entries(repo.getSnapshot().state)]);
 const {owner}=handoff({resolveCandidate:async()=>{throw Error('403');}});await owner.play(track());assert.equal(JSON.stringify([...Object.entries(new Repo(s).getSnapshot().state)]),before);
});

test('New Releases transient failure retains accepted cached cards with truthful errors',async()=>{
 cache.configure(storage());let fail=false;const r=discovery(async()=>{if(fail)throw Error('unavailable');return section([release()]);},Resilient);
 await r.getSearchNewReleases();fail=true;const response=await r.getSearchNewReleases({refresh:true});assert.ok(response.errors.length);assert.equal(response.result.sections[0].items.length,1);assert.match(homeHtml(r),/Verified Release/);
});
test('older release generation cannot notify or overwrite the newer result or persisted cache',async()=>{
 cache.configure(storage());const a=deferred(),b=deferred();let calls=0;const r=discovery(()=>++calls===1?a.promise:b.promise,Resilient),events=[];r.subscribeDiscovery(k=>events.push(k));
 const old=r.getSearchNewReleases({refresh:true}),latest=r.getSearchNewReleases({refresh:true});await tick();b.resolve(section([release('newer','Newer Verified Release')]));await latest;a.resolve(section([release('older','Older Verified Release')]));assert.equal((await old).cancelled,true);assert.deepEqual(events,['home-releases']);assert.match(homeHtml(r),/Newer Verified Release/);assert.doesNotMatch(homeHtml(r),/Older Verified Release/);assert.equal(cache.read('home-releases').value.result.sections[0].items[0].title,'Newer Verified Release');
});
test('verified empty releases are terminal and never fabricated into cards or failed recovery',async()=>{
 cache.configure(storage());cache.enqueue('home-releases');const r=discovery(async()=>({sections:[]}),Resilient);const response=await r.getSearchNewReleases({refresh:true});assert.deepEqual(response.errors,[]);assert.deepEqual(response.result.sections,[]);assert.deepEqual(cache.pendingKeys(),[]);assert.doesNotMatch(homeHtml(r),/Verified Release/);
});
test('all-overlapping validated releases remain visible while ordinary cross-shelf duplicates are minimized',()=>{
 const {buildDiscoveryGroups}=home(discovery(async()=>({sections:[]}))),one=track('abcdefghijk','Shared Title');const charts=[{id:'waven-global-top-50',title:'Chart',type:'tracks',items:[one]}];
 assert.equal(buildDiscoveryGroups(charts,[{id:'releases',type:'tracks',title:'Releases',items:[one,one]}]).find(g=>g.label==='New Releases').items.length,1);
 const distinct=track('ZYXWVUTSRQP','Distinct');assert.deepEqual(buildDiscoveryGroups(charts,[{id:'releases',type:'tracks',title:'Releases',items:[one,distinct]}]).find(g=>g.label==='New Releases').items.map(x=>x.item.title),['Distinct']);
});
test('failed requests never become successful persisted discovery data',async()=>{
 cache.configure(storage());const r=discovery(async()=>{throw Error('timeout');},Resilient);const response=await r.getSearchNewReleases({refresh:true});assert.ok(response.errors.length);assert.equal(cache.read('home-releases'),null);assert.deepEqual(cache.pendingKeys(),['home-releases']);
});
test('native row observer ignores position ticks and rejects stale identity restoration',async()=>{
 let emit,count=0;const old=deferred(),observer=new NativeTrackObserver({subscribe:f=>{emit=f;return()=>{};},snapshot:()=>new Promise(()=>{}),key:id=>id==='new'?'new-key':null,restoreKey:()=>old.promise});const stop=observer.subscribe(()=>count++);
 emit(snap());emit(snap({currentQueueId:'new'}));old.resolve('old-key');await tick();assert.equal(observer.getSnapshot().trackKey,'new-key');const previous=count;emit(snap({currentQueueId:'new',positionMs:12345}));assert.equal(count,previous);stop();
});
test('actual row UI exposes retry and now-playing state and remains enabled during optional recovery',()=>{
 let state='failed';const controls=loadUi('src/components/library/WavenLibraryControls.tsx',{
 '/connectivityHooks':{useWavenConnectivity:()=>({active:true,internetReady:true,remoteReady:false,state:'RECOVERING'})},
 '/trackPlaybackRuntime':{trackPlayback:{play:()=>{}},useTrackPlaybackStatus:()=>({state:'error'}),useWavenTrackPresentation:()=>state},
 '/libraryRuntime':{getLocalLibrary:()=>({}),useLocalLibrary:()=>({state:{favorites:[],playlists:[],scope:'local'}})},
 });
 const element=()=>React.createElement(controls.WavenTrackPlayTarget,{track:track()},React.createElement('span',{},'Song'));
 let html=render(element());assert.match(html,/Retry/);assert.doesNotMatch(html,/disabled=""/);state='playing';html=render(element());assert.match(html,/Currently playing/);state='paused';assert.match(render(element()),/Paused/);state='preparing';assert.match(render(element()),/Preparing audio/);
});
test('actual streaming adapter isolates HTTP 403 and preserves unrelated playback availability',async t=>{
 const {s}=connected(t);await s.revalidate();let calls=0;
 const adapter=loadUi('src/infrastructure/music/providers/youtubeMusicStreaming.ts',{
  'react-native':{Platform:{OS:'android'},NativeModules:{WavenStreamingSource:{resolve:async id=>{calls++;if(id==='abcdefghijk')throw Object.assign(Error('forbidden'),{code:'WAVEN_SOURCE_UNAVAILABLE'});return lease();},cancel:()=>{}}}},
  '/connectivityService':{wavenConnectivity:s},
 }).youtubeMusicStreaming;
 await assert.rejects(adapter.resolveCandidate({id:'abcdefghijk',providerId:'ytmusic-streaming'}));assert.equal(s.getSnapshot().state,'ONLINE');assert.equal(s.canRequest('ytmusic-streaming'),true);
 await adapter.resolveCandidate({id:'ZYXWVUTSRQP',providerId:'ytmusic-streaming'});assert.equal(calls,2);assert.equal(s.getSnapshot().providers['ytmusic-streaming'],undefined);
});
test('one discovery capability failure leaves metadata and streaming available; true offline closes both',async t=>{
 const {s}=connected(t);await s.revalidate();s.reportProvider('discovery:new-releases',false);
 assert.equal(s.getSnapshot().state,'DEGRADED');assert.equal(s.canRequest('ytmusic-streaming'),true);assert.equal(s.canRequest('ytmusic-metadata'),true);assert.equal(s.canRequest('discovery:new-releases'),false);
 s.observe({connected:false,internetReachable:false,type:'none'});assert.equal(s.canRequest('ytmusic-streaming'),false);assert.equal(s.getSnapshot().internetReady,false);
});
test('cancelled adapter source cannot hand off or mark a provider unavailable',async t=>{
 const {s}=connected(t);await s.revalidate();let cancelled=0;const source=deferred(),controller=new AbortController();
 const adapter=loadUi('src/infrastructure/music/providers/youtubeMusicStreaming.ts',{
  'react-native':{Platform:{OS:'android'},NativeModules:{WavenStreamingSource:{resolve:()=>source.promise,cancel:()=>cancelled++}}},'/connectivityService':{wavenConnectivity:s},
 }).youtubeMusicStreaming;
 const request=adapter.resolveCandidate({id:'abcdefghijk',providerId:'ytmusic-streaming'},{signal:controller.signal});await tick();controller.abort();source.resolve(lease());await assert.rejects(request);assert.ok(cancelled);assert.equal(s.getSnapshot().state,'ONLINE');
});
test('actual broker timeout is terminal and a later successful release refresh reaches Home',async()=>{
 let first=true;const r=discovery(()=>first?new Promise(()=>{}):Promise.resolve(section([release('retry','Recovered After Timeout')])));
 const timedOut=await r.getSearchNewReleases({refresh:true,timeoutMs:1000});assert.ok(timedOut.errors.some(e=>/timed out/i.test(e)));assert.equal(r.getSearchNewReleasesSessionSnapshot(),null);
 first=false;await r.getSearchNewReleases({refresh:true,timeoutMs:1000});assert.match(homeHtml(r),/Recovered After Timeout/);
});
test('cache-only offline release presentation preserves identity without network',async()=>{
 cache.configure(storage());cache.remember('home-releases',{result:section([release('cached','Cached Verified Release')])});
 const r=discovery(async()=>assert.fail('cached render must not fetch'),Resilient);assert.match(homeHtml(r),/Cached Verified Release/);
});
test('stale category generation cannot replace a more recent route result',async()=>{
 const a=deferred(),b=deferred();let calls=0;const category={id:'rock',title:'Rock',group:'Genres',browseId:'rock',params:'music'};
 const r=new Runtime([],[],[{id:'discovery',name:'Discovery',getCategory:()=>++calls===1?a.promise:b.promise}]);
 const old=r.getSearchDiscoveryCategory(category,{refresh:true}),latest=r.getSearchDiscoveryCategory(category,{refresh:true});await tick();b.resolve(section([release('new','New Rock')]));await latest;a.resolve(section([release('old','Old Rock')]));assert.equal((await old).cancelled,true);assert.equal(r.getSearchDiscoveryCategorySessionSnapshot(category).result.sections[0].items[0].title,'New Rock');
});
test('native cancellation releases HTTP probes without deleting any source checks or using persistent URLs',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../plugins/waven-streaming-native/WavenStreamingSourceModule.kt'),'utf8');
 assert.match(source,/request\.connection\?\.disconnect\(\)/);assert.match(source,/requests\.remove\(id, request\)/);assert.match(source,/bytes=1048576-/);assert.match(source,/source-length-unavailable/);assert.match(source,/source-identity-mismatch/);assert.doesNotMatch(source,/SharedPreferences|DownloadManager|ExoPlayer|MediaSession/);
 assert.match(source,/cancellationExecutor\.execute[\s\S]*request\.connection\?\.disconnect/);assert.match(source,/cancellationExecutor\.shutdown\(\)/);
});

async function mountHome(t,runtime){
 const {JSDOM}=require('jsdom'),dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost/'});
 const before={window:global.window,document:global.document,navigator:Object.getOwnPropertyDescriptor(global,'navigator'),act:global.IS_REACT_ACT_ENVIRONMENT};
 global.window=dom.window;global.document=dom.window.document;Object.defineProperty(global,'navigator',{configurable:true,value:dom.window.navigator});global.IS_REACT_ACT_ENVIRONMENT=true;
 const {createRoot}=require('react-dom/client'),container=dom.window.document.getElementById('root'),root=createRoot(container),Screen=home(runtime).default;
 t.after(async()=>{await React.act(async()=>root.unmount());dom.window.close();global.window=before.window;global.document=before.document;if(before.navigator)Object.defineProperty(global,'navigator',before.navigator);else delete global.navigator;global.IS_REACT_ACT_ENVIRONMENT=before.act;});
 await React.act(async()=>root.render(React.createElement(Screen)));return container;
}
test('mounted Home fills an initially empty shelf from background recovery without remount/navigation',async t=>{
 let first=true;const r=discovery(async()=>first?{sections:[]}:section([release('mounted','Mounted Background Release')]));const container=await mountHome(t,r);
 assert.doesNotMatch(container.textContent,/Mounted Background Release/);first=false;await React.act(async()=>{await r.getSearchNewReleases({refresh:true});});
 assert.match(container.textContent,/New Releases/);assert.match(container.textContent,/Mounted Background Release/);
});
test('mounted Home retains the newest accepted shelf when its old initial request finishes later',async t=>{
 const old=deferred();let first=true;const r=discovery(()=>{if(first){first=false;return old.promise;}return Promise.resolve(section([release('latest-mounted','Latest Mounted Release')]));});
 const container=await mountHome(t,r);await React.act(async()=>{await r.getSearchNewReleases({refresh:true});});assert.match(container.textContent,/Latest Mounted Release/);
 await React.act(async()=>{old.resolve(section([release('outdated-mounted','Outdated Mounted Release')]));await tick();});
 assert.match(container.textContent,/Latest Mounted Release/);assert.doesNotMatch(container.textContent,/Outdated Mounted Release/);
});
