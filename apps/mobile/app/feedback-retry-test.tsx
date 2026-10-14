import { useEffect } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { GLIMPSE_INTERNAL_PREVIEW } from '../src/features/glimpse/glimpseBuild';
import { armFeedbackAckLoss } from '../src/features/feedback/feedbackQualification';
export default function FeedbackReceiptQualificationRoute() {
  const { request } = useLocalSearchParams<{ request?: string }>();
  const router = useRouter();
  const valid = typeof request === 'string' && /^[a-z0-9-]{1,64}$/.test(request);
  useEffect(() => {
    if (GLIMPSE_INTERNAL_PREVIEW && valid) { armFeedbackAckLoss(request); router.replace('/feedback'); }
  }, [request, valid, router]);
  return GLIMPSE_INTERNAL_PREVIEW && valid ? null : <Redirect href="/" />;
}
