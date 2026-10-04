const test = require('node:test'), assert = require('node:assert/strict');
const { loader } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const { clock, nodes, trailerFixture } = require('./helpers/trailerSessionHarness.cjs');
const titles = require('./fixtures/trailerLanguageFixtures.json');
const normalize = loader()('apps/mobile/src/features/trailers/trailerCandidateService.ts').normalizeTrailerCandidates;
const external = loader()('apps/mobile/src/features/trailers/trailerExternalTarget.ts');
const text = f => f.nodes('Text').map(x => x.props.children).flat(Infinity);
const action = (f, label) => f.nodes('Pressable').find(x => nodes(x, 'Text').some(n => [n.props.children].flat(Infinity).includes(label)))?.props;
const deferred = () => { let resolve, reject; const promise = new Promise((yes,no) => { resolve=yes;reject=no; }); return { promise,resolve,reject }; };
async function rotate(timer, f) { timer.tick(700); await f.h.settle(); timer.tick(120); await f.h.settle(); }
function remoteFixture(primary = titles.beerus.primary, original = deferred()) {
  const h=hookHarness(), calls=[], currentOriginal=deferred(), network={remoteReady:true,recoveryEpoch:0};
  const load=loader({react:h.react, '@orion/shared/api': {tmdbFetch: async (path,options) => {
    calls.push({path,options});
    if (path.includes('/season/')) return {results:[]};
    if (path==='/movie/other/videos') return currentOriginal.promise;
    if (path.endsWith('/videos')) return original.promise;
    return {name:path.startsWith('/movie/other?')?'Another title':'Dragon Ball Super: Beerus',original_language:path.startsWith('/movie/other?')?'ko':'ja',number_of_seasons:1,videos:{results:primary}};
  }}, '../../context/NetworkContext':{useNetworkStatus:()=>network}, '../../context/useRemoteRecoveryEffect':{useRemoteRecoveryEffect(){}}});
  const hook=load('apps/mobile/src/features/media-detail/useMediaDetailRemoteState.ts').useMediaDetailRemoteState;
  h.start(hook,{id:'312359',type:'tv',selectedSeason:1,activeTab:'info',showTrailerModal:false});
  return {h,calls,original, pool:()=>normalize(h.result.data?.videos?.results || [],h.result.seasonVideos,'en','ja')};
}

test('English candidates may fail before a late original-language TMDb alternative plays through the same modal', async t => {
  const timer=clock(),remote=remoteFixture(); let f;
  t.after(()=>{f?.dispose();remote.h.dispose();timer.restore();}); await remote.h.settle();
  assert.equal(remote.calls.filter(x=>x.path==='/tv/312359/videos').length,1);
  assert.equal(remote.calls.find(x=>x.path==='/tv/312359/videos').options.language,'ja');
  f=trailerFixture(remote.pool(),{title:titles.beerus.title,titleKey:'tv:312359',searchMetadata:{year:'2026'}});await f.h.settle();
  const attempted=[];
  for(let i=0;i<3;i++){attempted.push(f.bridge().options.videoId);f.bridge().options.events.onError({data:100});await f.h.settle();await rotate(timer,f);}
  assert.equal(f.view(),undefined);
  remote.original.resolve({results:titles.beerus.original});await remote.h.settle();
  await f.update({candidates:remote.pool()});timer.tick(120);await f.h.settle();
  const next=f.bridge();assert.equal(next.options.videoId,remote.pool()[3].providerKey);
  attempted.push(next.options.videoId);next.options.events.onStateChange({data:1});await f.h.settle();
  timer.tick(90000);await f.h.settle();assert.equal(f.nodes('Modal').length,1);assert.equal(f.nodes('WebView').length,1);
  assert.ok(!text(f).includes('Trailer unavailable'));assert.ok(!action(f,'Search YouTube'));
  assert.deepEqual(attempted,remote.pool().slice(0,4).map(x=>x.providerKey));
  await action(f,'Open YouTube').onPress();assert.equal(f.opened.at(-1),external.exactTrailerUrl(remote.pool()[3]));
});

test('original-language pool deduplicates keys and never remounts a known-good first player', async t => {
  const timer=clock(),remote=remoteFixture();let f;
  t.after(()=>{f?.dispose();remote.h.dispose();timer.restore();});await remote.h.settle();
  f=trailerFixture(remote.pool());await f.h.settle();await f.emit('playing');const first=f.view();
  remote.original.resolve({results:[...titles.beerus.original,{...titles.beerus.primary[0],name:'Duplicate Japanese title',iso_639_1:'ja'}]});await remote.h.settle();
  const pool=remote.pool();assert.equal(pool.length,6);assert.equal(new Set(pool.map(x=>x.id)).size,6);
  assert.deepEqual(pool.slice(0,3),normalize(titles.beerus.primary,[],'en','ja'));
  await f.update({candidates:pool});assert.equal(f.view().key,first.key);assert.equal(f.view().source.html,first.source.html);
  timer.tick(90000);await f.h.settle();assert.equal(f.view().key,first.key);
});

