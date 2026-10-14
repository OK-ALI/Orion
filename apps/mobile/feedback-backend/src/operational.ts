// Never accept a request, report, exception, provider body, email or secret here.
const failures = ['REQUEST_CONFIG_FAILED','REQUEST_REDIRECT_FAILED','REQUEST_TIMEOUT','REQUEST_NETWORK_FAILED','REQUEST_UNKNOWN_FAILED','PROVIDER_ATTACHMENT_REJECTED','PROVIDER_AUTH_REJECTED','PROVIDER_SENDER_REJECTED','PROVIDER_REJECTED','PROVIDER_NON_JSON_REJECTED','PROVIDER_BODY_TOO_LARGE','PROVIDER_BODY_UNREADABLE','PROVIDER_ACCOUNT_REJECTED','PROVIDER_INVALID_PARAMETER'] as const;
export type DeliveryCode = typeof failures[number] | 'BUDGET_START' | 'PROVIDER_FETCH' | 'MAIL_FORMAT' | 'PROVIDER_RESPONSE' | 'RECEIPT_SAVE' | 'ACCEPTED' | 'PENDING_RECEIPT';
const codes = new Set<DeliveryCode>([...failures,'BUDGET_START','PROVIDER_FETCH','MAIL_FORMAT','PROVIDER_RESPONSE','RECEIPT_SAVE','ACCEPTED','PENDING_RECEIPT']);
export function deliveryEvent(feedbackId: string, code: DeliveryCode, status?: number) {
  if (!/^ORN-FB-[A-F0-9]{24}$/.test(feedbackId) || !codes.has(code)) return;
  console.log(JSON.stringify({event:'orion-feedback-delivery',feedbackId,code,...(Number.isInteger(status) && status! >= 100 && status! <= 599 ? {status} : {})}));
}

// Inspect exception text only in memory; never emit text, a stack or a name.
export function deliveryFailure(error: unknown): DeliveryCode {
 const name = error instanceof Error ? error.name : '';
 const message = error instanceof Error ? error.message : '';
 if (name === 'TimeoutError' || name === 'AbortError' || /timed? ?out|aborted/i.test(message)) return 'REQUEST_TIMEOUT';
 if (/redirect/i.test(message)) return 'REQUEST_REDIRECT_FAILED';
 if (/invalid.*header|header.*invalid|not a valid.*header|not implemented|not a function/i.test(message)) return 'REQUEST_CONFIG_FAILED';
 if (/network|dns|tls|ssl|connection|fetch failed/i.test(message)) return 'REQUEST_NETWORK_FAILED';
 return 'REQUEST_UNKNOWN_FAILED';
}

export function providerRejection(body: string, status: number): DeliveryCode {
 let message='',code='';try { const value=JSON.parse(body); if(typeof value.message==='string')message=value.message; if(typeof value.code==='string')code=value.code; } catch {return 'PROVIDER_NON_JSON_REJECTED';}
 if (/attachment|extension|\.json|file.*format/i.test(message)) return 'PROVIDER_ATTACHMENT_REJECTED';
 if (status === 401 || status === 403 || code==='unauthorized' || /api.?key|key not found/i.test(message)) return 'PROVIDER_AUTH_REJECTED';
 if (/sender|verified/i.test(message)) return 'PROVIDER_SENDER_REJECTED';
 if (/smtp|activat|account|permission/i.test(message) || code==='permission_denied') return 'PROVIDER_ACCOUNT_REJECTED';
 if (code==='invalid_parameter'||code==='missing_parameter')return 'PROVIDER_INVALID_PARAMETER';
 return 'PROVIDER_REJECTED';
}
