import type { MobileShieldEvidenceV1 } from '@orion/shared/types';
import type { CinemaSourceDescriptor, ProviderRequestManifestV1 } from '@orion/shared/sources';

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

export function createProviderIframeDocument(
  target: string,
  frameOrigins: readonly string[] = ['https://player.videasy.net', 'https://player.videasy.to'],
): string {
  const url = new URL(target);
  if (url.protocol !== 'https:' || url.username || url.password || !frameOrigins.includes(url.origin)
    || !frameOrigins.length || frameOrigins.some((origin) => new URL(origin).origin !== origin || !origin.startsWith('https://'))) {
    throw new Error('An exact HTTPS provider frame origin is required.');
  }
  const framePolicy = escapeHtmlAttribute(frameOrigins.join(' '));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; frame-src ${framePolicy}"><style>html,body,iframe{width:100%;height:100%;margin:0;border:0;background:#000;overflow:hidden}</style></head><body><iframe src="${escapeHtmlAttribute(url.toString())}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="origin"></iframe></body></html>`;
}

export function createProviderWebViewSource(embedUrl: string, source: CinemaSourceDescriptor | undefined) {
  if (!source?.requiresIframeWrapper) return { uri: embedUrl };
  try {
    const target = new URL(embedUrl);
    if (target.protocol !== 'https:' || !source.expectedOrigins.includes(target.origin)) return { uri: 'about:blank' };
    return {
      html: createProviderIframeDocument(target.toString(), source.playerEventContract ? source.expectedOrigins : undefined),
      // Reuse Orion's secure wrapper origin without transferring Orion state.
      baseUrl: 'https://orion.local/player/',
    };
  } catch {
    return { uri: 'about:blank' };
  }
}

export function getProviderShieldManifest(
  sourceId: string,
  source: CinemaSourceDescriptor | undefined,
): ProviderRequestManifestV1 {
  if (source?.requestManifest) return source.requestManifest;
  return {
    schemaVersion: 1,
    sourceId,
    mode: 'observe',
    allowedNavigationOrigins: source?.allowedNavigationOrigins ?? source?.expectedOrigins ?? [],
    requiredOrigins: source?.requiredRequestOrigins ?? source?.expectedOrigins ?? [],
    // Navigation-only wrapper origins never confer media/request authority.
    mediaOrigins: [],
    artworkOrigins: [],
    subtitleOrigins: [],
    popupPolicy: 'block',
    rules: [],
  };
}

export function getProviderCapturePolicy(source: CinemaSourceDescriptor | undefined) {
  return {
    captureEnabled: source != null && (source.supportsDownloads === true
      || ['vidlink', 'vidnest', 'vidsrc-ir', 'cinesrc'].includes(source.id)
      || source.supportsDiagnosticCapture === true),
    diagnosticOnly: source?.supportsDiagnosticCapture === true && source.supportsDownloads !== true,
  };
}
