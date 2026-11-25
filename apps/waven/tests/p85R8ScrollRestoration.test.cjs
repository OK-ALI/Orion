const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),React=require('react'),{JSDOM}=require('jsdom'),{transformSync}=require('esbuild');
async function mount(t,request={y:800,token:1}){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/'}),prior={window:global.window,document:global.document,act:global.IS_REACT_ACT_ENVIRONMENT,raf:global.requestAnimationFrame,caf:global.cancelAnimationFrame},frames=new Map(),model={height:900,content:1500,position:0,commands:[],props:null};let nextId=0;
 global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;global.requestAnimationFrame=fn=>{const id=++nextId;frames.set(id,fn);return id};global.cancelAnimationFrame=id=>frames.delete(id);
 const Scroll=React.forwardRef((props,ref)=>{model.props=props;React.useImperativeHandle(ref,()=>({scrollTo:command=>{model.commands.push(command);model.position=Math.min(command.y,Math.max(0,model.content-model.height));props.onScroll?.({nativeEvent:{contentOffset:{x:0,y:model.position}}})}}));return React.createElement('div',{},props.children)}),node=({children})=>React.createElement('div',{},children);
 const filename=path.resolve(__dirname,'../src/components/shell/WavenAppShell.tsx'),r=new Module(filename),load=Module._load;r.paths=Module._nodeModulePaths(path.dirname(filename));Module._load=function(name,...args){if(name==='react-native')return{Animated:{ScrollView:Scroll},View:node,StyleSheet:{create:x=>x,hairlineWidth:1}};if(name==='react-native-safe-area-context')return{SafeAreaView:node};if(name.endsWith('/WavenText'))return{WavenText:node};if(name.endsWith('/WavenConnectionStatus'))return{WavenConnectionStatus:()=>null};if(name.endsWith('/WavenWordmark'))return{WavenWordmark:()=>null};if(name.endsWith('/WavenAtmosphericCanvas'))return{WavenAtmosphericCanvas:()=>null};if(name.endsWith('/useWavenLayout'))return{useWavenLayout:()=>({gutter:20,contentMaxWidth:600})};if(name.endsWith('/theme/tokens'))return{wavenColors:{canvas:'black'},wavenFonts:{semiBold:'fixture'},wavenSpacing:{lg:20}};return load.call(this,name,...args)};
 try{r._compile(transformSync(fs.readFileSync(filename,'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,filename)}finally{Module._load=load}
 const {createRoot}=require('react-dom/client'),root=createRoot(dom.window.document.getElementById('root'));let unmounted=false;const render=async value=>React.act(async()=>root.render(React.createElement(r.exports.WavenAppShell,{scrollRestoreRequest:value,initialScrollY:value?.y??0,onScroll:e=>{model.lastObserved=e.nativeEvent.contentOffset.y}},'content'))),flush=()=>{const queued=[...frames.values()];frames.clear();for(const f of queued)f()};
 t.after(async()=>{if(!unmounted)await React.act(async()=>root.unmount());dom.window.close();global.window=prior.window;global.document=prior.document;global.IS_REACT_ACT_ENVIRONMENT=prior.act;global.requestAnimationFrame=prior.raf;global.cancelAnimationFrame=prior.caf});await render(request);
 return{model,frames,flush,render,layout:(height,content=model.content)=>{model.height=height;model.content=content;model.props.onLayout?.({nativeEvent:{layout:{height}}});model.props.onContentSizeChange?.(400,content)},unmount:async()=>{await React.act(async()=>root.unmount());unmounted=true}};
}
// Native scroll clamps and chrome/content layout are explicit doubles. Tests
// execute the actual AppShell hooks; physical pixel-origin checks remain separate.
test('R8F restoration retains the intended offset when primary chrome shrinks the viewport after an initial clamp',async t=>{
 const f=await mount(t);f.flush();assert.equal(f.model.position,600);assert.equal(f.model.lastObserved,600);f.layout(700);f.flush();assert.equal(f.model.position,800);assert.equal(f.model.lastObserved,800);assert.ok(f.model.commands.every(c=>c.animated===false&&c.x===0));
});
test('R8F content and safe-area layout bursts coalesce and restore the original request after growth',async t=>{
 const f=await mount(t,{y:1000,token:1});f.flush();assert.equal(f.model.position,600);f.layout(850,1700);f.layout(800,1800);f.layout(700,1900);assert.equal(f.frames.size,1);f.flush();assert.equal(f.model.position,1000);assert.equal(f.model.commands.length,2);
});
test('R8F touch or drag cancels a queued restore and later layout cannot snap the user back',async t=>{
 const f=await mount(t);f.model.props.onTouchStart();assert.equal(f.frames.size,0);f.model.position=123;f.layout(700,1900);f.flush();assert.equal(f.model.position,123);assert.equal(f.model.commands.length,0);
 await f.render({y:750,token:2});f.model.props.onScrollBeginDrag();f.layout(650,2000);f.flush();assert.equal(f.model.position,123);assert.equal(f.model.commands.length,0);
});
test('R8F a new explicit restoration token owns a new target after user interaction',async t=>{
 const f=await mount(t);f.flush();f.model.props.onTouchStart();await f.render({y:240,token:2});f.flush();assert.equal(f.model.position,240);f.layout(650,1900);f.flush();assert.equal(f.model.position,240);assert.equal(f.model.commands.at(-1).y,240);
});
test('R8F unmount cancels pending restoration without callbacks into a departed route',async t=>{
 const f=await mount(t);assert.equal(f.frames.size,1);await f.unmount();assert.equal(f.frames.size,0);f.flush();assert.equal(f.model.commands.length,0);
});
