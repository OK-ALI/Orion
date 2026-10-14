import type { FeedbackDraft } from './feedbackModel';
import { FeedbackText } from './FeedbackControls';
import { OrionContentDialog } from './OrionContentDialog';
import type { generateFeedbackReport } from './feedbackDiagnostics';
export type FeedbackReport=ReturnType<typeof generateFeedbackReport>;
export function FeedbackDiagnosticPreview({report,severity,onClose}:{report:FeedbackReport|null;severity?:FeedbackDraft['severity'];onClose:()=>void}) {return <OrionContentDialog visible={!!report} title="Included information" onClose={onClose}>
  {severity&&<><FeedbackText heading>Severity</FeedbackText><FeedbackText>{severity}</FeedbackText></>}
  <FeedbackText heading>App & device</FeedbackText><FeedbackText>Orion {report?.app.version}{'\n'}{report?.app.device || 'Android device'}{'\n'}Android {report?.app.android || ''}</FeedbackText>
  <FeedbackText heading>Current context</FeedbackText><FeedbackText>{report?.context.area}{'\n'}{report?.context.online?'Online':'Offline'}{'\n'}Performance: {report?.context.profile}{'\n'}Reduced Motion: {report?.context.reducedMotion?'On':'Off'}</FeedbackText>
  {report?.incident&&<><FeedbackText heading>Recent issue</FeedbackText><FeedbackText>{report.incident.area}: {report.incident.code.replaceAll('_',' ').toLowerCase()}{report.incident.provider?`\nProvider: ${report.incident.provider}`:''}</FeedbackText></>}
  <FeedbackText heading>Recent Orion events</FeedbackText><FeedbackText>{report?.events.length || 0} relevant events will be shared.</FeedbackText>
  {report?.previousSession&&<FeedbackText>Includes a small summary from the previous session.</FeedbackText>}
  <FeedbackText>No passwords, authentication tokens, private files, viewing history or precise location are included. Nothing is shared until you choose Send.</FeedbackText>
 </OrionContentDialog>;}
