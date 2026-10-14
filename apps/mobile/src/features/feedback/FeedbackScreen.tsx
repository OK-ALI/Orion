import { useEffect, useRef, useState } from 'react';
import { BackHandler, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@orion/shared/tokens';
import { OrionDialog } from '../../components/OrionDialog';
import { MobilePageHeader } from '../../components/MobilePageHeader';
import { useOrionTheme } from '../../context/ThemeContext';
import { useNetworkStatus } from '../../context/NetworkContext';
import { usePerformanceProfile } from '../../context/PerformanceContext';
import { resolveMotionPolicy } from '../../services/motionPolicy';
import { feedbackDiagnosticState, generateFeedbackReport } from './feedbackDiagnostics';
import { acceptFeedback, feedbackNative, initializeFeedback, newFeedback, saveFeedback } from './feedbackStore';
import { FEEDBACK_AREAS, feedbackValidation, feedbackSubject, type FeedbackDraft, type FeedbackKind, type FeedbackLocal, type FeedbackRecord } from './feedbackModel';
import { feedbackEndpoint, feedbackTransport } from './feedbackTransport';
import { FeedbackButton, FeedbackField, FeedbackText } from './FeedbackControls';
import { FeedbackDiagnosticPreview, type FeedbackReport } from './FeedbackDiagnosticPreview';
import { OrionContentDialog } from './OrionContentDialog';
type Page='home'|'form'|'history'|'details'|'success';
const kindLabel=(type:FeedbackKind)=>type==='problem'?'Report a Problem':type==='idea'?'Suggest a Feature':type==='followup'?'Add more information':'General Feedback';
export default function FeedbackScreen() {
  const {theme,preferences,systemReducedMotion}=useOrionTheme();const {resolvedProfile}=usePerformanceProfile();const network=useNetworkStatus();const insets=useSafeAreaInsets();const router=useRouter();const motion=resolveMotionPolicy(preferences.reducedMotion,systemReducedMotion);
  const [local,setLocal]=useState<FeedbackLocal|null>(null);const current=useRef(local);current.current=local;
  const [page,setPage]=useState<Page>('home');const [selected,setSelected]=useState<FeedbackRecord|null>(null);const [busy,setBusy]=useState(false);const lock=useRef(false);const [error,setError]=useState('');const [preview,setPreview]=useState<FeedbackReport|null>(null);const [areaPicker,setAreaPicker]=useState(false);const [historyFilter,setHistoryFilter]=useState('all');
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; actions: { text: string; style?: string; onPress?: () => void }[] } | null>(null);
  const confirm = (title: string, message: string, actions: { text: string; style?: string; onPress?: () => void }[]) => setConfirmation({ title, message, actions });
  const draft=local?.draft;const incidents=feedbackDiagnosticState().incidents.filter(i=>i.area===draft?.area);const previous=feedbackDiagnosticState().previousSession;
  useEffect(()=>{let alive=true;void initializeFeedback().then(v=>{if(alive)setLocal(v);}).catch(()=>{if(alive)setError('Your feedback storage is unavailable. Please restart Orion and try again.');});return()=>{alive=false;};},[]);
  function persist(next:FeedbackLocal) {setLocal(next);current.current=next;try{saveFeedback(next);return true;}catch{setError('Orion couldn’t save your draft. Keep this page open and try again.');return false;}}
  function change(update:Partial<FeedbackDraft>) {if(!draft||!local||busy||draft.attempted)return;persist({...local,draft:{...draft,...update}});setError('');}
  function discard() {if(!local)return;persist({...local,draft:null});void feedbackNative?.removeScreenshot();setPage('home');setError('');}
  function leaveForm() {if(busy)return;if(draft&&(draft.subject||draft.message||draft.screenshotUri))confirm('Discard this report?','Your unfinished feedback can stay on this device.',[{text:'Keep Draft',onPress:()=>{if(current.current&&persist(current.current))setPage('home');}},{text:'Discard',style:'destructive',onPress:discard}]);else { if(local)persist({...local,draft:null});setPage('home'); }}
  useEffect(()=>{const back=BackHandler.addEventListener('hardwareBackPress',()=>{if(areaPicker){setAreaPicker(false);return true;}if(preview){setPreview(null);return true;}if(page==='form'){leaveForm();return true;}if(page!=='home'){setPage(page==='details'?'history':'home');return true;}return false;});return()=>back.remove();},[page,draft,busy,preview,areaPicker]);
  async function start(type:FeedbackKind,parent?:FeedbackRecord) {if(!local||lock.current)return;if(local.draft){confirm('You have an unfinished report.','Continue your saved report, or discard it to start another.',[{text:'Continue',onPress:()=>setPage('form')},{text:'Discard',style:'destructive',onPress:()=>{void newFeedback(type).then(next=>{if(parent){next.parentId=parent.id;next.followupToken=parent.token;next.area=parent.area;next.subject='Additional information';}persist({...current.current!,draft:next});void feedbackNative?.removeScreenshot();setPage('form');setError('');}).catch(()=>setError('Orion couldn’t create a draft. Please try again.'));}},{text:'Cancel',style:'cancel'}]);return;}try{const next=await newFeedback(type);if(parent){next.parentId=parent.id;next.followupToken=parent.token;next.area=parent.area;next.subject='Additional information';}persist({...local,draft:next});setPage('form');setError('');}catch{setError('Orion couldn’t create a draft. Please try again.');}}
  async function report():Promise<FeedbackReport> {const native=await feedbackNative?.environment();return generateFeedbackReport(draft!.area,{version:Constants.expoConfig?.version||'0.0.0',platform:Platform.OS,...(native||{})},{online:network.online,profile:resolvedProfile,reducedMotion:motion.reduceMotion},draft?.incidentId,draft?.previousSession);}
  async function pick() {if(busy||draft?.attempted)return;try{const image=await feedbackNative?.pickScreenshot();if(image)change({screenshotUri:image.uri});}catch{setError('This image couldn’t be added. Choose a smaller image and try again.');}}
  async function send(allowRepeat=false) {
    if(!draft||!local||lock.current)return;const validation=feedbackValidation(draft);if(validation){setError(validation);return;}
    if(!network.online){change({failed:true});setError('You’re offline. Your report is still here. Reconnect and try again.');return;}
    if(!feedbackEndpoint()){change({failed:true});setError('Feedback sending isn’t available yet. Your draft is saved on this device.');return;}
    const recent=local.history.find(r=>r.incidentId&&r.incidentId===draft.incidentId&&Date.now()-r.sentAt<86_400_000);
    if(recent&&!allowRepeat&&!draft.attempted){confirm('This issue was recently reported.',`Report ${recent.id} was sent recently.`,[{text:'Add more information',onPress:()=>{void newFeedback('followup').then(next=>{next.parentId=recent.id;next.followupToken=recent.token;next.area=recent.area;next.subject='Additional information';persist({...local,draft:next});void feedbackNative?.removeScreenshot();setPage('form');});}},{text:'Send a new report anyway',onPress:()=>void send(true)},{text:'Cancel',style:'cancel'}]);return;}
    lock.current=true;setBusy(true);setError('');
    try {
      const meta=draft.frozenSubmission?JSON.parse(draft.frozenSubmission):{schema:1,submittedAt:Date.now(),requestId:draft.requestId,clientId:local.clientId,type:draft.type,area:draft.area,subject:feedbackSubject(draft),message:draft.message.trim(),...(draft.type==='problem'?{severity:draft.severity}:{}),...(draft.usefulness?{usefulness:draft.usefulness}:{}),...(draft.replyEmail?{replyEmail:draft.replyEmail}:{}),version:Constants.expoConfig?.version||'0.0.0',platform:Platform.OS,...(draft.parentId?{parentId:draft.parentId,followupToken:draft.followupToken}:{}),...(draft.type==='problem'&&draft.diagnostics?{diagnostics:await report()}:{} )};
      const attempted={...local,draft:{...draft,attempted:true,frozenSubmission:JSON.stringify(meta)}};if(!persist(attempted))return;
      const screenshot=draft.screenshotUri?await feedbackNative?.screenshot():null;if(draft.screenshotUri&&!screenshot)throw new Error('SCREENSHOT_MISSING');
      const result=await feedbackTransport.send(JSON.stringify({...meta,...(screenshot?{screenshot}:{})}));
      const record:FeedbackRecord={id:result.feedbackId,token:result.followupToken,type:draft.type,area:draft.area,subject:feedbackSubject(draft),message:draft.message,sentAt:Date.now(),diagnostics:!!meta.diagnostics,screenshot:!!screenshot,incidentId:draft.incidentId,parentId:draft.parentId};
      const accepted=acceptFeedback(current.current!,record); try { saveFeedback(accepted); } catch { throw new Error('LOCAL_UNAVAILABLE'); } setLocal(accepted); current.current=accepted;
      await feedbackNative?.removeScreenshot().catch(()=>{});setSelected(record);setPage('success');
    }catch(e){const next=current.current;if(next?.draft)persist({...next,draft:{...next.draft,failed:true}});const code=e instanceof Error?e.message:'';setError(code==='EXPIRED'?'This saved attempt is too old to check. Your message is still here. Choose Edit report if you want to start a new submission.':code==='RATE_LIMITED'?'Please wait before trying again. Your report is still here.':code==='LOCAL_UNAVAILABLE'?'Your feedback was accepted, but Orion couldn’t save its receipt. Keep this page open and retry to recover the same ID.':'Orion couldn’t confirm that your feedback was sent. Your report is still here. Try Again checks the same submission without sending a duplicate.');}
    finally{lock.current=false;setBusy(false);}
  }
  function editAttempted() {confirm('Edit this report?','A previous attempt may already have reached Orion. Editing starts a new submission. You can try again first to recover its confirmation.',[{text:'Keep checking',style:'cancel'},{text:'Edit report',onPress:()=>{void newFeedback(draft!.type).then(next=>{if(current.current?.draft)persist({...current.current,draft:{...current.current.draft,requestId:next.requestId,attempted:false,frozenSubmission:undefined,failed:false}});});}}]);}
  const title=page==='home'?'Feedback':page==='history'?'Feedback History':page==='details'?'Feedback Details':page==='success'?'Feedback sent':draft?.type==='followup'?'Add to Feedback':kindLabel(draft?.type||'problem');
  const back=()=>{if(page==='form')leaveForm();else if(page==='home')router.back();else setPage(page==='details'?'history':'home');};
  return <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1,backgroundColor:theme.background}}><MobilePageHeader eyebrow="YOUR VOICE" title={title} subtitle={page==='home'?'Help improve Orion.':undefined} trailing={<Pressable accessibilityRole="button" accessibilityLabel="Back from Feedback" onPress={back} disabled={busy} style={{minWidth:48,minHeight:48,justifyContent:'center',alignItems:'center'}}><Ionicons name="arrow-back" size={24} color={theme.accent}/></Pressable>}/>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{width:'100%',maxWidth:760,alignSelf:'center',paddingHorizontal:18,paddingBottom:insets.bottom+96,gap:spacing[4]}}>
    {!!error&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{fontFamily:'Inter',fontSize:15,lineHeight:24,color:theme.text}}>{error}</Text>}
    {page==='home'&&<>
      {(['problem','idea','general'] as const).map(type=><FeedbackButton key={type} label={kindLabel(type)} onPress={()=>void start(type)} disabled={!local}/>)}
      <FeedbackText heading>YOUR FEEDBACK</FeedbackText><FeedbackText>{local?.totalSent||0} feedback sent · History stays on this device.</FeedbackText>
      {draft&&<><FeedbackText>1 unfinished draft{draft.failed?' · Not sent':''}</FeedbackText><FeedbackButton label="Continue draft" onPress={()=>setPage('form')}/><FeedbackButton label="Discard draft" onPress={()=>confirm('Discard this report?','Your unfinished feedback will be removed.',[{text:'Keep Draft',style:'cancel'},{text:'Discard',style:'destructive',onPress:discard}])}/></>}
      <FeedbackButton label="View Feedback History" onPress={()=>setPage('history')}/><FeedbackText>Nothing is transmitted until you choose Send. Reply email and screenshots are optional.</FeedbackText>
    </>}
    {page==='form'&&draft&&<>
      {draft.parentId&&<FeedbackText>{draft.parentId}</FeedbackText>}
      {draft.type!=='general'&&<><FeedbackText heading>{draft.type==='problem'?'Problem Area':'Which part of Orion?'}</FeedbackText><FeedbackButton label={draft.area} onPress={()=>setAreaPicker(true)} disabled={busy||draft.attempted}/></>}
      {draft.type==='problem'&&<>
        <FeedbackText heading>{incidents.length?'Recent issue found':'No recent issue was detected.'}</FeedbackText>
        {incidents.length?incidents.slice(-3).reverse().map(i=><FeedbackButton key={i.id} label={`${draft.incidentId===i.id?'✓ ':''}${i.area} issue · ${new Date(i.at).toLocaleTimeString()}`} disabled={draft.attempted} onPress={()=>change({incidentId:draft.incidentId===i.id?undefined:i.id})}/>):<FeedbackText>Orion can still include current diagnostics.</FeedbackText>}
      </>}
      {draft.type==='general'&&<FeedbackField label="Subject" value={draft.subject} onChange={subject=>change({subject})} max={120} disabled={busy||draft.attempted}/>}
      {draft.incidentId&&<FeedbackButton label="View recent issue details" onPress={()=>{void report().then(setPreview).catch(()=>setError('Included information is unavailable.'));}}/>}
      <FeedbackField label={draft.type==='problem'?'What happened?':draft.type==='followup'?'Anything else we should know?':draft.type==='idea'?'Your idea':'Your thoughts'} hint={draft.type==='problem'?`Tell us what you expected and what happened in ${draft.area}. Orion can include the technical details for you.`:undefined} value={draft.message} onChange={message=>change({message})} multiline disabled={busy||draft.attempted}/>
      {draft.type==='idea'&&<FeedbackField label="Why would this be useful?" value={draft.usefulness} onChange={usefulness=>change({usefulness})} max={3000} multiline disabled={busy||draft.attempted}/>}
      {draft.type==='problem'&&<>
        <FeedbackText heading>Severity</FeedbackText><View accessibilityRole="radiogroup" style={{gap:8}}>{(['Minor','Annoying','Blocking'] as const).map(severity=><Pressable key={severity} accessibilityRole="radio" accessibilityState={{checked:draft.severity===severity,disabled:busy||draft.attempted}} disabled={busy||draft.attempted} onPress={()=>change({severity})} style={{padding:12,borderWidth:1,borderRadius:16,borderColor:draft.severity===severity?theme.accent:theme.border,backgroundColor:draft.severity===severity?theme.accentSoft:theme.elevated}}><FeedbackText heading>{severity}</FeedbackText><FeedbackText>{severity==='Minor'?'Something looked or behaved incorrectly.':severity==='Annoying'?'It noticeably affected the experience.':'You could not continue what you were doing.'}</FeedbackText></Pressable>)}</View>
        <View style={{flexDirection:'row',alignItems:'center',gap:12}}><View style={{flex:1}}><FeedbackText heading>Orion Diagnostics</FeedbackText><FeedbackText>Include safe technical details that may help identify the problem. Recommended.</FeedbackText></View><Switch accessibilityLabel="Include Orion Diagnostics" trackColor={{false:theme.border,true:theme.accentSoft}} thumbColor={draft.diagnostics?theme.accent:theme.textMuted} value={draft.diagnostics} disabled={busy||draft.attempted} onValueChange={diagnostics=>change({diagnostics})}/></View>
        {draft.diagnostics&&<><FeedbackButton label="View included information" onPress={()=>{void report().then(setPreview).catch(()=>setError('Included information is unavailable. You can send without diagnostics.'));}}/>{previous&&<View style={{flexDirection:'row',alignItems:'center',gap:12}}><View style={{flex:1}}><FeedbackText>Include previous-session diagnostics</FeedbackText></View><Switch accessibilityLabel="Include previous-session diagnostics" trackColor={{false:theme.border,true:theme.accentSoft}} thumbColor={draft.previousSession?theme.accent:theme.textMuted} value={draft.previousSession} disabled={busy||draft.attempted} onValueChange={previousSession=>change({previousSession})}/></View>}</>}
      </>}
      {(draft.type==='problem'||draft.type==='followup')&&<><FeedbackText heading>Screenshot · optional</FeedbackText>{draft.screenshotUri&&<Image accessibilityLabel="Selected screenshot preview" source={{uri:draft.screenshotUri}} resizeMode="contain" style={{height:200,width:'100%',borderRadius:16}}/>}<FeedbackButton label={draft.screenshotUri?'Change Screenshot':'Add Screenshot'} onPress={()=>void pick()} disabled={busy||draft.attempted}/>{draft.screenshotUri&&<FeedbackButton label="Remove Screenshot" disabled={busy||draft.attempted} onPress={()=>{change({screenshotUri:undefined});void feedbackNative?.removeScreenshot();}}/>}<FeedbackText>Choose an image yourself. Orion never takes screenshots automatically. Check it for personal information before sending.</FeedbackText></>}
      <FeedbackField label="Reply email · optional" hint="Only needed if you would like a reply. Your Google Account email is not included automatically." value={draft.replyEmail} onChange={replyEmail=>change({replyEmail})} max={254} email disabled={busy||draft.attempted}/>
      {draft.attempted&&<FeedbackButton label="Edit report" onPress={editAttempted} disabled={busy}/>}
      <FeedbackButton primary label={busy?'Sending…':draft.failed?'Try Again':draft.type==='problem'?'Send Report':draft.type==='idea'?'Send Suggestion':draft.type==='followup'?'Send Update':'Send Feedback'} onPress={()=>void send()} disabled={busy}/>
    </>}
    {page==='history'&&<>
      <FeedbackText>The most recent 50 sent reports are kept on this device.</FeedbackText><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{[['all','All'],['problem','Problems'],['idea','Ideas'],['general','General']].map(([filter,label])=><FeedbackButton key={filter} label={`${historyFilter===filter?'✓ ':''}${label}`} onPress={()=>setHistoryFilter(filter)}/>)}</View>
      {draft&&<FeedbackButton label={draft.failed?'Not sent · Continue draft':'Draft · Continue'} onPress={()=>setPage('form')}/>}
      {(local?.history||[]).filter(r=>historyFilter==='all'||r.type===historyFilter).slice().reverse().map(r=><FeedbackButton key={r.id} label={`✓ ${r.id}\n${kindLabel(r.type)} · ${r.area}\n${r.subject}\n${new Date(r.sentAt).toLocaleString()}`} onPress={()=>{setSelected(r);setPage('details');}}/>)}
      {!local?.history.length&&<FeedbackText>Your successfully sent feedback will appear here.</FeedbackText>}
    </>}
    {(page==='details'||page==='success')&&selected&&<>
      <Ionicons accessible={false} name="checkmark-circle-outline" color={theme.accent} size={40}/><FeedbackText heading>{page==='success'?'Thanks for helping improve Orion.':'Sent'}</FeedbackText><FeedbackText heading>Orion Feedback ID</FeedbackText><FeedbackText>{selected.id}</FeedbackText><FeedbackButton label="Copy ID" onPress={()=>{void feedbackNative?.copy(selected.id).catch(()=>setError('The Feedback ID couldn’t be copied.'));}}/>
      <FeedbackText>{kindLabel(selected.type)} · {selected.area}{'\n'}{new Date(selected.sentAt).toLocaleString()}</FeedbackText><FeedbackText heading>{selected.subject}</FeedbackText><FeedbackText>{selected.message}</FeedbackText><FeedbackText>Diagnostics Included: {selected.diagnostics?'Yes':'No'}{'\n'}Screenshot Included: {selected.screenshot?'Yes':'No'}</FeedbackText>
      <FeedbackButton label="Add more information" onPress={()=>void start('followup',selected)}/><FeedbackButton label="Done" onPress={()=>setPage('home')}/>
      {page==='success'&&<><FeedbackButton label="Send another report" onPress={()=>setPage('home')}/><FeedbackButton label="View Feedback History" onPress={()=>setPage('history')}/></>}
    </>}
  </ScrollView><FeedbackDiagnosticPreview report={preview} severity={draft?.type==='problem'?draft.severity:undefined} onClose={()=>setPreview(null)}/><OrionContentDialog visible={areaPicker} title="Choose an Orion area" onClose={()=>setAreaPicker(false)}>{FEEDBACK_AREAS.map(area=><FeedbackButton key={area} label={area} onPress={()=>{change({area,incidentId:undefined});setAreaPicker(false);}}/>)}</OrionContentDialog><OrionDialog visible={!!confirmation} title={confirmation?.title || ''} message={confirmation?.message}
    actions={(confirmation?.actions || []).map(action => ({ label: action.text, role: action.style === 'destructive' ? 'destructive' : action.style === 'cancel' ? 'cancel' : 'secondary', onPress: () => { setConfirmation(null); action.onPress?.(); } }))}
    onDismiss={() => setConfirmation(null)} /></KeyboardAvoidingView>;
}
