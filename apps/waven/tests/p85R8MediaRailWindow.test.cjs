const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {transformSync}=require('@babel/core'),ts=require('typescript');
const app=path.resolve(__dirname,'..'),policyFile=path.join(app,'src/components/shell/wavenMediaRailWindow.ts');
const policy=new Module(policyFile);policy._compile(ts.transpileModule(fs.readFileSync(policyFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,policyFile);
const {wavenMediaRailWindow:windowFor}=policy.exports;
// Execute the installed RN window algorithm. Native metrics and feature flags
// are doubles; this characterizes the chosen policy, not physical mount/FPS.
const rnFile=require.resolve('@react-native/virtualized-lists/Lists/VirtualizeUtils');
const previous=Module._load,record=new Module(rnFile);record.filename=rnFile;record.paths=Module._nodeModulePaths(path.dirname(rnFile));
Module._load=function(name,...args){return name.endsWith('/ReactNativeFeatureFlags')?{fixVirtualizeListCollapseWindowSize:()=>false}:previous.call(this,name,...args)};
try{record._compile(transformSync(fs.readFileSync(rnFile,'utf8'),{filename:rnFile,presets:[require.resolve('@react-native/babel-preset')],babelrc:false,configFile:false}).code,rnFile)}finally{Module._load=previous}
const {computeWindowedRenderLimits:compute}=record.exports;
const fixture=(count,width,visible,gap)=>{const data=Array.from({length:count},(_,i)=>({id:'provider-'+i})),p=windowFor(width,visible,gap),props={data,getItemCount:d=>d.length},metrics={getCellMetricsApprox:i=>p.getItemLayout(data,i)};return{data,p,at:(offset,prev={first:0,last:p.initialNumToRender-1},velocity=0)=>compute(props,p.maxToRenderPerBatch,p.windowSize,prev,metrics,{offset,visibleLength:visible,velocity,dt:16,zoomScale:1})}};

test('R8D initial media rail budgets cover compact, phone and tablet viewports without eagerly mounting all cards',()=>{
 for(const [visible,width,gap] of [[280,136,10],[380,148,10],[650,168,10],[380,104,14]]){
  const f=fixture(16,width,visible,gap),r=f.at(0);assert.equal(r.first,0);assert.ok((r.last+1)*(width+gap)>=visible);assert.ok(r.last<15);assert.ok(f.p.initialNumToRender<16);assert.equal(f.p.removeClippedSubviews,false);
 }
});
test('R8D installed RN windowing keeps every canonical item reachable in both scroll directions',()=>{
 const f=fixture(32,148,380,10),original=JSON.stringify(f.data),seen=new Set();let prev={first:0,last:3};
 for(const offset of [...Array.from({length:32},(_,i)=>i*158),...Array.from({length:32},(_,i)=>(31-i)*158)]){
  const r=f.at(offset,prev,offset?4:-4);assert.ok(r.first>=0&&r.last<32&&r.first<=r.last);const visibleIndex=Math.min(31,Math.floor(offset/158));assert.ok(r.first<=visibleIndex&&r.last>=visibleIndex);for(let i=r.first;i<=r.last;i++)seen.add(f.data[i].id);prev=r;
 }
 assert.equal(seen.size,32);assert.equal(JSON.stringify(f.data),original);
});
test('R8D rail metrics preserve exact Home/Search card widths and separators across deep restored offsets',()=>{
 for(const [width,gap] of [[136,10],[148,10],[168,10],[104,14],[136,14]]){
  const f=fixture(16,width,380,gap);for(const i of [0,1,7,15]){const m=f.p.getItemLayout(f.data,i);assert.equal(m.length,width);assert.equal(m.offset,i*(width+gap));const r=f.at(m.offset,{first:i,last:i});assert.ok(r.first<=i&&r.last>=i)}
 }
});
test('R8D recovered larger or shorter rails retain valid visible windows without truncating provider data',()=>{
 for(const size of [0,1,3,12,16,50]){const f=fixture(size,148,380,10),r=f.at(0);assert.equal(f.data.length,size);if(size)assert.ok(r.first===0&&r.last>=0&&r.last<size);else assert.deepEqual(r,{first:0,last:-1})}
});
test('R8 Home windows full data while Search preserves its accepted synchronous rail and origin restoration',()=>{
 const home=fs.readFileSync(path.join(app,'app/index.tsx'),'utf8'),search=fs.readFileSync(path.join(app,'app/search.tsx'),'utf8');
 assert.match(home,/<FlatList[\s\S]*?data=\{group\.items\}/);assert.match(home,/keyExtractor=.*item\.source\.provider.*item\.source\.id/);
 for(const s of [home,search]){assert.match(s,/WavenEntityRevealAnchor/);assert.match(s,/role="origin"/);assert.match(s,/useWavenArtworkLease/)}
 assert.match(home,/snapToInterval=\{discoveryCardWidth \+ 10\}/);assert.match(home,/discoveryRailSeparator: \{ width: 10 \}/);
 assert.match(search,/<ScrollView[\s\S]*?ref=\{railRef\}[\s\S]*?items\.map/);assert.match(search,/railRef\.current\?\.scrollTo\(\{ x: initialScrollX, animated: false \}\)/);assert.match(search,/discoveryRail: \{\s*gap: 14/);assert.doesNotMatch(search,/<FlatList/);
 assert.match(home,/router\.push\(detailRoute\)/);assert.match(search,/onOpenDetail\(item, scope\)/);
});
