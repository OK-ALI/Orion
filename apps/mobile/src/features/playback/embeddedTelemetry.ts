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
      if (window.__orionPlaybackTelemetry) return true;
      var config = ${config};
      var sequence = 0;
      var attached = new WeakSet();
      var allowedOrigins = new Set(config.expectedOrigins || []);
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
      function send(state, evidence, values) {
        if (!window.ReactNativeWebView) return;
        var payload = values || {};
        window.ReactNativeWebView.postMessage(JSON.stringify({
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
        }));
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
          .forEach(function(name) { video.addEventListener(name, function() { reportVideo(video, name); }, { passive: true }); });
        reportVideo(video, 'attached');
      }
      function discoverVideos() {
        if (config.strategy !== 'frame-video') return;
        document.querySelectorAll('video').forEach(attach);
      }
      function normalizeProviderMessage(event) {
        if (config.strategy !== 'player-event' || !allowedOrigins.has(event.origin)) return;
        var value = event.data;
        if (typeof value === 'string' && value.length <= 4096) {
          try { value = JSON.parse(value); } catch (_) { return; }
        }
        if (!value || typeof value !== 'object') return;
        var payload = value.type === 'PLAYER_EVENT' && value.data && typeof value.data === 'object'
          ? value.data
          : value.type === 'PLAYER_EVENT' ? value : null;
        if (!payload) return;
        var eventName = String(payload.event || payload.action || payload.type || '').toLowerCase();
        var state = payload.buffering || eventName === 'waiting' || eventName === 'buffering'
          ? 'buffering'
          : payload.paused === true || eventName === 'pause'
            ? 'paused'
            : eventName === 'ended' ? 'ended'
              : eventName === 'seeking' ? 'seeking'
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
      window.__orionPlaybackTelemetry = { stop: function() { clearInterval(timer); } };
      return true;
    })();
    true;
  `;
}
