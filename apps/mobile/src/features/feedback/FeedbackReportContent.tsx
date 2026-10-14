import { FeedbackText } from './FeedbackControls';
import { feedbackContentTitle, type FeedbackRecord } from './feedbackModel';

export function FeedbackReportContent(report: Pick<FeedbackRecord, 'subject' | 'message'>) {
  const title = feedbackContentTitle(report);
  return <>{title && <FeedbackText heading>{title}</FeedbackText>}<FeedbackText>{report.message}</FeedbackText></>;
}
