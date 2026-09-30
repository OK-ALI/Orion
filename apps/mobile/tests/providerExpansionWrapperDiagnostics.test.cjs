'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');
const { createLoader, cohortIds, readyNativeCandidate, sharedSources, workspaceRoot } = require('./helpers/providerExpansionCohortA.cjs');

const load = createLoader();
const registry = load(sharedSources);
const bridge = load('apps/mobile/src/features/playback/embeddedTelemetry.ts');
const support = load('apps/mobile/src/features/playback/providerEmbedSupport.ts');
const read = relative => fs.readFileSync(path.join(workspaceRoot, relative), 'utf8');
const authority = 'd9d173db5c8d879187270faa9c478ce33a549e98';
const atAuthority = relative => execFileSync('git', ['show', `${authority}:${relative}`], { cwd: workspaceRoot, encoding: 'utf8' });

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); if (!listeners.get(name)?.size) listeners.delete(name); },
    dispatch(name, value = {}) { for (const fn of [...listeners.get(name) || []]) fn(value); },
  };
}

// Run the real injected scripts with observable DOM/events and controlled timers.
function wrapperHarness(source = registry.getRegisteredSource('mapple'), withFrame = true, readyState = 'complete') {
  const messages = [], handshakes = [], observers = [], timers = new Map();
  let timerId = 0;
  const style = () => ({ display: 'block', visibility: 'visible', opacity: '1' });
  const ancestor = { style: style(), parentElement: null };
  const frame = Object.assign(eventTarget(), {
    src: `${source.expectedOrigins[0]}/private/path?token=SECRET_FIXTURE`, isConnected: withFrame,
    parentElement: ancestor, style: style(), width: 640, height: 360,
    getBoundingClientRect() { return { width: this.width, height: this.height }; },
    contentWindow: { postMessage: (payload, origin) => handshakes.push({ payload: JSON.parse(JSON.stringify(payload)), origin }) },
  });
  const document = Object.assign(eventTarget(), {
    readyState,
    querySelectorAll: selector => selector === 'iframe' && frame.isConnected ? [frame] : [],
    querySelector: selector => selector === 'iframe' && frame.isConnected ? frame : null,
  });
  const window = Object.assign(eventTarget(), {
    location: { origin: 'https://orion.local', href: 'https://orion.local/player/' },
    ReactNativeWebView: { postMessage: raw => messages.push(JSON.parse(raw)) },
    getComputedStyle: node => node.style,
  });
  const schedule = type => (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay, type }); return id; };
  const context = vm.createContext({
    window, document, URL, Date,
    MutationObserver: class {
      constructor(fn) { this.fn = fn; this.active = false; observers.push(this); }
      observe(target, options) { this.active = true; this.target = target; this.options = options; }
      disconnect() { this.active = false; }
    },
    setInterval: schedule('interval'), setTimeout: schedule('timeout'),
    clearInterval: id => timers.delete(id), clearTimeout: id => timers.delete(id),
  });
  const options = { sourceId: source.id, sessionId: 'wrapper-session-1', expectedOrigins: source.expectedOrigins, requiresIframeWrapper: source.requiresIframeWrapper === true };
  const run = overrides => vm.runInContext(bridge.createWrapperDiagnosticScript({ ...options, ...overrides }), context);
  const runBridge = overrides => vm.runInContext(bridge.createEmbeddedTelemetryScript({
    ...options, strategy: source.progressStrategy, playerEventContract: source.playerEventContract,
    playerMessageHandshake: source.playerMessageHandshake, ...overrides,
  }), context);
  run();
  return {
    messages, handshakes, observers, timers, context, options, window, document, frame, ancestor, run, runBridge,
    sample: () => { for (const timer of [...timers.values()]) if (timer.type === 'interval') timer.fn(); },
    mutate: records => { for (const observer of observers.filter(value => value.active)) observer.fn(records); },
    message: overrides => window.dispatch('message', { origin: source.expectedOrigins[0], source: frame.contentWindow, data: { private: 'SECRET_FIXTURE' }, ...overrides }),
    expire: () => { for (const timer of [...timers.values()]) if (timer.delay === 30000) timer.fn(); },
  };
}

