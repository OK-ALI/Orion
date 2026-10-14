import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evictDurableObject } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import { formatMail } from '../src/mail';
import { readBounded, validateSubmission } from '../src/validation';
const sample=()=>({schema:1,submittedAt:Date.now(),requestId:crypto.randomUUID(),clientId:crypto.randomUUID(),type:'problem',area:'Anime',subject:'Episode could not be verified',message:'The episode did not open.',severity:'Blocking',version:'4.0.0',platform:'android'});
const SELF=exports.default;
let replies:{status:number;body:object}[]=[];
const mail=(status=201,body:object={messageId:'fixture-message'})=>replies.push({status,body});
const send=(body:unknown,ip=crypto.randomUUID())=>SELF.fetch('https://orion.test/v1/feedback',{method:'POST',headers:{'Content-Type':'application/json','cf-connecting-ip':ip},body:JSON.stringify(body)});
beforeEach(()=>{replies=[];vi.stubGlobal('fetch',vi.fn(async (input:string,init?:RequestInit)=>{if(input!=='https://api.brevo.com/v3/smtp/email')throw Error('Outbound network blocked in tests');expect(init?.redirect).toBe('manual');const body=JSON.parse(String(init?.body));expect(body.sender.email).toBe('orion@example.invalid');expect(body.sender.name).toBe('Orion Feedback Fixture');expect(body.to[0].email).toBe('inbox@example.invalid');const reply=replies.shift();if(!reply)throw Error('Unexpected duplicate provider submission');return Response.json(reply.body,{status:reply.status});}));});afterEach(()=>{expect(replies).toHaveLength(0);vi.unstubAllGlobals();});
describe('bounded validation',()=>{
 it('accepts only known fields and human-readable severity',()=>{expect(validateSubmission(sample()).severity).toBe('Blocking');for(const patch of [{submittedAt:Date.now()-7*86_400_000},{type:'ticket'},{area:'Unknown'},{severity:'Critical'},{message:''},{subject:'a\nb'},{message:'a'.repeat(6001)},{replyEmail:'u@e.com\r\nBcc:x@e.com'},{authToken:'private'}])expect(()=>validateSubmission({...sample(),...patch})).toThrow();});
 it('rejects arbitrary diagnostic content, credentials and over-sized data',()=>{for(const diagnostics of [{schema:1,password:'private'},{schema:1,app:{version:'https://private'}},{schema:1,events:Array(161).fill({event:'state'})}])expect(()=>validateSubmission({...sample(),diagnostics})).toThrow();expect(validateSubmission({...sample(),diagnostics:{schema:1,app:{version:'4.0.0',device:'Samsung SM_S928B'},events:[{area:'Anime',code:'SOURCE_FAILED',at:1}]}}).diagnostics).toBeDefined();});
 it('rejects fake screenshot types and byte excess',()=>{for(const screenshot of ['data:image/jpeg;base64,AAAA','AAAA','a'.repeat(960004)])expect(()=>validateSubmission({...sample(),screenshot})).toThrow();});
 it('bounded reader rejects chunked requests without trusting content length',async()=>{await expect(readBounded(new Request('https://orion.test',{method:'POST',body:'abcdef'}),3)).rejects.toThrow('TOO_LARGE');});
 it('formats escaped structured email and safe Reply-To without spoofing',()=>{const s=validateSubmission({...sample(),message:'<script>never execute</script>',replyEmail:'reply@example.invalid',diagnostics:{schema:1,app:{version:'4.0.0'}}});const m=formatMail(s,'ORN-FB-'+ 'A'.repeat(24),'orion@example.invalid','inbox@example.invalid');expect(m.sender.email).toBe('orion@example.invalid');expect(m.replyTo?.email).toBe('reply@example.invalid');expect(m.htmlContent).not.toContain('<script>');expect(m.attachment?.[0].name).toBe('orion-diagnostics.zip');expect(m.subject).toContain('[ORION][BUG][ANIME]');});
});
describe('Worker and durable receipts',()=>{
 it('accepts only the submission endpoint and JSON POST',async()=>{expect((await SELF.fetch('https://orion.test/')).status).toBe(404);expect((await SELF.fetch('https://orion.test/v1/feedback')).status).toBe(405);expect((await SELF.fetch('https://orion.test/v1/feedback',{method:'POST',body:'text'})).status).toBe(415);expect((await send({...sample(),message:''})).status).toBe(400);});
 it('returns a server ID after provider acceptance and reuses it on retry',async()=>{const s=sample();mail();const first=await send(s);expect(first.status).toBe(200);const a=await first.json<{feedbackId:string;followupToken:string}>();expect(a.feedbackId).toMatch(/^ORN-FB-[A-F0-9]{24}$/);expect(a.followupToken).toMatch(/^[a-f0-9]{64}$/);const again=await send(s);expect(again.status).toBe(200);expect(await again.json()).toMatchObject(a);expect((await send({...s,message:'Changed content'})).status).toBe(409);});
 it('survives durable eviction without another provider submission',async()=>{const s=sample();mail();const first=await (await send(s)).json<{feedbackId:string}>();const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.FEEDBACK_HMAC_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const hash=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(s.clientId+':'+s.requestId))),v=>v.toString(16).padStart(2,'0')).join('');await evictDurableObject(env.RECEIPTS.getByName(hash));expect(await (await send(s)).json()).toMatchObject(first);},30000);
 it('concurrent double submission sends only one email',async()=>{const s=sample();mail();const pair=await Promise.all([send(s),send(s)]);expect(pair.map(r=>r.status)).toContain(200);expect(pair.every(r=>[200,409].includes(r.status))).toBe(true);expect((await send(s)).status).toBe(200);});
 it('does not fabricate success or resend an ambiguous provider failure',async()=>{const s=sample();mail(500,{error:'temporary'});const a=await send(s);expect(a.status).toBe(503);expect(await a.json()).not.toHaveProperty('feedbackId');const again=await send(s);expect(again.status).toBe(409);expect(await again.json()).toEqual({error:'confirmation_pending'});});
 it('can retry a definite provider rejection',async()=>{const s=sample();mail(429,{error:'quota'});expect((await send(s)).status).toBe(503);mail();expect((await send(s)).status).toBe(200);});
 it('requires the private receipt capability for follow-ups',async()=>{mail();const a=await (await send(sample())).json<{feedbackId:string;followupToken:string}>();const s={...sample(),type:'followup',severity:undefined,parentId:a.feedbackId,followupToken:a.followupToken};expect((await send({...s,followupToken:'a'.repeat(64)})).status).toBe(403);mail();expect((await send(s)).status).toBe(200);});
 it('enforces a persistent per-network daily allowance',async()=>{const ip='fixture-network-'+crypto.randomUUID();for(let i=0;i<5;i++){mail();expect((await send(sample(),ip)).status).toBe(200);}expect((await send(sample(),ip)).status).toBe(429);});
});

