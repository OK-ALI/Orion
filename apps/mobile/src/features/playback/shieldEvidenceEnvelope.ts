import type { MobileShieldEvidenceV1 } from '@orion/shared/types';

export interface ParsedShieldEvidenceEnvelope {
  decision: string;
  nativeEvidenceSeen: boolean;
  blockedCount: number;
  dependencyCount: number;
  popupCount: number;
  navigationCount: number;
  advertisementCount: number;
  trackerCount: number;
  mediaCount: number;
  subtitleCount: number;
  safeRuleId: string | null;
}

export function parseShieldEvidenceEnvelope(envelope: any): ParsedShieldEvidenceEnvelope | null {
  if (envelope?.kind !== 'orion-shield') return null;
  const counts = envelope?.counts && typeof envelope.counts === 'object' ? envelope.counts : {};
  const classifications = envelope?.classifications && typeof envelope.classifications === 'object'
    ? envelope.classifications : {};
  const decision = String(envelope.decision || 'unknown');
  const blockedCount = Object.entries(counts)
    .filter(([key]) => key === 'blocked' || key.startsWith('blocked-'))
    .reduce((total, [, value]) => total + Math.max(0, Number(value) || 0), 0);
  const nativeSessionCount = Math.max(0, Number(counts.active) || 0);
  return {
    decision,
    nativeEvidenceSeen: nativeSessionCount > 0 || decision === 'active',
    blockedCount,
    dependencyCount: Math.max(0, Number(counts['required-dependency']) || 0),
    popupCount: Math.max(0, Number(classifications.popup) || 0),
    navigationCount: Math.max(0, Number(classifications['unsafe-navigation']) || 0),
    advertisementCount: Math.max(0, Number(classifications.advertisement) || 0),
    trackerCount: Math.max(0, Number(classifications.tracker) || 0),
    mediaCount: Math.max(0, Number(counts['observed-media']) || 0),
    subtitleCount: Math.max(0, Number(counts['observed-subtitle']) || 0),
    safeRuleId: typeof envelope.ruleId === 'string'
      ? envelope.ruleId.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 64) || null
      : null,
  };
}

export function mergeShieldEvidence(
  current: MobileShieldEvidenceV1,
  parsed: ParsedShieldEvidenceEnvelope,
): MobileShieldEvidenceV1 {
  return {
    nativeSessionObserved: current.nativeSessionObserved || parsed.nativeEvidenceSeen,
    blockedRequests: current.blockedRequests + parsed.blockedCount,
    blockedPopups: current.blockedPopups + parsed.popupCount,
    blockedNavigations: current.blockedNavigations + parsed.navigationCount,
    blockedAdvertisements: current.blockedAdvertisements + parsed.advertisementCount,
    blockedTrackers: current.blockedTrackers + parsed.trackerCount,
    allowedPlaybackDependencies: current.allowedPlaybackDependencies + parsed.dependencyCount,
    observedMediaRequests: current.observedMediaRequests + parsed.mediaCount,
    observedSubtitleRequests: current.observedSubtitleRequests + parsed.subtitleCount,
    lastRuleId: parsed.safeRuleId || current.lastRuleId,
  };
}
