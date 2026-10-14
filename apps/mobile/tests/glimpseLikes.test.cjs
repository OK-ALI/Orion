'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loader, read } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const prefix='apps/mobile/src/features/glimpse/';
const load=loader();
const model=load(prefix+'glimpseModel.ts');
const schema=load(prefix+'glimpseLikesSchema.ts');
const {GlimpseLikesStore,GLIMPSE_LIKES_KEY}=load(prefix+'GlimpseLikesStore.ts');
function reel(id=1,media={}) {
 const identity={tmdbId:id,mediaType:'movie',isAnime:false,season:null,episode:null,...media}; const key=String(id).padStart(11,'0');
 return {schemaVersion:1,id:model.glimpseReelId(identity,key),media:identity,title:'Title '+id,clipTitle:'Scene',
  video:{provider:'youtube',key,type:'Clip',language:null,durationSeconds:null,dimensions:null},artworkPath:null,posterPath:null,year:'2026'};
}
function backend() { const values=new Map(); return {values,getString:key=>values.get(key),set:(key,value)=>values.set(key,value)}; }
function doc(record,revision=record.revision) {return {schemaVersion:1,localRevision:revision,records:{[record.id]:record}};}
function record(value=reel(),extra={}) {return {schemaVersion:1,id:value.id,updatedAt:100,revision:1,tombstone:false,reel:value,...extra};}

