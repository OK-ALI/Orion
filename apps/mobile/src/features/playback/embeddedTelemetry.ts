import type {
  MobilePlaybackEvidence,
  MobilePlaybackState,
} from '@orion/shared/types';
import type { PlaybackTelemetryInput } from './usePlaybackTelemetryController';
import { createAniLinkTelemetryAdapterScript } from './aniLinkTelemetry';

const EVENT_TYPE = 'ORION_PLAYBACK_TELEMETRY';

interface BridgeOptions {
  sessionId: string;
  sourceId: string;
  strategy: string;
  expectedOrigins: string[];
  frameOrigin?: string;
  pageContext?: { origin: string; pathname: string; mediaType: string; id: string; season: number | null; episode: number | null; variant?: string; frameUrl?: string };
}

interface ParseContext {
  sessionId: string;
  sourceId: string;
  expectedOrigins: string[];
  lastSequence: number;
}

export interface ParsedEmbeddedTelemetry {
  bridgeSequence: number;
  input: PlaybackTelemetryInput;
}

function finiteOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeState(value: unknown): MobilePlaybackState | null {
  const state = String(value || '').toLowerCase();
  if (['loading', 'playing', 'paused', 'buffering', 'seeking', 'ended', 'error'].includes(state)) {
    return state as MobilePlaybackState;
  }
  return null;
}

export function parseEmbeddedTelemetryMessage(
  raw: unknown,
  context: ParseContext,
): ParsedEmbeddedTelemetry | null {
  let data: any = raw;
  if (typeof data === 'string') {
    if (data.length > 8_192) return null;
    try { data = JSON.parse(data); } catch { return null; }
  }
  if (!data || data.type !== EVENT_TYPE) return null;
  if (data.sessionId !== context.sessionId || data.sourceId !== context.sourceId) return null;
  const bridgeSequence = Number(data.sequence);
  if (!Number.isInteger(bridgeSequence) || bridgeSequence <= context.lastSequence) return null;
  if (typeof data.origin !== 'string' || !context.expectedOrigins.includes(data.origin)) return null;
  const state = normalizeState(data.state);
  if (!state) return null;
  if (!['provider-message', 'provider-video-event'].includes(data.evidence)) return null;
  for (const value of [data.currentTime, data.duration, data.bufferedPosition]) {
    if (value != null && (!Number.isFinite(Number(value)) || Number(value) < 0)) return null;
  }
  const evidence: MobilePlaybackEvidence = data.evidence === 'provider-message'
    ? 'provider-message'
    : 'provider-video-event';
  const observedAt = Number(data.observedAt);
  if (!Number.isFinite(observedAt) || observedAt <= 0 || Math.abs(Date.now() - observedAt) > 15_000) {
    return null;
  }
  return {
    bridgeSequence,
    input: {
      evidence,
      state,
      currentTime: finiteOrNull(data.currentTime),
      duration: finiteOrNull(data.duration),
      bufferedPosition: finiteOrNull(data.bufferedPosition),
      observedAt,
    },
  };
}

export function getEmbeddedTelemetryRejectReason(data: any, context: ParseContext): string {
  const sequence = Number(data.sequence);
  if (data.sessionId !== context.sessionId) return 'session-mismatch';
  if (data.sourceId !== context.sourceId) return 'source-mismatch';
  if (!Number.isInteger(sequence)) return 'invalid-sequence';
  if (sequence <= context.lastSequence) return 'stale-bridge-sequence';
  if (typeof data.origin !== 'string' || !context.expectedOrigins.includes(data.origin)) return 'unexpected-origin';
  if (!normalizeState(data.state)) return 'invalid-state';
  if (!['provider-message', 'provider-video-event'].includes(data.evidence)) return 'invalid-evidence';
  return 'parse-rejected';
}

