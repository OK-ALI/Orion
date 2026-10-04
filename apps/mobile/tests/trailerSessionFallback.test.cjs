const test = require('node:test'), assert = require('node:assert/strict');
const titles = require('./fixtures/trailerTitles.json');
const { loader } = require('./helpers/animeModules.cjs');
const { clock, trailerFixture } = require('./helpers/trailerSessionHarness.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const normalize = loader()('apps/mobile/src/features/trailers/trailerCandidateService.ts').normalizeTrailerCandidates;
const list = normalize(titles[1].videos, [], 'en', 'ja');
const text = f => f.nodes('Text').map(x => x.props.children).flat(Infinity);
const action = (f, label) => f.nodes('Pressable').find(x => text({ nodes: name => name === 'Text' ? require('./helpers/trailerSessionHarness.cjs').nodes(x,name) : [] }).includes(label)).props.onPress;
async function rotate(timer, f) { timer.tick(700); await f.h.settle(); timer.tick(120); await f.h.settle(); }
for (const title of titles) test(`first candidate and existing player configuration preserved: ${title.title}`, async t => {
  const timer=clock(), f=trailerFixture(normalize(title.videos,[],'en',title.originalLanguage), { title:title.title, titleKey:`${title.type}:${title.id}` });
  t.after(()=>{f.dispose();timer.restore();}); await f.h.settle();
  const view=f.view(), b=f.bridge();
  assert.equal(view.key,title.expected.key);
  assert.deepEqual(JSON.parse(JSON.stringify(b.options)),title.expected.player);
  for(const [key,value] of Object.entries(title.expected.controlProps)) assert.deepEqual(view[key],value);
  assert.equal(view.source.baseUrl,title.expected.baseUrl);
  b.options.events.onReady();b.options.events.onStateChange({data:1});await f.h.settle();
  const source=f.view().source.html;
  timer.tick(90000);await f.h.settle();
  await f.update({ candidates:[...normalize(title.videos,[],'en',title.originalLanguage).map(x=>({...x})), {...list[0],id:'youtube:late_extra1',providerKey:'late_extra1'}] });
  assert.equal(f.view().key,view.key);assert.equal(f.view().source.html,source);
  assert.equal(f.nodes('ActivityIndicator').length,0);assert.equal(f.nodes('WebView').length,1);assert.equal(f.nodes('Modal').length,1);
  await f.policy(false,true);assert.equal(f.view().source.html,source);assert.equal(f.nodes('Modal')[0].props.animationType,'fade');
  await f.orient(840,420);assert.equal(f.view().key,view.key);assert.equal(f.view().source.html,source);
  await action(f,'Open in browser')();assert.equal(f.opened.at(-1),`https://www.youtube.com/watch?v=${title.expected.player.videoId}`);
});
test('slow/no-event load, buffering, paused and blocked autoplay never remount or advance', async t => {
  const timer=clock(),f=trailerFixture(list);t.after(()=>{f.dispose();timer.restore();});await f.h.settle();
  const first=f.view(),b=f.bridge();timer.tick(10*60*1000);await f.h.settle();
  assert.equal(f.view().key,first.key);assert.equal(f.view().source.html,first.source.html);
  for(const type of ['buffering','autoplay-blocked','paused','timeout','unknown']){b.post(type);await f.h.settle();timer.tick(90000);await f.h.settle();assert.equal(f.view().key,first.key);}
  b.options.events.onReady();b.options.events.onStateChange({data:1});await f.h.settle();assert.equal(f.nodes('ActivityIndicator').length,0);
});
test('terminal failure advances once through the same modal/player; healthy fallback cancels further attempts', async t => {
  const timer=clock(),f=trailerFixture(list);t.after(()=>{f.dispose();timer.restore();});await f.h.settle();
  const first=f.bridge();first.options.events.onError({data:100});first.options.events.onError({data:100});await f.h.settle();
  await rotate(timer,f);assert.equal(f.view().key,`${list[1].id}-1`);
  const second=f.bridge();second.options.events.onReady();second.options.events.onStateChange({data:1});await f.h.settle();
  first.options.events.onError({data:101});timer.tick(90000);await f.h.settle();assert.equal(f.view().key,`${list[1].id}-1`);
  await action(f,'Open in browser')();assert.equal(f.opened.at(-1),`https://www.youtube.com/watch?v=${list[1].providerKey}`);
  assert.equal(f.nodes('Modal').length,1);
});
test('several dead Trailers reach a Teaser; exhaustion is finite with an external search action', async t => {
  const timer=clock(),f=trailerFixture(list.slice(0,4));t.after(()=>{f.dispose();timer.restore();});await f.h.settle();
  for(let i=0;i<3;i++){f.bridge().options.events.onError({data:i===0?100:101});await f.h.settle();await rotate(timer,f);}
  assert.equal(f.view().key,`${list[3].id}-3`);assert.equal(list[3].type,'Teaser');
  await f.emit('playing');timer.tick(90000);await f.h.settle();assert.equal(f.view().key,`${list[3].id}-3`);
  f.bridge().options.events.onError({data:150});await f.h.settle();await rotate(timer,f);
  assert.equal(f.view(),undefined);assert.ok(text(f).includes('Trailer unavailable'));
  timer.tick(90000);await f.h.settle();assert.equal(f.view(),undefined);
  await action(f,'Search YouTube')();assert.equal(f.opened.at(-1),'https://www.youtube.com/results?search_query=Trailer%20fixture%20official%20trailer');
});
test('no videos produces unavailable state without mounting an empty player; late data may initialize once', async t => {
  const timer=clock(),f=trailerFixture([]);t.after(()=>{f.dispose();timer.restore();});await f.h.settle();
  assert.equal(f.view(),undefined);assert.ok(text(f).includes('Trailer unavailable'));
  await f.update({candidates:list});assert.equal(f.view().key,`${list[0].id}-0`);
});
test('late season alternatives keep a healthy manually selected candidate and current source', async t => {
  const timer=clock(),f=trailerFixture(list.slice(0,2));t.after(()=>{f.dispose();timer.restore();});await f.h.settle();
  f.nodes('Pressable').find(n=>n.props.key===list[1].id).props.onPress();await f.h.settle();await f.emit('playing');
  const current=f.view();await f.update({candidates:[list[3],...list]});
  assert.equal(f.view().key,current.key);assert.equal(f.view().source.html,current.source.html);
});
test('malformed, missing-token, wrong candidate and closed/reopened/title-stale messages cannot change the active attempt', async t => {
  const timer=clock(),f=trailerFixture(list,{titleKey:'tv:62715'});t.after(()=>{f.dispose();timer.restore();});await f.h.settle();
  const current=f.view(),old=f.bridge();
  const token = /attemptToken:"([^"]+)"/.exec(current.source.html)[1];
  current.onMessage({nativeEvent:{data:JSON.stringify({candidateId:'youtube:wrong-frame',attemptToken:token,type:'provider-error',detail:{code:100}})}});
  for(const raw of ['{','null','[]',JSON.stringify({candidateId:list[0].id,type:'provider-error',detail:{code:100}})]) current.onMessage({nativeEvent:{data:raw}});
  old.post('unsupported');old.post('provider-error');old.post('provider-error',{code:{not:'numeric'}});await f.h.settle();assert.equal(f.view().key,current.key);
  await f.update({visible:false});old.post('provider-error',{code:100});await f.update({visible:true});const reopened=f.view().source.html;
  old.post('provider-error',{code:100});await f.h.settle();timer.tick(5000);await f.h.settle();assert.equal(f.view().source.html,reopened);
  const prior=f.bridge();await f.update({titleKey:'movie:62715',title:'Different title'});prior.post('provider-error',{code:100});await f.h.settle();
  assert.equal(f.view().key,`${list[0].id}-0`);
});
test('unmounted attempts cannot create new fallback timers; a different title starts with fresh candidates', async t => {
  const timer=clock(),f=trailerFixture(list.slice(0,2),{titleKey:'tv:62715'});t.after(()=>timer.restore());await f.h.settle();
  const bridge=f.bridge();f.dispose();bridge.post('provider-error',{code:100});timer.tick(5000);
  const fresh=trailerFixture(list.slice(0,2),{titleKey:'tv:312359'});t.after(()=>fresh.dispose());await fresh.h.settle();assert.equal(fresh.view().key,`${list[0].id}-0`);
});
test('late season alternatives may rescue a terminally exhausted session without retrying failed uploads', async t => {
  const timer=clock(),f=trailerFixture(list.slice(0,1));t.after(()=>{f.dispose();timer.restore();});await f.h.settle();
  f.bridge().options.events.onError({data:100});await f.h.settle();await rotate(timer,f);assert.equal(f.view(),undefined);
  await f.update({candidates:list.slice(0,2)});timer.tick(120);await f.h.settle();assert.equal(f.view().key,`${list[1].id}-1`);
});
test('subresource HTTP errors and unrelated diagnostics do not interrupt healthy wrapper playback', async t => {
  const timer=clock(),f=trailerFixture(list);t.after(()=>{f.dispose();timer.restore();});await f.h.settle();await f.emit('playing');
  const view=f.view();view.onHttpError({nativeEvent:{statusCode:404,url:'https://i.ytimg.com/missing.jpg'}});await f.h.settle();
  assert.equal(f.view().key,view.key);assert.equal(f.view().source.html,view.source.html);
});
test('existing bounded direct retry is restricted to explicit errors; identity/network/unknown errors never exhaust alternatives', async t => {
  const timer=clock(),h=hookHarness(),load=loader({react:h.react});t.after(()=>{h.dispose();timer.restore();});
  h.start(({visible,titleKey})=>load('apps/mobile/src/features/trailers/hooks/useTrailerSession.ts').useTrailerSession(visible,list,titleKey),{visible:true,titleKey:'tv:62715'});await h.settle();
  const emit=(type,detail)=>h.result.handleMessage(JSON.stringify({candidateId:h.result.activeCandidate.id,attemptToken:h.result.messageToken,type,detail}));
  emit('provider-error',{code:153});await h.settle();assert.equal(h.result.transport,'direct');assert.equal(h.result.attempt,1);
  emit('provider-error',{code:153});await h.settle();timer.tick(90000);await h.settle();assert.equal(h.result.activeIndex,0);assert.equal(h.result.state,'client-identity-error');
  for(const [type,detail] of [['network-error',null],['provider-error',{code:'unknown'}]]){h.result.retry();await h.settle();emit(type,detail);await h.settle();timer.tick(90000);await h.settle();assert.equal(h.result.activeIndex,0);assert.equal(h.result.transport,'wrapper');}
  h.result.retry();await h.settle();emit('provider-error',{code:5});await h.settle();assert.equal(h.result.attempt,5);assert.equal(h.result.transport,'direct');
  emit('provider-error',{code:5});await h.settle();timer.tick(700);await h.settle();timer.tick(120);await h.settle();assert.equal(h.result.activeIndex,1);
});
test('existing Vimeo uses the same candidate session; privacy is terminal and unknown errors are not', async t => {
  const timer=clock(),h=hookHarness(),load=loader({react:h.react});t.after(()=>{h.dispose();timer.restore();});
  const mixed=normalize([{site:'Vimeo',key:'76979871',name:'Official Trailer',type:'Trailer',official:true},...titles[1].videos.filter(x=>x.type==='Teaser')],[]);
  h.start(()=>load('apps/mobile/src/features/trailers/hooks/useTrailerSession.ts').useTrailerSession(true,mixed,'movie:1'),{});await h.settle();
  h.result.handleMessage(JSON.stringify({candidateId:h.result.activeCandidate.id,attemptToken:h.result.messageToken,type:'provider-error',detail:{code:'PrivacyError'}}));await h.settle();
  timer.tick(700);await h.settle();timer.tick(120);await h.settle();assert.equal(h.result.activeCandidate.site,'YouTube');
});
