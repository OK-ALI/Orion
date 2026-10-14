'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loader,read}=require('./helpers/animeModules.cjs');
const {hookHarness}=require('./helpers/playerHookHarness.cjs');
const prefix='apps/mobile/src/features/glimpse/';
const {GlimpseAmbientSampler}=loader()(prefix+'GlimpseAmbientSampler.ts');
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
function timers(t){const oldSet=global.setTimeout,oldClear=global.clearTimeout;let id=0;const jobs=new Map();global.setTimeout=(fn,ms)=>{jobs.set(++id,{fn,ms});return id;};global.clearTimeout=id=>jobs.delete(id);t.after(()=>{global.setTimeout=oldSet;global.clearTimeout=oldClear;});return{jobs,run(){const [id,job]=jobs.entries().next().value;jobs.delete(id);job.fn();return job.ms;}};}
function bridge(){const calls=[],stops=[];return{calls,stops,native:{sample:(id,session)=>new Promise(resolve=>calls.push({id,session,resolve})),stop:async session=>stops.push(session)}};}
const palette=session=>({session,colors:['#a03070','#206090'],durationMs:12});
test('sampling stays serial and profile paced; stop discards pending colors and prevents rescheduling',async t=>{
 const clock=timers(t),b=bridge(),published=[];const sampler=new GlimpseAmbientSampler(b.native,(...v)=>published.push(v));
 sampler.start('orion-glimpse:a','a','balanced',false);assert.equal(b.calls.length,1);assert.equal(clock.jobs.size,0);
 b.calls[0].resolve(palette('a'));await flush();assert.equal(published.length,1);assert.equal(clock.run(),1400);assert.equal(b.calls.length,2);assert.equal(clock.jobs.size,0);
 sampler.stop();b.calls[1].resolve(palette('a'));await flush();assert.equal(published.length,1);assert.equal(clock.jobs.size,0);assert.deepEqual(b.stops,['a']);
 sampler.start('orion-glimpse:b','b','quality',false);b.calls[2].resolve(palette('b'));await flush();assert.equal(clock.run(),850);sampler.stop();b.calls[3].resolve(palette('b'));await flush();
});
test('foreign colors, malformed colors and capture failures stop after three attempts',async t=>{
 const clock=timers(t),b=bridge(),published=[];const sampler=new GlimpseAmbientSampler(b.native,v=>published.push(v));sampler.start('a','a','balanced',false);
 const invalid=[palette('old'),{session:'a',colors:['bad','#112233']},null];for(let i=0;i<3;i++){b.calls[i].resolve(invalid[i]);await flush();if(i<2)clock.run();}
 assert.equal(clock.jobs.size,0);assert.equal(published.length,0);assert.equal(b.calls.length,3);sampler.stop();
});
test('Efficiency captures nothing; Reduced Motion captures once and does not poll',async t=>{
 const clock=timers(t),b=bridge(),published=[];const sampler=new GlimpseAmbientSampler(b.native,v=>published.push(v));sampler.start('a','a','efficiency',false);assert.equal(b.calls.length,0);
 sampler.start('a','a','balanced',true);b.calls[0].resolve(palette('a'));await flush();assert.equal(published.length,1);assert.equal(clock.jobs.size,0);sampler.stop();
});
test('a replaced owner cannot publish late colors',async t=>{
 const clock=timers(t),b=bridge(),published=[];const sampler=new GlimpseAmbientSampler(b.native,v=>published.push(v));sampler.start('a','a','balanced',false);sampler.start('b','b','balanced',false);
 b.calls[0].resolve(palette('a'));await flush();assert.equal(published.length,0);assert.equal(clock.jobs.size,0);b.calls[1].resolve(palette('b'));await flush();assert.equal(published.length,1);sampler.stop();assert.equal(clock.jobs.size,0);
});
test('hook releases on playback stop, Efficiency and unmount; ordinary production never invokes capture',async t=>{
 timers(t);for(const preview of [false,true]){const h=hookHarness(),b=bridge();let props={nativeId:'orion-glimpse:a',session:'a',enabled:true,profile:'balanced',reducedMotion:false,onPalette(){}};
 const hook=loader({react:h.react,'react-native':{Platform:{OS:'android'}},'expo-modules-core':{requireOptionalNativeModule:()=>b.native},'./glimpseBuild':{GLIMPSE_INTERNAL_PREVIEW:preview,GLIMPSE_PRODUCTION_ENABLED:false}})(prefix+'useGlimpseAmbientSampler.ts').useGlimpseAmbientSampler;
 h.start(()=>hook(props.nativeId,props.session,props.enabled,props.profile,props.reducedMotion,props.onPalette));assert.equal(b.calls.length,preview?1:0);props={...props,enabled:false};h.update();assert.deepEqual(b.stops,preview?['a']:[]);
 props={...props,enabled:true};h.update();props={...props,profile:'efficiency'};h.update();assert.equal(b.calls.length,preview?2:0);
 props={...props,profile:'balanced',session:'b',nativeId:'orion-glimpse:b'};h.update();h.dispose();assert.equal(b.stops.at(-1),preview?'b':undefined);for(const call of b.calls)call.resolve(palette(call.session));await flush();}
});
test('native capture is confined to the Glimpse view and respects secure windows without saving frames',()=>{
 const s=read('apps/mobile/modules/orion-glimpse-ambient/android/src/main/java/expo/modules/orionglimpse/OrionGlimpseAmbientModule.kt');
 assert.match(s,/ReactFindViewUtil.findView\(activity.window.decorView, nativeId\)/);assert.match(s,/FLAG_SECURE/);assert.match(s,/Bitmap.createBitmap\(32, 18/);assert.match(s,/OnActivityEntersBackground/);assert.match(s,/generation != requestGeneration/);assert.doesNotMatch(s,/FileOutputStream|writeBytes|takePicture|MediaProjection|HttpURLConnection/);
});

test('artwork fallback animates only while playing; live colors replace the image and Reduced Motion is static',async()=>{
 const h=hookHarness(),animations=[];class Value{setValue(){}stopAnimation(){}interpolate(){return 1;}}
 const create=kind=>{const a={kind,started:0,stopped:0,start(){this.started++;},stop(){this.stopped++;}};animations.push(a);return a;};
 const Frame=loader({react:h.react,'react-native':{Animated:{Value,View:'AnimatedView',timing:(v,options)=>({...create('timing'),options}),sequence:()=>create('sequence'),loop:()=>create('loop')},View:'View',Image:'Image',StyleSheet:{create:v=>v}},'expo-linear-gradient':{LinearGradient:'Gradient'},'@orion/shared/api':{imgUrl:(path,size)=>path?path+':'+size:null}})(prefix+'GlimpseAmbientFrame.tsx').GlimpseAmbientFrame;
 const props={artworkPath:'/art.jpg',enabled:true,playing:true,reducedMotion:false,palette:null,profile:'balanced',children:'player'};h.start(Frame,props);
 const loop=animations.find(a=>a.kind==='loop');assert.equal(loop.started,1);h.update({...props,playing:false});assert.equal(loop.stopped,1);
 const stopped=animations.length;h.update({...props,reducedMotion:true});assert.equal(animations.length,stopped);
 h.update({...props,palette:['#30a070','#204080']});await h.settle();
 function all(n,type,out=[]){if(!n||typeof n!=='object')return out;if(n.type===type)out.push(n);[n.props?.children].flat(Infinity).forEach(c=>all(c,type,out));return out;}
 assert.equal(all(h.result,'Image').length,0);assert.ok(all(h.result,'Gradient').length>0);h.update({...props,enabled:false});await h.settle();assert.equal(all(h.result,'Gradient').length,0);h.dispose();
});
