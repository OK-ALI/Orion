import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import type { MobileDownloadMediaIdentityV1 } from '@orion/shared/types';
import { listMobileDownloadJobsV1 } from './downloadRepository';
import { mobileDownloadItemKeyFromMediaV1 } from './downloadIdentity';
import {
  getMobileDownloadSourceResolutionIntentV1,
  markMobileDownloadSourceAutoReturnIssuedV1,
  requestMobileDownloadSourceResolutionV1,
  selectMobileDownloadCandidateForItemV1,
  subscribeMobileDownloadCandidatesV1,
} from './downloadCandidateCapture';

/**
 * Returns from Player only when a pending download intent has a genuinely
 * ready supported candidate. There is no timer-based provider guess or
 * source switching. The one-shot marker prevents repeated navigation for one intent.
 */
export function useDownloadSourceAutoReturnV1(itemKey: string, sourceId: string, media: MobileDownloadMediaIdentityV1): void {
  const router = useRouter();
  const returning = useRef(false);

  useEffect(() => {
    if (getMobileDownloadSourceResolutionIntentV1(itemKey)) return;
    const refreshJob = listMobileDownloadJobsV1().find((job) => (
      (job.state === 'action-required' || job.state === 'expired') &&
      (job.failure?.code === 'request-context-refresh-required' || job.failure?.code === 'request-context-rejected' || job.state === 'expired') &&
      job.sourceId === sourceId && mobileDownloadItemKeyFromMediaV1(job.media) === itemKey &&
      String(job.media.id) === String(media.id) && job.media.mediaType === media.mediaType &&
      job.media.libraryKind === media.libraryKind &&
      job.media.season === media.season && job.media.episode === media.episode
    ));
    if (refreshJob && (refreshJob.transferKind === 'hls' || refreshJob.transferKind === 'dash')) {
      requestMobileDownloadSourceResolutionV1(itemKey, 'fragments', sourceId);
    }
  }, [itemKey, media, sourceId]);

  useEffect(() => subscribeMobileDownloadCandidatesV1((snapshots) => {
    if (returning.current) return;
    const intent = getMobileDownloadSourceResolutionIntentV1(itemKey);
    if (!intent || intent.autoReturnIssued) return;
    const ready = selectMobileDownloadCandidateForItemV1(itemKey, intent.method, snapshots, 'orion-library', intent.sourceId);
    if (!ready || !markMobileDownloadSourceAutoReturnIssuedV1(itemKey)) return;
    returning.current = true;
    router.back();
  }), [itemKey, router]);
}
