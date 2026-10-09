/** Static WebView script: no native-engine function serialization or new telemetry owner. */
export function createAniLinkTelemetryAdapterScript(): string {
  return `
  var aniLinkDiagnostics = { rows: 0, counts: {}, events: {}, firstEvent: null, firstReason: null, last: null }, aniLinkRejection = 'payload';
  function rejectAniLinkEvent(reason) { aniLinkRejection = reason; return null; }
  function recordAniLinkDiagnostic(reason, event) {
    if (aniLinkStopped || aniLinkDiagnostics.rows >= 64) return;
    aniLinkDiagnostics.rows++;
    aniLinkDiagnostics.last = reason;
    if (!aniLinkDiagnostics.firstReason) aniLinkDiagnostics.firstReason = reason;
    aniLinkDiagnostics.counts[reason] = (aniLinkDiagnostics.counts[reason] || 0) + 1;
    var name = event && typeof event.type === 'string' && event.type.startsWith('anilink-player:') ? event.type.slice(15) : '';
    if (['ready', 'play', 'pause', 'progress', 'ended', 'error', 'episodechange', 'variantchange',
      'fullscreenchange', 'markerschange', 'serverschange', 'autonext', 'skip'].includes(name)) {
      if (!aniLinkDiagnostics.firstEvent) aniLinkDiagnostics.firstEvent = name;
      aniLinkDiagnostics.events[name] = (aniLinkDiagnostics.events[name] || 0) + 1;
    }
  }
  function normalizeAniLinkEvent(value, identity, lastState) {
  if (lastState === 'error') return rejectAniLinkEvent('terminal');
  if (!value || typeof value !== 'object' || Array.isArray(value)) return rejectAniLinkEvent('payload');
  const event = value;
  if (typeof event.type !== 'string' || !event.type.startsWith('anilink-player:')) return rejectAniLinkEvent('unsupported');
  const name = event.type.slice('anilink-player:'.length);
  if (!['ready', 'play', 'pause', 'progress', 'ended', 'error', 'episodechange', 'variantchange'].includes(name)) return rejectAniLinkEvent('unsupported');
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return rejectAniLinkEvent('payload');
  const payload = event.payload;
  if (Object.keys(payload).length > 32) return rejectAniLinkEvent('payload');
  const hasIdentity = ['anilistId', 'episodeNumber', 'variant'].some((key) => payload[key] != null);
  if (hasIdentity || !['ready', 'error'].includes(name)) {
    if (typeof payload.anilistId !== 'number' || !Number.isSafeInteger(payload.anilistId) || payload.anilistId < 1
      || typeof payload.episodeNumber !== 'number' || !Number.isSafeInteger(payload.episodeNumber) || payload.episodeNumber < 1
      || !['sub', 'dub'].includes(String(payload.variant))) return rejectAniLinkEvent('payload');
    const matches = String(payload.anilistId) === identity.id && payload.episodeNumber === identity.episode && payload.variant === identity.variant;
    if (name === 'episodechange' || name === 'variantchange') {
      return matches ? rejectAniLinkEvent('unchanged-identity') : { state: 'error', currentTime: null, duration: null };
    }
    if (!matches) return rejectAniLinkEvent('identity');
  }
  if (name === 'error') return typeof payload.code === 'string' && payload.code.length > 0 && payload.code.length <= 80
    ? { state: 'error', currentTime: null, duration: null } : rejectAniLinkEvent('payload');
  if (name === 'ready') return { state: 'loading', currentTime: null, duration: null };
  if (typeof payload.position !== 'number' || !Number.isFinite(payload.position) || payload.position < 0
    || typeof payload.duration !== 'number' || !Number.isFinite(payload.duration) || payload.duration <= 0
    || payload.position > payload.duration) return rejectAniLinkEvent('payload');
  return { state: name === 'pause' || (name === 'progress' && lastState === 'paused') ? 'paused'
    : name === 'ended' || (name === 'progress' && lastState === 'ended') ? 'ended' : 'playing', currentTime: payload.position, duration: payload.duration };
  }
    var aniLinkFrame = null, aniLinkState = 'loading';
    function observeAniLinkMessage(event) {
      var page = config.pageContext, owner = window.__orionPlaybackTelemetry;
      if (aniLinkStopped || !page || !page.frameUrl || !config.frameOrigin || !owner
        || owner.sessionId !== config.sessionId || owner.sourceId !== config.sourceId) {
        recordAniLinkDiagnostic('session', event.data); return;
      }
      if (window !== window.top || window.location.origin !== 'https://orion.local' || window.location.pathname !== '/player/') {
        recordAniLinkDiagnostic('topology', event.data); return;
      }
      if (event.origin !== config.frameOrigin || !allowedOrigins.has(event.origin)) {
        recordAniLinkDiagnostic('origin', event.data); return;
      }
      var frame = document.getElementById('orion-provider-frame');
      if (!frame || frame.tagName !== 'IFRAME' || !frame.isConnected || event.source !== frame.contentWindow
        || document.querySelectorAll('iframe#orion-provider-frame').length !== 1) {
        recordAniLinkDiagnostic('frame-window', event.data); return;
      }
      try { if (new URL(frame.src).href !== page.frameUrl || new URL(frame.src).origin !== event.origin) {
        recordAniLinkDiagnostic('frame-url', event.data); return;
      } }
      catch (_) { recordAniLinkDiagnostic('frame-url', event.data); return; }
      if (!aniLinkFrame) aniLinkFrame = frame;
      if (frame !== aniLinkFrame) { recordAniLinkDiagnostic('frame-replaced', event.data); return; }
      var normalized = normalizeAniLinkEvent(event.data, page, aniLinkState);
      if (!normalized) { recordAniLinkDiagnostic(aniLinkRejection, event.data); return; }
      recordAniLinkDiagnostic('accepted', event.data);
      aniLinkState = normalized.state;
      send(normalized.state, 'provider-message', { currentTime: normalized.currentTime,
        duration: normalized.duration, observedOrigin: event.origin });
    }
  `;
}
