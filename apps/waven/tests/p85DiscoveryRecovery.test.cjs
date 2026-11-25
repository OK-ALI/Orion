const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),test=require('node:test'),ts=require('typescript');
const React=require('react');
const compile=(source,file)=>ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
require.extensions['.ts']=require.extensions['.tsx']=(record,file)=>record._compile(compile(fs.readFileSync(file,'utf8'),file),file);
const connectionModule=require('../src/infrastructure/connectivity/connectivityService.ts');
const {ResilientWavenDiscoveryRuntime:Runtime}=require('../src/features/discovery/wavenDiscoveryRuntime.ts');
const {offlineMetadata:cache}=require('../src/infrastructure/connectivity/offlineMetadata.ts');
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const store=()=>{const m=new Map();return {get:k=>m.get(k)??null,set:(k,v)=>m.set(k,v),remove:k=>m.delete(k)};};
const category=(name='Jazz')=>({id:name.toLowerCase(),title:name,group:'Genres',browseId:'FEmusic_moods_and_genres_category',params:name,accentColor:null});
const jazz=category(),rock=category('Rock'),key=c=>`category:${c.browseId}\0${c.params}`,cap=c=>`discovery:${key(c)}`;
const sections=(title='Recovered Jazz')=>({sections:[{id:'catalogue-result',title:'Verified catalogue',type:'tracks',items:[{id:title,title,artistName:'Provider Artist',source:{provider:'ytmusic-metadata',id:title}}]}]});
const empty=()=>({sections:[]});
async function setup(t,categoryRead=async()=>sections(),getNewReleases=async()=>empty()){
 let now=10000;const service=new connectionModule.ConnectivityService(()=>now,1000000);connectionModule.wavenConnectivity=service;
 cache.configure(store());let calls=0;
 const runtime=new Runtime([],[],[{id:'ytmusic-search-discovery',name:'Discovery',getCategories:async()=>[jazz,rock],getCategory:async(c,o)=>{calls++;return categoryRead(c,o);},getNewReleases}]);
 // Optional artist fanout is outside these mounted category fixtures.
 runtime.getArtistsToExplore=async()=>({artists:[],errors:[],cancelled:false});
 service.start({internet:async()=>true,providers:async()=>({'ytmusic-metadata':true})});await service.revalidate();
 const remove=service.registerRecovery('catalogue','metadata',signal=>runtime.refreshPendingOfflineMetadata(signal),()=>cache.pendingKeys().length>0);
 t.after(async()=>{await React.act(async()=>{remove();service.stop();});});
 return {service,runtime,calls:()=>calls,advance:(ms=4001)=>{now+=ms;}};
}
const dom=tag=>({children,accessibilityLabel,accessibilityLiveRegion,disabled,onPress,onChangeText,value})=>React.createElement(tag,{'aria-label':accessibilityLabel,'aria-live':accessibilityLiveRegion,disabled,onClick:onPress,onChange:onChangeText?e=>onChangeText(e.target.value):undefined,value},children);
const NativeImage=Object.assign(()=>null,{resolveAssetSource:()=>({uri:'https://images.example/category.jpg',width:200,height:200})});
function loadUi(relative,{runtime,service,navigation=null}={}){
 const file=path.resolve(__dirname,'..',relative),previous=Module._load;
 Module._load=function(request,parent,...args){
  if(/\.(png|jpg)$/.test(request))return 1;
  if(request==='react-native')return {View:dom('div'),ScrollView:dom('div'),FlatList:({data,renderItem,keyExtractor})=>React.createElement('div',{},data.map((item,index)=>React.createElement(React.Fragment,{key:keyExtractor(item,index)},renderItem({item,index})))),Pressable:dom('button'),Text:dom('span'),TextInput:dom('input'),Image:NativeImage,ActivityIndicator:()=>null,BackHandler:{addEventListener:()=>({remove(){}})},Platform:{OS:'web'},StyleSheet:{create:x=>x,hairlineWidth:1,absoluteFill:{}},useWindowDimensions:()=>({width:420,height:900,fontScale:1})};
  if(request==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({top:0,bottom:0})};
  if(request==='expo-router')return {useRouter:()=>({push(){},navigate(){}})};
  if(request.endsWith('/connectivityHooks'))return {useWavenConnectivity:()=>React.useSyncExternalStore(service.subscribe,service.getSnapshot,service.getSnapshot)};
  if(request.endsWith('/connectivityRuntime'))return {checkWavenConnection:()=>service.revalidate()};
  if(request.endsWith('/wavenDiscoveryRuntime'))return {wavenDiscoveryRuntime:runtime};
  if(request.endsWith('/wavenSearchNavigationSession'))return {readWavenSearchNavigationSession:()=>navigation,writeWavenSearchNavigationSession(){},updateWavenSearchNavigationScroll(){},updateWavenSearchArtistsToExploreScroll(){},popWavenSearchNavigationCheckpoint:()=>null,pushWavenSearchNavigationCheckpoint(){}};
  if(request.endsWith('/libraryRuntime'))return {useLocalLibrary:()=>({state:{history:[]}})};
  if(request.endsWith('/trackPlaybackRuntime'))return {trackPlayback:{play:async()=>{}}};
  if(request.endsWith('/WavenLibraryControls'))return {WavenLibraryHeroArtwork:()=>null,WavenLibraryRow:()=>null,WavenTrackPlayTarget:dom('button'),WavenMusicLibraryActions:()=>null};
  if(request.endsWith('/WavenText'))return {WavenText:dom('span')};
  if(request.endsWith('/WavenPressable'))return {WavenPressable:dom('button')};
  if(request.endsWith('/WavenAppShell'))return {WavenAppShell:dom('main')};
  if(request.endsWith('/WavenSurface'))return {WavenSurface:dom('section')};
  if(request.endsWith('/WavenAccentTitle'))return {WavenAccentTitle:({children,leading,accent})=>React.createElement('h1',{},children??`${leading??''} ${accent??''}`)};
  if(request.endsWith('/WavenSectionTitle'))return {WavenSectionTitle:({leading,accent})=>React.createElement('h2',{},`${leading} ${accent??''}`),splitWavenSectionAccent:title=>({leading:title})};
  if(request.endsWith('/WavenEntityRevealAnchor'))return {WavenEntityRevealAnchor:dom('div')};
  if(request.endsWith('/WavenArtworkFallback'))return {WavenArtworkFallback:()=>null};
  if(request.endsWith('/useWavenLayout'))return {useWavenLayout:()=>({width:420,gutter:20,contentMaxWidth:600,isCompact:false,isTabletLike:false})};
  if(request.endsWith('/useWavenReducedMotion'))return {useWavenReducedMotion:()=>true};
  if(request.endsWith('/useWavenArtworkLease'))return {useWavenArtworkLease:()=>({showFallback:true,hasRendered:false,imageKey:'fixture'})};
  if(request.endsWith('/wavenEntityReveal'))return {wavenEntityRevealKey:(...a)=>a.join(':'),wavenReleaseRevealKind:()=> 'single',beginWavenEntityReveal:async()=>false};
  if(request.endsWith('/wavenDetailPrefetch'))return {primeWavenAlbumDetail(){},primeWavenArtistDetail(){}};
  return previous.call(this,request,parent,...args);
 };
 try{const record=new Module(file,module);record.filename=file;record.paths=Module._nodeModulePaths(path.dirname(file));record._compile(compile(fs.readFileSync(file,'utf8'),file),file);return record.exports;}finally{Module._load=previous;}
}
function selection(c=jazz){return {query:'',scope:'Songs',status:'idle',result:{tracks:[],artists:[],albums:[],playlists:[]},providerErrors:[],suggestions:[],selectedDiscovery:{kind:'category',title:c.title,category:c},focusedDiscoveryStatus:'error',focusedDiscoverySections:[],focusedDiscoveryErrors:['Temporary provider failure'],scrollY:0,artistsToExploreX:0};}
async function mount(t,relative,fixture,navigation=null){
 const {JSDOM}=require('jsdom'),d=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/'}),before={window:global.window,document:global.document,act:global.IS_REACT_ACT_ENVIRONMENT};
 global.window=d.window;global.document=d.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
 const {createRoot}=require('react-dom/client'),container=d.window.document.getElementById('root'),root=createRoot(container);
 const exports=loadUi(relative,{...fixture,navigation}),Screen=exports.default??exports.WavenConnectionStatus;
 const Status=fixture.withStatus?loadUi('src/components/connectivity/WavenConnectionStatus.tsx',fixture).WavenConnectionStatus:null;
 const Component=()=>React.createElement(React.Fragment,{},React.createElement(Screen),Status?React.createElement(Status):null);
 t.after(async()=>{await React.act(async()=>root.unmount());d.window.close();global.window=before.window;global.document=before.document;global.IS_REACT_ACT_ENVIRONMENT=before.act;});
 await React.act(async()=>{root.render(React.createElement(Component));await tick();});return {container,root};
}

