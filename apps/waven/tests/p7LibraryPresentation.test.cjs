const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
require.extensions['.ts'] = require.extensions['.tsx'] = (record, filename) => record._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {
  fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
}).outputText, filename);
const { LocalLibraryRepository: Repo } = require('../src/features/library/localLibrary.ts');
const original = Module._load;
const node = tag => ({children,...props}) => React.createElement(tag,{},children);
let owner;
Module._load = function(request,parent,...args) {
  if (request === 'react-native') return {StyleSheet:{create:x=>x,hairlineWidth:1},View:node('div')};
  if (request === 'expo-router') return {useRouter:()=>({navigate:()=>{},push:()=>{}})};
  if (request.endsWith('/libraryRuntime')) return {getLocalLibrary:()=>owner,useLocalLibrary:()=>owner.getSnapshot()};
  if (request.endsWith('/WavenLibraryControls')) return {
    LibraryButton:({label})=>React.createElement('button',{},label),LibraryDialog:()=>null,LibraryNameInput:()=>null,
    LibraryNotice:({message})=>React.createElement('p',{},message),WavenLibraryRow:({entity})=>React.createElement('article',{},entity.title??entity.name),
    WavenLibraryHeroArtwork:({track})=>React.createElement('img',{alt:track.title}),
  };
  if (request.endsWith('/WavenText')) return {WavenText:node('span')};
  if (request.endsWith('/WavenAppShell')) return {WavenAppShell:node('main')};
  if (request.endsWith('/WavenPressable')) return {WavenPressable:node('button')};
  if (request.endsWith('/WavenArtworkFallback')) return {WavenArtworkFallback:()=>null};
  if (request.endsWith('/WavenAccentTitle')) return {WavenAccentTitle:({before,accent})=>React.createElement('h1',{},before+accent)};
  if (request.endsWith('/useWavenLayout')) return {useWavenLayout:()=>({isCompact:true})};
  if (request.endsWith('/detailNavigation')) return {albumDetailRoute:()=>null,artistDetailRoute:()=>null};
  return original.call(this,request,parent,...args);
};
let Screen;
try { Screen = require('../app/library.tsx').default; } finally { Module._load = original; }
function setup(){const map=new Map();owner=new Repo({get:k=>map.get(k)??null,set:(k,v)=>map.set(k,v),remove:k=>map.delete(k)});}
test('actual Library render has a real empty state and no demo collection',()=>{
  setup();const html=renderToStaticMarkup(React.createElement(Screen));assert.match(html,/Your Library Is Quiet/);assert.match(html,/Find Music/);assert.match(html,/Create playlist/);assert.doesNotMatch(html,/<article>/);
});
test('actual populated Library render exposes repository favorites and playlists and retires empty copy',()=>{
  setup();owner.setFavorite('track',{id:'stable',title:'Real saved metadata',artistName:'Artist',source:{provider:'catalog',id:'stable'}},true);owner.createPlaylist('User named playlist');
  const html=renderToStaticMarkup(React.createElement(Screen));assert.match(html,/Real saved metadata/);assert.match(html,/User named playlist/);assert.doesNotMatch(html,/Your Library Is Quiet|Find Music/);
  assert.match(html,/Liked Songs/);assert.match(html,/Your Music/);assert.doesNotMatch(html,/Downloads/);
});
test('Home Recently Played consumes the same durable history and retains its accepted section order',()=>{
  const home=fs.readFileSync(path.join(__dirname,'../app/index.tsx'),'utf8');assert.match(home,/const library = useLocalLibrary\(\)/);assert.match(home,/library\.state\.history\.length/);assert.match(home,/library\.state\.history\.slice\(0, 5\)/);
  assert.ok(home.indexOf('Recently Played')<home.indexOf('discoveryStatus ==='));assert.match(home,/Your first plays will collect here/);
});
test('migration fixture harness cannot write product Library or identity storage',()=>{
  const fixture=fs.readFileSync(path.join(__dirname,'../app/library-debug.tsx'),'utf8');assert.match(fixture,/if \(!__DEV__\)/);assert.match(fixture,/id: 'waven.library.validation'/);assert.doesNotMatch(fixture,/SecureStore|completeWavenEntry|bindLibrarySession|id: 'waven.library'/);
});
test('new Library artwork mounts an unrendered source so the accepted lease can receive onLoad',()=>{
  setup(); const previous=Module._load;
  Module._load=function(request,parent,...args){
    if(request==='react-native')return {Image:({source})=>React.createElement('img',{src:source.uri}),View:node('div'),StyleSheet:{create:x=>x},Modal:()=>null,KeyboardAvoidingView:node('div'),ScrollView:node('div'),TextInput:node('input')};
    if(request==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({top:0,bottom:0})};
    if(request.endsWith('/useWavenArtworkLease'))return {useWavenArtworkLease:()=>({showFallback:true,hasRendered:false,backupSourceKey:null,imageKey:'not-yet-rendered',onLoad:()=>{},onError:()=>{}})};
    if(request.endsWith('/trackPlaybackRuntime'))return {trackPlayback:{},useTrackPlaybackStatus:()=>({state:'idle'}),useWavenTrackPresentation:()=> 'available'};
    if(request.endsWith('/connectivityHooks'))return {useWavenConnectivity:()=>({remoteReady:true})};
    if(request.endsWith('/libraryRuntime'))return {getLocalLibrary:()=>owner,useLocalLibrary:()=>owner.getSnapshot()};
    if(request.endsWith('/WavenText'))return {WavenText:node('span')};
    if(request.endsWith('/WavenPressable'))return {WavenPressable:node('button')};
    if(request.endsWith('/WavenArtworkFallback'))return {WavenArtworkFallback:()=>React.createElement('span',{},'fallback')};
    return previous.call(this,request,parent,...args);
  };
  try {
    const controls=require('../src/components/library/WavenLibraryControls.tsx');
    const track={id:'catalog:one',source:{provider:'catalog',id:'one'},title:'Song',artistName:'Artist',artworkUrl:'https://img.example/one.jpg'};
    for(const element of [React.createElement(controls.WavenLibraryHeroArtwork,{track,size:172}),React.createElement(controls.WavenLibraryRow,{kind:'track',entity:track,trailing:React.createElement('span')})]){
      const html=renderToStaticMarkup(element);assert.match(html,/fallback/);assert.match(html,/<img[^>]+src="https:\/\/img.example\/one.jpg"/);
    }
  }finally{Module._load=previous;}
});
