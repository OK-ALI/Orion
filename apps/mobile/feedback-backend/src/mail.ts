import { diagnosticsAttachment } from './diagnosticsAttachment';
import type { Submission } from './validation';
const escape = (v: string) => v.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function formatMail(report: Submission, id: string, sender: string, recipient: string, senderName = 'Orion Feedback') {
  const kind = report.type === 'problem' ? 'BUG' : report.type === 'idea' ? 'FEATURE' : report.type === 'followup' ? 'FOLLOW-UP' : 'FEEDBACK';
  const subject = report.type === 'followup' ? `[ORION][FOLLOW-UP][${report.parentId}]` : `[ORION][${kind}]${report.type==='general'?'':`[${report.area.toUpperCase()}]`} ${report.subject}`;
  // The mail subject already carries the generated summary. Render the full report once.
  const normalized = (text: string) => text.trim().replace(/\s+/g, ' ');
  const summary = normalized(report.message).slice(0, 120).trim();
  const bodyTitle = normalized(report.subject) === summary ? '' : report.subject + '\n\n';
  const textContent = `Orion Feedback ID: ${id}\nType: ${kind}\nArea: ${report.area}\nSeverity: ${report.severity || 'Not applicable'}\n${report.parentId ? `Original Feedback ID: ${report.parentId}\n` : ''}Orion: ${report.version}\nPlatform: ${report.platform}\nReply email: ${report.replyEmail || 'Not supplied'}\nDiagnostics: ${report.diagnostics ? 'Attached' : 'Not included'}\nScreenshot: ${report.screenshot ? 'Attached' : 'Not included'}\n\n${bodyTitle}${report.message}${report.usefulness ? `\n\nWhy this helps:\n${report.usefulness}` : ''}\n${report.diagnostics ? `\nTechnical summary:\n${JSON.stringify(report.diagnostics,null,2)}` : ''}`;
  const attachment: {name:string;content:string}[] = [];
  if (report.diagnostics) attachment.push(diagnosticsAttachment(JSON.stringify(report.diagnostics,null,2)));
  if (report.screenshot) attachment.push({name:'screenshot.jpg',content:report.screenshot});
  return {sender:{name:senderName,email:sender},to:[{email:recipient}],subject,textContent,htmlContent:`<div style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escape(textContent)}</div>`,...(report.replyEmail?{replyTo:{email:report.replyEmail}}:{}),...(attachment.length?{attachment}:{})};
}