test('pending category forces real validation even when valid cached data is fresh',async t=>{
 const f=await setup(t);await f.runtime.getSearchDiscoveryCategories();await f.runtime.getSearchDiscoveryCategory(jazz);
 f.service.reportProvider(cap(jazz),false);cache.enqueue(key(jazz));f.advance();await f.service.revalidate();
 assert.equal(f.calls(),2);assert.equal(f.service.getSnapshot().providers[cap(jazz)].available,true);assert.equal(f.service.getSnapshot().state,'ONLINE');
});

test('mounted category receives automatic recovery before an unrelated recovery tail finishes',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let fail=true;const f=await setup(t,async()=>{if(fail)throw Error('temporary provider outage');return sections();});
 await f.runtime.getSearchDiscoveryCategories();const view=await mount(t,'app/search.tsx',f,selection());assert.doesNotMatch(view.container.textContent,/Recovered Jazz/);
 const tail=deferred();f.service.registerRecovery('slow-unrelated-tail','metadata',()=>tail.promise);t.after(()=>tail.resolve());fail=false;f.advance();
 let recovery;await React.act(async()=>{recovery=f.service.revalidate();await tick();await tick();});
 try{assert.match(view.container.textContent,/Recovered Jazz/);assert.equal(f.service.getSnapshot().stage,'metadata');}finally{await React.act(async()=>{tail.resolve();await recovery;});}
});

