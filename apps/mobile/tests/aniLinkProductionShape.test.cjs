const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const { loader, read } = require('./helpers/animeModules.cjs');
const { aniLinkFrameHost, event } = require('./helpers/aniLinkFrameHarness.cjs');
const load = loader(), registry = load('packages/shared/src/sources/registry.ts');
const support = load('apps/mobile/src/features/playback/providerEmbedSupport.ts');
const bridge = load('apps/mobile/src/features/playback/embeddedTelemetry.ts');
const native = 'apps/mobile/plugins/orion-cinema-webview-native/';
const client = read(native + 'OrionCinemaWebViewClient.kt');

test('qualified AniLink URLs retain full parameters even when the retired diagnostic flag is set', () => {
  const previous = process.env.EXPO_PUBLIC_ORION_ANILINK_RESUME_CONTROL;
  process.env.EXPO_PUBLIC_ORION_ANILINK_RESUME_CONTROL = 'minimal';
  try {
    for (const variant of ['sub', 'dub']) for (const start of [0, 167, 608]) {
      assert.equal(registry.getSourceUrl('anilink', 'tv', {anilistId: 21175}, 1, 1, {start, variant}),
        `https://anilink.cc/watch/21175/1?autoplay=true&autonext=false&start=${start}&variant=${variant}`);
    }
    assert.doesNotMatch(read('apps/mobile/src/features/playback/PlayerScreen.tsx'), /getAniLinkResumeDiagnosticUrl|EXPO_PUBLIC_ORION_ANILINK_RESUME_CONTROL/);
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_ORION_ANILINK_RESUME_CONTROL;
    else process.env.EXPO_PUBLIC_ORION_ANILINK_RESUME_CONTROL = previous;
  }
  const source = registry.getRegisteredSource('anilink');
  assert.equal(source.releaseStatus, 'candidate'); assert.equal(source.routingMode, 'manual-only');
  assert.equal(source.supportsDownloads, false);
});

test('qualified full route uses the same wrapper CSP, exact frame and verified progress contract', () => {
  const url = registry.getSourceUrl('anilink', 'tv', {anilistId: 21175}, 1, 1, {start: 167, variant: 'sub'});
  const wrapper = support.createProviderWebViewSource(registry.getRegisteredSource('anilink'), url);
  assert.equal(wrapper.baseUrl, 'https://orion.local/player/');
  assert.match(wrapper.html, /frame-src https:\/\/anilink\.cc/);
  assert.ok(wrapper.html.includes(url.replaceAll('&', '&amp;')));
  const host = aniLinkFrameHost(url);
  for (const position of [167, 167.8, 168.9]) host.send(event('progress', {position, duration: 1402}));
  assert.deepEqual(host.messages.map(row => row.currentTime), [167, 167.8, 168.9]);
  host.send(event(), 'https://evil.invalid'); host.send(event(), 'https://anilink.cc', {});
  host.frame.src = url + '&start=0'; host.send(event());
  assert.equal(host.messages.length, 3);
});

test('production telemetry has no temporary counters, layout probes or diagnostic owner fields', () => {
  for (const id of ['anilink', 'aniembed', 'vixsrc', 'vidsrc', 'vidsrc-ir', 'cinesrc']) {
    const script = bridge.createEmbeddedTelemetryScript({sessionId: 'current', sourceId: id,
      strategy: 'player-event', expectedOrigins: ['https://example.invalid']});
    assert.doesNotMatch(script, /aniLinkDiagnostics|aniEmbedDiagnostics|diagnostics:|noteHostSeek/);
  }
  assert.doesNotMatch(client, /WRAPPER_DIAGNOSTIC_SCRIPT|diagnosticPoll|safePublicWatchUrl|recordConsoleDiagnostic/);
  assert.match(client, /stage=manifest source=\$\{current\.sourceId\.take\(40\)\} capture=/);
});

test('resume commands are exactly Orion’s existing verified scripts without the investigation prefix', () => {
  const existing = load('apps/mobile/src/features/playback/mobileAdBlocker.ts');
  for (const time of [0, 45, 167.8]) for (const id of ['aniembed', 'anilink', 'vixsrc', 'vidsrc', 'vidsrc-ir', 'vidlink', 'vidnest']) {
    assert.equal(support.createProviderResumeScript(id, time, 'attempt'), existing.createVerifiedResumeScript(time, 'attempt'));
  }
  assert.equal(support.createProviderResumeScript('cinesrc', 167, 'attempt'), existing.createCineSrcResumeScript(167, 'attempt'));
});

