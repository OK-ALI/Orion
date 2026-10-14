export const MAX_BODY = 1_100_000;
export const AREAS = ['Home','Glimpse','Discovery','Search','Movies','TV','Anime','Media Details','Player','Downloads','Library','Orion Connect','Account','Settings','Update','Other'] as const;
export interface Submission {
  schema: 1; submittedAt: number; requestId: string; clientId: string; type: 'problem' | 'idea' | 'general' | 'followup';
  area: string; subject: string; message: string; usefulness?: string; severity?: string; replyEmail?: string;
  version: string; platform: string; parentId?: string; followupToken?: string;
  screenshot?: string; diagnostics?: Record<string, unknown>;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number, required = false) => {
  if (v === undefined && !required) return undefined;
  if (typeof v !== 'string' || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v) || (required && !v.trim())) throw new Error('INVALID');
  return v.trim();
};
// Diagnostics are an allowlisted technical contract, never arbitrary logs or JSON.
const fields = new Set(['schema','capturedAt','app','context','incident','previousSession','events','version','versionCode','platform','device','android','profile','reducedMotion','area','online','code','event','at','id','provider','state','surface','health','handoff','strategy','mediaId','mediaType','sourceType','videoKey','owned','phase','retryCount','anilistId','season','episode','variant','stage']);
const technicalValues = /^[a-zA-Z0-9 .:_()/-]{0,120}$/;
export function safeDiagnostics(value: unknown, depth = 0): unknown {
  if (depth > 6) throw new Error('INVALID');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 1e15) return value;
  if (typeof value === 'string' && technicalValues.test(value) && !/https?:|bearer|password|token|secret|cookie|authorization|api.?key|@/i.test(value)) return value;
  if (Array.isArray(value) && value.length <= 160) return value.map(v => safeDiagnostics(v, depth + 1));
  if (object(value) && Object.keys(value).length <= 30) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) { if (!fields.has(key)) throw new Error('INVALID'); out[key] = safeDiagnostics(item, depth + 1); }
    return out;
  }
  throw new Error('INVALID');
}
export function validateSubmission(value: unknown): Submission {
  if (!object(value) || value.schema !== 1) throw new Error('INVALID');
  const keys = ['submittedAt','schema','requestId','clientId','type','area','subject','message','usefulness','severity','replyEmail','version','platform','parentId','followupToken','screenshot','diagnostics'];
  if (Object.keys(value).some(key => !keys.includes(key))) throw new Error('INVALID');
  if (!['problem','idea','general','followup'].includes(String(value.type))) throw new Error('INVALID');
  if (!AREAS.includes(value.area as typeof AREAS[number])) throw new Error('INVALID');
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  if (!uuid.test(String(value.requestId)) || !uuid.test(String(value.clientId))) throw new Error('INVALID');
  if (!Number.isSafeInteger(value.submittedAt) || Number(value.submittedAt) > Date.now() + 300_000) throw new Error('INVALID');
  if (Number(value.submittedAt) < Date.now() - 6*86_400_000) throw new Error('EXPIRED');
  const result: Submission = {schema:1,submittedAt:Number(value.submittedAt),requestId:String(value.requestId),clientId:String(value.clientId),type:value.type as Submission['type'],area:String(value.area),subject:text(value.subject,120,true)!,message:text(value.message,6000,true)!,version:text(value.version,32,true)!,platform:text(value.platform,20,true)!};
  if (!/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(result.version) || !['android','ios','web'].includes(result.platform) || /[\r\n]/.test(result.subject)) throw new Error('INVALID');
  if (value.severity !== undefined) { if (result.type !== 'problem' || !['Minor','Annoying','Blocking'].includes(String(value.severity))) throw new Error('INVALID'); result.severity = String(value.severity); }
  if (result.type === 'problem' && !result.severity) throw new Error('INVALID');
  if (value.usefulness !== undefined) result.usefulness = text(value.usefulness,3000);
  if (value.replyEmail) { result.replyEmail = text(value.replyEmail,254); if (!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(result.replyEmail!)) throw new Error('INVALID'); }
  if (result.type === 'followup') {
    if (!/^ORN-FB-[A-F0-9]{24}$/.test(String(value.parentId)) || !/^[a-f0-9]{64}$/.test(String(value.followupToken))) throw new Error('INVALID');
    result.parentId = String(value.parentId); result.followupToken = String(value.followupToken);
  } else if (value.parentId || value.followupToken) throw new Error('INVALID');
  if (value.screenshot !== undefined) {
    if (typeof value.screenshot !== 'string' || value.screenshot.length > 960_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.screenshot) || value.screenshot.length % 4) throw new Error('INVALID');
    const bytes = Uint8Array.from(atob(value.screenshot), c => c.charCodeAt(0));
    if (bytes.length > 720_000 || bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new Error('INVALID');
    result.screenshot = value.screenshot;
  }
  if (value.diagnostics !== undefined) {
    if (result.type !== 'problem' || JSON.stringify(value.diagnostics).length > 48_000 || !object(value.diagnostics) || value.diagnostics.schema !== 1) throw new Error('INVALID');
    result.diagnostics = safeDiagnostics(value.diagnostics) as Record<string, unknown>;
  }
  return result;
}
export async function readBounded(request: Request | Response, limit = MAX_BODY): Promise<string> {
  const reader = request.body?.getReader(); if (!reader) throw new Error('INVALID');
  const chunks: Uint8Array[] = []; let total = 0;
  try { while (true) { const {done,value} = await reader.read(); if (done) break; total += value.byteLength; if (total > limit) throw new Error('TOO_LARGE'); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); }
  const joined = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { joined.set(chunk,offset); offset += chunk.length; }
  return new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(joined);
}
