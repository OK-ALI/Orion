const vm = require('node:vm');
const { loader } = require('./animeModules.cjs');
function aniLinkFrameHost(url, sessionId = 'current', onNative = () => {}) {
  const load = loader(), support = load('apps/mobile/src/features/playback/providerEmbedSupport.ts');
  const bridge = load('apps/mobile/src/features/playback/embeddedTelemetry.ts');
  const listeners = new Set(), messages = []; let count = 1;
  const makeFrame = () => ({ src: url, tagName: 'IFRAME', isConnected: true, contentWindow: {} });
  let frame = makeFrame();
  const window = { location: new URL('https://orion.local/player/'),
    ReactNativeWebView: { postMessage(raw) { messages.push(JSON.parse(raw)); onNative(raw); } },
    addEventListener(_name, fn) { listeners.add(fn); }, removeEventListener(_name, fn) { listeners.delete(fn); } };
  window.top = window;
  const document = { getElementById: () => frame, querySelectorAll: selector => selector === 'iframe#orion-provider-frame' ? Array(count).fill(frame) : [], querySelector: () => null };
  const context = vm.createContext({ window, document, URL, Date, setInterval: () => 1, clearInterval() {} });
  const inject = (id = sessionId) => vm.runInContext(bridge.createEmbeddedTelemetryScript({ sessionId: id, sourceId: 'anilink',
    strategy: 'player-event', expectedOrigins: ['https://anilink.cc'], frameOrigin: 'https://anilink.cc',
    pageContext: support.getProviderTelemetryPageContext('anilink', url) }), context);
  inject();
  return { window, messages, listeners, inject, get frame() { return frame; },
    send(data, origin = 'https://anilink.cc', source = frame.contentWindow) { for (const fn of [...listeners]) fn({data,origin,source}); },
    duplicates(n) { count = n; }, replaceFrame() { const old = frame; old.isConnected = false; frame = makeFrame(); return old; } };
}
const event = (name = 'progress', patch = {}) => ({ type: `anilink-player:${name}`,
  payload: { anilistId: 21175, episodeNumber: 1, variant: 'sub', position: 1200, duration: 1440, ...patch } });
module.exports = { aniLinkFrameHost, event };
