const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const path = require('node:path');
const { loader } = require('./helpers/animeModules.cjs');
const { aniLinkFrameHost, event } = require('./helpers/aniLinkFrameHarness.cjs');
const root = path.resolve(__dirname, '../../..');
const nativePath = 'apps/mobile/plugins/orion-cinema-webview-native/';
const client = fs.readFileSync(path.join(root, nativePath, 'OrionCinemaWebViewClient.kt'), 'utf8');
const snapshotScript = /private val WRAPPER_DIAGNOSTIC_SCRIPT = """([\s\S]+?)"""\.trimIndent\(\)/.exec(client)[1];
const url = 'https://anilink.cc/watch/21175/1?autoplay=true&autonext=false&variant=sub';
function snapshot(host, extra = {}) {
  const document = { readyState: 'complete', body: {children: [host.frame]},
    getElementById: () => host.frame, querySelectorAll: () => [host.frame], ...extra };
  return JSON.parse(vm.runInNewContext(snapshotScript, {window:host.window, document, URL}));
}
test('actual native snapshot script reports the public selected route, parent DOM and existing bridge counters', () => {
  const host = aniLinkFrameHost(url); host.send(event('ready')); host.send(event('play')); host.send(event());
  const result = snapshot(host);
  assert.equal(result.documentOrigin, 'wrapper'); assert.equal(result.frameOrigin, 'provider');
  assert.equal(result.publicWatchUrl, url); assert.equal(new URL(result.publicWatchUrl).searchParams.has('start'), false);
  assert.equal(result.frameCount, 1); assert.equal(result.frameConnected, true); assert.equal(result.selectedBridge, true);
  assert.deepEqual(result.events, {ready:1,play:1,progress:1}); assert.deepEqual(result.counts, {accepted:3});
  assert.equal(result.rows,3); assert.deepEqual(host.messages.map(m=>m.state), ['loading','playing','playing']);
  assert.equal(result.firstEvent,'ready');assert.equal(result.firstReason,'accepted');assert.equal(result.lastReason,'accepted');
});
test('diagnostic reasons distinguish validation stages without accepting previously rejected provider messages', () => {
  const host=aniLinkFrameHost(url);
  host.send(event(),'https://evil.invalid'); host.send(event(),'https://anilink.cc',{});
  host.frame.src=url+'&start=120'; host.send(event()); host.frame.src=url;
  host.send(event('progress',{episodeNumber:2})); host.send(event('progress',{position:'PRIVATE'})); host.send(event('serverschange'));
  assert.deepEqual(host.messages,[]);
  assert.deepEqual(snapshot(host).counts, {'origin':1,'frame-window':1,'frame-url':1,identity:1,payload:1,unsupported:1});
  host.window.location=new URL('https://anilink.cc/watch/21175/1?variant=sub'); host.send(event());
  assert.equal(snapshot(host).counts.topology,1);
  host.window.location=new URL('https://orion.local/player/'); host.window.__orionPlaybackTelemetry.sessionId='stale'; host.send(event());
  assert.equal(snapshot(host).counts.session,1); assert.deepEqual(host.messages,[]);
});
test('trace output never serializes payload text, request context, foreign URLs or unsupported event names', () => {
  const host=aniLinkFrameHost(url);
  host.send(event('error',{code:'PRIVATE_CODE',message:'PRIVATE_BODY',cookie:'PRIVATE_COOKIE',url:'https://private.invalid/signed?token=PRIVATE_TOKEN'}));
  const output=JSON.stringify(snapshot(host)); assert.doesNotMatch(output,/PRIVATE|cookie|token|signed|private\.invalid/);
  assert.equal(host.messages[0].state,'error'); host.send(event()); assert.equal(host.messages.length,1);
  assert.equal(snapshot(host).counts.terminal,1);
  const fresh=aniLinkFrameHost(url); fresh.send({type:'anilink-player:PRIVATE_NAME',payload:{}});
  assert.deepEqual(snapshot(fresh).events,{}); assert.doesNotMatch(JSON.stringify(snapshot(fresh)),/PRIVATE_NAME/);
});
test('public route capture fails closed for private/unknown parameters, malformed values, credentials and duplicate parameters', () => {
  const host=aniLinkFrameHost(url);
  for(const value of ['https://evil.invalid/watch/21175/1?variant=sub','http://anilink.cc/watch/21175/1?variant=sub',
    'https://secret@anilink.cc/watch/21175/1?variant=sub',url+'&token=PRIVATE',url+'&cookie=PRIVATE',
    url+'&variant=sub',url+'#PRIVATE',url+'&start=PRIVATE',url.replace('variant=sub','variant=raw'),
    url.replace('21175','0'),url.replace('variant=sub','variant=%73ub')]) {
    host.frame.src=value; const result=snapshot(host); assert.equal(result.publicWatchUrl,null,value);
    assert.doesNotMatch(JSON.stringify(result),/PRIVATE|evil\.invalid|secret@/);
  }
  for(const start of ['0','1200']){host.frame.src=url+'&start='+start;assert.equal(snapshot(host).publicWatchUrl,host.frame.src);}
});
test('missing frame/body and malformed diagnostic fields remain bounded and do not expose arbitrary data', () => {
  const host=aniLinkFrameHost(url); const result=snapshot(host,{getElementById:()=>null,querySelectorAll:()=>[],body:null});
  assert.equal(result.frameCount,0);assert.equal(result.bodyChildren,0);assert.equal(result.frameOrigin,'absent');assert.equal(result.publicWatchUrl,null);
  host.window.__orionPlaybackTelemetry.diagnostics={rows:Infinity,events:{ready:'PRIVATE',error:65,PRIVATE_KEY:1},counts:{origin:-1,PRIVATE_KEY:2}};
  const safe=snapshot(host);assert.equal(safe.rows,0);assert.deepEqual(safe.events,{});assert.deepEqual(safe.counts,{});
  assert.doesNotMatch(JSON.stringify(safe),/PRIVATE/);
});
test('empty document diagnostics distinguish blank/data and MIME categories without exposing document contents', () => {
  const host=aniLinkFrameHost(url);
  for(const [location,expectedScheme,blank] of [['about:blank','about',true],
    ['data:text/html,PRIVATE_HTML','data',false],['file:///PRIVATE_PATH','file',false],
    ['https://private.invalid/PRIVATE?token=PRIVATE','https',false],['secret:PRIVATE','other',false]]) {
    host.window.location=new URL(location);
    for(const [contentType,expectedType] of [['text/html','html'],['text/plain','plain'],
      ['application/xhtml+xml','xhtml'],['PRIVATE_TYPE','other']]) {
      const result=snapshot(host,{getElementById:()=>null,querySelectorAll:()=>[],body:null,contentType});
      assert.equal(result.documentScheme,expectedScheme);assert.equal(result.documentBlank,blank);
      assert.equal(result.contentType,expectedType);assert.equal(result.frameCount,0);
      assert.doesNotMatch(JSON.stringify(result),/PRIVATE|token|private\.invalid/);
    }
  }
});
test('diagnostic budget and lifecycle cleanup do not change telemetry acceptance or revive a stopped owner', () => {
  const host=aniLinkFrameHost(url);for(let i=0;i<100;i++)host.send(event());
  assert.equal(host.messages.length,100,'diagnostic budget must not suppress healthy telemetry');
  assert.equal(snapshot(host).rows,64); assert.equal(snapshot(host).events.progress,64);
  const callback=[...host.listeners][0], previous=JSON.stringify(snapshot(host));host.window.__orionPlaybackTelemetry.stop();
  callback({data:event(),origin:'https://anilink.cc',source:host.frame.contentWindow});
  assert.equal(host.messages.length,100);assert.equal(JSON.stringify(snapshot(host)),previous);
  host.inject('next');assert.equal(snapshot(host).rows,0);assert.equal(host.listeners.size,1);
});
test('providers outside the two diagnostic owners contain no diagnostic counters or additional owner fields', () => {
  const bridge=loader()('apps/mobile/src/features/playback/embeddedTelemetry.ts');
  for(const id of ['vixsrc','vidsrc','vidsrc-ir','cinesrc']) {
    const script=bridge.createEmbeddedTelemetryScript({sessionId:'current',sourceId:id,strategy:'player-event',expectedOrigins:['https://example.invalid']});
    assert.doesNotMatch(script,/aniLinkDiagnostics|diagnostics:/);
  }
});
test('native instrumentation keeps source/navigation/error authorities and excludes every non-diagnostic provider', () => {
  const manager=fs.readFileSync(path.join(root,nativePath,'OrionCinemaWebViewManager.kt'),'utf8');
  const chrome=fs.readFileSync(path.join(root,nativePath,'OrionCinemaWebChromeClient.kt'),'utf8');
  assert.match(manager,/override fun setNewSource[\s\S]*?recordSourceDiagnostic\(value\)[\s\S]*?super\.setNewSource\(viewWrapper, value\)/);
  assert.match(manager,/override fun onAfterUpdateTransaction[\s\S]*?recordSourceTransactionDiagnostic\(viewWrapper\.webView, "before"\)[\s\S]*?super\.onAfterUpdateTransaction\(viewWrapper\)[\s\S]*?recordSourceTransactionDiagnostic\(viewWrapper\.webView, "after"\)/);
  assert.match(client,/it\.sourceId in listOf\("anilink", "aniembed"\) && it\.downloadCaptureEnabled && !it\.downloadAllowed/);
  assert.match(client,/diagnosticRows >= 96/);assert.match(client,/if \(\+\+samples < 8\)/);
  assert.match(client,/request\.isForMainFrame \|\| decision\.decision == "blocked"[\s\S]*?traceNavigationDiagnostic\("wrapper-intercept-request"/);
  assert.match(client,/"scheme-deny", "hostless-deny", "owned-wrapper-html" -> decision\.ruleId/);
  assert.match(client,/generation != diagnosticGeneration \|\| session != manifest\?\.sessionId/);
  assert.match(client,/removeCallbacks\(it\)/);assert.match(client,/fun dispose\(\) \{\s*wrapperSourceLoad\.clear\(\)\s*cancelDiagnosticPoll\(\)/);
  assert.match(chrome,/recordConsoleDiagnostic\(message\)\s*return super\.onConsoleMessage\(message\)/);
  assert.match(client,/return if \(decision\.decision == "blocked" && request\.isForMainFrame\) true else super\.shouldOverrideUrlLoading\(view, request\)/);
  assert.match(client,/return if \(decision\.decision == "blocked"\) true else super\.shouldOverrideUrlLoading\(view, url\)/);
  assert.match(client,/super\.onReceivedError\(view, request, error\)/);assert.match(client,/super\.onReceivedHttpError\(view, request, response\)/);
  const diagnosticMethods=client.slice(client.indexOf('fun recordSourceTransactionDiagnostic'),client.indexOf('override fun onRenderProcessGone'));
  assert.doesNotMatch(diagnosticMethods,/\.headers|\.description|\.sourceId\(\)|innerHTML|outerHTML|innerText|textContent|loadUrl|loadData|setSource|postMessage/);
});
test('owned HTML permission stays within the stock source commit and never becomes download/request authority', () => {
  const manager=fs.readFileSync(path.join(root,nativePath,'OrionCinemaWebViewManager.kt'),'utf8');
  assert.match(manager,/stageWrapperSource\(value\)[\s\S]*?super\.setNewSource\(viewWrapper, value\)/);
  assert.match(manager,/armWrapperSource\(\)[\s\S]*?super\.onAfterUpdateTransaction\(viewWrapper\)/);
  const interception=client.slice(client.indexOf('override fun shouldInterceptRequest'),client.indexOf('@Deprecated("Deprecated in Android")'));
  const owned=interception.slice(interception.indexOf('val owner = manifest'),interception.indexOf('val decision = classify'));
  assert.match(owned,/owner\.sourceId, owner\.sessionId/);assert.match(owned,/request\.isForMainFrame/);
  assert.match(owned,/ShieldDecision\("allow", "navigation", "owned-wrapper-html"\)/);assert.match(owned,/return null/);
  assert.doesNotMatch(owned,/observeRequest|mediaOrigins|requiredOrigins|observeServiceWorker/);
  assert.match(client,/previousSessionId != next\?\.sessionId \|\| previousSourceId != next\?\.sourceId\) wrapperSourceLoad\.invalidate\(\)/);
  assert.match(client,/override fun onPageFinished[^]*?wrapperSourceLoad\.clear\(\)/);
  assert.match(client,/fun dispose\(\) \{\s*wrapperSourceLoad\.clear\(\)/);
  const classify=client.slice(client.indexOf('private fun classify'),client.indexOf('private fun emit'));
  assert.match(classify,/scheme != "http" && scheme != "https"[^]*?ShieldDecision\("blocked", "unsafe-navigation", "scheme-deny"\)/);
  assert.doesNotMatch(classify,/owned-wrapper-html|OrionWrapperSourceLoad/);
});