test('AniEmbed keeps the same telemetry lifecycle and advancing media output without diagnostic reads', () => {
  const messages = [], listeners = new Map(); let timer, stopped = false;
  const video = {currentTime: 45, duration: 1440, paused: false, ended: false, seeking: false,
    addEventListener: (name, callback) => listeners.set(name, callback),
    getBoundingClientRect: () => assert.fail('temporary layout probe')};
  const window = {location: new URL('https://aniembed.se/e/21175/1?lang=sub&t=0'),
    ReactNativeWebView: {postMessage: raw => messages.push(JSON.parse(raw))},
    addEventListener() {}, removeEventListener() {}};
  const document = {querySelector: () => video, querySelectorAll: () => [video]};
  const context = vm.createContext({window, document, URL, Date,
    setInterval: callback => {timer = callback; return 1;}, clearInterval: () => {stopped = true;}});
  const script = bridge.createEmbeddedTelemetryScript({sessionId: 'current', sourceId: 'aniembed',
    strategy: 'frame-video', expectedOrigins: ['https://aniembed.se']});
  vm.runInContext(script, context); const owner = window.__orionPlaybackTelemetry;
  vm.runInContext(script, context); assert.equal(window.__orionPlaybackTelemetry, owner);
  assert.equal(messages.length, 1); video.currentTime = 46; timer();
  video.paused = true; listeners.get('pause')(); timer();
  assert.deepEqual(messages.map(row => row.state), ['playing', 'playing', 'paused', 'paused']);
  assert.deepEqual(messages.map(row => row.currentTime), [45, 46, 46, 46]);
  assert.deepEqual(messages.map(row => row.sequence), [1, 2, 3, 4]);
  owner.stop(); assert.equal(stopped, true);
});

test('AniLink accepts long-running healthy progress and rejects callbacks from a stopped owner', () => {
  const host = aniLinkFrameHost('https://anilink.cc/watch/21175/1?autoplay=true&autonext=false&start=167&variant=sub');
  for (let i = 0; i < 100; i++) host.send(event('progress', {position: 167 + i}));
  assert.equal(host.messages.length, 100);
  const callback = [...host.listeners][0]; host.window.__orionPlaybackTelemetry.stop();
  callback({data: event(), origin: 'https://anilink.cc', source: host.frame.contentWindow});
  assert.equal(host.messages.length, 100); host.inject('next'); assert.equal(host.listeners.size, 1);
  host.send(event('progress', {position: 268})); assert.equal(host.messages.at(-1).currentTime, 268);
});

test('owned HTML permission stays inside stock loading and cannot become request or download authority', () => {
  const manager = read(native + 'OrionCinemaWebViewManager.kt');
  assert.match(manager, /stageWrapperSource\(value\)[\s\S]*?super\.setNewSource\(viewWrapper, value\)/);
  assert.match(manager, /armWrapperSource\(\)[\s\S]*?super\.onAfterUpdateTransaction\(viewWrapper\)/);
  const interception = client.slice(client.indexOf('override fun shouldInterceptRequest'), client.indexOf('@Deprecated("Deprecated in Android")'));
  const owned = interception.slice(interception.indexOf('val owner = manifest'), interception.indexOf('val decision = classify'));
  assert.match(owned, /owner\.sourceId, owner\.sessionId/); assert.match(owned, /request\.isForMainFrame/);
  assert.match(owned, /return null/); assert.doesNotMatch(owned, /observeRequest|mediaOrigins|requiredOrigins|observeServiceWorker/);
  assert.match(client, /previousSessionId != next\?\.sessionId \|\| previousSourceId != next\?\.sourceId\) wrapperSourceLoad\.invalidate\(\)/);
  assert.match(client, /override fun onPageFinished[^]*?wrapperSourceLoad\.clear\(\)/);
  assert.match(client, /fun dispose\(\) \{\s*wrapperSourceLoad\.clear\(\)/);
  const classify = client.slice(client.indexOf('private fun classify'), client.indexOf('private fun emit'));
  assert.match(classify, /scheme != "http" && scheme != "https"[^]*?ShieldDecision\("blocked", "unsafe-navigation", "scheme-deny"\)/);
  assert.doesNotMatch(classify, /owned-wrapper-html|OrionWrapperSourceLoad/);
});

test('native popup/navigation protections and inherited error dispatch remain authoritative', () => {
  const chrome = read(native + 'OrionCinemaWebChromeClient.kt');
  assert.match(chrome, /cinemaClient\.recordPopupBlocked\(view\)\s*return false/);
  assert.doesNotMatch(chrome, /onConsoleMessage|ConsoleMessage/);
  assert.match(client, /return if \(decision\.decision == "blocked" && request\.isForMainFrame\) true else super\.shouldOverrideUrlLoading\(view, request\)/);
  assert.match(client, /return if \(decision\.decision == "blocked"\) true else super\.shouldOverrideUrlLoading\(view, url\)/);
  assert.doesNotMatch(client, /override fun onReceived(?:Http)?Error/);
});