it('uses configured sender identity without letting Reply-To replace it',()=>{const s=validateSubmission({...sample(),replyEmail:'reply@example.invalid'});const m=formatMail(s,'ORN-FB-'+ 'B'.repeat(24),'orion@example.invalid','inbox@example.invalid','Orion Sender Fixture');expect(m.sender).toEqual({name:'Orion Sender Fixture',email:'orion@example.invalid'});expect(m.to).toEqual([{email:'inbox@example.invalid'}]);expect(m.replyTo?.email).toBe('reply@example.invalid');});

import { deliveryEvent } from '../src/operational';
it('operational trace emits only a generated ID, fixed code and HTTP status',()=>{
 const log=vi.spyOn(console,'log').mockImplementation(()=>{});
 try {
  const id='ORN-FB-'+ 'D'.repeat(24);
  deliveryEvent(id,'PROVIDER_RESPONSE',503);
  expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({event:'orion-feedback-delivery',feedbackId:id,code:'PROVIDER_RESPONSE',status:503});
  deliveryEvent('private-user-content','ACCEPTED',200);
  deliveryEvent(id,'private-user-content' as never,200);
  expect(log).toHaveBeenCalledTimes(1);
  deliveryEvent(id,'ACCEPTED',999);
  expect(JSON.parse(String(log.mock.calls[1][0]))).toEqual({event:'orion-feedback-delivery',feedbackId:id,code:'ACCEPTED'});
 } finally { log.mockRestore(); }
});

import { deliveryFailure } from '../src/operational';
it('exceptions map to fixed codes without emitting private exception text',()=>{
 const privateText='private-user-email-or-token';
 expect(deliveryFailure(new DOMException(privateText,'TimeoutError'))).toBe('REQUEST_TIMEOUT');
 expect(deliveryFailure(new Error('invalid header '+privateText))).toBe('REQUEST_CONFIG_FAILED');
 expect(deliveryFailure(new Error('redirect '+privateText))).toBe('REQUEST_REDIRECT_FAILED');
 expect(deliveryFailure(new Error('network '+privateText))).toBe('REQUEST_NETWORK_FAILED');
 expect(deliveryFailure(new Error(privateText))).toBe('REQUEST_UNKNOWN_FAILED');
});

it('does not forward the mail credential or resend when the provider returns a redirect',async()=>{const s=sample();mail(302,{error:'redirect'});expect((await send(s)).status).toBe(503);expect((await send(s)).status).toBe(409);});

