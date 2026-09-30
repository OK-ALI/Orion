'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createLoader, cohortIds, sharedSources, workspaceRoot } = require('./helpers/providerExpansionCohortA.cjs');

const load = createLoader();
const registry = load(sharedSources);
const support = load('apps/mobile/src/features/playback/providerEmbedSupport.ts');

// Execute Orion's actual React wrapper and inspect the props sent to the stock WebView.
function renderCinemaWebView(props) {
  const filename = path.join(workspaceRoot, 'apps/mobile/src/features/playback/OrionCinemaWebView.tsx');
  const module = { exports: {} };
  const WebView = () => null;
  const mocks = {
    react: {
      forwardRef: render => render, useEffect() {}, useMemo: factory => factory(),
      useRef: value => ({ current: value }),
    },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': {
      Platform: { OS: 'android' }, requireNativeComponent: name => name,
      DeviceEventEmitter: { addListener: () => ({ remove() {} }) },
    },
    'react-native-webview': { WebView },
  };
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('exports', 'require', 'module', js)(module.exports, name => {
    if (name === './embeddedWrapperDiagnostics') return load('apps/mobile/src/features/playback/embeddedWrapperDiagnostics.ts');
    assert.ok(Object.hasOwn(mocks, name), `Unexpected Cinema wrapper import: ${name}`);
    return mocks[name];
  }, module);
  const node = module.exports.OrionCinemaWebView(props, { current: null });
  assert.equal(node.type, WebView);
  assert.equal(node.props.nativeConfig.component, 'OrionCinemaWebView');
  return node.props;
}