test('mounted Home clears its stale local warning when a missing shelf genuinely recovers',async t=>{
 const f=await setup(t);let fail=true;
 const {WavenDiscoveryRuntime:Base}=require('../src/features/discovery/wavenDiscoveryRuntime.ts');
 const r=new Base([], [{id:'spotify-charts-dashboard',name:'Charts',getDashboard:async()=>({sections:sections('Chart Song').sections.map(s=>({...s,id:'waven-global-top-50'}))})}],[{id:'discovery',name:'Discovery',getNewReleases:async()=>{if(fail)throw Error('temporary');return sections('Recovered New Release');}}]);
 const view=await mount(t,'app/index.tsx',{...f,runtime:r});assert.match(view.container.textContent,/temporarily unavailable|could not refresh|retry automatically/i);
 fail=false;f.advance();await React.act(async()=>{await r.getSearchNewReleases({refresh:true});});
 assert.match(view.container.textContent,/Recovered New Release/);assert.doesNotMatch(view.container.textContent,/Some discovery shelves are temporarily unavailable|New Releases will retry automatically/);
});

test('automatic backoff retries a transient category without CHECK, remount or a transport event',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let fail=true;const f=await setup(t,async()=>{if(fail)throw Error('temporary');return sections();});
 await f.runtime.getSearchDiscoveryCategories();await f.runtime.getSearchDiscoveryCategory(jazz);assert.equal(f.calls(),1);
 fail=false;f.advance();t.mock.timers.tick(4001);await tick();await tick();
 assert.equal(f.calls(),2);assert.equal(f.service.getSnapshot().state,'ONLINE');assert.deepEqual(cache.pendingKeys(),[]);
});

