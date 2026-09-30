'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const { execFileSync } = require('node:child_process');
const { createLoader, cohortIds, sharedSources, workspaceRoot } = require('./helpers/providerExpansionCohortA.cjs');

const load = createLoader();
const registry = load(sharedSources);
const support = load('apps/mobile/src/features/playback/providerEmbedSupport.ts');
const telemetry = load('apps/mobile/src/features/playback/embeddedTelemetry.ts');
const diagnostics = load('apps/mobile/src/features/playback/embeddedWrapperDiagnostics.ts');
const { mobileAdBlockerScript } = load('apps/mobile/src/features/playback/mobileAdBlocker.ts');
const read = relative => fs.readFileSync(path.join(workspaceRoot, relative), 'utf8');

// Execute the actual Orion component, including its pre-native source observation.
function handoff(source, input, injections) {
  const events = [], module = { exports: {} };
  const WebView = () => null;
  const filename = path.join(workspaceRoot, 'apps/mobile/src/features/playback/OrionCinemaWebView.tsx');
  const mocks = {
    react: { forwardRef: fn => fn, useMemo: fn => fn(), useEffect() {}, useRef: value => ({ current: value }) },
    'react/jsx-runtime': { jsx: (type, props) => { events.push({ handedOff: true }); return { type, props }; } },
    'react-native': { Platform: { OS: 'android' }, requireNativeComponent: name => name },
    'react-native-webview': { WebView },
    './embeddedWrapperDiagnostics': diagnostics,
  };
  const js = ts.transpileModule(read('apps/mobile/src/features/playback/OrionCinemaWebView.tsx'), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('exports', 'require', 'module', js)(module.exports, name => {
    assert.ok(Object.hasOwn(mocks, name), `Unexpected Orion component import: ${name}`);
    return mocks[name];
  }, module);
  const previous = console.info;
  console.info = (lane, raw) => events.push({ lane, metadata: JSON.parse(raw) });
  try {
    const node = module.exports.OrionCinemaWebView({
      shieldManifest: support.getProviderShieldManifest(source.id, source), shieldSessionId: 'construction-fixture',
      wrapperDiagnosticOrigins: source.requiresIframeWrapper ? source.expectedOrigins : undefined,
      source: input, ...injections,
    }, null);
    assert.equal(node.type, WebView);
    return { props: node.props, events };
  } finally { console.info = previous; }
}

function injectionProps(source) {
  const options = { sourceId: source.id, sessionId: 'construction-fixture', expectedOrigins: source.expectedOrigins };
  const before = telemetry.createWrapperDiagnosticScript({ ...options, requiresIframeWrapper: source.requiresIframeWrapper === true });
  return {
    injectedJavaScriptBeforeContentLoaded: before || undefined,
    injectedJavaScript: before + mobileAdBlockerScript + '\n' + telemetry.createEmbeddedTelemetryScript({
      ...options, strategy: source.progressStrategy, playerEventContract: source.playerEventContract,
      playerMessageHandshake: source.playerMessageHandshake,
    }),
  };
}

// Execute the installed stock WebView's own newSource expression, not a copied transformation.
function stockNewSource(sourceResolved) {
  const filename = path.join(workspaceRoot, 'apps/mobile/node_modules/react-native-webview/src/WebView.android.tsx');
  const sourceFile = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile) === 'newSource') initializer = node.initializer.getText(sourceFile);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  assert.ok(initializer, 'The real stock Android newSource construction must be found');
  const js = ts.transpileModule(`module.exports = (${initializer});`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('sourceResolved', 'module', js)(sourceResolved, module);
  return module.exports;
}

