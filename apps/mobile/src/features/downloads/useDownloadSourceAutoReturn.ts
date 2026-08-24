import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  getMobileDownloadSourceResolutionIntentV1,
  markMobileDownloadSourceAutoReturnIssuedV1,
  selectMobileDownloadCandidateForItemV1,
  subscribeMobileDownloadCandidatesV1,
} from './downloadCandidateCapture';
import { getMobileDownloadPreferencesV1 } from './downloadPreferences';

/**
 * Returns from Player only when a pending download intent has a genuinely
 * ready HLS/DASH candidate. There is no timer-based guess and no Direct
 * fallback. The one-shot marker prevents repeated navigation for one intent.
 */
export function useDownloadSourceAutoReturnV1(itemKey: string): void {
  const router = useRouter();
  const returning = useRef(false);

  useEffect(() => subscribeMobileDownloadCandidatesV1((snapshots) => {
    if (returning.current) return;
    const intent = getMobileDownloadSourceResolutionIntentV1(itemKey);
    if (!intent || intent.autoReturnIssued) return;
    const destination = getMobileDownloadPreferencesV1().defaultDestination;
    const ready = selectMobileDownloadCandidateForItemV1(itemKey, intent.method, snapshots, destination);
    if (!ready || !markMobileDownloadSourceAutoReturnIssuedV1(itemKey)) return;
    returning.current = true;
    router.back();
  }), [itemKey, router]);
}