test('Like publishes immediately after a complete metadata write; repeated Like cannot duplicate or churn revisions',()=>{
 const storage=backend(); const store=new GlimpseLikesStore(storage,()=>100); let notices=0;
 const unsubscribe=store.subscribe(()=>{notices++; assert.equal(JSON.parse(storage.values.get(GLIMPSE_LIKES_KEY)).localRevision,store.getSnapshot().document.localRevision);});
 store.setLiked(reel(),true); assert.equal(store.getSnapshot().reels.length,1); assert.equal(notices,1);
 store.setLiked(reel(),true); assert.equal(store.getSnapshot().document.localRevision,1); assert.equal(notices,1);
 assert.equal(Object.keys(store.getSnapshot().document.records).length,1);
 unsubscribe(); store.setLiked(reel(),false); assert.equal(notices,1);
});
test('Unlike persists a metadata-free tombstone across a fresh store and a subsequent Like advances the revision',()=>{
 const storage=backend(); let store=new GlimpseLikesStore(storage,()=>10);
 store.setLiked(reel(),true); store.setLiked(reel(),false);
 store=new GlimpseLikesStore(storage,()=>1); assert.equal(store.getSnapshot().reels.length,0);
 assert.deepEqual(store.getSnapshot().document.records[reel().id],{schemaVersion:1,id:reel().id,updatedAt:11,revision:2,tombstone:true,reel:null});
 store.setLiked(reel(),true); assert.equal(store.getSnapshot().document.localRevision,3); assert.equal(store.getSnapshot().document.records[reel().id].updatedAt,12);
 assert.equal(new GlimpseLikesStore(storage).getSnapshot().reels[0].id,reel().id);
});
test('local transactions work without a network and order timestamps/revisions across clock rollback and restart',()=>{
 const storage=backend(); let time=100; const store=new GlimpseLikesStore(storage,()=>time);
 store.setLiked(reel(1),true); time=20; store.setLiked(reel(2),true); time=NaN; store.setLiked(reel(1),false);
 assert.equal(store.getSnapshot().document.localRevision,3);
 assert.equal(store.getSnapshot().document.records[reel(1).id].updatedAt,102);
 assert.equal(store.getSnapshot().document.records[reel(2).id].updatedAt,101);
 assert.deepEqual(new GlimpseLikesStore(storage).getSnapshot().reels.map(r=>r.id),[reel(2).id]);
});
test('multiple local store instances include already persisted transactions before issuing their next revision',()=>{
 const storage=backend(); const a=new GlimpseLikesStore(storage,()=>10), b=new GlimpseLikesStore(storage,()=>10);
 a.setLiked(reel(1),true); b.setLiked(reel(2),true); a.setLiked(reel(1),false);
 const restored=new GlimpseLikesStore(storage).getSnapshot();
 assert.equal(restored.document.localRevision,3); assert.equal(restored.document.records[reel(2).id].revision,2);
 assert.deepEqual(restored.reels.map(r=>r.id),[reel(2).id]);
});
test('canonical movie, TV, Anime and complete episode identities stay distinct and mismatches are rejected',()=>{
 const store=new GlimpseLikesStore(backend());
 const values=[reel(1),reel(1,{mediaType:'tv',isAnime:true}),reel(1,{mediaType:'tv',isAnime:true,season:2,episode:7})];
 values.forEach(r=>store.setLiked(r,true)); assert.equal(store.getSnapshot().reels.length,3);
 assert.throws(()=>store.setLiked({...values[0],id:values[1].id},true));
 assert.throws(()=>store.setLiked({...values[0],media:{...values[0].media,episode:1}},true));
 assert.equal(store.getSnapshot().document.localRevision,3);
});
test('merge is commutative, associative, idempotent and independent of incoming object field order',()=>{
 const a=doc(record(reel(1),{updatedAt:100,revision:1}));
 const b=doc(record(reel(1),{updatedAt:101,revision:2,tombstone:true,reel:null}));
 const c=doc(record(reel(2),{updatedAt:102,revision:3}));
 const m=schema.mergeGlimpseLikes;
 assert.deepEqual(m(a,b),m(b,a)); assert.deepEqual(m(m(a,b),c),m(a,m(b,c))); assert.deepEqual(m(a,a),schema.normalizeGlimpseLikes(a));
 const reordered=JSON.parse(JSON.stringify(a)); reordered.records[reel(1).id].reel={...reel(1),video:{dimensions:null,durationSeconds:null,language:null,type:'Clip',key:reel(1).video.key,provider:'youtube'}};
 assert.deepEqual(m(a,reordered),m(reordered,a));
});
test('newer changes win deterministically; removals win exact ties and stale Likes cannot resurrect them',()=>{
 const a=doc(record()); const removed=doc(record(reel(),{tombstone:true,reel:null}));
 assert.equal(schema.likedGlimpseReels(schema.mergeGlimpseLikes(a,removed)).length,0);
 const newerRemoval=doc(record(reel(),{updatedAt:110,revision:2,tombstone:true,reel:null}));
 assert.equal(schema.likedGlimpseReels(schema.mergeGlimpseLikes(newerRemoval,a)).length,0);
 const newerLike=doc(record(reel(),{updatedAt:111,revision:3}));
 assert.equal(schema.likedGlimpseReels(schema.mergeGlimpseLikes(newerRemoval,newerLike)).length,1);
 const revised=doc(record(reel(),{revision:4})); assert.equal(schema.mergeGlimpseLikes(a,revised).records[reel().id].revision,4);
 const metadataTie=doc(record({...reel(),clipTitle:'Another scene'})); assert.deepEqual(schema.mergeGlimpseLikes(a,metadataTie),schema.mergeGlimpseLikes(metadataTie,a));
});
test('restored merge counters advance past every accepted revision and stable sorting prevents duplicate rows',()=>{
 const storage=backend(); const merged=schema.mergeGlimpseLikes(doc(record(reel(1),{revision:90})),doc(record(reel(2),{revision:80})));
 storage.set(GLIMPSE_LIKES_KEY,JSON.stringify(merged)); const store=new GlimpseLikesStore(storage,()=>1);
 assert.deepEqual(store.getSnapshot().reels.map(r=>r.id),[reel(1).id,reel(2).id]);
 store.setLiked(reel(3),true); assert.equal(store.getSnapshot().document.localRevision,91);
});
test('unknown versions and corrupt documents remain intact and cannot be overwritten by a Like',()=>{
 for(const raw of ['{broken',JSON.stringify({...schema.emptyGlimpseLikes(),schemaVersion:2}),JSON.stringify(doc({...record(),id:'forged'})),
  JSON.stringify(doc(record(reel(),{revision:5}),4)),JSON.stringify(doc(record(reel(),{tombstone:true})))]) {
  const storage=backend(); storage.set(GLIMPSE_LIKES_KEY,raw); const store=new GlimpseLikesStore(storage);
  assert.equal(store.getSnapshot().unavailable,true); assert.throws(()=>store.setLiked(reel(),true)); assert.equal(storage.values.get(GLIMPSE_LIKES_KEY),raw);
 }
});
test('write failure cannot publish a false Like or erase the previous persisted document',()=>{
 const storage=backend(); const store=new GlimpseLikesStore(storage); store.setLiked(reel(1),true);
 const before=store.getSnapshot(), bytes=storage.values.get(GLIMPSE_LIKES_KEY); storage.set=()=>{throw new Error('disk unavailable');};
 assert.throws(()=>store.setLiked(reel(2),true)); assert.equal(store.getSnapshot(),before); assert.equal(storage.values.get(GLIMPSE_LIKES_KEY),bytes);
});
test('snapshots are immutable and stable; revision exhaustion never wraps or loses saved metadata',()=>{
 const storage=backend(); storage.set(GLIMPSE_LIKES_KEY,JSON.stringify(doc(record(reel(),{revision:Number.MAX_SAFE_INTEGER}))));
 const store=new GlimpseLikesStore(storage); const snapshot=store.getSnapshot();
 assert.equal(snapshot,store.getSnapshot()); assert.ok(Object.isFrozen(snapshot.reels)); assert.ok(Object.isFrozen(snapshot.document.records[reel().id].reel.media));
 assert.throws(()=>store.setLiked(reel(2),true)); assert.equal(store.getSnapshot(),snapshot);
});
test('native storage opens only the versioned Glimpse MMKV namespace and reuses one private store',()=>{
 const ids=[]; const values=new Map([['existing-orion','untouched']]);
 const module=loader({'react-native':{Platform:{OS:'android'}},'react-native-mmkv':{createMMKV:options=>{ids.push(options.id); return {getString:key=>values.get(key),set:(key,value)=>values.set(key,value)};}}})(prefix+'glimpseLikesStorage.ts');
 assert.deepEqual(ids,[]); const store=module.getGlimpseLikesStore(); assert.equal(store,module.getGlimpseLikesStore());
 assert.deepEqual(ids,['orion.mobile.glimpse.metadata.v1']); store.setLiked(reel(),true); assert.equal(values.get('existing-orion'),'untouched');
 assert.doesNotMatch(read(prefix+'glimpseLikesStorage.ts'),/AccountContext|PortableProfile|mmkvStorageAdapter/);
});
test('native MMKV initialization failure is honest and never falls back to volatile memory',()=>{
 const module=loader({'react-native':{Platform:{OS:'android'}},'react-native-mmkv':{createMMKV:()=>{throw new Error('native unavailable');}}})(prefix+'glimpseLikesStorage.ts');
 assert.equal(module.getGlimpseLikesStore().getSnapshot().unavailable,true);
});
test('Like hook immediately follows its store, unsubscribes on exit and reports a failed write',async()=>{
 const storage=backend(); const store=new GlimpseLikesStore(storage); const h=hookHarness();
 const hook=loader({react:h.react,'./glimpseLikesStorage':{getGlimpseLikesStore:()=>store}})(prefix+'useGlimpseLikes.ts').useGlimpseLikes;
 h.start(hook); h.result.toggle(reel()); await h.settle(); assert.equal(h.result.reels.length,1);
 storage.set=()=>{throw new Error('write failure');}; h.result.toggle(reel()); await h.settle(); assert.equal(h.result.saveError,true); assert.equal(h.result.reels.length,1);
 h.dispose();
});
test('Liked uses local metadata offline, retains Discover identity, and removes the current Like without multiple owners',async()=>{
 const h=hookHarness(); const store=new GlimpseLikesStore(backend(),()=>100); let remoteReady=true,focused=true;
 const feed={reels:[reel(1),reel(2),reel(3)],status:'ready',exhausted:true,canAutoExtend:true,loadMore:async()=>{},activeId:{current:null}};
 const enabled=[]; const pushes=[]; const theme={};
 const Screen=loader({react:h.react,'react-native':{View:'View',Text:'Text',Pressable:'Pressable',FlatList:'FlatList',ActivityIndicator:'ActivityIndicator',StyleSheet:{create:v=>v}},
  'expo-router':{useLocalSearchParams:()=>({}),useIsFocused:()=>focused,useRouter:()=>({push:p=>pushes.push(p)})},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})},
  '../../context/ThemeContext':{useOrionTheme:()=>({theme,preferences:{reducedMotion:true},systemReducedMotion:false})},
  '../../context/NetworkContext':{useNetworkStatus:()=>({remoteReady})},'../../context/PerformanceContext':{usePerformanceProfile:()=>({resolvedProfile:'balanced'})},
  '../../services/responsive':{useResponsiveLayout:()=>({isTablet:false,isLandscape:false})},'./useGlimpseForeground':{useGlimpseForeground:()=>true},
  './useGlimpseFeed':{useGlimpseFeed:value=>{enabled.push(value);return feed;}},'./glimpseLikesStorage':{getGlimpseLikesStore:()=>store},'./glimpsePreferences': { useGlimpsePreferences: () => ({ preferences: { startMuted: true, autoAdvance: false, rememberPosition: false, position: null, sorts: { discover: 'manual', liked: 'manual' } }, unavailable: false, saveError: false, update() {} }) },
    './GlimpseControls': { GlimpseControls: 'Controls' }, '../library/LibrarySortDialog': { LibrarySortDialog: 'SortDialog' },    '@expo/vector-icons': { Ionicons: 'Icon' }, '../../components/MobilePageHeader': { MobilePageHeader: 'Header' }, './GlimpseStage':{GlimpseStage:'Stage'},
 })(prefix+'GlimpseScreen.tsx').default;
 const find=(node,predicate)=>{if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const match=find(child,predicate);if(match)return match;}return null;};
 const list=()=>find(h.result,n=>n.type==='FlatList');
 const stages=()=>list()?.props.data.map((item,index)=>find(list().props.renderItem({item,index}),n=>n.type==='Stage').props)||[];
 const active=()=>stages().filter(s=>s.active).map(s=>s.reel.id);
 const tab=value=>find(h.result,n=>n.props?.accessibilityLabel===value+' Glimpse').props.onPress();
 h.start(Screen); find(h.result,n=>n.props?.onLayout).props.onLayout({nativeEvent:{layout:{height:500}}}); await h.settle();
 stages()[0].onLike(); await h.settle(); list().props.onScrollBeginDrag(); list().props.onMomentumScrollEnd({nativeEvent:{contentOffset:{y:500}}}); await h.settle(); stages()[1].onLike(); await h.settle();
 tab('Liked'); await h.settle(); assert.deepEqual(stages().map(s=>s.reel.id),[reel(1).id,reel(2).id]); assert.deepEqual(active(),[reel(1).id]); assert.equal(enabled.at(-1),false);
 stages()[1].onLike(); await h.settle(); assert.deepEqual(active(),[reel(1).id]); assert.equal(stages().length,1);
 tab('Discover'); await h.settle(); assert.deepEqual(active(),[reel(2).id]); assert.equal(stages()[1].liked,false);
 remoteReady=false; h.update(); await h.settle(); assert.equal(active().length,0); stages()[1].onLike(); await h.settle(); assert.equal(stages()[1].liked,true);
 tab('Liked'); await h.settle(); assert.equal(stages().length,2); assert.equal(active().length,0); assert.equal(enabled.at(-1),false);
 remoteReady=true; h.update(); await h.settle(); assert.equal(active().length,1); stages().find(s=>s.active).onView(); await h.settle(); assert.equal(active().length,0); assert.equal(pushes[0].params.id,'1');
 focused=false; h.update(); focused=true; h.update(); await h.settle(); assert.equal(active().length,1); h.dispose();
});