test('additional original-language Trailers preserve an existing first Teaser and deterministic alternative ranking', () => {
  const primary={...titles.beerus.primary[0],type:'Teaser'};
  const alternatives=titles.beerus.original.map(x=>({...x,originalLanguageAlternative:true}));
  const pool=normalize([primary,...alternatives],[],'en','ja');
  assert.equal(pool[0].providerKey,primary.key);
  assert.deepEqual(pool,normalize([primary,...alternatives.reverse()],[],'en','ja'));
});

test('all terminally unusable uploads exhaust finitely and use external search instead of the failed final video', async t => {
  const timer=clock(),pool=normalize(titles.beerus.primary,[],'en','ja');
  const f=trailerFixture(pool,{title:titles.beerus.title,searchMetadata:{year:'2026',originalTitle:titles.beerus.originalTitle}});
  t.after(()=>{f.dispose();timer.restore();});await f.h.settle();
  for(const code of [100,101,150]){f.bridge().options.events.onError({data:code});await f.h.settle();await rotate(timer,f);}
  assert.equal(f.view(),undefined);assert.ok(text(f).includes('Trailer unavailable'));
  assert.ok(text(f).includes('You can search YouTube for another version.'));assert.ok(!action(f,'Open YouTube'));
  const expected='https://www.youtube.com/results?search_query=Dragon%20Ball%20Super%3A%20Beerus%202026%20official%20trailer';
  await action(f,'Search YouTube').onPress();await action(f,'Open in browser').onPress();assert.deepEqual(f.opened,[expected,expected]);
  for(let i=0;i<5;i++){action(f,'Try next').onPress();await f.h.settle();timer.tick(90000);await f.h.settle();assert.equal(f.view(),undefined);}
  assert.equal(f.nodes('Modal').length,1);
});

test('a terminal failure cannot retain the external target while an appropriate unfailed candidate remains', async t => {
  const timer=clock(),pool=normalize(titles.beerus.primary,[],'en','ja'),f=trailerFixture(pool);
  t.after(()=>{f.dispose();timer.restore();});await f.h.settle();
  f.bridge().options.events.onError({data:100});await f.h.settle();
  await action(f,'Open YouTube').onPress();assert.equal(f.opened.at(-1),external.exactTrailerUrl(pool[1]));
  assert.ok(!action(f,'Search YouTube'));await rotate(timer,f);assert.equal(f.view().key,`${pool[1].id}-1`);
  assert.equal(f.nodes('Pressable').find(x=>x.props.key===pool[1].id).props.accessibilityState.selected,true);
});

test('successful embedded video remains the exact external target through pause, buffering and rerenders', async t => {
  const timer=clock(),pool=normalize(titles.beerus.primary,[],'en','ja'),f=trailerFixture(pool);
  t.after(()=>{f.dispose();timer.restore();});await f.h.settle();await f.emit('playing');const first=f.view();
  for(const state of ['paused','buffering','autoplay-blocked']){await f.emit(state);await f.update({candidates:pool.map(x=>({...x}))});
    await action(f,'Open YouTube').onPress();await action(f,'Open in browser').onPress();assert.equal(f.view().key,first.key);assert.equal(f.view().source.html,first.source.html);}
  assert.ok(f.opened.every(url=>url===external.exactTrailerUrl(pool[0])));assert.ok(!action(f,'Search YouTube'));
});

test('Try next preserves traversal and skips terminal failures after an explicit chip selection', async t => {
  const timer=clock(),pool=normalize(titles.beerus.primary,[],'en','ja'),f=trailerFixture(pool);
  t.after(()=>{f.dispose();timer.restore();});await f.h.settle();
  f.bridge().options.events.onError({data:100});await f.h.settle();await rotate(timer,f);
  f.nodes('Pressable').find(n=>n.props.key===pool[2].id).props.onPress();await f.h.settle();
  action(f,'Try next').onPress();await f.h.settle();timer.tick(120);await f.h.settle();
  assert.equal(f.view().key,`${pool[1].id}-3`);
  action(f,'Try next').onPress();await f.h.settle();timer.tick(5000);await f.h.settle();assert.equal(f.view(),undefined);
  await action(f,'Open YouTube').onPress();assert.notEqual(f.opened.at(-1),external.exactTrailerUrl(pool[0]));
});

test('search query uses current metadata deterministically, encodes safely and does not duplicate a year', () => {
  for(const [metadata,query] of [
    [{title:'  The   Scandal ',year:'2026',originalTitle:'스캔들'},'The Scandal 2026 official trailer'],
    [{title:'Movie (2026)',year:'2026'},'Movie (2026) official trailer'],
    [{title:'',originalTitle:' ドラゴンボール超  ビルス ',year:'2026'},'ドラゴンボール超 ビルス 2026 official trailer'],
    [{title:'A & B / C?',year:'invalid'},'A & B / C? official trailer'],
    [{title:'Title',year:'0000'},'Title official trailer'],
    [{title:'   ',originalTitle:' '},null]]){
    assert.equal(external.trailerSearchQuery(metadata),query);
    const target=external.trailerExternalTarget(null,metadata,true);
    if(query){const url=new URL(target.url);assert.equal(url.origin,'https://www.youtube.com');assert.equal(url.pathname,'/results');assert.equal(url.searchParams.get('search_query'),query);}
    else assert.equal(target,null);
  }
  assert.equal(external.trailerExternalTarget(null,{title:'Title'},false),null);
});

