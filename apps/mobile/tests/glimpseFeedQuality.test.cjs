'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {loader}=require('./helpers/animeModules.cjs');
const prefix='apps/mobile/src/features/glimpse/';
const load=loader({'react-native':{Platform:{OS:'android'}},'@orion/shared/api':{isAnimeContent:()=>false},'../../services/storageAdapter':{mmkvStorageAdapter:{get:()=>null}}});
const {GlimpseFeedOrder}=load(prefix+'GlimpseFeedOrder.ts');
const {GlimpseFeedEngine}=load(prefix+'GlimpseFeedEngine.ts');
const curated=load(prefix+'glimpseCuratedScenes.ts'), policy=load(prefix+'glimpsePolicy.ts'), model=load(prefix+'glimpseModel.ts');
const {normalizeGlimpseVideos}=load(prefix+'tmdbGlimpseSource.ts');
const browse=load(prefix+'glimpseBrowse.ts');
const media=id=>({id,media_type:'movie',title:'Title '+id});
const reel=(id,key=String(id).padStart(11,'0'))=>normalizeGlimpseVideos(media(id),[{site:'YouTube',key,type:'Clip',name:'Scene'}])[0];
const signal=()=>new AbortController().signal;

test('newer metadata never inserts above the viewed prefix; explicit sort resets upcoming order',()=>{
 const order=new GlimpseFeedOrder(), a=reel(1),b=reel(2),c=reel(3),d=reel(4);
 assert.deepEqual(order.order('newest',[a],null).map(r=>r.id),[a.id]);
 assert.deepEqual(order.order('newest',[c,b,a],a.id).map(r=>r.id),[a.id,c.id,b.id]);
 assert.deepEqual(order.order('newest',[d,c,b,a],c.id).map(r=>r.id),[a.id,c.id,d.id,b.id]);
 assert.deepEqual(order.order('newest',[d,c,b,a],a.id).map(r=>r.id),[a.id,c.id,d.id,b.id]);
 assert.deepEqual(order.order('title',[b,d,a,c],a.id).map(r=>r.id),[b.id,d.id,a.id,c.id]);
});

test('feed ordering forgets evicted history and retains only the current metadata window',()=>{
 const order=new GlimpseFeedOrder(); let values=Array.from({length:48},(_,i)=>reel(i+1));
 order.order('custom',values,values[47].id);
 for(let page=0;page<20;page++){values=[...values.slice(8),...Array.from({length:8},(_,i)=>reel(49+page*8+i))]; const next=order.order('custom',values,values[20].id);assert.equal(next.length,48);assert.equal(new Set(next.map(r=>r.id)).size,48);}
 assert.deepEqual(order.order('custom',[reel(500)],null).map(r=>r.media.tmdbId),[500]);
});

test('first viable clip publishes without waiting for the remaining title budget',async()=>{
 const calls=[];
 const engine=new GlimpseFeedEngine({page:async()=>({items:[media(1),media(2),media(3)],hasMore:false})},{candidates:async item=>{calls.push(item.id);return item.id===1?[]:[reel(item.id)];}});
 const first=await engine.extend(signal(),6,null,true);assert.deepEqual(calls,[1,2]);assert.deepEqual(first.reels.map(r=>r.media.tmdbId),[2]);
 const next=await engine.extend(signal(),6);assert.deepEqual(next.reels.map(r=>r.media.tmdbId),[2,3]);assert.equal(next.exhausted,true);
});

test('duplicate videos across titles, batches and cancelled transactions cannot repeat in the feed',async()=>{
 const shared='aaaaaaaaaaa';let page=0;
 const engine=new GlimpseFeedEngine({page:async()=>({items:[media(++page)],hasMore:page<3})},{candidates:async item=>[reel(item.id,shared),reel(item.id)]});
 const first=await engine.extend(signal(),4);assert.equal(first.reels[0].video.key,shared);
 const second=await engine.extend(signal(),4);assert.equal(second.reels[1].video.key,'00000000002');
 const third=await engine.extend(signal(),4);assert.equal(new Set(third.reels.map(r=>r.video.key)).size,3);
 let controller=new AbortController(),cancel=true;
 const retry=new GlimpseFeedEngine({page:async()=>({items:[media(9)],hasMore:false})},{candidates:async()=>{if(cancel)controller.abort();return [reel(9,shared)];}});
 await assert.rejects(retry.extend(controller.signal,4),/cancelled/);cancel=false;
 assert.equal((await retry.extend(signal(),4)).reels.length,1);
});

