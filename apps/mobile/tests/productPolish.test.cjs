const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript');const root=path.resolve(__dirname,'..');
function loader(mocks={}) {const cache=new Map();return function read(name){if(Object.hasOwn(mocks,name))return mocks[name];const file=path.resolve(root,name);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(code,{module:mod,exports:mod.exports,require:n=>mocks[n]||read(path.relative(root,path.resolve(path.dirname(file),n+'.ts'))),URL,Date,Set,Map,Number,JSON,console,__DEV__:false,process:{env:{NODE_ENV:'test'}}});return mod.exports;};}
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
test('release parser renders hierarchy, paragraphs, lists and emphasis without HTML',()=>{const m=loader()('src/features/releaseNotes/releaseNotesModel.ts');const b=m.parseReleaseNotes('# Title\n\n## Changes\n\nFirst line\nnext line\n\n- **Like** clips\n- <b>Native</b>');assert.equal(b.length,5);assert.equal(b[0].kind,'heading');assert.equal(b[1].level,2);assert.equal(b[2].parts[0].text,'First line next line');assert.equal(b[3].kind,'bullet');assert.equal(b[3].parts[0].emphasis,true);assert.equal(b[4].parts[0].text,'Native');});
test('release links reject active schemes, credentials, local addresses and arbitrary HTML',()=>{const m=loader()('src/features/releaseNotes/releaseNotesModel.ts');for(const url of ['javascript:alert(1)','http://example.com','https://u:p@example.com','https://127.0.0.1','https://[::1]/','https://device.local/','https://example.com:8080/','https://example.com/a\n'])assert.equal(m.safeNoteLink(url),undefined,url);assert.equal(m.safeNoteLink('https://github.com/OK-ALI/Orion/releases'),'https://github.com/OK-ALI/Orion/releases');const parts=m.parseInlineNotes('[bad](javascript:x) [good](https://github.com/OK-ALI/Orion)');assert.equal(parts[0].href,undefined);assert.ok(parts[2].href);});
test('release parser bounds content and skips unsupported executable code',()=>{const m=loader()('src/features/releaseNotes/releaseNotesModel.ts');const b=m.parseReleaseNotes('```html\n<script>alert(1)</script>\n```\nHello\n'+('x\n'.repeat(900)));assert.ok(b.length<=500);assert.ok(!JSON.stringify(b).includes('alert'));});
test('installed release has offline fallback and update presentation caches only installed notes',()=>{const data=new Map();const store={get:k=>data.get(k),set:(k,v)=>data.set(k,v)};const m=loader({'../../services/storageAdapter':{mmkvStorageAdapter:store}})('src/features/releaseNotes/releaseNotesContent.ts');assert.ok(m.installedReleaseNotes('4.0.0').notes.includes('Glimpse'));m.releaseNotesFromUpdate('4.0.0',{version:'4.0.1',notes:'# New'});assert.equal(data.size,0);m.releaseNotesFromUpdate('4.0.0',{version:'4.0.0',notes:'# Current'});assert.equal(m.installedReleaseNotes('4.0.0').notes,'# Current');data.set('orion.mobile.releaseNotes.v1','bad');assert.ok(m.installedReleaseNotes('4.0.0').notes.includes('Glimpse'));});
test('release dialog opens and closes only local presentation state; updater engine remains separate',()=>{const c=source('src/features/settings/UpdatesSettingsContent.tsx');assert.match(c,/onPress=\{\(\) => setNotesDocument\(releaseDocument\)\}/);assert.match(c,/onClose=\{\(\) => setNotesDocument\(null\)\}/);assert.doesNotMatch(c,/<MobileReleaseNotes/);assert.match(c,/<MobileUpdateExecutionSection state=\{appUpdateState\}/);const d=source('src/features/feedback/OrionContentDialog.tsx');assert.match(d,/onRequestClose=\{onClose\}/);assert.match(d,/<ScrollView style=\{\{ flex: 1 \}\}/);assert.match(d,/accessibilityViewIsModal/);assert.match(d,/resolvedProfile === 'efficiency'/);});
test('Welcome Feedback introduction is local, passive, in the requested order',()=>{const s=source('src/features/releaseWelcome/ReleaseWelcomeScreen.tsx');assert.ok(s.indexOf('Everything you already know')<s.indexOf('STAY CONNECTED TO ORION'));assert.ok(s.indexOf('STAY CONNECTED TO ORION')<s.indexOf('The Final Chapter'));assert.match(s,/Bug fixes, compatibility work, essential maintenance/);assert.doesNotMatch(s,/feedbackTransport|initializeFeedback|feedbackDiagnosticState|fetch\(/);assert.equal((s.match(/onPress=\{\(\)=>onExit/g)||[]).length,2);});
test('Feedback storage is bounded, restart-safe and deduplicates accepted server IDs',async()=>{const data=new Map();const store={get:k=>data.get(k),set:(k,v)=>data.set(k,v)};const read=loader({'../../services/storageAdapter':{mmkvStorageAdapter:store},'expo-modules-core':{requireOptionalNativeModule:()=>({uuid:async()=> 'a'.repeat(8)+'-aaaa-4aaa-8aaa-'+ 'a'.repeat(12)})}});const m=read('src/features/feedback/feedbackStore.ts');let local=await m.initializeFeedback();const draft=await m.newFeedback('problem');assert.equal(draft.diagnostics,true);local={...local,draft:{...draft,message:'Offline draft'}};m.saveFeedback(local);assert.equal(m.loadFeedback().draft.message,'Offline draft');const record={id:'ORN-FB-'+ 'A'.repeat(24),token:'b'.repeat(64),type:'problem',area:'Anime',subject:'Issue',message:'Still here',sentAt:1,diagnostics:true,screenshot:false};local=m.acceptFeedback(local,record);local=m.acceptFeedback(local,record);assert.equal(local.history.length,1);assert.equal(local.totalSent,1);for(let i=1;i<90;i++)local=m.acceptFeedback(local,{...record,id:'ORN-FB-'+i.toString(16).padStart(24,'0').toUpperCase()});assert.equal(local.history.length,50);assert.equal(local.totalSent,90);m.saveFeedback(local);assert.equal(m.loadFeedback().draft,null);});
test('diagnostic events and incidents stay bounded and do not include arbitrary fields',()=>{const data=new Map();const m=loader({'../../services/storageAdapter':{mmkvStorageAdapter:{get:k=>data.get(k),set:(k,v)=>data.set(k,v)}}})('src/features/feedback/feedbackDiagnostics.ts');for(let i=0;i<250;i++)m.recordFeedbackEvent({at:Date.now(),area:'Player',event:'state',code:'SOURCE_FAILED',provider:'https://private?token=abc',password:'secret',message:'private'},true);const s=m.feedbackDiagnosticState();assert.equal(s.events.length,120);assert.equal(s.incidents.length,8);const report=m.generateFeedbackReport('Player',{version:'4.0.0'},{online:false,profile:'efficiency',reducedMotion:true});assert.equal(report.events.length,40);assert.doesNotMatch(JSON.stringify(report),/private|password|secret|https/);m.flushDiagnostics();assert.ok(data.size);});
test('feedback text validation is clear and failed reports receive no fabricated ID',()=>{const m=loader()('src/features/feedback/feedbackModel.ts');const d=m.blankFeedback('general','x');assert.equal(d.diagnostics,false);assert.ok(m.feedbackValidation(d));d.subject='Hello';d.message='Thoughts';assert.equal(m.feedbackValidation(d),null);d.replyEmail='wrong';assert.match(m.feedbackValidation(d),/email/);assert.ok(!Object.hasOwn(d,'id'));});
test('native screenshot path uses explicit picker, strips metadata, bounds bytes and no new permissions',()=>{const s=source('modules/orion-feedback/android/src/main/java/expo/modules/orionfeedback/OrionFeedbackModule.kt');assert.match(s,/ACTION_OPEN_DOCUMENT/);assert.match(s,/Bitmap\.CompressFormat\.JPEG/);assert.match(s,/720000/);assert.doesNotMatch(source('modules/orion-feedback/android/src/main/AndroidManifest.xml'),/uses-permission/);assert.doesNotMatch(source('src/features/feedback/FeedbackScreen.tsx'),/useOrionAccount|accountProfile\.email/);});
test('diagnostic evidence observers cannot affect original Orion state updates',()=>{const m=loader({'expo-constants':{default:{expoConfig:{version:'3.2.1'}}},'@orion/shared/sources':{getRegisteredSource:()=>null},'@orion/shared/types':{SMART_CONNECT_PROTOCOL_VERSION:1},'./storageAdapter':{getMobileStorageHealth:()=>({state:'ready'})}})('src/services/mobileDiagnostics.ts');let n=0;const off=m.subscribeMobileDiagnosticEvidence(()=>{n++;throw Error('optional');});m.updateMobileDiagnostics({route:'/player/1',playbackState:'playing'});assert.equal(m.getMobileDiagnosticsSnapshot().route,'/player/1');assert.equal(n,1);off();m.updateMobileDiagnostics({route:'/'});assert.equal(n,1);});

test('Anime evidence omits search text and observers preserve the qualified writer contract',()=>{const m=loader({'react-native':{Platform:{OS:'android'},NativeModules:{}},'@orion/shared/api':{ANIME_IDENTITY_REASONS:['not-found'],normalizeAnimeTitle:v=>v}})('src/features/playback/animeIdentityDiagnostics.ts');const rows=[];const evidence=[];const off=m.subscribeAnimeIdentityEvidence(e=>{evidence.push(e);throw Error('optional');});const trace=m.createAnimeIdentityTrace(s=>rows.push(JSON.parse(s)));trace({stage:'decision',tmdbId:'123',mediaType:'movie',outcome:'rejected',reason:'not-found',query:'A known title'});assert.equal(rows.length,1);assert.equal(rows[0].sequence,1);assert.equal(rows[0].query,'A known title');assert.equal(evidence[0].tmdbId,'123');assert.ok(!Object.hasOwn(evidence[0],'query'));off();trace({stage:'decision',outcome:'accepted'});assert.equal(evidence.length,1);assert.equal(rows[1].sequence,2);});
test('Feedback Worker has no payload or credential logging, including failure branches',()=>{const files=['index.ts','mail.ts','validation.ts'];for(const file of files)assert.doesNotMatch(source('feedback-backend/src/'+file),/console\.|logger\.|JSON\.stringify\([^)]*\).*log/);const config=JSON.parse(source('feedback-backend/wrangler.jsonc'));assert.equal(config.observability.enabled,false);assert.ok(config.secrets.required.includes('BREVO_API_KEY'));});

test('problem and idea reports derive a safe subject from the primary message',()=>{const m=loader()('src/features/feedback/feedbackModel.ts');for(const kind of ['problem','idea']){const d=m.blankFeedback(kind,'x');d.message='First line\nMore details';assert.equal(m.feedbackValidation(d),null);assert.equal(m.feedbackSubject(d),'First line More details');}const screen=source('src/features/feedback/FeedbackScreen.tsx');assert.match(screen,/paddingBottom:insets.bottom\+96/);assert.match(screen,/trackColor=\{\{false:theme.border,true:theme.accentSoft\}\}/);});


const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'Fragment'};
function nodes(tree){if(!tree||typeof tree!=='object')return [];return [tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];}
function textOf(tree){if(typeof tree==='string'||typeof tree==='number')return String(tree);if(!tree||typeof tree!=='object')return '';return [tree.props?.children].flat(Infinity).map(textOf).join('');}
const flatStyle=styles=>Object.assign({},...[styles].flat(Infinity).filter(Boolean));
test('sidebar shares one compact footer, preserves status and opens Feedback; larger text grows safely',()=>{
  for(const fontScale of [1,1.3,1.8]){
    let closed=0;const routes=[];
    const read=loader({'react':{},'react/jsx-runtime':jsx,
      'react-native':{View:'View',Text:'Text',Pressable:'Pressable',ScrollView:'ScrollView',Modal:'Modal',Image:'Image',Platform:{OS:'android'},StyleSheet:{create:v=>v,hairlineWidth:1,absoluteFill:{}},useWindowDimensions:()=>({fontScale})},
      '@expo/vector-icons':{Ionicons:'Icon'},'expo-router':{useRouter:()=>({push:r=>routes.push(r)}),usePathname:()=>'/'},'expo-linear-gradient':{LinearGradient:'Gradient'},
      '@orion/shared/tokens':{fontFamilies:{display:'Display',heading:'Heading'},fontSizes:{sm:14},radii:{xl:16},spacing:{2:8,3:12,4:16},text:{muted:'gray'},accent:{primary:'red'}},
      '../context/ThemeContext':{useOrionTheme:()=>({theme:{}})},'../context/AccountContext':{useOrionAccount:()=>({state:{phase:'local'}})},
      '../context/NetworkContext':{useNetworkStatus:()=>({productState:'online',latencyMs:7})},'./mobileConnectionPresentationPolicy':{getMobileConnectionPresentation:()=>({tone:'success'})},
      '../features/glimpse/glimpsePreview':{isGlimpsePreviewEnabled:()=>true}});
    const tree=read('src/components/SidebarDrawer.tsx').SidebarDrawer({visible:true,persistent:true,onClose:()=>closed++});
    const all=nodes(tree);const footers=all.filter(n=>n.props?.testID==='sidebar-shared-footer');assert.equal(footers.length,1);
    const footer=footers[0];const children=nodes(footer);
    const status=children.find(n=>n.props?.accessibilityLabel==='Orion Mobile. Online · 7 ms');assert.ok(status);assert.equal(status.props.onPress,undefined);
    const button=children.find(n=>n.props?.accessibilityLabel==='Feedback. Bugs, ideas and feedback');assert.ok(button);assert.equal(button.props.accessibilityRole,'button');
    const style=flatStyle(button.props.style({pressed:false}));assert.ok(style.minHeight>=44);assert.equal(style.height,undefined);assert.equal(flatStyle(footer.props.style).height,undefined);
    assert.equal(flatStyle(footer.props.style).flexDirection,fontScale>1.3?'column':'row');assert.equal(flatStyle(status.props.style).minWidth,0);
    button.props.onPress();assert.deepEqual(routes,['/feedback']);assert.equal(closed,1);
    const labels=all.filter(n=>n.type==='Pressable').map(n=>n.props.accessibilityLabel);for(const label of ['Home','Glimpse','Discover & Search','Library','Downloads','Orion Connect','Settings'])assert.ok(labels.includes(label));
  }
  assert.doesNotMatch(source('src/components/SidebarDrawer.tsx'),/feedbackCard:/);
});
test('included information presents the user-selected severity already included in the report submission',()=>{
  const view=loader({'react/jsx-runtime':jsx,'./FeedbackControls':{FeedbackText:'FeedbackText'},'./OrionContentDialog':{OrionContentDialog:'Dialog'}})('src/features/feedback/FeedbackDiagnosticPreview.tsx').FeedbackDiagnosticPreview;
  const report={app:{version:'4.0.0'},context:{area:'Home',online:true,profile:'quality',reducedMotion:false},events:[]};
  for(const severity of ['Minor','Annoying','Blocking']){const text=textOf(view({report,severity,onClose:()=>{}}));assert.ok(text.includes('Severity'+severity));}
  assert.ok(!textOf(view({report,onClose:()=>{}})).includes('Severity'));
  const screen=source('src/features/feedback/FeedbackScreen.tsx');assert.match(screen,/severity=\{draft\?\.type==='problem'\?draft.severity:undefined\}/);assert.match(screen,/draft.type==='problem'\?\{severity:draft.severity\}/);
});