test('diagnostics are opt-in for wrapper providers; Cohort A retains its existing boundaries', () => {
  for (const id of cohortIds) {
    const source = registry.getRegisteredSource(id);
    assert.equal(source.releaseStatus, 'candidate');
    assert.equal(source.routingMode, 'manual-only');
    assert.equal(source.supportsDownloads, false);
    assert.equal(source.requiresIframeWrapper, true);
    const harness = wrapperHarness(source);
    assert.equal(harness.messages.some(message => message.stage === 'provider-iframe-present'), true);
    assert.ok(harness.messages.every(message => message.sourceId === id));
    assert.equal(support.getProviderCapturePolicy(source).diagnosticOnly, true);
  }
  for (const id of ['vixsrc', 'vidsrc']) {
    const harness = wrapperHarness(registry.getRegisteredSource(id));
    assert.deepEqual(harness.messages, []);
    assert.equal(harness.window.__orionWrapperDiagnostics, undefined);
    assert.equal(harness.observers.length, 0);
    assert.equal(harness.timers.size, 0);
  }
  for (const expectedOrigins of [[], ['*'], ['http://mapple.fun'], ['https://mapple.fun/path'], ['https://user:SECRET_FIXTURE@mapple.fun']]) {
    assert.equal(bridge.createWrapperDiagnosticScript({ sessionId: 's', sourceId: 'mapple', requiresIframeWrapper: true, expectedOrigins }), '');
  }
});

test('all nine lifecycle stages are independent observations, including removal and hiding', () => {
  const h = wrapperHarness(undefined, true, 'loading');
  assert.equal(h.messages.some(value => value.stage === 'wrapper-document-ready'), false);
  assert.deepEqual(h.messages.map(value => value.stage), ['provider-iframe-present', 'provider-iframe-connected']);
  h.document.readyState = 'interactive';
  h.document.dispatch('DOMContentLoaded');
  h.frame.dispatch('load');
  h.frame.dispatch('error');
  h.frame.style.display = 'none';
  h.mutate([{ type: 'attributes', attributeName: 'style' }]);
  h.frame.style.display = 'block';
  h.ancestor.style.visibility = 'hidden';
  h.sample();
  h.message();
  h.document.dispatch('securitypolicyviolation', { effectiveDirective: 'frame-src', blockedURI: h.frame.src });
  h.frame.isConnected = false;
  h.mutate([{ removedNodes: [{ contains: value => value === h.frame }] }]);
  assert.deepEqual(new Set(h.messages.map(value => value.stage)), new Set([
    'wrapper-document-ready', 'provider-iframe-present', 'provider-iframe-connected',
    'provider-iframe-load-fired', 'provider-iframe-error-fired', 'provider-iframe-removed',
    'provider-iframe-hidden', 'wrapper-security-policy-violation', 'provider-message-observed',
  ]));
  assert.ok(h.messages.some(value => value.hiddenCause === 'self-style'));
  assert.ok(h.messages.some(value => value.hiddenCause === 'ancestor-style'));
  assert.equal(h.messages.find(value => value.stage === 'provider-iframe-load-fired').loadFired, true);
  assert.ok(h.messages.some(value => value.stage === 'provider-iframe-removed' && !value.isConnected));
  assert.equal(h.observers[0].target, h.document);
  assert.equal(h.observers[0].options.attributes, true);
  assert.equal(h.frame.src.includes('SECRET_FIXTURE'), true); // Instrumentation never changes the source.
});

test('missing or mutated iframe cannot fabricate presence, messages, or playback evidence', () => {
  const h = wrapperHarness(undefined, false);
  assert.deepEqual(h.messages.map(value => value.stage), ['wrapper-document-ready']);
  assert.equal(h.messages[0].iframeCount, 0);
  assert.equal(h.messages[0].srcCategory, 'absent');
  h.message();
  assert.equal(h.messages.length, 1);
  h.frame.isConnected = true;
  h.mutate([{ addedNodes: [h.frame] }]);
  h.frame.src = 'https://unrelated.example/private?token=SECRET_FIXTURE';
  h.mutate([{ attributeName: 'src' }]);
  h.message();
  assert.equal(h.messages.some(value => value.stage === 'provider-message-observed'), false);
  assert.ok(h.messages.some(value => value.srcCategory === 'other'));
  h.frame.width = 0;
  h.sample();
  assert.ok(h.messages.some(value => value.stage === 'provider-iframe-hidden' && value.hiddenCause === 'zero-size'));
  assert.ok(h.messages.every(value => value.type === 'ORION_WRAPPER_DIAGNOSTIC'));
  assert.ok(h.messages.every(value => !Object.hasOwn(value, 'currentTime') && !Object.hasOwn(value, 'state')));
});