test('no usable candidates offers external search without mounting or discovering arbitrary search videos', async t => {
  const timer=clock(),f=trailerFixture([],{title:'Current title',searchMetadata:{year:'2025'}});
  t.after(()=>{f.dispose();timer.restore();});await f.h.settle();assert.equal(f.view(),undefined);
  await action(f,'Search YouTube').onPress();timer.tick(120000);await f.h.settle();assert.equal(f.view(),undefined);
  assert.equal(f.opened.length,1);assert.equal(f.nodes('WebView').length,0);assert.equal(f.nodes('Modal').length,1);
});

test('The Scandal keeps its physical-control first candidate, exact player configuration and external actions', async t => {
  const timer=clock(),control=titles.control,pool=normalize(control.videos,[],'en',control.originalLanguage);
  const f=trailerFixture(pool,{title:control.title,titleKey:`tv:${control.id}`,searchMetadata:{year:'2026'}});
  t.after(()=>{f.dispose();timer.restore();});await f.h.settle();const view=f.view(),b=f.bridge();
  assert.equal(view.key,control.expected.key);assert.deepEqual(JSON.parse(JSON.stringify(b.options)),control.expected.player);
  for(const [key,value] of Object.entries(control.expected.controlProps))assert.deepEqual(view[key],value);
  assert.equal(view.source.baseUrl,control.expected.baseUrl);
  b.options.events.onReady();b.options.events.onStateChange({data:1});await f.h.settle();
  await f.update({candidates:[...pool,...normalize(titles.beerus.original.map(x=>({...x,originalLanguageAlternative:true})),[])]});
  timer.tick(120000);await f.h.settle();assert.equal(f.view().key,view.key);assert.equal(f.view().source.html,view.source.html);
  await action(f,'Open YouTube').onPress();assert.equal(f.opened.at(-1),external.exactTrailerUrl(pool[0]));assert.ok(!action(f,'Search YouTube'));
});

test('terminal eligibility is title/session scoped and a retry needs actual playing evidence to restore a failed exact target', async t => {
  const timer=clock(),pool=normalize(titles.beerus.primary.slice(0,1),[]),f=trailerFixture(pool,{titleKey:'tv:312359'});
  t.after(()=>{f.dispose();timer.restore();});await f.h.settle();const stale=f.bridge();
  stale.options.events.onError({data:100});await f.h.settle();await rotate(timer,f);assert.ok(action(f,'Search YouTube'));
  action(f,'Retry').onPress();await f.h.settle();assert.equal(action(f,'Open YouTube').disabled,true);
  await f.emit('playing');await action(f,'Open YouTube').onPress();assert.equal(f.opened.at(-1),external.exactTrailerUrl(pool[0]));
  await f.update({visible:false});await f.update({visible:true,titleKey:'tv:another',title:'Another title'});
  stale.options.events.onError({data:100});await f.h.settle();assert.equal(action(f,'Open YouTube').disabled,false);assert.equal(f.view().key,`${pool[0].id}-0`);
});

test('network failures do not falsely exhaust uploads or invoke external search', async t => {
  const timer=clock(),pool=normalize(titles.beerus.primary,[]),f=trailerFixture(pool);
  t.after(()=>{f.dispose();timer.restore();});await f.h.settle();const first=f.view();
  first.onError();await f.h.settle();timer.tick(120000);await f.h.settle();assert.ok(!action(f,'Search YouTube'));
  await action(f,'Open YouTube').onPress();assert.equal(f.opened.at(-1),external.exactTrailerUrl(pool[0]));
});

test('original-language metadata failure preserves primary candidates; stale route responses cannot add alternatives', async t => {
  const remote=remoteFixture();t.after(()=>remote.h.dispose());await remote.h.settle();const primary=remote.pool();
  remote.original.reject(new Error('metadata unavailable'));await remote.h.settle();assert.deepEqual(remote.pool(),primary);
  const stale=remoteFixture();t.after(()=>stale.h.dispose());await stale.h.settle();
  stale.h.update({id:'other',type:'movie',selectedSeason:1,activeTab:'info',showTrailerModal:false});await stale.h.settle();
  const currentPool=stale.pool();
  stale.original.resolve({results:titles.beerus.original});await stale.h.settle();
  assert.equal(stale.h.result.data.name,'Another title');assert.deepEqual(stale.pool(),currentPool);
  assert.equal(stale.calls.filter(x=>x.path==='/tv/312359/videos').length,1);
});