for (const id of cohortIds) {
  test(`${id} preserves explicit wrapper navigation and separate request authority at the native shield boundary`, () => {
    const registered = registry.getRegisteredSource(id);
    assert.equal(registered.releaseStatus, 'candidate');
    assert.equal(registered.routingMode, 'manual-only');
    assert.equal(registered.supportsDownloads, false);
    // Exercise the fallback that previously replaced both lists with expectedOrigins.
    const descriptor = { ...registered, requestManifest: undefined };
    const manifest = support.getProviderShieldManifest(id, descriptor);
    const source = support.createProviderWebViewSource(registry.getSourceUrl(id, 'movie', 550), descriptor);
    const policy = support.getProviderCapturePolicy(descriptor);
    const nativeProps = renderCinemaWebView({
      shieldManifest: manifest, shieldSessionId: `shield-${id}`, source,
      downloadCaptureEnabled: policy.captureEnabled, downloadProviderClass: descriptor.releaseStatus,
      javaScriptEnabled: true, setSupportMultipleWindows: false,
    });
    const serialized = JSON.parse(nativeProps.nativeConfig.props.orionShieldSession);
    assert.deepEqual(serialized.allowedNavigationOrigins, descriptor.allowedNavigationOrigins);
    assert.deepEqual(serialized.requiredOrigins, descriptor.requiredRequestOrigins);
    assert.equal(serialized.allowedNavigationOrigins.includes('https://orion.local'), true);
    assert.equal(serialized.requiredOrigins.includes('https://orion.local'), false);
    assert.deepEqual(serialized.mediaOrigins, []);
    assert.deepEqual(serialized.artworkOrigins, []);
    assert.deepEqual(serialized.subtitleOrigins, []);
    assert.equal(serialized.popupPolicy, 'block');
    assert.equal(serialized.mode, 'observe');
    assert.equal(serialized.downloadCaptureEnabled, true);
    assert.equal(serialized.providerClass, 'candidate');
    assert.equal(policy.diagnosticOnly, true);
    // HTML/baseUrl survive Orion's custom nativeConfig path without becoming a URI load.
    assert.equal(nativeProps.source, source);
    assert.equal(nativeProps.source.baseUrl, 'https://orion.local/player/');
    assert.match(nativeProps.source.html, /<iframe src="https:\/\//);
    assert.equal(Object.hasOwn(nativeProps.source, 'uri'), false);
    assert.equal(nativeProps.setSupportMultipleWindows, false);
  });
}

test('registered enforced manifests already contain wrapper navigation and are forwarded unchanged', () => {
  for (const id of cohortIds) {
    const source = registry.getRegisteredSource(id);
    const manifest = support.getProviderShieldManifest(id, source);
    assert.equal(manifest, source.requestManifest);
    assert.equal(manifest.mode, 'enforce');
    assert.equal(manifest.allowedNavigationOrigins.includes('https://orion.local'), true);
    assert.deepEqual(manifest.requiredOrigins, source.requiredRequestOrigins);
    assert.deepEqual(manifest.mediaOrigins, []);
    assert.equal(manifest.popupPolicy, 'block');
    assert.ok(manifest.rules.length > 0);
  }
});

test('fallback uses only declared navigation/request lists and never treats navigation as media authority', () => {
  const source = {
    ...registry.getRegisteredSource('mapple'), requestManifest: undefined,
    expectedOrigins: ['https://frame.example'],
    allowedNavigationOrigins: ['https://orion.local', 'https://navigation.example'],
    requiredRequestOrigins: ['https://request.example'],
  };
  const manifest = support.getProviderShieldManifest(source.id, source);
  assert.deepEqual(manifest.allowedNavigationOrigins, source.allowedNavigationOrigins);
  assert.deepEqual(manifest.requiredOrigins, source.requiredRequestOrigins);
  assert.deepEqual(manifest.mediaOrigins, []);
  assert.equal(manifest.allowedNavigationOrigins.includes(source.expectedOrigins[0]), false);
  assert.equal(manifest.requiredOrigins.includes('https://orion.local'), false);
  assert.equal(manifest.allowedNavigationOrigins.some(origin => origin.includes('*')), false);
});

test('non-wrapper legacy fallbacks retain expectedOrigins only when each explicit field is absent', () => {
  const source = {
    ...registry.getRegisteredSource('vidsrc'), requestManifest: undefined,
    allowedNavigationOrigins: undefined, requiredRequestOrigins: undefined,
  };
  const legacy = support.getProviderShieldManifest(source.id, source);
  assert.deepEqual(legacy.allowedNavigationOrigins, source.expectedOrigins);
  assert.deepEqual(legacy.requiredOrigins, source.expectedOrigins);
  assert.deepEqual(legacy.mediaOrigins, []);
  const empty = support.getProviderShieldManifest(source.id, {
    ...source, allowedNavigationOrigins: [], requiredRequestOrigins: [],
  });
  assert.deepEqual(empty.allowedNavigationOrigins, []);
  assert.deepEqual(empty.requiredOrigins, []);
  const partial = support.getProviderShieldManifest(source.id, { ...source, requiredRequestOrigins: [] });
  assert.deepEqual(partial.allowedNavigationOrigins, source.expectedOrigins);
  assert.deepEqual(partial.requiredOrigins, []);
  const unknown = support.getProviderShieldManifest('unknown', undefined);
  assert.deepEqual(unknown.allowedNavigationOrigins, []);
  assert.deepEqual(unknown.requiredOrigins, []);
});

test('VixSrc and VidSrc keep their existing URL loads, enforced manifests, and capture policy', () => {
  for (const id of ['vixsrc', 'vidsrc']) {
    const source = registry.getRegisteredSource(id);
    const before = JSON.stringify(source);
    const url = registry.getSourceUrl(id, 'movie', 550);
    assert.equal(support.getProviderShieldManifest(id, source), source.requestManifest);
    assert.deepEqual(support.createProviderWebViewSource(url, source), { uri: url });
    assert.equal(support.getProviderCapturePolicy(source).diagnosticOnly, false);
    assert.equal(JSON.stringify(source), before);
  }
});

test('player surface passes the resolved manifest and HTML source through the existing Cinema component', () => {
  const surface = fs.readFileSync(path.join(workspaceRoot, 'apps/mobile/src/features/playback/EmbedPlayerSurface.tsx'), 'utf8');
  assert.match(surface, /getProviderShieldManifest\(sourceId, source\)/);
  assert.match(surface, /shieldManifest=\{shieldManifest\}/);
  assert.match(surface, /source=\{webViewSource\}/);
  assert.doesNotMatch(surface, /allowedNavigationOrigins:\s*expectedOrigins/);
});