test('provider message observation requires exact origin and selected contentWindow without reading payload', () => {
  const h = wrapperHarness();
  for (const origin of ['null', 'https://orion.local', 'https://mapple.fun.evil.example', 'http://mapple.fun']) h.message({ origin });
  for (const source of [null, {}, { parent: h.frame.contentWindow }]) h.message({ source });
  assert.equal(h.messages.some(value => value.stage === 'provider-message-observed'), false);
  const event = { origin: 'https://mapple.fun', source: h.frame.contentWindow };
  Object.defineProperty(event, 'data', { get() { throw new Error('Diagnostic listener must not read payload'); } });
  h.window.dispatch('message', event);
  assert.equal(h.messages.filter(value => value.stage === 'provider-message-observed').length, 1);
  h.message();
  assert.equal(h.messages.filter(value => value.stage === 'provider-message-observed').length, 1);
});

test('CSP and iframe metadata disclose no request URLs, credentials, payload, or unknown origins', () => {
  const h = wrapperHarness();
  for (const blockedURI of [h.frame.src, 'https://orion.local/private?token=SECRET_FIXTURE',
    'https://private.example/path?token=SECRET_FIXTURE', 'http://private.example/path',
    'data:SECRET_FIXTURE', 'blob:https://private.example/SECRET_FIXTURE', 'inline', 'eval']) {
    h.document.dispatch('securitypolicyviolation', { effectiveDirective: 'frame-src', blockedURI });
  }
  h.document.dispatch('securitypolicyviolation', { effectiveDirective: 'SECRET_FIXTURE', blockedURI: 'SECRET_FIXTURE' });
  const policies = h.messages.filter(value => value.stage === 'wrapper-security-policy-violation');
  assert.deepEqual(policies.map(value => value.blockedCategory), ['provider', 'wrapper', 'https-other', 'http-other', 'data', 'blob', 'inline', 'eval', 'other']);
  assert.deepEqual(policies.map(value => value.blockedOrigin), ['https://mapple.fun', 'https://orion.local', null, null, null, null, null, null, null]);
  assert.equal(policies.at(-1).blockedDirective, 'other');
  assert.doesNotMatch(JSON.stringify(h.messages), /SECRET_FIXTURE|private\.example|\/private|\?token|headers|cookies/);
});

test('diagnostic envelope validation rejects stale sessions, replays, malformed metrics and private origins', () => {
  const source = registry.getRegisteredSource('mapple');
  const h = wrapperHarness(source);
  const valid = h.messages[0];
  const logs = [];
  const previous = console.info;
  console.info = (...values) => logs.push(values.join(' '));
  try {
    const invalid = [null, [], 'not JSON', ' '.repeat(4097), { ...valid, type: 'PLAYER_EVENT' },
      { ...valid, schemaVersion: 2 }, { ...valid, sessionId: 'old' }, { ...valid, sourceId: 'stellar' },
      { ...valid, stage: 'unknown' }, { ...valid, providerOrigin: 'https://orion.local' },
      { ...valid, providerOrigin: 'https://mapple.fun/private?token=SECRET_FIXTURE' },
      { ...valid, sequence: 0 }, { ...valid, sequence: 65 }, { ...valid, sequence: 1.5 },
      { ...valid, observedAt: Date.now() - 16000 }, { ...valid, observedAt: Date.now() + 16000 },
      { ...valid, width: -1 }, { ...valid, height: Infinity }, { ...valid, opacity: NaN },
      { ...valid, iframeCount: 0.5 }, { ...valid, display: 'SECRET_FIXTURE' },
      { ...valid, isConnected: 1 }, { ...valid, loadFired: 'true' }, { ...valid, srcCategory: 'SECRET_FIXTURE' },
      { ...valid, stage: 'wrapper-security-policy-violation', blockedDirective: 'frame-src', blockedCategory: 'https-other', blockedOrigin: 'https://private.example' },
    ];
    for (const raw of invalid) assert.equal(bridge.recordWrapperDiagnosticMessage(raw, source, h.options.sessionId, 0), null);
    assert.equal(bridge.recordWrapperDiagnosticMessage(valid, source, h.options.sessionId, valid.sequence), null);
    assert.equal(bridge.recordWrapperDiagnosticMessage(valid, registry.getRegisteredSource('vixsrc'), h.options.sessionId, 0), null);
    assert.equal(logs.length, 0);
    assert.equal(bridge.recordWrapperDiagnosticMessage(JSON.stringify({ ...valid, url: h.frame.src, headers: 'SECRET_FIXTURE', payload: 'SECRET_FIXTURE' }), source, h.options.sessionId, 0), 1);
    assert.match(logs[0], /^\[OrionP102Trace\] wrapper /);
    assert.doesNotMatch(logs[0], /SECRET_FIXTURE|\/private|\?token|headers|payload|sessionId/);
  } finally { console.info = previous; }
});

