import { mmkvStorageAdapter as storage } from '../../services/storageAdapter';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { blankFeedback, type FeedbackDraft, type FeedbackKind, type FeedbackLocal, type FeedbackRecord, FEEDBACK_AREAS } from './feedbackModel';
export const FEEDBACK_KEY = 'orion.mobile.feedback.v1';
export const feedbackNative = requireOptionalNativeModule<{ uuid():Promise<string>; pickScreenshot():Promise<{uri:string}|null>; screenshot():Promise<string|null>; removeScreenshot():Promise<void>; copy(value:string):Promise<void>; environment():Promise<{versionCode:number;device:string;android:string}> }>('OrionFeedback');
const uuidPattern=/^[a-f0-9-]{36}$/i;
export function loadFeedback(): FeedbackLocal | null {
  try { const raw=storage.get(FEEDBACK_KEY); if (!raw) return null; if(raw.length>1_000_000)return null; const v=JSON.parse(raw); if(v.schema!==1||!uuidPattern.test(v.clientId)||!Array.isArray(v.history))return null;
    const history=v.history.slice(-50).filter((r:FeedbackRecord)=>/^ORN-FB-[A-F0-9]{24}$/.test(r.id)&&/^[a-f0-9]{64}$/.test(r.token)&&typeof r.message==='string'&&r.message.length<=6000&&typeof r.subject==='string'&&r.subject.length<=120&&FEEDBACK_AREAS.includes(r.area)&&Number.isFinite(r.sentAt));
    const d=v.draft; const draft=d&&d.schema===1&&uuidPattern.test(d.requestId)&&['problem','idea','general','followup'].includes(d.type)&&FEEDBACK_AREAS.includes(d.area)&&typeof d.message==='string'&&d.message.length<=6000&&typeof d.subject==='string'&&d.subject.length<=120&&typeof d.usefulness==='string'&&d.usefulness.length<=3000&&typeof d.replyEmail==='string'&&d.replyEmail.length<=254?d:null;
    return {schema:1,clientId:v.clientId,history,draft,totalSent:Math.max(history.length,Number.isSafeInteger(v.totalSent)?v.totalSent:0)};
  }catch{return null;}
}
export async function initializeFeedback():Promise<FeedbackLocal> {
  const current=loadFeedback();if(current){if(!current.draft?.screenshotUri)void feedbackNative?.removeScreenshot().catch(()=>{});return current;}
  if(!feedbackNative)throw new Error('LOCAL_UNAVAILABLE');
  const next:FeedbackLocal={schema:1,clientId:await feedbackNative.uuid(),draft:null,history:[],totalSent:0};saveFeedback(next);return next;
}
export function saveFeedback(value:FeedbackLocal) {const text=JSON.stringify(value);if(text.length>1_000_000)throw new Error('LOCAL_LIMIT');storage.set(FEEDBACK_KEY,text);if(storage.get(FEEDBACK_KEY)!==text)throw new Error('LOCAL_UNAVAILABLE');}
export async function newFeedback(type:FeedbackKind):Promise<FeedbackDraft>{if(!feedbackNative)throw new Error('LOCAL_UNAVAILABLE');return blankFeedback(type,await feedbackNative.uuid());}
export function acceptFeedback(local:FeedbackLocal,record:FeedbackRecord):FeedbackLocal {
  if(local.history.some(r=>r.id===record.id))return {...local,draft:null};
  return {...local,draft:null,totalSent:local.totalSent+1,history:[...local.history,record].slice(-50)};
}