export function createEmbeddedTelemetryScript({
  sessionId,
  sourceId,
  strategy,
  expectedOrigins,
  frameOrigin,
  pageContext,
}: BridgeOptions): string {
  const config = JSON.stringify({ sessionId, sourceId, strategy, expectedOrigins, frameOrigin, pageContext });
  return `
    (function() {
      var config = ${config};
      var existing = window.__orionPlaybackTelemetry;
      if (existing
        && existing.sessionId === config.sessionId
        && existing.sourceId === config.sourceId) return true;
      if (existing && typeof existing.stop === 'function') {
        try { existing.stop(); } catch (_) {}
      }

      var sequence = 0;
      var attached = new WeakSet();
      var allowedOrigins = new Set(config.expectedOrigins || []);
      var aniLinkStopped = false;
      var providerMessageOrigins = {
        vidsrc: new Set(['https://cloudorchestranova.com']),
        vsembed: new Set(['https://cloudorchestranova.com'])
      };

      function numberOrNull(value) {
        var number = Number(value);
        return Number.isFinite(number) && number >= 0 ? number : null;
      }

      function bufferedPosition(video) {
        try {
          if (!video.buffered || !video.buffered.length) return null;
          return numberOrNull(video.buffered.end(video.buffered.length - 1));
        } catch (_) { return null; }
      }

      function post(payload) {
        if (!window.ReactNativeWebView) return;
        try { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } catch (_) {}
      }

      function send(state, evidence, values) {
        var payload = values || {};
        post({
          type: '${EVENT_TYPE}',
          sessionId: config.sessionId,
          sourceId: config.sourceId,
          sequence: ++sequence,
          origin: typeof payload.observedOrigin === 'string' ? payload.observedOrigin : window.location.origin,
          evidence: evidence,
          state: state,
          currentTime: numberOrNull(payload.currentTime),
          duration: numberOrNull(payload.duration),
          bufferedPosition: numberOrNull(payload.bufferedPosition),
          observedAt: Date.now()
        });
      }

      function stateFor(video, eventName) {
        if (eventName === 'ended' || video.ended) return 'ended';
        if (eventName === 'waiting' || eventName === 'stalled') return 'buffering';
        if (eventName === 'seeking') return 'seeking';
        if (eventName === 'error') return 'error';
        if (video.paused) return 'paused';
        return 'playing';
      }

      function reportVideo(video, eventName) {
        send(stateFor(video, eventName), 'provider-video-event', {
          currentTime: video.currentTime,
          duration: video.duration,
          bufferedPosition: bufferedPosition(video)
        });
      }

      function attach(video) {
        if (!video || attached.has(video)) return;
        attached.add(video);
        ['playing', 'pause', 'waiting', 'stalled', 'seeking', 'seeked', 'ended', 'error', 'durationchange']
          .forEach(function(name) {
            video.addEventListener(name, function() { reportVideo(video, name); }, { passive: true });
          });
        reportVideo(video, 'attached');
      }

      function discoverVideos() {
        if (config.strategy !== 'frame-video') return;
        document.querySelectorAll('video').forEach(attach);
      }

      // VidSrc.ir owns a selected child player even when its relay is top-level.
      // Observe that relationship without changing provider DOM, storage or topology.
      function selectedVidSrcIrOrigin(event, payload) {
        var page = config.pageContext;
        var owner = window.__orionPlaybackTelemetry;
        if (!page || !owner || owner.sessionId !== config.sessionId || owner.sourceId !== config.sourceId
          || window !== window.top || window.location.origin !== page.origin || window.location.pathname !== page.pathname
          || !allowedOrigins.has(page.origin)) return null;
        var frame = document.getElementById('player_iframe');
        if (!frame || frame.tagName !== 'IFRAME' || !frame.isConnected || event.source !== frame.contentWindow
          || document.querySelectorAll('iframe#player_iframe').length !== 1) return null;
        try {
          var frameSource = frame.getAttribute('src');
          if (!frameSource) return null;
          var selected = new URL(frameSource, window.location.href);
          // No arbitrary message origin is trusted: match this provider-owned,
          // currently visible frame, require HTTPS and reject local/IP authorities.
          if (selected.protocol !== 'https:' || selected.username || selected.password || event.origin !== selected.origin
            || !/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/i.test(selected.hostname)
            || /^[0-9.]+$/.test(selected.hostname) || /\\.(local|localhost|internal|invalid|test)$/i.test(selected.hostname)) return null;
          var rect = frame.getBoundingClientRect(), style = window.getComputedStyle(frame);
          if (frame.hidden || rect.width <= 0 || rect.height <= 0 || style.display === 'none'
            || style.visibility === 'hidden' || Number(style.opacity) === 0) return null;
        } catch (_) { return null; }
        var info = payload.player_info;
        if (!info || typeof info !== 'object' || info.mediaType !== page.mediaType) return null;
        var contentId = page.id.indexOf('tt') === 0 ? info.imdb : info.tmdb;
        if (String(contentId) !== page.id || (page.mediaType === 'tv'
          && (Number(info.season) !== page.season || Number(info.episode) !== page.episode))) return null;
        if (typeof payload.player_progress !== 'number' || !Number.isFinite(payload.player_progress)
          || typeof payload.player_duration !== 'number' || !Number.isFinite(payload.player_duration)
          || payload.player_progress < 0 || payload.player_duration <= 0 || payload.player_progress > payload.player_duration
          || !['playing', 'paused', 'seeked', 'completed', 'buffering', 'waiting', 'loading', 'seeking', 'ended', 'error'].includes(payload.player_status)) return null;
        // Attribute only the validated selected-child contract to its trusted
        // top-level provider. This grants no native navigation/request authority.
        return page.origin;
      }

      ${sourceId === 'anilink' ? createAniLinkTelemetryAdapterScript() : ''}
      function normalizeProviderMessage(event) {
        if (config.sourceId === 'anilink') { observeAniLinkMessage(event); return; }
        var supportedSources = {
          videasy: true,
          vidlink: true,
          vidnest: true,
          'vidsrc-ir': true,
          cinesrc: true,
          vixsrc: true,
          vidsrc: true,
          vsembed: true
        };
        if (!supportedSources[config.sourceId]) return;
        if (config.frameOrigin) {
          var frame = document.getElementById('orion-provider-frame');
          if (!frame || event.source !== frame.contentWindow || event.origin !== config.frameOrigin) return;
        }
        var extraOrigins = providerMessageOrigins[config.sourceId];
        if (config.sourceId !== 'vidsrc-ir' && !allowedOrigins.has(event.origin) && !(extraOrigins && extraOrigins.has(event.origin))) return;

        var value = event.data;
        if (typeof value === 'string' && value.length <= 4096) {
          try { value = JSON.parse(value); } catch (_) { return; }
        }
        if (!value || typeof value !== 'object') return;
        var isCineSrcEvent = typeof value.type === 'string' && value.type.indexOf('cinesrc:') === 0;
        var payload = value.type === 'PLAYER_EVENT'
          ? (value.data && typeof value.data === 'object' ? value.data : value)
          : isCineSrcEvent ? value : null;
        if (!payload) return;
        var observedOrigin = event.origin;
        if (config.sourceId === 'vidsrc-ir') {
          if (value.type !== 'PLAYER_EVENT') return;
          observedOrigin = selectedVidSrcIrOrigin(event, payload);
          if (!observedOrigin) return;
        }

        // VidSrc/VsEmbed use provider_progress/provider_duration/provider_status
        // fields inside PLAYER_EVENT. These are physically verified outgoing
        // telemetry only; their incoming continuity capability remains disabled.
        var providerProgress = numberOrNull(payload.player_progress);
        var providerDuration = numberOrNull(payload.player_duration);
        if (providerProgress != null
          && providerDuration != null
          && providerDuration > 0
          && providerProgress <= providerDuration + 5) {
          var providerStatus = String(payload.player_status || '').toLowerCase();
          var providerState = providerStatus.indexOf('pause') >= 0
            ? 'paused'
            : providerStatus.indexOf('buffer') >= 0 || providerStatus.indexOf('wait') >= 0 || providerStatus.indexOf('load') >= 0
              ? 'buffering'
              : providerStatus.indexOf('seek') >= 0
                ? 'seeking'
                : providerStatus.indexOf('end') >= 0 || providerStatus.indexOf('finish') >= 0 || (config.sourceId === 'vidsrc-ir' && providerStatus === 'completed')
                  ? 'ended'
                  : providerStatus.indexOf('error') >= 0
                    ? 'error'
                    : providerStatus.indexOf('play') >= 0
                      ? 'playing'
                      : null;
          if (providerState) {
            send(providerState, 'provider-message', {
              currentTime: providerProgress,
              duration: providerDuration,
              bufferedPosition: payload.bufferedPosition,
              observedOrigin: observedOrigin
            });
            return;
          }
        }

        var eventName = String(payload.event || payload.action || payload.type || '')
          .toLowerCase()
          .replace(/^cinesrc:/, '');
        if (!['play', 'pause', 'seeked', 'ended', 'timeupdate', 'waiting', 'buffering'].includes(eventName)) return;
        var state = eventName === 'waiting' || eventName === 'buffering'
          ? 'buffering'
          : eventName === 'pause'
            ? 'paused'
            : eventName === 'ended'
              ? 'ended'
              : eventName === 'seeked'
                ? 'seeking'
                : 'playing';
        send(state, 'provider-message', {
          currentTime: payload.currentTime != null ? payload.currentTime : payload.time != null ? payload.time : payload.position,
          duration: payload.duration != null ? payload.duration : payload.totalTime != null ? payload.totalTime : payload.length,
          bufferedPosition: payload.bufferedPosition,
          observedOrigin: observedOrigin
        });
      }

      window.addEventListener('message', normalizeProviderMessage, false);
      discoverVideos();
      var timer = setInterval(function() {
        discoverVideos();
        if (config.strategy === 'frame-video') {
          var video = document.querySelector('video');
          if (video) reportVideo(video, 'sample');
        }
      }, 1000);

      window.__orionPlaybackTelemetry = {
        sessionId: config.sessionId,
        sourceId: config.sourceId,
        stop: function() {
          aniLinkStopped = true;
          clearInterval(timer);
          window.removeEventListener('message', normalizeProviderMessage, false);
        }
      };
      return true;
    })();
    true;
  `;
}