test('reinjection is idempotent; existing playback lifecycle cleans diagnostics without disarming a new session', () => {
  const h = wrapperHarness(registry.getRegisteredSource('stellar'));
  const initialCount = h.messages.length;
  h.run();
  assert.equal(h.messages.length, initialCount);
  assert.equal(h.observers.length, 1);
  h.runBridge();
  assert.equal(h.handshakes.length, 1);
  const oldStop = h.window.__orionPlaybackTelemetry.stop;
  h.run({ sessionId: 'wrapper-session-2' });
  h.runBridge({ sessionId: 'wrapper-session-2' });
  oldStop();
  const previousCount = h.messages.length;
  h.frame.dispatch('load');
  assert.ok(h.messages.slice(previousCount).every(value => value.sessionId === 'wrapper-session-2'));
  assert.ok(h.messages.length > previousCount);
  h.window.__orionPlaybackTelemetry.stop();
  assert.equal(h.timers.size, 0);
  assert.equal(h.window.listeners.size, 0);
  assert.equal(h.document.listeners.size, 0);
  assert.equal(h.frame.listeners.size, 0);
  assert.ok(h.observers.every(value => !value.active));
});

test('diagnostic event/mutation budgets and deadline bound overhead and release listeners', () => {
  const h = wrapperHarness();
  const initialCount = h.messages.length;
  h.sample();
  assert.equal(h.messages.length, initialCount);
  for (let i = 0; i < 140; i++) { h.frame.width = 640 + i; h.mutate([{ attributeName: 'style' }]); }
  assert.equal(h.messages.length, 64);
  assert.equal(h.observers[0].active, false);
  h.expire();
  assert.equal(h.timers.size, 0);
  assert.equal(h.frame.listeners.size, 0);
  assert.equal(h.document.listeners.size, 0);
  assert.equal(h.window.listeners.size, 0);
  h.frame.dispatch('load');
  assert.equal(h.messages.length, 64);
});

test('a missing/throwing WebView diagnostic channel cannot interrupt normal script injection', () => {
  const h = wrapperHarness();
  h.window.__orionWrapperDiagnostics.stop();
  h.window.ReactNativeWebView.postMessage = () => { throw new Error('Unavailable bridge'); };
  assert.doesNotThrow(() => h.run({ sessionId: 'wrapper-session-2' }));
  assert.doesNotThrow(() => h.runBridge({ sessionId: 'wrapper-session-2' }));
  assert.doesNotThrow(() => h.frame.dispatch('load'));
  h.window.__orionPlaybackTelemetry.stop();
});

test('wrapper instrumentation cannot enter playback evidence or P102 candidate/prepared-download storage', () => {
  let emit;
  const released = [];
  const captureLoad = createLoader({ 'react-native': {
    Platform: { OS: 'android' }, DeviceEventEmitter: { addListener: (_name, fn) => { emit = fn; return { remove() {} }; } },
    NativeModules: { OrionDownloadCapture: { releaseSession: id => released.push(id), releaseJobContext() {}, bindRequestContext() { assert.fail('Diagnostic events must not bind a download context'); } } },
  } });
  const capture = captureLoad('apps/mobile/src/features/downloads/downloadCandidateCapture.ts');
  const h = wrapperHarness();
  const session = {
    playbackSessionId: h.options.sessionId, sourceId: 'mapple', providerClass: 'candidate', diagnosticOnly: true,
    itemKey: 'movie:550', media: { schemaVersion: 1, id: 550, mediaType: 'movie', title: 'Fixture', season: null, episode: null, libraryKind: 'movie' },
  };
  const end = capture.beginMobileDownloadCaptureSessionV1(session);
  for (const event of [...h.messages, readyNativeCandidate(session)]) {
    assert.equal(capture.normalizeMobileDownloadCandidateEventV1(event, session), null);
    emit(event);
    assert.equal(bridge.parseEmbeddedTelemetryMessage(event, { ...h.options, lastSequence: 0 }), null);
  }
  assert.deepEqual(capture.getMobileDownloadCandidateSnapshotsV1(), []);
  assert.equal(capture.selectMobileDownloadCandidateForItemV1(session.itemKey), null);
  end();
  assert.deepEqual(released, [session.playbackSessionId]);
});

