import { DurableObject } from 'cloudflare:workers';
import { readBounded, validateSubmission, type Submission } from './validation';
import { formatMail } from './mail';
import { deliveryEvent, deliveryFailure, providerRejection } from './operational';
const json = (body: object, status = 200) => Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
async function mac(secret: string, value: string) { const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']); return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value))); }
async function validToken(secret: string, id: string, token: string) { const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']); return crypto.subtle.verify('HMAC',key,Uint8Array.from(token.match(/../g)!,s=>parseInt(s,16)),new TextEncoder().encode('followup:'+id)); }
// This object coordinates only the daily mail budget, not request bodies or mail I/O.
export class FeedbackBudget extends DurableObject<Env> {
  async reserve(client: string) {
    const sql = this.ctx.storage.sql; sql.exec('CREATE TABLE IF NOT EXISTS counters (key TEXT PRIMARY KEY, count INTEGER NOT NULL)');
    const day = Math.floor(Date.now()/86_400_000); sql.exec('DELETE FROM counters WHERE key NOT LIKE ?',`${day}:%`);
    const keys = [`${day}:all`,`${day}:${client}`];
    const counts = keys.map(key => sql.exec<{count:number}>('SELECT count FROM counters WHERE key=?',key).toArray()[0]?.count || 0);
    const limit = Math.min(250,Math.max(1,Number(this.env.DAILY_MAIL_LIMIT)||100));
    if (counts[0] >= limit || counts[1] >= 5) return null;
    for (const key of keys) sql.exec('INSERT INTO counters VALUES (?,1) ON CONFLICT(key) DO UPDATE SET count=count+1',key);
    await this.ctx.storage.setAlarm(Date.now()+86_400_000); return day;
  }
  async releaseRejected(day: number, client: string) {
    // Return only the original reservation's day; never debit another day's mail.
    if (!Number.isInteger(day) || !/^[a-f0-9]{64}$/.test(client)) return;
    for (const key of [`${day}:all`,`${day}:${client}`]) this.ctx.storage.sql.exec('UPDATE counters SET count=MAX(0,count-1) WHERE key=?',key);
  }
  async alarm() { await this.ctx.storage.deleteAll(); }
}
export class FeedbackReceipt extends DurableObject<Env> {
  async submit(payload: string, client: string): Promise<{status:number; body:{error?:string;feedbackId?:string;followupToken?:string;accepted?:boolean}}> {
    const report = validateSubmission(JSON.parse(payload));
    const sql = this.ctx.storage.sql; sql.exec('CREATE TABLE IF NOT EXISTS receipt (id TEXT, hash TEXT, state TEXT, at INTEGER)');
    const digest = hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(report))));
    const rows = sql.exec<{id:string;hash:string;state:string}>('SELECT * FROM receipt').toArray();
    if (rows.length) {
      if (rows[0].hash !== digest) return {status:409,body:{error:'changed_report'}};
      if (rows[0].state === 'sent') return this.success(rows[0].id);
      deliveryEvent(rows[0].id,'PENDING_RECEIPT'); return {status:409,body:{error:'confirmation_pending'}};
    }
    // Establish ownership synchronously before external I/O. Other calls now see pending.
    const id = 'ORN-FB-'+crypto.randomUUID().replaceAll('-','').slice(0,24).toUpperCase();
    sql.exec('INSERT INTO receipt VALUES (?,?,?,?)',id,digest,'pending',Date.now());
    await this.ctx.storage.setAlarm(Date.now()+7*86_400_000);
    deliveryEvent(id,'BUDGET_START');
    const budget = this.env.BUDGET.getByName('daily-mail-budget');
    const reservation = await budget.reserve(client);
    if (reservation === null) { sql.exec('DELETE FROM receipt'); return {status:429,body:{error:'rate_limited'}}; }
    let stage: 'MAIL_FORMAT' | 'PROVIDER_FETCH' | 'PROVIDER_RESPONSE' | 'RECEIPT_SAVE' = 'MAIL_FORMAT';
    try {
      const body = JSON.stringify(formatMail(report,id,this.env.BREVO_SENDER_EMAIL,this.env.FEEDBACK_RECIPIENT,this.env.BREVO_SENDER_NAME));
      stage = 'PROVIDER_FETCH'; deliveryEvent(id,stage);
      const response = await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',redirect:'manual',headers:{'api-key':this.env.BREVO_API_KEY,'Content-Type':'application/json','Accept':'application/json'},body,signal:AbortSignal.timeout(15_000)});
      stage = 'PROVIDER_RESPONSE'; deliveryEvent(id,stage,response.status);
      // A definite validation/auth rejection is safe to retry after correction. Unknown
      // network/provider outcomes retain pending and are never silently sent again.
      if (!response.ok) { let rejected=''; try { rejected=await readBounded(response,4096); } catch (error) { deliveryEvent(id,error instanceof Error && error.message==='TOO_LARGE'?'PROVIDER_BODY_TOO_LARGE':'PROVIDER_BODY_UNREADABLE',response.status); } deliveryEvent(id,providerRejection(rejected,response.status),response.status); if ([400,401,403,404,422,429].includes(response.status)) { await budget.releaseRejected(reservation,client); sql.exec('DELETE FROM receipt'); } return {status:503,body:{error:'send_unconfirmed'}}; }
      const accepted = JSON.parse(await readBounded(response,4096));
      if (typeof accepted.messageId !== 'string' || !accepted.messageId) return {status:503,body:{error:'send_unconfirmed'}};
      stage = 'RECEIPT_SAVE'; sql.exec("UPDATE receipt SET state='sent'"); deliveryEvent(id,'ACCEPTED'); return this.success(id);
    } catch (error) { deliveryEvent(id,deliveryFailure(error)); return {status:503,body:{error:'send_unconfirmed'}}; }
  }
  private async success(id:string) { return {status:200,body:{feedbackId:id,followupToken:await mac(this.env.FEEDBACK_HMAC_SECRET,'followup:'+id),accepted:true}}; }
  async alarm() { await this.ctx.storage.deleteAll(); }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const path = new URL(request.url).pathname;
      if (path !== '/v1/feedback') return json({error:'not_found'},404);
      if (request.method !== 'POST') return json({error:'method_not_allowed'},405);
      if (!env.BREVO_API_KEY || !env.FEEDBACK_HMAC_SECRET || !env.BREVO_SENDER_EMAIL || !env.FEEDBACK_RECIPIENT) return json({error:'unavailable'},503);
      if (!request.headers.get('content-type')?.startsWith('application/json')) return json({error:'invalid'},415);
      if (Number(request.headers.get('content-length')) > 1_100_000) return json({error:'too_large'},413);
      const ip = await mac(env.FEEDBACK_HMAC_SECRET,'ip:'+(request.headers.get('cf-connecting-ip') || 'unknown'));
      if (!(await env.IP_LIMIT.limit({key:ip})).success) return json({error:'rate_limited'},429);
      let report: Submission;
      try { report = validateSubmission(JSON.parse(await readBounded(request))); } catch (error) { return json({error:error instanceof Error && error.message === 'EXPIRED' ? 'expired' : 'invalid'},400); }
      if (report.type === 'followup' && !await validToken(env.FEEDBACK_HMAC_SECRET,report.parentId!,report.followupToken!)) return json({error:'invalid_reference'},403);
      const receipt = await mac(env.FEEDBACK_HMAC_SECRET,report.clientId+':'+report.requestId);
      const result = await env.RECEIPTS.getByName(receipt).submit(JSON.stringify(report),ip);
      return json(result.body,result.status);
    } catch { return json({error:'unavailable'},503); }
  }
} satisfies ExportedHandler<Env>;
