import type { MobilePlaybackEvidence } from '@orion/shared/types';

const VERIFIED_EVIDENCE = new Set<MobilePlaybackEvidence>([
  'native-video-event',
  'provider-video-event',
  'provider-message',
]);

export function canPersistVerifiedPlayback(
  evidence: MobilePlaybackEvidence | null | undefined,
  sessionId: string | null | undefined,
): boolean {
  return Boolean(evidence && VERIFIED_EVIDENCE.has(evidence) && sessionId?.trim());
}