import { providerRejection } from '../src/operational';
it('provider error bodies produce only fixed rejection codes',()=>{
 expect(providerRejection(JSON.stringify({message:'attachment extension private user content'}),400)).toBe('PROVIDER_ATTACHMENT_REJECTED');
 expect(providerRejection(JSON.stringify({message:'private API key'}),401)).toBe('PROVIDER_AUTH_REJECTED');
 expect(providerRejection(JSON.stringify({message:'sender not verified private email'}),400)).toBe('PROVIDER_SENDER_REJECTED');
 expect(providerRejection('private arbitrary content',400)).toBe('PROVIDER_NON_JSON_REJECTED');
 expect(providerRejection(JSON.stringify({code:'invalid_parameter',message:'Unsupported .json'}),400)).toBe('PROVIDER_ATTACHMENT_REJECTED');
 expect(providerRejection(JSON.stringify({message:'Key not found'}),400)).toBe('PROVIDER_AUTH_REJECTED');
 expect(providerRejection(JSON.stringify({code:'permission_denied'}),400)).toBe('PROVIDER_ACCOUNT_REJECTED');
});

it('definite rejections return reservations while accepted sends still enforce the daily cap',async()=>{
 const ip='rejected-budget-'+crypto.randomUUID();
 for(let i=0;i<5;i++){mail(400,{message:'Invalid attachment'});expect((await send(sample(),ip)).status).toBe(503);}
 mail();expect((await send(sample(),ip)).status).toBe(200);
},30000);

import { diagnosticsAttachment, diagnosticsZip } from '../src/diagnosticsAttachment';
it('diagnostics travel as one fixed JSON entry in an allowed ZIP, with screenshot unchanged',()=>{
 const json=JSON.stringify({schema:1,app:{version:'4.0.0'}},null,2),zip=diagnosticsZip(json),view=new DataView(zip.buffer);
 expect(view.getUint32(0,true)).toBe(0x04034b50);expect(view.getUint16(8,true)).toBe(0);expect(view.getUint32(18,true)).toBe(new TextEncoder().encode(json).length);
 const length=view.getUint16(26,true);expect(new TextDecoder().decode(zip.subarray(30,30+length))).toBe('orion-diagnostics.json');
 expect(new TextDecoder().decode(zip.subarray(30+length,30+length+view.getUint32(18,true)))).toBe(json);
 expect(diagnosticsAttachment(json).name).toBe('orion-diagnostics.zip');expect(()=>diagnosticsZip('x'.repeat(200001))).toThrow('DIAGNOSTICS_TOO_LARGE');
 const report=validateSubmission({...sample(),diagnostics:{schema:1},screenshot:btoa(String.fromCharCode(255,216,255,217))});
 expect(formatMail(report,'ORN-FB-'+ 'A'.repeat(24),'orion@example.invalid','inbox@example.invalid').attachment?.map(a=>a.name)).toEqual(['orion-diagnostics.zip','screenshot.jpg']);
});

describe('Feedback report presentation',()=>{
 for(const type of ['problem','idea','general','followup'] as const){
  it(type+' renders exact and truncated summaries only as one full report body',()=>{
   for(const message of ['A short report.', 'First line\n  More details.', 'A complete report with details. '.repeat(12), 'x'.repeat(119)+' '+ 'More details remain visible.']){
    const subject=message.trim().replace(/\s+/g,' ').slice(0,120);
    const report=validateSubmission({...sample(),type,message,subject,severity:type==='problem'?'Annoying':undefined,...(type==='followup'?{parentId:'ORN-FB-'+ 'A'.repeat(24),followupToken:'b'.repeat(64)}:{})});
    const before=JSON.stringify(report),m=formatMail(report,'ORN-FB-'+ 'B'.repeat(24),'orion@example.invalid','inbox@example.invalid');
    const body=m.textContent.split('Screenshot: Not included\n\n')[1];
    expect(body).toBe(report.message+'\n');
    expect(m.htmlContent).toContain(report.message);
    expect(JSON.stringify(report)).toBe(before);
    expect(m.subject).toContain(type==='followup'?'[ORION][FOLLOW-UP]':report.subject);
   }
  });
  it(type+' retains distinct subjects and supporting information',()=>{
   const report=validateSubmission({...sample(),type,subject:'A distinct title',message:'The complete report.',severity:type==='problem'?'Annoying':undefined,...(type==='idea'?{usefulness:'Helps explain why this matters.'}:{}),...(type==='followup'?{parentId:'ORN-FB-'+ 'A'.repeat(24),followupToken:'b'.repeat(64)}:{})});
   const m=formatMail(report,'ORN-FB-'+ 'B'.repeat(24),'orion@example.invalid','inbox@example.invalid');
   expect(m.textContent).toContain('\n\nA distinct title\n\nThe complete report.');
   if(type==='idea')expect(m.textContent).toContain('Why this helps:\nHelps explain why this matters.');
   if(type==='followup')expect(m.textContent).toContain('Original Feedback ID: '+report.parentId);
  });
 }
});
