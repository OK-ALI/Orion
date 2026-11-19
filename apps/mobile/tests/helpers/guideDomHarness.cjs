'use strict';
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{pretendToBeVisual:true,url:'http://localhost'});
for(const key of ['window','document','navigator','Node','Element','HTMLElement','ShadowRoot','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,key,{value:key==='getComputedStyle'?dom.window.getComputedStyle.bind(dom.window):key==='window'?dom.window:dom.window[key],configurable:true,writable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;
dom.window.matchMedia??=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
const React=require('react'),RN=require('react-native-web'),testing=require('@testing-library/react');
const mobileRoot=path.resolve(__dirname,'../..'),repoRoot=path.resolve(mobileRoot,'../..');

function createGuideHarness({screen=false,themeId='midnight-premiere',width=390,height=844,platform='web',reduced=false,systemReduced=false,content}={}){
 const cache=new Map(),events={network:[],writes:[],routes:[],search:[],nativeFocus:[],fades:[]};
 const env={theme:null,preferences:{reducedMotion:reduced},systemReducedMotion:systemReduced,width,height,insets:{top:24,bottom:20,left:0,right:0},platform,guideModal:null};
 const themeMock={useOrionTheme:()=>({theme:env.theme,preferences:env.preferences,systemReducedMotion:env.systemReducedMotion})};
 function Icon(){return null;}
 function Modal(props){if(props.animationType==='none'&&props.visible)env.guideModal=props;return React.createElement(RN.Modal,props);}
 const Animated={...RN.Animated,timing(value,config){
   events.fades.push({...config});
   return RN.Animated.timing(value,{...config,useNativeDriver:false});
 }};
 const native={...RN,Animated,Modal,Platform:{...RN.Platform,get OS(){return env.platform;}},useWindowDimensions:()=>({width:env.width,height:env.height,scale:1,fontScale:1}),findNodeHandle:()=>42,AccessibilityInfo:{...RN.AccessibilityInfo,setAccessibilityFocus:tag=>events.nativeFocus.push(tag)}};
 const remoteGate=()=>({network:{remoteReady:false,productState:'offline'},refreshKey:0,generationRef:React.useRef(0),remoteReadyRef:React.useRef(false)});
 const mocks={react:React,'react/jsx-runtime':require('react/jsx-runtime'),'react-native':native,
  'react-native-safe-area-context':{useSafeAreaInsets:()=>env.insets},'@expo/vector-icons':{Ionicons:Icon},
  'expo-linear-gradient':{LinearGradient:RN.View},'expo-router':{useLocalSearchParams:()=>({}),useRouter:()=>({push:r=>events.routes.push(r),setParams:r=>events.routes.push(r)})},
  '@orion/shared/api':{tmdbFetch:(...args)=>{events.network.push(args);throw Error('Network access is forbidden in Guide tests');}},
  '../../context/ThemeContext':themeMock,'../context/ThemeContext':themeMock,
  '../../context/PerformanceContext':{usePerformanceProfile:()=>({resolvedProfile:'balanced'})},
  './useDiscoverRemoteGate':{useDiscoverRemoteGate:remoteGate,getDiscoverUnavailableCopy:()=> 'Cinema browsing is unavailable offline.'},
  './useDiscoverSearchResults':{useDiscoverSearchResults:args=>{events.search.push({query:args.query,activeFilter:args.activeFilter});return {filteredSearchResults:[],loading:false,searchSucceeded:false};}},
  './useDiscoverRegionResults':{useDiscoverRegionResults:()=>({regionResults:[],regionLoading:false,regionSucceeded:false})},
  './useSearchArrivalAnimation':{useSearchArrivalAnimation:()=>({style:{},animate:()=>{}})},
  '../../services/listPerformance':{getGridRenderBudget:()=>({}),getRailRenderBudget:()=>({})},
  './CinemaPortals':{CinemaPortals:()=>null},'../../components/MediaCard':{MediaCard:()=>null},'../../components/PersonCard':{PersonCard:()=>null},
  '../services/storageAdapter':{mmkvStorageAdapter:{get:()=>null,set:(...args)=>events.writes.push(args)}},
  '../hooks/useSystemReducedMotion':{useSystemReducedMotion:()=>false},
 };
 function load(file){if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const localRequire=name=>{
   if(Object.hasOwn(mocks,name))return mocks[name];if(name==='@orion/shared/tokens')return load(path.join(repoRoot,'packages/shared/src/tokens/index.ts'));
   if(!name.startsWith('.'))throw Error('Unexpected Guide test dependency: '+name);
   const base=path.resolve(path.dirname(file),name);const resolved=['.ts','.tsx','.cjs','.js','/index.ts'].map(ext=>base+ext).find(p=>fs.existsSync(p));if(!resolved)throw Error('Missing module '+name);if(resolved.endsWith('.cjs'))return require(resolved);return load(resolved);
  };const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','module','exports',code)(localRequire,module,module.exports);return module.exports;}
 const themes=load(path.join(mobileRoot,'src/context/ThemeContext.tsx')).ORION_MOBILE_THEMES;env.theme=themes[themeId];
 const guide=load(path.join(mobileRoot,'src/components/guide/OrionGuide.tsx')),page=load(path.join(mobileRoot,'src/features/discover/DiscoverGuide.tsx'));
 const Component=screen?load(path.join(mobileRoot,'src/features/discover/DiscoverScreen.tsx')).default:content?()=>React.createElement(guide.OrionGuide,{content}):page.DiscoverGuide;
 const rendered=testing.render(React.createElement(Component));
 return {env,events,themes,load,rendered,...testing,rerender(){rendered.rerender(React.createElement(Component));},setTheme(theme){env.theme=theme;rendered.rerender(React.createElement(Component));},lastSearch(){return events.search.at(-1);},nativeBack(){testing.act(()=>env.guideModal.onRequestClose());},unmount(){rendered.unmount();}};
}
module.exports={createGuideHarness,testing,React,dom};
