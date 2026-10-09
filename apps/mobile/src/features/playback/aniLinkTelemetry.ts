/** Static WebView script: no native-engine function serialization or new telemetry owner. */
export function createAniLinkTelemetryAdapterScript(): string {
  return `
  function normalizeAniLinkEvent(value, identity, lastState) {
  if (lastState === 'error') return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const event = value;
  if (typeof event.type !== 'string' || !event.type.startsWith('anilink-player:')) return null;
  const name = event.type.slice('anilink-player:'.length);
  if (!['ready', 'play', 'pause', 'progress', 'ended', 'error', 'episodechange', 'variantchange'].includes(name)) return null;
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return null;
  const payload = event.payload;
  if (Object.keys(payload).length > 32) return null;
  const hasIdentity = ['anilistId', 'episodeNumber', 'variant'].some((key) => payload[key] != null);
  if (hasIdentity || !['ready', 'error'].includes(name)) {
    if (typeof payload.anilistId !== 'number' || !Number.isSafeInteger(payload.anilistId) || payload.anilistId < 1
      || typeof payload.episodeNumber !== 'number' || !Number.isSafeInteger(payload.episodeNumber) || payload.episodeNumber < 1
      || !['sub', 'dub'].includes(String(payload.variant))) return null;
    const matches = String(payload.anilistId) === identity.id && payload.episodeNumber === identity.episode && payload.variant === identity.variant;
    if (name === 'episodechange' || name === 'variantchange') {
      return matches ? null : { state: 'error', currentTime: null, duration: null };
    }
    if (!matches) return null;
  }
  if (name === 'error') return typeof payload.code === 'string' && payload.code.length > 0 && payload.code.length <= 80
    ? { state: 'error', currentTime: null, duration: null } : null;
  if (name === 'ready') return { state: 'loading', currentTime: null, duration: null };
  if (typeof payload.position !== 'number' || !Number.isFinite(payload.position) || payload.position < 0
    || typeof payload.duration !== 'number' || !Number.isFinite(payload.duration) || payload.duration <= 0
    || payload.position > payload.duration) return null;
  return { state: name === 'pause' || (name === 'progress' && lastState === 'paused') ? 'paused'
    : name === 'ended' || (name === 'progress' && lastState === 'ended') ? 'ended' : 'playing', currentTime: payload.position, duration: payload.duration };
  }
    var aniLinkFrame = null, aniLinkState = 'loading';
    function observeAniLinkMessage(event) {
      var page = config.pageContext, owner = window.__orionPlaybackTelemetry;
      if (aniLinkStopped || !page || !page.frameUrl || !config.frameOrigin || !owner
        || owner.sessionId !== config.sessionId || owner.sourceId !== config.sourceId) {
        return;
      }
      if (window !== window.top || window.location.origin !== 'https://orion.local' || window.location.pathname !== '/player/') {
        return;
      }
      if (event.origin !== config.frameOrigin || !allowedOrigins.has(event.origin)) {
        return;
      }
      var frame = document.getElementById('orion-provider-frame');
      if (!frame || frame.tagName !== 'IFRAME' || !frame.isConnected || event.source !== frame.contentWindow
        || document.querySelectorAll('iframe#orion-provider-frame').length !== 1) {
        return;
      }
      try { if (new URL(frame.src).href !== page.frameUrl || new URL(frame.src).origin !== event.origin) {
        return;
      } }
      catch (_) { return; }
      if (!aniLinkFrame) aniLinkFrame = frame;
      if (frame !== aniLinkFrame) { return; }
      var normalized = normalizeAniLinkEvent(event.data, page, aniLinkState);
      if (!normalized) { return; }
      aniLinkState = normalized.state;
      send(normalized.state, 'provider-message', { currentTime: normalized.currentTime,
        duration: normalized.duration, observedOrigin: event.origin });
    }
  `;
}
