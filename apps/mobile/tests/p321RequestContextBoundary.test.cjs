'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const plugin = path.resolve(__dirname, '../plugins/orion-cinema-webview-native');
const broker = fs.readFileSync(path.join(plugin, 'OrionDownloadRequestContextBroker.kt'), 'utf8');
const http = fs.readFileSync(path.join(plugin, 'OrionDownloadAuthorizedHttp.kt'), 'utf8');
const gateway = fs.readFileSync(path.join(plugin, 'OrionDownloadYtDlpGateway.kt'), 'utf8');
const runtime = fs.readFileSync(path.join(plugin, 'OrionDownloadYtDlpRuntime.kt'), 'utf8');
const transfer = fs.readFileSync(path.join(plugin, 'OrionDownloadTransferRuntime.kt'), 'utf8');
const store = fs.readFileSync(path.join(plugin, 'OrionDownloadJobStore.kt'), 'utf8');
const between = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start) + start.length));

test('root and child redirects use destination-aware context and a public-network boundary', () => {
  const root = between(broker, 'private fun performPreflight(context:', 'private fun inspectResponse(');
  assert.match(root, /!redirectAllowed\(context, redirect\)/);
  assert.match(root, /performPreflightAt\(context, redirect\)/);
  const opener = between(broker, 'private fun openConnection(', 'private fun finishAndEmit(');
  assert.match(opener, /authorizedRequestFor\(context, rawUrl\)/);
  assert.doesNotMatch(opener, /context\.cookieHeader|context\.requestHeaders/);
  const child = between(broker, 'private fun probeChild(', 'private fun openConnection(');
  assert.match(child, /if \(!redirectAllowed\(context, url\)\)/);
  assert.match(http, /private fun authorizedRedirect\(/);
  assert.equal((http.match(/authorizedRedirect\(bound, request\.url, redirectUrl\)/g) || []).length, 2);
  assert.match(broker, /authorizeRedirectForJob\(/);
  assert.match(broker, /private fun redirectAllowed\([\s\S]*?trustedRedirectDestination\(/);
  assert.match(broker, /private fun descendantAllowed\([\s\S]*?trustedDescendantDestination\(/);
  assert.match(broker, /allowedOrigins\.contains\(origin\) \|\| observedUrls\.any \{ originOf\(it\) == origin \}/);
  assert.match(broker, /allowedOrigins\.contains\(origin\) \|\| observedUrls\.contains\(rawUrl\)/);
  assert.match(broker, /isSafePublicHttpUrl\(rawUrl\)/);
  assert.doesNotMatch(broker, /private fun descendantAllowed\(context: CapturedContext, rawUrl: String\): Boolean =\s*isSafePublicHttpUrl\(rawUrl\)/);
});

test('exact observations win and observed-origin browser identity is inherited without cross-URL credentials', () => {
  const selection = between(broker, 'private fun authorizedRequestFor(', 'private fun sanitizeReferer(');
  assert.match(selection, /val observed = OrionBoundObservationPolicy\.selectExact\(/);
  assert.match(selection, /activeObservedFor\(context\)/);
  assert.match(selection, /context\.boundObservedRequestMaterial/);
  assert.match(selection, /observed\.headers\.toMap\(\)/);
  assert.match(selection, /if \(sameOrigin\)/);
  assert.match(selection, /OrionBoundObservationPolicy\.selectOrigin\(/);
  assert.match(selection, /safeObservedOriginHeaders\(observedOrigin\.headers\)/);
  assert.match(selection, /safeCrossOriginHeaders\(context\.requestHeaders\)/);
  assert.match(selection, /captureCookie\(normalized, emptyMap\(\)\)/);
  const fallback = between(broker, 'internal fun safeCrossOriginHeaders(', 'private fun sanitizeReferer(');
  assert.match(fallback, /"accept", "accept-language", "user-agent"/);
  assert.doesNotMatch(fallback, /"origin"|"authorization"|"cookie"/);
  const observedFallback = between(broker, 'internal fun safeObservedOriginHeaders(', 'internal fun safeCrossOriginHeaders(');
  assert.match(observedFallback, /"origin"/);
  assert.match(observedFallback, /"referer"/);
  assert.doesNotMatch(observedFallback, /"authorization"|"cookie"/);
  assert.match(fallback, /sanitizeReferer\(value\)/);
  assert.match(broker, /if \(!isSafePublicHttpUrl\(normalized\)\) return null/);
  assert.doesNotMatch(broker, /publicOriginSafetyCache/);
  assert.match(http, /"cookie",\s*"accept-encoding" -> false/);
  assert.match(broker, /observed\.cookieHeader \?: captureCookie\(normalized, observed\.headers\)/);
});

test('closing temporary playback preserves bounded exact observations only for its bound download job', () => {
  const release = between(broker, 'fun releaseSession(sessionId: String)', 'fun releaseJob(jobId: String)');
  assert.match(release, /val observed = observedRequestMaterial\.remove\(sessionId\)/);
  assert.match(release, /it\.sessionId == sessionId && it\.boundJobId != null/);
  assert.match(release, /it\.boundObservedRequestMaterial = snapshot/);
  assert.match(release, /it\.sessionReleased = true/);
  assert.match(release, /it\.sessionId == sessionId && it\.boundJobId == null/);
  assert.match(broker, /OrionBoundObservationPolicy\.selectExact\([\s\S]*?context\.boundObservedRequestMaterial/);
  assert.match(broker, /OrionBoundObservationPolicy\.selectOrigin\([\s\S]*?context\.boundObservedRequestMaterial/);
  assert.match(broker, /OrionBoundObservationPolicy\.trustedUrls\([\s\S]*?context\.boundObservedRequestMaterial/);
  assert.match(broker, /if \(context\.sessionReleased\) null else observedRequestMaterial\[context\.sessionId\]/);
  assert.match(broker, /fun releaseJob\(jobId: String\)[\s\S]*?remove\.forEach\(::removeLocked\)/);
});

test('HLS progress counts completed provider routes and never treats a yt-dlp fragment total as episode size', () => {
  const hls = between(runtime, 'fun executeHlsGateway(', 'fun executeDashGateway(');
  assert.match(hls, /\.start\(cleanJobId, onMeasuredMediaProgress\)/);
  assert.match(hls, /onProgress = \{\}/);
  assert.match(gateway, /synchronized\(mediaProgressLock\)[\s\S]*?completedProviderBytes\.putIfAbsent\(routeKey, deliveredBytes\) == null/);
  assert.match(gateway, /reachedEnd && deliveredBytes > 0L/);
  assert.match(gateway, /onMediaProgress\(bytes, completedProviderBytes\.size, providerRouteCount\.get\(\)\)/);
  assert.match(transfer, /onMeasuredMediaProgress = \{ bytes, completed, total ->[\s\S]*?setGatewayMediaProgress\(jobId, bytes, completed, total\)/);
  const measured = between(store, 'fun setGatewayMediaProgress(', 'fun setFinalizationStage(');
  assert.match(measured, /progress\.put\("totalBytes", JSONObject\.NULL\)/);
  assert.match(measured, /safeCompleted\.toDouble\(\) \* 100\.0 \/ safeTotal\.toDouble\(\)/);
  assert.match(measured, /progress\.put\("percent", percent \?: JSONObject\.NULL\)/);
  assert.match(measured, /progress\.put\("completedFragments", safeCompleted\)/);
  assert.match(measured, /estimateGatewayEtaSeconds/);
});

test('HLS and DASH verify staged audio/video before treating Orion Library output size as complete', () => {
  for (const body of [
    between(transfer, 'private fun runHlsYtDlp(', 'private fun runHlsFragmented('),
    between(transfer, 'private fun runDashYtDlp(', 'private fun runDashFragmented('),
  ]) {
    const verify = body.indexOf('OrionFinalizedMediaVerifier.verify(');
    const reject = body.indexOf('if (!mediaVerification.ok)');
    const promote = body.indexOf('val verifiedBytes = mediaVerification.sizeBytes');
    const progress = body.indexOf('OrionDownloadJobStore.setProgress(', promote);
    assert.ok(verify >= 0 && verify < reject && reject < promote && promote < progress);
    assert.doesNotMatch(body.slice(verify, progress), /media\.length\(\)/);
    assert.match(body, /finalizeDirect\(/);
  }
});
