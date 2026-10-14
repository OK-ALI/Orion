'use strict';
const assert=require('node:assert/strict'),test=require('node:test');
const {loader}=require('./helpers/animeModules.cjs');
const {hookHarness}=require('./helpers/playerHookHarness.cjs');
const prefix='apps/mobile/src/features/glimpse/';
const {GlimpseFeedEngine}=loader()(prefix+'GlimpseFeedEngine.ts');
const {awaitGlimpseRequest}=loader()(prefix+'glimpseRequestCancellation.ts');
const item=id=>({id,media_type:'movie',title:'Title '+id});
const reel=id=>({schemaVersion:1,id:'reel:'+id,media:{tmdbId:id,mediaType:'movie',isAnime:false,season:null,episode:null},title:'Title '+id,clipTitle:'Scene',video:{provider:'youtube',key:String(id).padStart(11,'0'),type:'Clip',language:null,durationSeconds:null},artworkPath:null,posterPath:null,year:null});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};};
const turn=()=>new Promise(resolve=>setImmediate(resolve));

test('a cancelled never-settling catalog unlocks Retry without waiting for the old request',async()=>{
 let calls=0;const never=deferred(),controller=new AbortController();
 const engine=new GlimpseFeedEngine({page:async()=>++calls===1?never.promise:{items:[item(2)],hasMore:false}},{candidates:async i=>[reel(i.id)]});
 const old=engine.extend(controller.signal,4);const rejected=assert.rejects(old,/cancelled/);
 await turn();controller.abort();await rejected;
 assert.equal(engine.snapshot().reels.length,0);
 const recovered=await engine.extend(new AbortController().signal,4);
 assert.deepEqual(recovered.reels.map(r=>r.media.tmdbId),[2]);assert.equal(calls,2);
 never.resolve({items:[item(1)],hasMore:true});await turn();
 assert.deepEqual(engine.snapshot().reels.map(r=>r.media.tmdbId),[2]);assert.equal(engine.snapshot().exhausted,true);
});

test('a cancelled title at the next page recovers beyond forty reels with protected identity and the bounded window',async()=>{
 const never=deferred();let block=true;
 const engine=new GlimpseFeedEngine({page:async page=>({items:Array.from({length:40},(_,i)=>item((page-1)*40+i+1)),hasMore:true})},{candidates:async i=>i.id===41&&block?never.promise:[reel(i.id)]});
 for(let i=0;i<5;i++)await engine.extend(new AbortController().signal,8);
 assert.equal(engine.snapshot().reels.length,40);
 const controller=new AbortController(),old=engine.extend(controller.signal,8,'reel:40');const rejected=assert.rejects(old,/cancelled/);
 await turn();controller.abort();await rejected;assert.equal(engine.snapshot().reels.length,40);
 block=false;await engine.extend(new AbortController().signal,8,'reel:40');
 await engine.extend(new AbortController().signal,8,'reel:40');
 const recovered=engine.snapshot().reels;
 assert.equal(recovered.length,48);assert.ok(recovered.some(r=>r.id==='reel:40'));assert.ok(recovered.some(r=>r.id==='reel:56'));
 assert.equal(new Set(recovered.map(r=>r.id)).size,48);
 never.resolve([reel(41)]);await turn();assert.deepEqual(engine.snapshot().reels,recovered);
});

test('already cancelled requests do not enter the public client and late rejection is consumed',async()=>{
 let calls=0;const controller=new AbortController();controller.abort();
 await assert.rejects(awaitGlimpseRequest(async()=>{calls++;return 1},controller.signal),/cancelled/);assert.equal(calls,0);
 const pending=deferred(),second=new AbortController(),request=awaitGlimpseRequest(()=>pending.promise,second.signal),rejected=assert.rejects(request,/cancelled/);
 second.abort();await rejected;pending.reject(Error('late transport error'));await turn();
});

test('ordinary completion keeps one in-flight extension and preserves existing title order',async()=>{
 const pending=deferred();let calls=0;
 const engine=new GlimpseFeedEngine({page:async()=>({items:[item(1),item(2)],hasMore:false})},{candidates:async i=>{calls++;return i.id===1?pending.promise:[reel(i.id)]}});
 const first=engine.extend(new AbortController().signal,4);await turn();
 assert.equal((await engine.extend(new AbortController().signal,4)).addedCount,0);assert.equal(calls,1);
 pending.resolve([reel(1)]);assert.deepEqual((await first).reels.map(r=>r.media.tmdbId),[1,2]);assert.equal(calls,2);
});

test('the real hook retries after its deadline even when the timed-out client promise never settles',async t=>{
 const original={setTimeout:global.setTimeout,clearTimeout:global.clearTimeout},timers=new Map();let id=0;
 global.setTimeout=(callback,delay)=>{timers.set(++id,{callback,delay});return id};global.clearTimeout=key=>timers.delete(key);
 t.after(()=>Object.assign(global,original));
 const h=hookHarness(),never=deferred();let calls=0;
 const useFeed=loader({react:h.react,'./tmdbGlimpseSource':{glimpseDiscoveryCatalog:{page:async()=>({items:[item(1)],hasMore:false})},tmdbGlimpseVideoSource:{candidates:async()=>++calls===1?never.promise:[reel(1)]}}})(prefix+'useGlimpseFeed.ts').useGlimpseFeed;
 h.start(input=>useFeed(input.enabled,4),{enabled:true});t.after(()=>h.dispose());await h.settle();
 const deadline=[...timers.entries()].find(([,value])=>value.delay===20000);assert.ok(deadline);timers.delete(deadline[0]);deadline[1].callback();await h.settle();
 assert.equal(h.result.status,'error');assert.equal(h.result.failure.kind,'timeout');
 const retry=[...timers.entries()].find(([,value])=>value.delay===1500);assert.ok(retry);timers.delete(retry[0]);retry[1].callback();await h.settle();
 assert.equal(calls,2);assert.equal(h.result.status,'ready');assert.equal(h.result.reels[0].id,'reel:1');
 never.resolve([reel(999)]);await h.settle();assert.equal(h.result.reels[0].id,'reel:1');
});
