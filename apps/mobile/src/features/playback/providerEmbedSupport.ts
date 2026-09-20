import type { MobileShieldEvidenceV1 } from '@orion/shared/types';

export const EMPTY_SHIELD_EVIDENCE: MobileShieldEvidenceV1 = {
  nativeSessionObserved: false,
  blockedRequests: 0,
  blockedPopups: 0,
  blockedNavigations: 0,
  blockedAdvertisements: 0,
  blockedTrackers: 0,
  allowedPlaybackDependencies: 0,
  observedMediaRequests: 0,
  observedSubtitleRequests: 0,
  lastRuleId: null,
};

export const QUIET_CURRENT_SURFACE_SCRIPT = `
  (() => {
    document.querySelectorAll('video, audio').forEach((media) => {
      try { media.muted = true; media.pause(); } catch (_) {}
    });
    true;
  })();
`;

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function createProviderIframeDocument(target: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; frame-src https://player.videasy.net https://player.videasy.to"><style>html,body,iframe{width:100%;height:100%;margin:0;border:0;background:#000;overflow:hidden}</style></head><body><iframe src="${escapeHtmlAttribute(target)}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="origin"></iframe></body></html>`;
}