const test=require('node:test'),assert=require('node:assert/strict');
const {loader,read}=require('./helpers/animeModules.cjs');
const {hookHarness}=require('./helpers/playerHookHarness.cjs');
const {nodes}=require('./helpers/trailerSessionHarness.cjs');
const jsx=(type,props,key)=>({type,props:{...props,...(key==null?{}:{key})}});
const theme=new Proxy({}, {get:(_,key)=>String(key)});
function animatedMock(){
  const loops=[],layouts=[];
  class Value{constructor(value){this.value=value;}setValue(value){this.value=value;}stopAnimation(){}interpolate(options){return {options};}}
  return {loops,layouts,rn:{View:'View',Text:'Text',Pressable:'Pressable',FlatList:'FlatList',ScrollView:'ScrollView',Switch:'Switch',TextInput:'TextInput',
    StyleSheet:{create:x=>x,absoluteFill:{position:'absolute'}},Platform:{OS:'android'},UIManager:{setLayoutAnimationEnabledExperimental(){}},
    LayoutAnimation:{Presets:{easeInEaseOut:'normal'},configureNext:value=>layouts.push(value)},
    Animated:{Value,Image:'AnimatedImage',ScrollView:'AnimatedScrollView',event:()=>()=>{},
      timing:(value,options)=>({value,options}),sequence:value=>value,loop:steps=>{const loop={steps,started:0,stopped:0,start(){this.started++;},stop(){this.stopped++;}};loops.push(loop);return loop;}}}};
}
for(const [orion,system] of [[false,false],[true,false],[false,true],[true,true]]){
  test(`Connect decorative motion uses OR policy (${orion}/${system}) without restarting on data updates`,async t=>{
    const h=hookHarness(),a=animatedMock();let policy={preferences:{reducedMotion:orion},systemReducedMotion:system};
    const load=loader({react:h.react,'react-native':a.rn,'../../context/ThemeContext':{useOrionTheme:()=>policy}});
    const initial={isConnected:false,showPairingModal:true,pairingMethod:'qr'};
    h.start(load('apps/mobile/src/features/connect/useConnectPresentationMotion.ts').useConnectPresentationMotion,initial);t.after(()=>h.dispose());await h.settle();
    assert.equal(a.loops.length,orion||system?0:2);
    const before=a.loops.length;for(let i=0;i<30;i++){h.update({...initial,heartbeat:i});await h.settle();}assert.equal(a.loops.length,before);
    policy={preferences:{reducedMotion:true},systemReducedMotion:false};h.update(initial);await h.settle();
    for(const loop of a.loops)assert.equal(loop.stopped,1);assert.equal(h.result.pulseAnim.value,1);assert.equal(h.result.scanLineAnim.value,0);
    policy={preferences:{reducedMotion:false},systemReducedMotion:false};h.update(initial);await h.settle();
    const pulse=a.loops.at(-2),scan=a.loops.at(-1);assert.equal(pulse.started,1);assert.equal(scan.started,1);
    h.update({...initial,isConnected:true,showPairingModal:false});await h.settle();assert.equal(pulse.stopped,1);assert.equal(scan.stopped,1);
    assert.deepEqual(pulse.steps.map(x=>x.options.duration),[1200,1200]);assert.deepEqual(scan.steps.map(x=>x.options.duration),[1400,1400]);
  });
}
function personFixture(){
  const h=hookHarness(),a=animatedMock(),requests=[],back=[];let route={id:'1',originTitle:'Origin',originRole:'Hero'},policy={theme,preferences:{reducedMotion:false},systemReducedMotion:false};
  const load=loader({react:h.react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':a.rn,
    'expo-router':{useLocalSearchParams:()=>route,useRouter:()=>({back:()=>back.push('back'),push(){}})},
    '@orion/shared/api':{imgUrl:path=>path?`https://image.tmdb.org/t/p/h632${path}`:null,fetchPersonDetails:id=>new Promise(resolve=>requests.push({id,resolve}))},
    '@expo/vector-icons':{Ionicons:'Icon'},'expo-linear-gradient':{LinearGradient:'Gradient'},'expo-blur':{BlurView:'BlurView'},
    '../../src/components/MediaCard':{MediaCard:'MediaCard'},'../../src/context/ThemeContext':{useOrionTheme:()=>policy},
    '../../src/services/responsive':{useResponsiveLayout:()=>({width:420,isLandscape:false,isTablet:false})},
    '../../src/context/PerformanceContext':{usePerformanceProfile:()=>({resolvedProfile:'balanced'})},
    'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:20,left:0})}});
  h.start(load('apps/mobile/app/person/[id].tsx').default,{});
  return {h,a,requests,back,async policy(orion,system){policy={...policy,preferences:{reducedMotion:orion},systemReducedMotion:system};h.update({});await h.settle();},
    async route(id){route={...route,id};h.update({});await h.settle();},nodes:name=>nodes(h.result,name)};
}
const person={name:'Performer',profile_path:'/public.jpg',biography:'Biography text',combined_credits:{cast:[{id:1,title:'Movie',media_type:'movie',popularity:2}],crew:[]}};
test('Person loading reserves the same hero/scroll geometry with an available back action and inert placeholders',async t=>{
  const f=personFixture();t.after(()=>f.h.dispose());await f.h.settle();
  const scroll=f.nodes('AnimatedScrollView')[0].props;assert.equal(scroll.accessibilityState.busy,true);
  const hero=f.nodes('View').find(x=>Array.isArray(x.props.style)&&x.props.style[0]?.height===500).props.style;
  const back=f.nodes('Pressable').find(x=>x.props.accessibilityLabel==='Go back');back.props.onPress();assert.equal(f.back.length,1);
  assert.ok(f.nodes('View').filter(x=>x.props.pointerEvents==='none').every(x=>x.props.accessible===false));
  assert.ok(f.nodes('Text').some(x=>x.props.children==='Loading profile…'));
  f.requests[0].resolve(person);await f.h.settle();
  assert.deepEqual(f.nodes('View').find(x=>Array.isArray(x.props.style)&&x.props.style[0]?.height===500).props.style,hero);
  assert.equal(f.nodes('AnimatedScrollView').length,1);assert.equal(f.nodes('AnimatedScrollView')[0].props.accessibilityState.busy,false);
  assert.equal(f.nodes('FlatList')[0].props.data[0].id,1);assert.equal(f.nodes('ActivityIndicator').length,0);
});
for(const [orion,system] of [[false,false],[true,false],[false,true],[true,true]])test(`Person parallax and biography expansion respect OR policy (${orion}/${system})`,async t=>{
  const f=personFixture();t.after(()=>f.h.dispose());f.requests[0].resolve(person);await f.h.settle();await f.policy(orion,system);
  const image=f.nodes('AnimatedImage')[0];assert.equal(image.props.style.some(x=>x?.transform),!(orion||system));
  f.nodes('Text').find(x=>x.props.onTextLayout).props.onTextLayout({nativeEvent:{lines:Array(20)}});await f.h.settle();
  f.nodes('Pressable').find(x=>x.props.accessibilityLabel==='Show more biography').props.onPress();await f.h.settle();
  assert.equal(f.a.layouts.length,orion||system?0:1);assert.ok(f.nodes('Pressable').some(x=>x.props.accessibilityState?.expanded));
  await f.policy(false,true);assert.equal(f.nodes('AnimatedImage')[0].props.style.some(x=>x?.transform),false);
});
test('Person navigation ignores stale profile requests and retains an explicit failure state',async t=>{
  const f=personFixture();t.after(()=>f.h.dispose());await f.route('2');f.requests[0].resolve({...person,name:'Stale'});await f.h.settle();
  assert.ok(f.nodes('Text').some(x=>x.props.children==='Loading profile…'));f.requests[1].resolve(null);await f.h.settle();
  assert.ok(f.nodes('Text').some(x=>x.props.children==='Failed to load profile.'));assert.equal(f.nodes('FlatList').length,0);
});
for(const [orion,system] of [[false,false],[true,false],[false,true],[true,true]])test(`Settings section scroll uses live OR policy (${orion}/${system}) without altering preferences`,async t=>{
  const h=hookHarness(),calls=[],a=animatedMock();let policy={theme,preferences:{reducedMotion:orion},systemReducedMotion:system};
  const noop=()=>{};
  const load=loader({react:h.react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':a.rn,'@expo/vector-icons':{Ionicons:'Icon'},
    'expo-router':{useLocalSearchParams:()=>({})},'../../src/context/ThemeContext':{ORION_MOBILE_THEMES:[],useOrionTheme:()=>({...policy,setTheme:noop,setReducedMotion:noop,setFollowSystem:noop,setCustomAccent:noop})},
    '../../src/context/PerformanceContext':{usePerformanceProfile:()=>({selection:'balanced',resolvedProfile:'balanced',setSelection:noop})},
    '../../src/services/responsive':{useResponsiveLayout:()=>({isTablet:false})},'../../src/components/MobilePageHeader':{MobilePageHeader:'Header'},
    '../../src/features/settings/settingsSectionOrderPreferences':{useSettingsSectionOrderPreferences:()=>({order:['account','appearance','accessibility'],save:noop})},
    '../../src/features/settings/SettingsSectionNavigator':{SettingsSectionNavigator:'Navigator'},
    ...Object.fromEntries(['AccountSettingsContent','UpdatesSettingsContent','NotificationSettingsContent','HomeLayoutSettingsContent'].map(name=>[`../../src/features/settings/${name}`,{[name]:name}])),
    '../../src/features/downloads/DownloadSettingsContent':{DownloadSettingsContent:'DownloadSettingsContent'}});
  h.start(load('apps/mobile/app/(tabs)/settings.tsx').default,{});t.after(()=>h.dispose());await h.settle();
  nodes(h.result,'ScrollView')[0].props.ref.current={scrollTo:value=>calls.push(value)};
  const appearance=nodes(h.result,'SettingsSection').find(x=>x.props.sectionId==='appearance');appearance.props.onLayout({nativeEvent:{layout:{y:400}}});
  nodes(h.result,'Navigator')[0].props.onSelect('appearance');await h.settle();assert.equal(calls.at(-1).animated,!(orion||system));assert.equal(calls.at(-1).y,392);
  policy={...policy,preferences:{reducedMotion:false},systemReducedMotion:true};h.update({});await h.settle();nodes(h.result,'Navigator')[0].props.onSelect('appearance');await h.settle();assert.equal(calls.at(-1).animated,false);
  assert.deepEqual(nodes(h.result,'SettingsSection').map(x=>x.props.sectionId),['account','appearance','accessibility']);
});
for(const [orion,system] of [[false,false],[true,false],[false,true],[true,true]])test(`Offline/shared loading overlay uses OR policy (${orion}/${system}) and keeps clear static feedback`,()=>{
  const load=loader({'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{View:'View',Text:'Text',Pressable:'Pressable',ActivityIndicator:'Spinner',StyleSheet:{create:x=>x}},
    '@expo/vector-icons':{Ionicons:'Icon'},'../../context/ThemeContext':{useOrionTheme:()=>({theme,preferences:{reducedMotion:orion},systemReducedMotion:system})}});
  const render=load('apps/mobile/src/components/player/PlayerStateOverlay.tsx').PlayerStateOverlay;
  const tree=render({state:'preparing'});assert.equal(nodes(tree,'Spinner').length,orion||system?0:1);assert.equal(nodes(tree,'View')[0].props.pointerEvents,'none');
  assert.ok(nodes(tree,'Text').some(x=>x.props.children==='Preparing source'));assert.equal(render({state:null}),null);
});
test('native offline presentation retains existing fades, reduced-motion branches and non-interactive hidden chrome',()=>{
  const native=read('apps/mobile/plugins/orion-cinema-webview-native/OrionPlayerActivity.kt');
  assert.match(native,/reducedMotion = intent.getBooleanExtra\(EXTRA_REDUCED_MOTION, false\)/);
  assert.match(native,/get\(\) = field \|\| try \{[\s\S]*?Settings.Global.getString\(contentResolver, Settings.Global.TRANSITION_ANIMATION_SCALE\)[\s\S]*?toFloatOrNull\(\) == 0f/);
  assert.match(native,/if \(reducedMotion\) \{\s*chrome.alpha = 0f\s*chrome.visibility = View.INVISIBLE\s*setChromeControlsVisible\(false\)/);
  assert.match(native,/\.alpha\(1f\)\s*\.setDuration\(CHROME_FADE_MS\)/);
  const surface=read('apps/mobile/src/features/playback/OrionOfflinePlayerSurface.tsx');
  assert.match(surface,/<PlayerStateOverlay/);assert.match(surface,/<PlayerHUD/);assert.match(surface,/<OfflineSubtitleSheet/);assert.match(surface,/<PresentationSheet/);
  assert.doesNotMatch(surface,/LayoutAnimation|withSpring|Animated\.timing/);
});
