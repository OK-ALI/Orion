const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{transformSync}=require('esbuild');
const baseline=require('./fixtures/wavenAtmospherePaint.json'),filename=path.resolve(__dirname,'../src/components/surfaces/WavenAtmosphericCanvas.tsx');
const serialize=n=>!n||typeof n!=='object'?n:Array.isArray(n)?n.map(serialize):{type:n.type,props:Object.fromEntries(Object.entries(n.props).filter(([k])=>k!=='children')),...(n.props.children===undefined?{}:{children:serialize(n.props.children)})};
function render(platform,variant,cacheStatic=true){const prior=Module._load,r=new Module(filename);r.paths=Module._nodeModulePaths(path.dirname(filename));Module._load=function(name,...args){if(name==='react-native')return{View:'View',Platform:{OS:platform},StyleSheet:{create:x=>x,absoluteFill:{position:'absolute',top:0,bottom:0,left:0,right:0}}};if(name==='expo-linear-gradient')return{LinearGradient:'LinearGradient'};return prior.call(this,name,...args)};try{r._compile(transformSync(fs.readFileSync(filename,'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,filename);return serialize(r.exports.WavenAtmosphericCanvas({variant,cacheStatic}))}finally{Module._load=prior}}
// Symbolic native View/gradient doubles validate paint identity and platform
// boundaries. Actual Android pixels, memory and frame time require device tests.
for(const platform of ['android','web','ios'])for(const variant of ['default','entry','quiet'])test(`R8E ${platform}/${variant} retains the accepted atmosphere paint tree and opacity boundary`,()=>{
 const tree=render(platform,variant),cached=platform==='android'&&variant==='default';
 if(cached){assert.equal(tree.type,'View');assert.equal(tree.props.renderToHardwareTextureAndroid,true);assert.equal(tree.props.collapsable,false);assert.equal(tree.props.pointerEvents,'none');assert.equal(tree.props.accessible,false);assert.deepEqual(tree.props.style,baseline[variant].props.style[0]);assert.equal(tree.props.opacity,undefined);assert.deepEqual(tree.children,baseline[variant]);}
 else assert.deepEqual(tree,baseline[variant]);
});
test('R8F route canvases stay uncached without the persistent-root opt-in',()=>{
 for(const platform of ['android','web','ios'])for(const variant of ['default','entry','quiet'])assert.deepEqual(render(platform,variant,false),baseline[variant]);
});
test('R8F only the persistent root opts into the existing native cache facility',()=>{
 const root=fs.readFileSync(path.resolve(__dirname,'../app/_layout.tsx'),'utf8'),shell=fs.readFileSync(path.resolve(__dirname,'../src/components/shell/WavenAppShell.tsx'),'utf8');
 assert.match(root,/showAtmosphericCanvas \? <WavenAtmosphericCanvas cacheStatic \/> : null/);assert.match(shell,/<WavenAtmosphericCanvas \/>/);assert.doesNotMatch(shell,/<WavenAtmosphericCanvas[^>]*cacheStatic/);
});