test('deployment plan targets the existing Worker and preserves the stored key and variables',()=>{const c=JSON.parse(source('feedback-backend/wrangler.jsonc'));assert.equal(c.name,'orion-feedback');assert.equal(c.keep_vars,true);assert.deepEqual(c.secrets.required,['BREVO_API_KEY','FEEDBACK_HMAC_SECRET']);assert.equal(c.vars.BREVO_SENDER_NAME,'Orion Feedback');assert.ok(!Object.hasOwn(c.vars,'BREVO_API_KEY'));assert.ok(!Object.hasOwn(c.vars,'FEEDBACK_HMAC_SECRET'));assert.equal(c.observability.enabled,false);assert.equal(c.preview_urls,false);assert.deepEqual(c.durable_objects.bindings.map(v=>v.name),['RECEIPTS','BUDGET']);assert.match(source('feedback-backend/src/index.ts'),/this.env.BREVO_SENDER_EMAIL,this.env.FEEDBACK_RECIPIENT,this.env.BREVO_SENDER_NAME/);});

test('Mobile uses only the verified public production Feedback endpoint and contains no backend credentials',()=>{
  const app=JSON.parse(source('app.json')).expo;
  assert.equal(app.extra.feedbackEndpoint,'https://orion-feedback.okali-orion.workers.dev/v1/feedback');
  assert.equal(app.android.package,'com.okali.orion');
  assert.equal(app.version,'4.0.0');assert.equal(app.android.versionCode,60);
  assert.doesNotMatch(JSON.stringify(app),/BREVO_API_KEY|FEEDBACK_HMAC_SECRET|followupToken/);
});

