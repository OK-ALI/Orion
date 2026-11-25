const assert=require('node:assert/strict'), fs=require('node:fs'), test=require('node:test'), ts=require('typescript');
require.extensions['.ts']=(record,filename)=>record._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const {ResilientWavenDiscoveryRuntime:Runtime}=require('../src/features/discovery/wavenDiscoveryRuntime.ts');
const {wavenConnectivity:connection}=require('../src/infrastructure/connectivity/connectivityService.ts');
const {offlineMetadata:cache}=require('../src/infrastructure/connectivity/offlineMetadata.ts');
const store=()=>{const map=new Map();return {get:k=>map.get(k)??null,set:(k,v)=>map.set(k,v),remove:k=>map.delete(k)};};
const album={id:'album',title:'Album',artworkUrl:'https://img.example/album.jpg',source:{provider:'catalog',id:'album'}};
const track={id:'track',title:'Song',artistName:'Artist',durationMs:180000,source:{provider:'catalog',id:'song'},providerRefs:[{provider:'ytmusic-metadata',id:'abcdefghijk'}]};
const detail={album,tracks:[track]};
function setup(t){
  cache.configure(store());connection.start({internet:async()=>true,providers:async()=>({catalog:true})});
  connection.observe({connected:false,internetReachable:false,type:'none'});t.after(()=>connection.stop());
  let calls=0;const provider={id:'catalog',name:'Catalogue',kind:'metadata',capabilities:[],getAlbum:async()=>{calls++;return detail;}};
  return {runtime:new Runtime([provider],[],[]),calls:()=>calls};
}
test('offline album uses durable canonical detail without provider calls or stream fields',async t=>{
  const {runtime,calls}=setup(t);cache.remember('album:catalog\0album',{detail});
  const response=await runtime.getAlbum(album);assert.deepEqual(response.detail,detail);assert.equal(calls(),0);assert.equal(response.cancelled,false);
  assert.ok(cache.pendingKeys().includes('album:catalog\0album'));
});
test('uncached detail is an intentional offline miss and cancelled reads remain cancelled',async t=>{
  const {runtime,calls}=setup(t);const response=await runtime.getAlbum({...album,source:{provider:'catalog',id:'uncached'}});
  assert.equal(response.detail,null);assert.match(response.errors.join(' '),/offline/);assert.equal(calls(),0);
  const controller=new AbortController();controller.abort();assert.equal((await runtime.getAlbum(album,{signal:controller.signal})).cancelled,true);
});
test('malformed persisted detail is ignored rather than crashing cached screen consumers',async t=>{
  const {runtime}=setup(t);cache.remember('album:catalog\0album',{detail:{album:null,tracks:[null]}});
  const result=await runtime.getAlbum(album);assert.equal(result.detail,null);assert.match(result.errors.join(' '),/offline/);
});
test('cached Home preserves artwork, shared IDs and sections after a new runtime',async t=>{
  const {runtime,calls}=setup(t);cache.remember('home-charts',{result:{sections:[{id:'chart',title:'Global',type:'tracks',items:[track]}]}});
  const restored=new Runtime([],[],[]), response=await restored.getSearchGlobalCharts();
  assert.equal(response.result.sections[0].items[0].source.id,'song');assert.equal(calls(),0);assert.ok(runtime.getSearchGlobalChartsSessionSnapshot());
});
test('ordered reconnect drains durable detail read once and preserves metadata ownership',async t=>{
  const {runtime,calls}=setup(t);const target={...album,source:{provider:'catalog',id:'recovery'}};
  await runtime.getAlbum(target);const unregister=connection.registerRecovery('p8-test-cache','metadata',signal=>runtime.refreshPendingOfflineMetadata(signal));
  t.after(unregister);
  connection.observe({connected:true,internetReachable:true,type:'wifi'});await connection.revalidate();
  assert.equal(calls(),1);assert.equal(cache.pendingKeys().includes('album:catalog\0recovery'),false);assert.equal(connection.getSnapshot().state,'ONLINE');
});
test('development outage and fixture surfaces cannot mutate accepted product storage or Cloud',()=>{
  const source=fs.readFileSync(require('node:path').join(__dirname,'../app/connectivity-debug.tsx'),'utf8');
  assert.match(source,/if \(!__DEV__\)/);assert.match(source,/id: 'waven.connectivity.validation'/);
  assert.doesNotMatch(source,/setFavorite\([^\n]*getLocalLibrary|writePortableProfile|SecureStore|completeWavenEntry|id: 'waven.library'/);
});

// V8.2: a provider's truthful error response leaves refresh intent pending and must
// signal recovery failure, not be counted as a successfully drained queue.
test('unresolved public metadata refresh signals retry while retaining durable intent', async t => {
  const {runtime}=setup(t);
  cache.enqueue('home-releases');
  assert.deepEqual(cache.pendingKeys(),['home-releases']);
  await assert.rejects(runtime.refreshPendingOfflineMetadata(new AbortController().signal),/incomplete/i);
  assert.deepEqual(cache.pendingKeys(),['home-releases']);
  const controller=new AbortController(); controller.abort();
  await runtime.refreshPendingOfflineMetadata(controller.signal);
  assert.deepEqual(cache.pendingKeys(),['home-releases']);
});
