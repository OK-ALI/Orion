export const FEEDBACK_AREAS = ['Home','Glimpse','Discovery','Search','Movies','TV','Anime','Media Details','Player','Downloads','Library','Orion Connect','Account','Settings','Update','Other'] as const;
export type FeedbackArea = typeof FEEDBACK_AREAS[number];
export type FeedbackKind = 'problem' | 'idea' | 'general' | 'followup';
export interface FeedbackDraft { schema:1; requestId:string; type:FeedbackKind; area:FeedbackArea; subject:string; message:string; usefulness:string; severity:'Minor'|'Annoying'|'Blocking'; diagnostics:boolean; incidentId?:string; previousSession:boolean; screenshotUri?:string; replyEmail:string; parentId?:string; followupToken?:string; failed?:boolean; attempted?:boolean; frozenSubmission?:string }
export interface FeedbackRecord { id:string; token:string; type:FeedbackKind; area:FeedbackArea; subject:string; message:string; sentAt:number; diagnostics:boolean; screenshot:boolean; incidentId?:string; parentId?:string }
export interface FeedbackLocal {schema:1;clientId:string;draft:FeedbackDraft|null;history:FeedbackRecord[];totalSent:number}
export function blankFeedback(type:FeedbackKind, requestId:string): FeedbackDraft { return {schema:1,requestId,type,area:'Other',subject:'',message:'',usefulness:'',severity:'Annoying',diagnostics:type==='problem',previousSession:false,replyEmail:''}; }
export function feedbackValidation(draft:FeedbackDraft):string|null {
  if (draft.type === 'general' && !draft.subject.trim()) return 'Add a short title for your feedback.';
  if (!draft.message.trim()) return draft.type==='idea'?'Tell us about your idea.':'Tell us what happened or what you would like to share.';
  if (draft.subject.length>120||draft.message.length>6000||draft.usefulness.length>3000) return 'Please shorten your message before sending.';
  if (draft.replyEmail && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(draft.replyEmail)) return 'Check your reply email, or leave it blank.';
  return null;
}

// A transport/history summary is not a second copy of the report body.
export function feedbackContentTitle({subject, message}: Pick<FeedbackRecord, 'subject' | 'message'>): string | null {
  const normalized = (text: string) => text.trim().replace(/\s+/g, ' ');
  const summary = normalized(message).slice(0, 120).trim();
  return !subject.trim() || normalized(subject) === summary ? null : subject;
}

export function feedbackSubject(draft: FeedbackDraft): string { return (draft.subject.trim() || draft.message.trim().replace(/\s+/g, ' ')).slice(0,120); }