function nativeManifest(source) {
  const module = { exports: {} };
  const filename = path.join(workspaceRoot, 'apps/mobile/src/features/playback/OrionCinemaWebView.tsx');
  const mocks = {
    react: { forwardRef: fn => fn, useEffect() {}, useMemo: fn => fn(), useRef: value => ({ current: value }) },
    'react/jsx-runtime': { jsx: (_type, props) => props },
    'react-native': { Platform: { OS: 'android' }, requireNativeComponent: name => name },
    'react-native-webview': { WebView: () => null },
  };
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('exports', 'require', 'module', js)(module.exports, name => name === './embeddedWrapperDiagnostics'
    ? load('apps/mobile/src/features/playback/embeddedWrapperDiagnostics.ts') : mocks[name], module);
  const props = module.exports.OrionCinemaWebView({
    shieldManifest: support.getProviderShieldManifest(source.id, source), shieldSessionId: 'native-session',
    wrapperDiagnosticOrigins: source.requiresIframeWrapper ? source.expectedOrigins : undefined,
  }, null);
  assert.equal(Object.hasOwn(props, 'wrapperDiagnosticOrigins'), false);
  return JSON.parse(props.nativeConfig.props.orionShieldSession);
}

test('native diagnostic origins are wrapper-only metadata and never modify request/media/navigation authority', () => {
  for (const id of [...cohortIds, 'vixsrc', 'vidsrc']) {
    const source = registry.getRegisteredSource(id);
    const manifest = nativeManifest(source);
    if (source.requiresIframeWrapper) assert.deepEqual(manifest.wrapperDiagnosticOrigins, source.expectedOrigins);
    else assert.equal(Object.hasOwn(manifest, 'wrapperDiagnosticOrigins'), false);
    for (const key of ['allowedNavigationOrigins', 'requiredOrigins', 'mediaOrigins', 'rules']) {
      assert.deepEqual(manifest[key], source.requestManifest[key]);
    }
    assert.equal(manifest.mediaOrigins.includes('https://orion.local'), false);
  }
  const relative = 'apps/mobile/plugins/orion-cinema-webview-native/OrionCinemaWebViewClient.kt';
  const current = read(relative), original = atAuthority(relative);
  const policy = text => text.slice(text.indexOf('  private fun classify('), text.indexOf('  private fun emit(')).replace(/\r\n/g, '\n');
  assert.equal(policy(current), policy(original));
  const broker = text => text.match(/OrionDownloadRequestContextBroker\.observeRequest\([\s\S]*?\n      \)/)[0].replace(/\r\n/g, '\n');
  assert.equal(broker(current), broker(original));
  for (const category of ['top-level-wrapper', 'provider-subframe-navigation', 'provider-subframe-request', 'ordinary-subresource-request', 'subresource-unclassified', 'frame-unknown']) assert.ok(current.includes(`"${category}"`));
  const diagnostic = current.slice(current.indexOf('  private fun traceWrapperFrame('), current.indexOf('  private fun classify('));
  assert.match(diagnostic, /current\.wrapperDiagnosticOrigins \?: return/);
  assert.match(diagnostic, /wrapperDiagnosticKeys\.size >= 32/);
  assert.doesNotMatch(diagnostic, /uri\??\.toString|requestHeaders|cookies|requestContext|query/);
});

test('provider contracts, URL/CSP/referrer policy and ad blocker remain byte-identical to authority', () => {
  for (const relative of ['packages/shared/src/sources/adapters/candidates.ts', 'packages/shared/src/sources/adapters/primary.ts',
    'packages/shared/src/sources/contracts.ts', 'apps/mobile/src/features/playback/mobileAdBlocker.ts']) {
    assert.equal(read(relative).replace(/\r\n/g, '\n'), atAuthority(relative).replace(/\r\n/g, '\n'));
  }
  const before = atAuthority('apps/mobile/src/features/playback/providerEmbedSupport.ts');
  const after = read('apps/mobile/src/features/playback/providerEmbedSupport.ts');
  const wrapper = text => text.slice(text.indexOf('export function createProviderIframeDocument('), text.indexOf('export function getProvider')).replace(/\r\n/g, '\n');
  assert.equal(wrapper(after), wrapper(before));
  const surface = read('apps/mobile/src/features/playback/EmbedPlayerSurface.tsx');
  assert.match(surface, /\$\{wrapperDiagnosticScript\}\$\{mobileAdBlockerScript\}\\n\$\{telemetryScript\}/);
  assert.match(surface, /injectedJavaScriptBeforeContentLoaded=\{wrapperDiagnosticScript \|\| undefined\}/);
  assert.match(surface, /wrapperDiagnosticOrigins=\{source\?\.requiresIframeWrapper \? expectedOrigins : undefined\}/);
});