test('new Likes append after existing Likes across rollback, restart and re-Like without duplicating records',()=>{
 const storage=backend(); const store=new GlimpseLikesStore(storage,()=>10);
 [reel(3),reel(1),reel(2)].forEach(r=>store.setLiked(r,true));
 assert.deepEqual(store.getSnapshot().reels.map(r=>r.id),[reel(3).id,reel(1).id,reel(2).id]);
 store.setLiked(reel(4),true);
 assert.deepEqual(new GlimpseLikesStore(storage).getSnapshot().reels.map(r=>r.id),[reel(3).id,reel(1).id,reel(2).id,reel(4).id]);
 store.setLiked(reel(1),false); store.setLiked(reel(1),true);
 assert.deepEqual(store.getSnapshot().reels.map(r=>r.id),[reel(3).id,reel(2).id,reel(4).id,reel(1).id]);
 assert.equal(Object.keys(store.getSnapshot().document.records).length,4);
});

test('visible Stage actions distinguish detail destinations from canonical episode playback',()=>{
 assert.equal(model.glimpseActionLabel(reel()),'Movie details');
 assert.equal(model.glimpseActionLabel(reel(2,{mediaType:'tv'})),'Series details');
 assert.equal(model.glimpseActionLabel(reel(3,{mediaType:'tv',isAnime:true})),'Anime details');
 assert.equal(model.glimpseActionLabel(reel(4,{mediaType:'tv',season:2,episode:3})),'Watch S2 · E3');
});