for (const id of cohortIds) {
  for (const mediaType of ['movie', 'tv']) {
    test(`${id} ${mediaType}: actual source contains one parsed provider iframe through the WebView handoff and injections`, () => {
      const source = registry.getRegisteredSource(id);
      const url = registry.getSourceUrl(id, mediaType, { tmdbId: 550, imdbId: 'tt0137523' }, 1, 2);
      assert.ok(url.length > 0);
      assert.equal(new URL(url).protocol, 'https:');
      assert.equal(source.requiresIframeWrapper, true);
      assert.equal(source.releaseStatus, 'candidate');
      assert.equal(source.routingMode, 'manual-only');
      assert.equal(source.supportsDownloads, false);
      const input = support.createProviderWebViewSource(url, source);
      assert.deepEqual(Object.keys(input).sort(), ['baseUrl', 'html']);
      assert.equal(input.baseUrl, 'https://orion.local/player/');
      assert.match(input.html, /<body><iframe\s/);
      assert.doesNotMatch(input.html, /&lt;iframe|document\.write|innerHTML|replaceChildren/);
      const result = handoff(source, input, injectionProps(source));
      assert.equal(result.props.source, input);
      assert.equal(result.events.length, 2);
      assert.equal(result.events[0].metadata.stage, 'wrapper-source-built');
      assert.equal(result.events[1].handedOff, true); // Trace precedes handing source to WebView.
      assert.deepEqual(result.events[0].metadata, {
        stage: 'wrapper-source-built', sourceId: id, hasIframe: true, iframeCountExpected: 1,
        providerOrigin: source.expectedOrigins[0], htmlLengthBucket: 'lt-1k', hasDiagnosticScript: true, hasAdBlocker: true,
      });
      const nativeSource = stockNewSource(result.props.source);
      assert.equal(nativeSource.html, input.html);
      assert.equal(nativeSource.baseUrl, input.baseUrl);
      assert.doesNotMatch(result.props.injectedJavaScript, /postMessage\([^;]*['"]\*['"]/);
      // External resources are disabled by default; outside-only scripts run only when explicitly evaluated.
      const dom = new JSDOM(nativeSource.html, { url: nativeSource.baseUrl, runScripts: 'outside-only' });
      try {
        const { window } = dom;
        const frames = window.document.querySelectorAll('iframe');
        assert.equal(frames.length, 1);
        assert.equal(frames[0].src, url);
        assert.equal(new URL(frames[0].src).origin, source.expectedOrigins[0]);
        assert.notEqual(new URL(frames[0].src).origin, window.location.origin);
        assert.equal(frames[0].isConnected, true);
        assert.equal(window.document.querySelectorAll('script').length, 0);
        assert.equal(window.document.querySelector('meta[http-equiv="Content-Security-Policy"]').content,
          `default-src 'none'; style-src 'unsafe-inline'; frame-src ${source.expectedOrigins.join(' ')}`);
        const messages = [];
        window.ReactNativeWebView = { postMessage: raw => messages.push(JSON.parse(raw)) };
        window.eval(result.props.injectedJavaScriptBeforeContentLoaded);
        window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
        window.eval(result.props.injectedJavaScript);
        assert.equal(window.document.querySelectorAll('iframe').length, 1);
        assert.equal(window.document.querySelector('iframe').src, url);
        assert.ok(messages.some(value => value.stage === 'provider-iframe-present' && value.iframeCount === 1));
        assert.ok(messages.some(value => value.stage === 'provider-iframe-connected' && value.isConnected));
        assert.equal(window.__orionCinemaCleanupInstalled, true);
        window.__orionPlaybackTelemetry.stop();
      } finally { dom.window.close(); }
    });
  }
}

test('document-start diagnostics and the parser use the same main document before frame insertion', async () => {
  const source = registry.getRegisteredSource('mapple');
  const input = support.createProviderWebViewSource(registry.getSourceUrl(source.id, 'movie', 550), source);
  const injections = injectionProps(source), messages = [];
  let documentBeforeParsing;
  const dom = new JSDOM(input.html, {
    url: input.baseUrl, runScripts: 'outside-only',
    beforeParse(window) {
      documentBeforeParsing = window.document;
      assert.equal(window.document.querySelectorAll('iframe').length, 0);
      window.ReactNativeWebView = { postMessage: raw => messages.push(JSON.parse(raw)) };
      window.eval(injections.injectedJavaScriptBeforeContentLoaded);
    },
  });
  try {
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(dom.window.document, documentBeforeParsing);
    assert.equal(dom.window.document.querySelectorAll('iframe').length, 1);
    assert.ok(messages.some(value => value.stage === 'wrapper-document-ready' && value.iframeCount === 1));
    assert.ok(messages.some(value => value.stage === 'provider-iframe-present'));
    dom.window.eval(injections.injectedJavaScript);
    assert.equal(dom.window.document.querySelectorAll('iframe').length, 1);
    dom.window.__orionPlaybackTelemetry.stop();
  } finally { dom.window.close(); }
});

test('attribute/JSON escaping cannot swallow iframe markup or introduce a second element', () => {
  const source = registry.getRegisteredSource('mapple');
  const url = new URL(registry.getSourceUrl(source.id, 'movie', 550));
  url.searchParams.set('fixture', '</iframe><script>SECRET_FIXTURE</script>"&');
  const input = support.createProviderWebViewSource(url.toString(), source);
  const result = handoff(source, input, injectionProps(source));
  const dom = new JSDOM(input.html, { url: input.baseUrl });
  try {
    assert.equal(dom.window.document.querySelectorAll('iframe').length, 1);
    assert.equal(dom.window.document.querySelectorAll('script').length, 0);
    assert.equal(dom.window.document.querySelector('iframe').src, url.toString());
    assert.doesNotMatch(JSON.stringify(result.events), /SECRET_FIXTURE|\/watch\/movie|fixture=/);
  } finally { dom.window.close(); }
});

test('pre-load diagnostics report absent markup and script flags without altering fallback or leaking input', () => {
  const source = registry.getRegisteredSource('mapple');
  const invalid = support.createProviderWebViewSource('', source);
  assert.deepEqual(invalid, { uri: 'about:blank' });
  const result = handoff(source, invalid, {});
  assert.equal(result.props.source, invalid);
  assert.deepEqual(result.events[0].metadata, {
    stage: 'wrapper-source-built', sourceId: 'mapple', hasIframe: false, iframeCountExpected: 0,
    providerOrigin: 'https://mapple.fun', htmlLengthBucket: 'empty', hasDiagnosticScript: false, hasAdBlocker: false,
  });
  const logs = [], previous = console.info;
  console.info = (_lane, raw) => logs.push(JSON.parse(raw));
  try {
    for (const src of ['https://private.fixture/path?token=SECRET_FIXTURE', 'not-a-url']) {
      diagnostics.recordWrapperSourceBuilt('mapple', source.expectedOrigins,
        { html: `<iframe src="${src}"></iframe>`, headers: 'SECRET_FIXTURE', cookies: 'SECRET_FIXTURE' }, '', '');
    }
    assert.ok(logs.every(value => value.hasIframe && value.providerOrigin === null));
    assert.doesNotMatch(JSON.stringify(logs), /SECRET_FIXTURE|private\.fixture|headers|cookies|not-a-url/);
    assert.deepEqual(Object.keys(logs[0]).sort(), ['stage', 'sourceId', 'hasIframe', 'iframeCountExpected', 'providerOrigin', 'htmlLengthBucket', 'hasDiagnosticScript', 'hasAdBlocker'].sort());
    for (const length of [1024, 4096, 16384]) diagnostics.recordWrapperSourceBuilt('mapple', source.expectedOrigins, { html: 'x'.repeat(length) }, '', '');
    assert.deepEqual(logs.slice(-3).map(value => value.htmlLengthBucket), ['1k-4k', '4k-16k', '16k-plus']);
    const throwingSource = Object.defineProperty({}, 'html', { get() { throw new Error('SECRET_FIXTURE'); } });
    assert.doesNotThrow(() => diagnostics.recordWrapperSourceBuilt('mapple', source.expectedOrigins, throwingSource, '', ''));
  } finally { console.info = previous; }
});

test('VixSrc and VidSrc retain URI loads and receive no wrapper construction event', () => {
  for (const id of ['vixsrc', 'vidsrc']) {
    const source = registry.getRegisteredSource(id);
    const url = registry.getSourceUrl(id, 'movie', 550);
    const input = support.createProviderWebViewSource(url, source);
    const result = handoff(source, input, injectionProps(source));
    assert.deepEqual(input, { uri: url });
    assert.equal(result.props.source, input);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].handedOff, true);
    assert.deepEqual(stockNewSource(input), input);
  }
});

test('native handoff keeps HTML MIME/encoding, inherited newSource forwarding, and construction policy unchanged', () => {
  const delegate = read('apps/mobile/plugins/orion-cinema-webview-native/OrionCinemaWebViewManagerDelegate.java');
  assert.match(delegate, /super\.setProperty\(view, propName, value\)/);
  const root = 'apps/mobile/node_modules/react-native-webview/android/';
  assert.match(read(root + 'build/generated/source/codegen/java/com/facebook/react/viewmanagers/RNCWebViewManagerDelegate.java'), /case "newSource":\s*mViewManager\.setNewSource\(view, \(ReadableMap\) value\)/);
  assert.match(read(root + 'src/newarch/com/reactnativecommunity/webview/RNCWebViewManager.java'), /setNewSource\([\s\S]*?mRNCWebViewManagerImpl\.setSource\(view, value\)/);
  const impl = read(root + 'src/main/java/com/reactnativecommunity/webview/RNCWebViewManagerImpl.kt');
  assert.match(impl, /HTML_MIME_TYPE = "text\/html"/);
  assert.match(impl, /loadDataWithBaseURL\(\s*baseUrl,\s*html!!,\s*HTML_MIME_TYPE,\s*HTML_ENCODING,\s*null\s*\)/);
  assert.match(impl, /mPendingSource\?\.let \{ source ->\s*loadSource\(viewWrapper, source\)/);
  const authority = '2fc92411da3b1e0d35a3a57cd4c9482e17391e64';
  for (const relative of ['packages/shared/src/sources/adapters/candidates.ts', 'packages/shared/src/sources/adapters/primary.ts',
    'packages/shared/src/sources/contracts.ts', 'apps/mobile/src/features/playback/EmbedPlayerSurface.tsx',
    'apps/mobile/src/features/playback/providerEmbedSupport.ts', 'apps/mobile/src/features/playback/mobileAdBlocker.ts',
    'apps/mobile/plugins/orion-cinema-webview-native/OrionCinemaWebViewManager.kt']) {
    const original = execFileSync('git', ['show', `${authority}:${relative}`], { cwd: workspaceRoot, encoding: 'utf8' });
    assert.equal(read(relative).replace(/\r\n/g, '\n'), original.replace(/\r\n/g, '\n'));
  }
});