test('global CHECK updates an already-mounted recovered category and clears the compact warning',async t=>{
 let fail=true;const f=await setup(t,async c=>{if(fail)throw Error('temporary');return sections(`Recovered ${c.title}`);});
 await f.runtime.getSearchDiscoveryCategories();await f.runtime.getSearchDiscoveryCategory(rock);
 const view=await mount(t,'app/search.tsx',{...f,withStatus:true},selection());assert.ok(view.container.querySelector('[aria-label="Check connection"]'));
 fail=false;f.advance();await React.act(async()=>{view.container.querySelector('[aria-label="Check connection"]').click();await tick();await tick();});
 assert.match(view.container.textContent,/Recovered Jazz/);assert.equal(view.container.querySelector('[aria-label="Check connection"]'),null);assert.equal(f.service.getSnapshot().state,'ONLINE');
});

test('one category can recover while another remains genuinely degraded and pending',async t=>{
 let recovered=false;const f=await setup(t,async c=>{if(!recovered||c.id==='rock')throw Error('temporary');return sections();});
 await f.runtime.getSearchDiscoveryCategories();await f.runtime.getSearchDiscoveryCategory(jazz);await f.runtime.getSearchDiscoveryCategory(rock);
 recovered=true;f.advance();await f.service.revalidate();
 assert.equal(f.service.getSnapshot().providers[cap(jazz)].available,true);assert.equal(f.service.getSnapshot().providers[cap(rock)].available,false);assert.equal(f.service.getSnapshot().state,'DEGRADED');
 assert.ok(cache.pendingKeys().includes(key(rock)));assert.ok(!cache.pendingKeys().includes(key(jazz)));
});

test('normal connectivity has no global warning; widespread real fixture failures show accessible Check',async t=>{
 let fail=false;const f=await setup(t,async()=>{if(fail)throw Error('temporary');return sections();});
 const view=await mount(t,'src/components/connectivity/WavenConnectionStatus.tsx',f);assert.equal(view.container.textContent,'');
 fail=true;await React.act(async()=>{await f.runtime.getSearchDiscoveryCategory(jazz);});assert.equal(view.container.textContent,'');
 await React.act(async()=>{await f.runtime.getSearchDiscoveryCategory(rock);});assert.match(view.container.textContent,/Discovery is refreshing/);assert.ok(view.container.querySelector('[aria-live="polite"]'));
 fail=false;f.advance();await React.act(async()=>{await f.service.revalidate();});assert.equal(view.container.textContent,'');
});

test('twelve overlapping category reads make one request; one cancelled reader does not cancel the rest',async t=>{
 const gate=deferred(),f=await setup(t,()=>gate.promise),controllers=Array.from({length:12},()=>new AbortController());
 const reads=controllers.map(c=>f.runtime.getSearchDiscoveryCategory(jazz,{signal:c.signal,refresh:true}));await tick();assert.equal(f.calls(),1);
 controllers[0].abort();assert.equal((await reads[0]).cancelled,true);gate.resolve(sections());const results=await Promise.all(reads.slice(1));assert.ok(results.every(r=>!r.cancelled&&r.result.sections.length));assert.equal(f.calls(),1);
});

test('last reader leaving cancels stale work; its late response cannot overwrite the newer category or health',async t=>{
 const old=deferred();let n=0;const f=await setup(t,()=>++n===1?old.promise:Promise.resolve(sections('Latest Jazz'))),c=new AbortController();
 const first=f.runtime.getSearchDiscoveryCategory(jazz,{signal:c.signal,refresh:true});await tick();c.abort();assert.equal((await first).cancelled,true);
 const next=await f.runtime.getSearchDiscoveryCategory(jazz,{signal:new AbortController().signal,refresh:true});assert.equal(next.cancelled,false);
 old.resolve(sections('Stale Jazz'));await tick();assert.equal(f.runtime.getSearchDiscoveryCategorySessionSnapshot(jazz).result.sections[0].items[0].title,'Latest Jazz');
 assert.equal(cache.read(key(jazz)).value.result.sections[0].items[0].title,'Latest Jazz');assert.equal(f.service.getSnapshot().providers[cap(jazz)].available,true);
});