test('all-associated search retains unique scenes while suppressing a shared video under another title',async()=>{
 const engine=new GlimpseFeedEngine({page:async()=>({items:[media(1),media(2)],hasMore:false})},{candidates:async item=>[reel(item.id,'aaaaaaaaaaa'),reel(item.id)]},null,true);
 const result=await engine.extend(signal(),8);assert.equal(result.reels.length,3);assert.equal(new Set(result.reels.map(r=>r.video.key)).size,3);
});

test('performance profiles scale metadata lookahead and row windows without additional media owners',()=>{
 assert.deepEqual(['efficiency','balanced','quality'].map(profile=>{const b=policy.glimpseRenderBudget(profile);return [b.windowSize,b.titleBatch,b.metadataAhead,b.initialNumToRender,b.maxToRenderPerBatch];}),[[3,4,1,1,1],[4,5,2,1,1],[5,6,3,1,1]]);
});

test('curated scenes preserve canonical Detail identity and do not bypass source ordering or filters',()=>{
 assert.equal(curated.GLIMPSE_SCENE_COLLECTION.length,7);const keys=new Set();
 for(const entry of curated.GLIMPSE_SCENE_COLLECTION){
  const item={...media(entry.tmdbId),title:entry.title,original_language:entry.language,genre_ids:[...entry.genres],origin_country:[entry.country],release_date:entry.year+'-01-01'};
  const videos=curated.curatedGlimpseVideos(item);const reels=normalizeGlimpseVideos(item,[{site:'YouTube',key:'zzzzzzzzzzz',type:'Trailer',name:'Trailer',official:true},...videos]);
  assert.equal(reels[0].video.type,'Clip');
  for(const scene of reels.filter(r=>r.video.type==='Clip')){assert.equal(keys.has(scene.video.key),false);keys.add(scene.video.key);assert.deepEqual(model.glimpseDestination(scene),{pathname:'/media/[id]',params:{id:String(entry.tmdbId),type:'movie'}});}
  assert.equal(browse.filterGlimpseReels(reels,{...browse.defaultGlimpseFilters(),region:'bollywood'},'').length>0,entry.country==='IN');
  assert.equal(browse.filterGlimpseReels(reels,{...browse.defaultGlimpseFilters(),region:'asian'},'').length>0,['KR','HK','JP'].includes(entry.country));
 }
 assert.ok(curated.GLIMPSE_SCENE_COLLECTION.some(e=>e.scenes.some(s=>s.channel==='JoBlo Movie Clips')));
 assert.equal(keys.size,10);assert.deepEqual(curated.curatedGlimpseVideos({id:20413,media_type:'tv'}),[]);
});

test('curated seeds interleave once, preserve overflow and replay after transaction rollback',async()=>{
 let calls=0;const raw={page:async()=>{calls++;return {items:Array.from({length:40},(_,i)=>media(i+1)),hasMore:false};}};
 const pager=curated.withGlimpseCuratedTitles(raw,browse.defaultGlimpseFilters(),'');
 const first=await pager.page(1,signal());assert.equal(first.items.length,40);assert.equal(first.items[4].id,20413);assert.equal(first.hasMore,true);
 assert.equal(await pager.page(1,signal()),first);assert.equal(calls,1);
 const last=await pager.page(2,signal());assert.equal(last.items.length,7);assert.equal(last.hasMore,false);assert.equal(calls,1);
 assert.equal(new Set([...first.items,...last.items].map(item=>item.id)).size,47);
});

test('curated seeds obey title search, media type and regional subfilters',async()=>{
 const raw={page:async()=>({items:[],hasMore:false})};
 const query=await curated.withGlimpseCuratedTitles(raw,browse.defaultGlimpseFilters(),'jurassic par').page(1,signal());assert.deepEqual(query.items.map(item=>item.id),[329]);
 const tv=await curated.withGlimpseCuratedTitles(raw,{...browse.defaultGlimpseFilters(),type:'tv'},'').page(1,signal());assert.deepEqual(tv.items,[]);
 const indian=await curated.withGlimpseCuratedTitles(raw,{...browse.defaultGlimpseFilters(),region:'bollywood',subfilter:'hi'},'').page(1,signal());assert.deepEqual(indian.items.map(item=>item.id),[20413]);
});
