import type { MobileShieldEvidenceV1, MobilePlayerPresentation } from '@orion/shared/types';
import type { CinemaSourceDescriptor, ProviderRequestManifestV1 } from '@orion/shared/sources';
import { getSourceResumeParams } from '@orion/shared/sources';
import type { PlaybackTargetObservation } from './playerTypes';
import type { PlaybackTelemetryInput } from './usePlaybackTelemetryController';
import { createCineSrcResumeScript, createVerifiedResumeScript } from './mobileAdBlocker';
import { HANDOFF_POSITION_TOLERANCE_SECONDS, HANDOFF_SNAPSHOT_MAX_AGE_MS, HANDOFF_LATE_CONFIRMATION_WINDOW_MS } from './handoffPolicy';

/** CineSrc's documented command seek owns the Mobile target; Desktop stays unchanged. */
export function getMobileEmbedResumeParams(sourceId: string, time: number, type: 'movie' | 'tv') {
  return sourceId === 'cinesrc' ? {} : getSourceResumeParams(sourceId, time, type);
}

export function createProviderResumeScript(sourceId: string, time: number, attemptId: string) {
  return sourceId === 'cinesrc' ? createCineSrcResumeScript(time, attemptId) : createVerifiedResumeScript(time, attemptId);
}

export function retainPlaybackTargetObservation(previous: PlaybackTargetObservation | null, attemptId: string | null | undefined,
  sessionId: string, sourceId: string, target: number, input: PlaybackTelemetryInput): PlaybackTargetObservation | null {
  if (!attemptId) return null;
  const sameAttempt = previous?.attemptId === attemptId && previous.sessionId === sessionId;
  if (sameAttempt && input.observedAt != null && input.observedAt - previous.observedAt <= HANDOFF_LATE_CONFIRMATION_WINDOW_MS) return previous;
  if (!['playing', 'seeking', 'paused'].includes(input.state) || input.currentTime == null || input.observedAt == null
    || !Number.isFinite(input.currentTime) || !Number.isFinite(input.observedAt) || Date.now() - input.observedAt > HANDOFF_SNAPSHOT_MAX_AGE_MS
    || input.observedAt > Date.now() + 1000 || Math.abs(input.currentTime - target) > HANDOFF_POSITION_TOLERANCE_SECONDS) return sameAttempt ? previous : null;
  return { attemptId, sessionId, sourceId, currentTime: input.currentTime, observedAt: input.observedAt };
}

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

export function createProviderWebViewSource(source: CinemaSourceDescriptor | undefined, url: string) {
  if (!source?.requiresIframeWrapper) return { uri: url };
  try {
    const target = new URL(url);
    if (target.protocol !== 'https:' || !source.expectedOrigins.includes(target.origin)) return { uri: 'about:blank' };
    return { html: createProviderIframeDocument(target.toString()), baseUrl: 'https://orion.local/player/' };
  } catch { return { uri: 'about:blank' }; }
}

/** Preserves the legacy fallback while keeping the player surface below its ceiling. */
export function getProviderShieldManifest(sourceId: string, source?: CinemaSourceDescriptor): ProviderRequestManifestV1 {
  return source?.requestManifest || { schemaVersion: 1, sourceId, mode: 'observe',
    allowedNavigationOrigins: source?.expectedOrigins || [], requiredOrigins: source?.expectedOrigins || [],
    mediaOrigins: [], artworkOrigins: [], subtitleOrigins: [], popupPolicy: 'block', rules: [] };
}

/** Anime testing may not silently navigate to another episode or requested variant. */
export function isSelectedAnimeNavigation(requestedUrl: string, selectedUrl: string): boolean {
  try {
    const requested = new URL(requestedUrl);
    const selected = new URL(selectedUrl);
    return requested.protocol === 'https:' && !requested.username && !requested.password
      && requested.origin === selected.origin && requested.pathname === selected.pathname
      && requested.searchParams.get('lang') === selected.searchParams.get('lang');
  } catch { return false; }
}

export function hasProviderPlaybackSource(url: string): boolean {
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password; }
  catch { return false; }
}

export function getEmbeddedPresentationStyle(presentation: MobilePlayerPresentation, width: number, height: number) {
  const screenWiderThanVideo = width / Math.max(1, height) > 16 / 9;
  return presentation === 'provider'
    ? { width: '100%' as const, height: '100%' as const, flex: 0, alignSelf: 'stretch' as const }
    : presentation === 'fit'
      ? (screenWiderThanVideo ? { height: '100%' as const, aspectRatio: 16 / 9, alignSelf: 'center' as const, flex: 0 } : { width: '100%' as const, aspectRatio: 16 / 9, alignSelf: 'center' as const, flex: 0 })
      : presentation === 'fill'
        ? (screenWiderThanVideo ? { width: '100%' as const, aspectRatio: 16 / 9, alignSelf: 'center' as const, flex: 0 } : { height: '100%' as const, aspectRatio: 16 / 9, alignSelf: 'center' as const, flex: 0 })
        : undefined;
}