test('navigation away cancels the old destination; late completion cannot paint the Search root',async t=>{
 const gate=deferred(),f=await setup(t,()=>gate.promise);await f.runtime.getSearchDiscoveryCategories();
 const view=await mount(t,'app/search.tsx',f,selection());assert.equal(f.calls(),1);
 await React.act(async()=>{view.container.querySelector('[aria-label="Back to Search discovery"]').click();});
 await React.act(async()=>{gate.resolve(sections('Stale Navigation Jazz'));await tick();});
 assert.doesNotMatch(view.container.textContent,/Stale Navigation Jazz/);assert.ok(view.container.querySelector('[aria-label="Explore Rock"]'));assert.equal(cache.read(key(jazz)),null);
});

test('background cancellation retains pending intent and foreground recovery fills the mounted path',async t=>{
 let fail=true;const f=await setup(t,async()=>{if(fail)throw Error('temporary');return sections('Foreground Jazz');});await f.runtime.getSearchDiscoveryCategories();
 const view=await mount(t,'app/search.tsx',f,selection());await React.act(async()=>f.service.setActive(false));assert.equal(f.service.canRequest(cap(jazz)),false);
 fail=false;f.advance();await React.act(async()=>{f.service.setActive(true);await f.service.revalidate();});assert.match(view.container.textContent,/Foreground Jazz/);assert.equal(f.service.getSnapshot().state,'ONLINE');
});

test('cached category data and artwork survive a provider outage with truthful pending intent',async t=>{
 let fail=false;const f=await setup(t,async()=>{if(fail)throw Error('outage');return {sections:sections('Saved Jazz').sections.map(s=>({...s,items:s.items.map(i=>({...i,artworkUrl:'https://images.example/art.jpg'}))}))};});
 await f.runtime.getSearchDiscoveryCategory(jazz);fail=true;const result=await f.runtime.getSearchDiscoveryCategory(jazz,{refresh:true,signal:new AbortController().signal});
 assert.ok(result.errors.length);assert.equal(result.result.sections[0].items[0].title,'Saved Jazz');assert.equal(result.result.sections[0].items[0].artworkUrl,'https://images.example/art.jpg');assert.ok(cache.pendingKeys().includes(key(jazz)));
});

test('a verified empty category recovers to an honest empty state, with no invented music',async t=>{
 let fail=true;const f=await setup(t,async()=>{if(fail)throw Error('temporary');return empty();});await f.runtime.getSearchDiscoveryCategories();
 const view=await mount(t,'app/search.tsx',f,selection());fail=false;f.advance();await React.act(async()=>{await f.service.revalidate();});
 assert.match(view.container.textContent,/Nothing surfaced here yet/);assert.doesNotMatch(view.container.textContent,/temporarily unavailable/);assert.equal(f.service.getSnapshot().state,'ONLINE');
});

test('optional discovery degradation keeps real streaming admission available',async t=>{
 const f=await setup(t,async()=>{throw Error('discovery outage');});await f.runtime.getSearchDiscoveryCategory(jazz);
 assert.equal(f.service.getSnapshot().state,'DEGRADED');assert.equal(f.service.canRequest('ytmusic-streaming'),true);
 let calls=0;assert.equal(await f.service.runRemote('ytmusic-streaming',async()=>{calls++;return 'validated fixture source';}),'validated fixture source');assert.equal(calls,1);
});

