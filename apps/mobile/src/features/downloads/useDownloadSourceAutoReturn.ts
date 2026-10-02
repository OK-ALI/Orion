import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import type { MobileDownloadMediaIdentityV1 } from '@orion/shared/types';
import { listMobileDownloadJobsV1 } from './downloadRepository';
import { mobileDownloadItemKeyFromMediaV1 } from './downloadIdentity';
import {
  cancelMobileDownloadSourceResolutionV1,
  failMobileDownloadSourceResolutionV1,
  getMobileDownloadSourceResolutionIntentV1,
  markMobileDownloadSourceAutoReturnIssuedV1,
  requestMobileDownloadSourceResolutionV1,
  selectMobileDownloadCandidateForItemV1,
  subscribeMobileDownloadCandidatesV1,
} from './downloadCandidateCapture';
import { retryNativeDownloadJobV1 } from './nativeDownloadEngine';

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
    const recovery = intent.recovery;
    if (recovery && (recovery.sourceId !== sourceId ||
      String(recovery.media.id) !== String(media.id) || recovery.media.mediaType !== media.mediaType ||
      recovery.media.libraryKind !== media.libraryKind || recovery.media.season !== media.season ||
      recovery.media.episode !== media.episode)) return;
    const job = recovery && listMobileDownloadJobsV1().find((entry) => entry.jobId === recovery.jobId);
    if (recovery && (!job || job.candidateId !== recovery.candidateId || job.sourceId !== recovery.sourceId ||
      job.transferKind !== recovery.transferKind || mobileDownloadItemKeyFromMediaV1(job.media) !== itemKey ||
      (job.state !== 'action-required' && job.state !== 'expired'))) return;
    const ready = selectMobileDownloadCandidateForItemV1(itemKey, intent.method, snapshots, recovery?.destination || 'orion-library', intent.sourceId);
    if (recovery && (!ready || ready.candidate.candidateId === recovery.candidateId ||
      ready.candidate.sourceId !== recovery.sourceId || ready.candidate.preflight.resolvedManifestKind !== recovery.transferKind ||
      ready.candidate.preflight.state !== 'ready' || !ready.candidate.preflight.requestContextReady ||
      ready.candidate.preflight.reachability !== 'reachable' || ready.candidate.preflight.protection !== 'clear' ||
      ready.candidate.preflight.expiry === 'expired' || !ready.candidate.playbackSessionId || !ready.candidate.requestContextId ||
      String(ready.candidate.media.id) !== String(recovery.media.id) ||
      ready.candidate.media.mediaType !== recovery.media.mediaType ||
      ready.candidate.media.libraryKind !== recovery.media.libraryKind ||
      ready.candidate.media.season !== recovery.media.season || ready.candidate.media.episode !== recovery.media.episode)) return;
    if (!ready || !markMobileDownloadSourceAutoReturnIssuedV1(itemKey)) return;
    returning.current = true;
    if (!recovery) { router.back(); return; }
    void retryNativeDownloadJobV1(recovery.jobId).then(
      () => router.back(),
      (error: unknown) => {
        failMobileDownloadSourceResolutionV1(itemKey, error instanceof Error ? error.message : 'Orion could not safely restart this download.');
        router.back();
      },
    );
  }), [itemKey, media, router, sourceId]);

  useEffect(() => () => {
    if (!returning.current && getMobileDownloadSourceResolutionIntentV1(itemKey)?.recovery) {
      cancelMobileDownloadSourceResolutionV1(itemKey);
    }
  }, [itemKey]);
}