test('receipt acknowledgement loss is internal-only, explicit, once-only and never retains a payload',()=>{
  const {loader}=require('./helpers/animeModules.cjs');
  const file='apps/mobile/src/features/feedback/feedbackQualification.ts';
  for(const enabled of [false,true]){
    const q=loader({'../glimpse/glimpseBuild':{GLIMPSE_INTERNAL_PREVIEW:enabled}})(file);
    assert.equal(q.armFeedbackAckLoss(undefined),false);assert.equal(q.armFeedbackAckLoss('bad request'),false);
    assert.equal(q.consumeFeedbackAckLoss(),false);
    assert.equal(q.armFeedbackAckLoss('physical-first-ack'),enabled);
    assert.equal(q.consumeFeedbackAckLoss(),enabled);assert.equal(q.consumeFeedbackAckLoss(),false);
    assert.equal(q.armFeedbackAckLoss('physical-first-ack'),false);
  }
  const transport=source('src/features/feedback/feedbackTransport.ts');
  assert.ok(transport.indexOf('result.accepted!==true')<transport.indexOf('if(consumeFeedbackAckLoss())'));
  assert.doesNotMatch(source('src/features/feedback/feedbackQualification.ts'),/storage|console\.|fetch\(|process\.env/);
  assert.match(source('app/feedback-retry-test.tsx'),/GLIMPSE_INTERNAL_PREVIEW && valid/);
});

test('v4 notes qualification uses the bundled native dialog only in internal builds and exits to Settings',()=>{
  for(const enabled of [false,true]){
    let reads=0;const routes=[];
    const read=loader({'react/jsx-runtime':jsx,'expo-router':{Redirect:'Redirect',useRouter:()=>({replace:r=>routes.push(r)})},
      '../src/features/glimpse/glimpseBuild':{GLIMPSE_INTERNAL_PREVIEW:enabled},
      '../src/features/releaseNotes/ReleaseNotesDialog':{ReleaseNotesDialog:'Dialog'},
      '../src/features/releaseNotes/releaseNotesContent':{installedReleaseNotes:version=>{reads++;return{version,title:'Release Notes',notes:'Bundled notes'};}}});
    const tree=read('app/release-notes-test.tsx').default();
    assert.equal(tree.type,enabled?'Dialog':'Redirect');assert.equal(reads,enabled?1:0);
    if(enabled){assert.equal(tree.props.document.version,'4.0.0');tree.props.onClose();assert.deepEqual(routes,['/settings']);}
    else assert.equal(tree.props.href,'/');
  }
});

test('all Feedback receipts and history details render a generated summary only as the full message',()=>{
  const read=loader({'react/jsx-runtime':jsx,'./FeedbackControls':{FeedbackText:'FeedbackText'}});
  const model=read('src/features/feedback/feedbackModel.ts');
  const content=read('src/features/feedback/FeedbackReportContent.tsx').FeedbackReportContent;
  for(const type of ['problem','idea','general','followup']){
    for(const message of ['A short report.', 'First line\n  More details.', 'A complete report with details. '.repeat(12), 'x'.repeat(119)+' '+ 'More details remain visible.']){
      const draft={...model.blankFeedback(type,'fixture'),message};
      const subject=model.feedbackSubject(draft),record={subject,message},before=JSON.stringify(record);
      const tree=content(record),texts=nodes(tree).filter(n=>n.type==='FeedbackText');
      assert.equal(texts.length,1,type);assert.equal(textOf(tree),message,type);
      assert.equal(texts[0].props.heading,undefined);assert.equal(JSON.stringify(record),before);
    }
  }
  const screen=source('src/features/feedback/FeedbackScreen.tsx');
  assert.match(screen,/\(page==='details'\|\|page==='success'\)/);
  assert.match(screen,/<FeedbackReportContent subject=\{selected.subject\} message=\{selected.message\}\/>/);
});

test('distinct user titles and legacy report subjects remain visible without changing saved content',()=>{
  const read=loader({'react/jsx-runtime':jsx,'./FeedbackControls':{FeedbackText:'FeedbackText'}});
  const content=read('src/features/feedback/FeedbackReportContent.tsx').FeedbackReportContent;
  for(const report of [{subject:'A useful title',message:'The full report explains the title.'},{subject:'Additional information',message:'Further details about the original report.'},{subject:'Playback',message:'Playback failed after returning to Orion.'}]){
    const tree=content(report),texts=nodes(tree).filter(n=>n.type==='FeedbackText');
    assert.equal(texts.length,2);assert.equal(texts[0].props.heading,true);
    assert.equal(textOf(texts[0]),report.subject);assert.equal(textOf(texts[1]),report.message);
  }
  assert.equal(textOf(content({subject:'First   line More details.',message:'First line\n More details.'})),'First line\n More details.');
});
