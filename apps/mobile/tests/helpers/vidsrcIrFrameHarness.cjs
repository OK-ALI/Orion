const vm = require('node:vm');

// Models the provider's existing #player_iframe and actual top-level script;
// no provider bootstrap, parent frame or playback success is fabricated by Orion.
function vidsrcIrFrameHost(script, onNative = () => {}, url = 'https://vidsrc.ir/embed/movie/9') {
  const listeners = new Set(), messages = [], stale = {}, nested = {}, style = { display: 'block', visibility: 'visible', opacity: '1' };
  let duplicates = 1;
  const makeFrame = () => ({ tagName: 'IFRAME', isConnected: true, hidden: false,
    src: 'https://player.example.net/player', contentWindow: {},
    getAttribute(name) { return name === 'src' ? this.src : null; },
    getBoundingClientRect: () => ({ width: 800, height: 450 }) });
  let frame = makeFrame();
  const window = { location: new URL(url), getComputedStyle: () => style,
    ReactNativeWebView: { postMessage(raw) { messages.push(JSON.parse(raw)); onNative(raw); } },
    addEventListener(_type, fn) { listeners.add(fn); }, removeEventListener(_type, fn) { listeners.delete(fn); } };
  window.top = window; window.parent = window;
  const document = { getElementById: id => id === 'player_iframe' && frame.isConnected ? frame : null,
    querySelectorAll: selector => selector === 'iframe#player_iframe' ? Array(duplicates).fill(frame) : [], querySelector: () => null };
  const context = vm.createContext({ window, document, URL, Date, setInterval: () => 1, clearInterval() {} });
  const run = value => vm.runInContext(value, context);
  run(script);
  return { messages, window, document, stale, nested, style, listeners, run,
    get frame() { return frame; },
    send(data, origin = new URL(frame.src || 'about:blank').origin, source = frame.contentWindow) {
      for (const fn of [...listeners]) fn({ data, origin, source });
    },
    replaceFrame() { const old = frame; old.isConnected = false; frame = makeFrame(); return old; },
    duplicates(count) { duplicates = count; },
  };
}
module.exports = { vidsrcIrFrameHost };