test('repeated checks and an ongoing outage respect minimum interval, backoff and one recovery owner',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=await setup(t,async()=>{throw Error('outage');});await f.runtime.getSearchDiscoveryCategories();await f.runtime.getSearchDiscoveryCategory(jazz);
 await Promise.all(Array.from({length:20},()=>f.service.revalidate()));assert.equal(f.calls(),1);
 f.advance();t.mock.timers.tick(4001);await tick();await tick();assert.equal(f.calls(),2);
 await Promise.all(Array.from({length:20},()=>f.service.revalidate()));assert.equal(f.calls(),2);
 t.mock.timers.tick(1000);await tick();assert.equal(f.calls(),2);assert.ok(cache.pendingKeys().includes(key(jazz)));
});

test('durable category intent can recover its provider handle without a cached category index',async t=>{
 let fail=true;const f=await setup(t,async()=>{if(fail)throw Error('temporary');return sections();});
 await f.runtime.getSearchDiscoveryCategory(jazz);assert.equal(f.runtime.getSearchDiscoveryCategoriesSessionSnapshot(),null);
 fail=false;f.advance();await f.service.revalidate();assert.equal(f.calls(),2);assert.equal(f.service.getSnapshot().state,'ONLINE');assert.deepEqual(cache.pendingKeys(),[]);
});

test('a superseded generation failure cannot poison current capability health',async t=>{
 const old=deferred();let n=0;const f=await setup(t,()=>++n===1?old.promise:Promise.resolve(sections('Newest Jazz'))),states=[];
 f.service.subscribe(()=>states.push(f.service.getSnapshot().state));
 const first=f.runtime.getSearchDiscoveryCategory(jazz,{refresh:true});await tick();const latest=f.runtime.getSearchDiscoveryCategory(jazz,{refresh:true});await tick();old.reject(Error('obsolete outage'));
 assert.equal((await first).cancelled,true);await latest;assert.ok(!states.includes('DEGRADED'));assert.equal(f.service.getSnapshot().providers[cap(jazz)].available,true);
});

test('Home receives New Releases from coordinated retry without remount, navigation or CHECK',async t=>{
 let fail=true;const f=await setup(t,async()=>sections(),async()=>{if(fail)throw Error('temporary');return sections('Automatically Recovered Release');});
 const view=await mount(t,'app/index.tsx',f);assert.doesNotMatch(view.container.textContent,/Automatically Recovered Release/);
 fail=false;f.advance();await React.act(async()=>{await f.service.revalidate();});assert.match(view.container.textContent,/Automatically Recovered Release/);assert.doesNotMatch(view.container.textContent,/could not refresh|will retry automatically/);
});

test('all pending reads healing outside a failed recovery pass clears authoritative degraded state immediately',async t=>{
 let fail=true;const f=await setup(t,async()=>{if(fail)throw Error('outage');return sections();});await f.runtime.getSearchDiscoveryCategories();await f.runtime.getSearchDiscoveryCategory(jazz);
 f.advance();await f.service.revalidate();assert.equal(f.service.getSnapshot().state,'DEGRADED');
 fail=false;f.advance(16001);await f.runtime.getSearchDiscoveryCategory(jazz,{refresh:true,signal:new AbortController().signal});
 assert.deepEqual(cache.pendingKeys(),[]);assert.equal(f.service.getSnapshot().providers[cap(jazz)].available,true);assert.equal(f.service.getSnapshot().state,'ONLINE');
});

test('catalogue completion cannot clear an unrelated failed recovery job without completion evidence',async t=>{
 let fail=true;const f=await setup(t,async()=>{if(fail)throw Error('outage');return sections();});await f.runtime.getSearchDiscoveryCategories();await f.runtime.getSearchDiscoveryCategory(jazz);
 f.service.registerRecovery('unrelated-job','pending',async()=>{throw Error('still unavailable');});f.advance();await f.service.revalidate();
 fail=false;f.advance(16001);await f.runtime.getSearchDiscoveryCategory(jazz,{refresh:true,signal:new AbortController().signal});
 assert.deepEqual(cache.pendingKeys(),[]);assert.equal(f.service.getSnapshot().providers[cap(jazz)].available,true);assert.equal(f.service.getSnapshot().state,'DEGRADED');
});
