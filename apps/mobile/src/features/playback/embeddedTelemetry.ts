import type {
  MobilePlaybackEvidence,
  MobilePlaybackState,
} from '@orion/shared/types';
import type { PlaybackTelemetryInput } from './usePlaybackTelemetryController';

const EVENT_TYPE = 'ORION_PLAYBACK_TELEMETRY';

interface BridgeOptions {
  sessionId: string;
  sourceId: string;
  strategy: string;
  expectedOrigins: string[];
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

export function createEmbeddedTelemetryScript({
  sessionId,
  sourceId,
  strategy,
  expectedOrigins,
}: BridgeOptions): string {
  const config = JSON.stringify({ sessionId, sourceId, strategy, expectedOrigins });
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
          origin: window.location.origin,
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

      function normalizeProviderMessage(event) {
        var hybridFrameMessageSource = config.sourceId === 'vidsrc' || config.sourceId === 'vsembed';
        if (config.strategy !== 'player-event' && !hybridFrameMessageSource) return;
        var extraOrigins = providerMessageOrigins[config.sourceId];
        if (!allowedOrigins.has(event.origin) && !(extraOrigins && extraOrigins.has(event.origin))) return;
        var supportedSources = { vidking: true, vidlink: true, vixsrc: true, vidsrc: true, vsembed: true };
        if (!supportedSources[config.sourceId]) return;

        var value = event.data;
        if (typeof value === 'string' && value.length <= 4096) {
          try { value = JSON.parse(value); } catch (_) { return; }
        }
        if (!value || typeof value !== 'object') return;
        var payload = value.type === 'PLAYER_EVENT' && value.data && typeof value.data === 'object'
          ? value.data
          : null;
        if (!payload) return;

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
                : providerStatus.indexOf('end') >= 0 || providerStatus.indexOf('finish') >= 0
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
              bufferedPosition: payload.bufferedPosition
            });
            return;
          }
        }

        var eventName = String(payload.event || payload.action || payload.type || '').toLowerCase();
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
          bufferedPosition: payload.bufferedPosition
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
          clearInterval(timer);
          window.removeEventListener('message', normalizeProviderMessage, false);
        }
      };
      return true;
    })();
    true;
  `;
}
