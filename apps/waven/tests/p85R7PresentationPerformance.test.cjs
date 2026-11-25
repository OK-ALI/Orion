const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const React = require('react');
const { JSDOM } = require('jsdom');
const { transformSync } = require('esbuild');
const app = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const filename = path.join(app, file), previous = Module._load;
  Module._load = function(name, parent, main) {
    const key = Object.keys(mocks).find(k => name === k || name.endsWith(k));
    return key ? mocks[key] : previous.call(this, name, parent, main);
  };
  try { const m = new Module(filename); m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename)); m._compile(transformSync(fs.readFileSync(filename,'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,filename);return m.exports; }
  finally { Module._load = previous; }
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture({ reduced = false, width = 300, fontScale = 1 } = {}) {
  const bindings = [], timings = [], loops = [], nodes = [], routes = [], commands = [];
  let listener, pathname = '/', snapshot;
  class Value {
    constructor(n) { this.n = n; nodes.push(this); }
    setValue(n) { this.n = n; }
    stopAnimation(cb) { cb?.(this.n); }
    interpolate({inputRange,outputRange}) { const expression=new Expression(() => { const n=this.read(),a=inputRange;let i=0;while(i<a.length-2&&n>a[i+1])i++;const t=(n-a[i])/(a[i+1]-a[i]);return outputRange[i]+t*(outputRange[i+1]-outputRange[i]); });expression.parentValue=this;return expression; }
    read() { return this.n; }
  }
  class Expression extends Value { constructor(fn){ super(0);this.fn=fn; }read(){return this.fn();} }
  const read = v => v instanceof Value ? v.read() : v;
  const flatten = s => Array.isArray(s) ? Object.assign({},...s.filter(Boolean).map(flatten)) : s||{};
  const node = animated => function Node(props) {
    const style=flatten(props.style); if(animated)bindings.push({style,props});
    React.useEffect(()=>{props.onLayout?.({nativeEvent:{layout:{width: props.accessibilityRole==='text'?50:width,height:48}}});},[props.onLayout]);
    return React.createElement('div',{'data-animated':animated||undefined,'aria-label':props.accessibilityLabel,role:props.accessibilityRole},props.children);
  };
  const rn = { View:node(false),Image:node(false),StyleSheet:{create:x=>x,hairlineWidth:1},useWindowDimensions:()=>({width:390,height:844,fontScale}),PanResponder:{create:()=>({panHandlers:{}})},Easing:{linear:x=>x,out:x=>x,inOut:x=>x,cubic:x=>x,quad:x=>x},Animated:{Value,View:node(true),subtract:(a,b)=>new Expression(()=>read(a)-read(b)),timing:(value,config)=>({start(){timings.push({value,config});},stop(){}}),spring:(value,config)=>({start(){timings.push({value,config});},stop(){}}),sequence:items=>({items,start(){},stop(){}}),loop:animation=>({start(){loops.push(animation);},stop(){}})} };
  const native = { getSnapshot:async()=>snapshot,pause:async()=>{commands.push('pause');return snapshot;} };
  const mocks={'react-native':rn,'expo-router':{usePathname:()=>pathname,useRouter:()=>({navigate:p=>routes.push(p)})},'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:0})},'/WavenText':{WavenText:node(false)},'/WavenPressable':{WavenPressable:({children,onPress,...p})=>React.createElement('button',{'aria-label':p.accessibilityLabel,onClick:onPress},children)},'/useWavenReducedMotion':{useWavenReducedMotion:()=>reduced},'/connectivityHooks':{useWavenConnectivity:()=>({internetReady:true})},'/useWavenArtworkLease':{useWavenArtworkLease:()=>({showFallback:false,imageKey:'a'})},'/WavenArtworkFallback':{WavenArtworkFallback:node(false)},'/trackPlaybackRuntime':{resumeWavenNativeTrack:async()=>{commands.push('resume');return snapshot;}},'/WavenPlaybackNative':{nativePlayback:native,subscribeNativePlayback:fn=>{listener=fn;return{remove(){listener=null;}}}},'/theme/tokens':load('src/theme/tokens.ts')};
  const mini=load('src/components/player/WavenMiniPlayer.tsx',mocks).WavenMiniPlayer;
  const nav=load('src/components/shell/WavenBottomNav.tsx',mocks).WavenBottomNav;
  snapshot={state:'paused',playing:false,buffering:false,playWhenReady:false,currentQueueId:'q1',queueIds:['q1'],positionMs:25000,durationMs:100000,currentItem:{queueId:'q1',title:'Song A',artistName:'Artist',artworkUrl:null},error:null};
  return {mini,nav,bindings,timings,loops,nodes,routes,commands,read,emit:patch=>{snapshot={...snapshot,...patch};listener?.(snapshot);},route:p=>{pathname=p;},get snapshot(){return snapshot;}};
}
async function mount(t, Component) {
  const dom=new JSDOM('<div id="root"></div>'),old={window:global.window,document:global.document,act:global.IS_REACT_ACT_ENVIRONMENT};global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
  const root=require('react-dom/client').createRoot(document.getElementById('root'));let commits=0;
  const render=()=>React.act(async()=>{root.render(React.createElement(React.Profiler,{id:'actual-component',onRender:()=>commits++},React.createElement(Component)));await tick();});await render();
  t.after(async()=>{await React.act(async()=>root.unmount());dom.window.close();global.window=old.window;global.document=old.document;global.IS_REACT_ACT_ENVIRONMENT=old.act;});
  return{render,get commits(){return commits;},container:dom.window.document.getElementById('root')};
}
const layoutKeys=['width','height','left','right','top','bottom','marginLeft','marginRight','paddingLeft','paddingRight'];
test('R7 actual Mini Player maps native position to a fixed-layout animated mask',async t=>{
  const f=fixture(),ui=await mount(t,f.mini);assert.match(ui.container.textContent,/Song A/);
  assert.equal(f.bindings.filter(b=>layoutKeys.some(k=>b.style[k] instanceof Object&&typeof b.style[k].read==='function')).length,0,'per-frame progress must not bind a layout property');
});
test('R7 actual progress interpolation uses the native driver, keeps ticks authoritative and does not render per frame',async t=>{
  const f=fixture(),ui=await mount(t,f.mini);await React.act(async()=>{f.emit({state:'ready',playing:true,playWhenReady:true});await tick();});
  const interpolation=f.timings.find(a=>a.config.duration===1000);assert.ok(interpolation);assert.equal(interpolation.config.useNativeDriver,true);
  const before=ui.commits;for(let i=0;i<240;i++)interpolation.value.setValue(i/240);assert.equal(ui.commits,before);
  await React.act(async()=>{f.emit({positionMs:50000});await tick();});assert.ok(ui.container.querySelector('[aria-label="Playback progress 50 percent"]'));assert.ok(ui.commits>before);
});
test('R7 pause and Reduced Motion do not start progress interpolation; source ownership stays native',async t=>{
  const f=fixture({reduced:true}),ui=await mount(t,f.mini);await React.act(async()=>{f.emit({playing:true,playWhenReady:true});await tick();});assert.equal(f.timings.filter(a=>a.config.duration===1000).length,0);assert.equal(f.loops.length,0);
  await React.act(async()=>{f.emit({playing:false,positionMs:75000});await tick();});assert.ok(ui.container.querySelector('[aria-label="Playback progress 75 percent"]'));
});
test('R7 actual navigation never animates text measurement or layout properties',async t=>{
  const f=fixture(),ui=await mount(t,f.nav);f.bindings.length=0;f.route('/search');await ui.render();
  assert.equal(f.bindings.filter(b=>layoutKeys.some(k=>b.style[k] instanceof Object&&typeof b.style[k].read==='function')).length,0,'navigation label reveal must not drive Yoga/text measurement every frame');
  assert.equal(f.timings.filter(a=>a.config.useNativeDriver===false).length,0);
  const buttons=[...ui.container.querySelectorAll('button')];assert.deepEqual(buttons.map(b=>b.getAttribute('aria-label')),['Home','Search','Library']);
  await React.act(async()=>buttons[0].click());assert.deepEqual(f.routes,['/']);
});
for(const width of [300,630])test(`R7 progress reveal stays anchored at every ratio with ${width}px viewport`,async t=>{
  const f=fixture({width});await mount(t,f.mini);await React.act(async()=>{f.emit({playing:true,playWhenReady:true});await tick();});
  const value=f.timings.find(a=>a.config.duration===1000).value;
  const mask=f.bindings.findLast(b=>b.style.overflow==='hidden'&&b.style.width===width&&b.style.transform);
  const bars=f.bindings.findLast(b=>b.style.height===11&&b.style.width===width&&b.style.transform);
  assert.ok(mask);assert.ok(bars);
  for(const ratio of [0,.125,.5,.999,1]){
    value.setValue(ratio);const x=f.read(mask.style.transform[0].translateX),counter=f.read(bars.style.transform[0].translateX);
    assert.ok(Math.abs(x+counter)<1e-8,'played bars must never drift horizontally');
    assert.ok(Math.abs(Math.max(0,x+width)-ratio*width)<1e-8,'visible played extent tracks full-range native progress');
    assert.equal(mask.style.width,width,'no per-frame layout width change');
  }
});
test('R7 native label reveal preserves inactive/active icon geometry and button targets',async t=>{
  const f=fixture(),ui=await mount(t,f.nav),icons=f.bindings.filter(b=>b.style.width===24&&b.style.height===22&&b.style.transform).slice(-3),labels=f.bindings.filter(b=>b.style.left==='50%').slice(-3);
  assert.equal(icons.length,3);assert.equal(labels.length,3);
  for(let i=0;i<3;i++){
    const root=icons[i].style.transform[0].translateX.parentValue;assert.ok(root);
    for(const p of [0,.25,.5,1]){
      root.setValue(p);const labelWidth=[46,52,55][i],iconX=f.read(icons[i].style.transform[0].translateX);
      assert.ok(Math.abs(iconX+(labelWidth+8)*p/2)<1e-8);
      const maskX=f.read(labels[i].style.transform[0].translateX);assert.ok(Math.abs(maskX+labelWidth-(12+(4+labelWidth/2)*p))<1e-8);
    }
  }
  assert.equal(ui.container.querySelectorAll('button').length,3);
});
