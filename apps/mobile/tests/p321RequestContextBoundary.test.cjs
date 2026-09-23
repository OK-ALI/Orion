'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const plugin = path.resolve(__dirname, '../plugins/orion-cinema-webview-native');
const broker = fs.readFileSync(path.join(plugin, 'OrionDownloadRequestContextBroker.kt'), 'utf8');
const http = fs.readFileSync(path.join(plugin, 'OrionDownloadAuthorizedHttp.kt'), 'utf8');
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

test('exact observed cross-origin request wins; unobserved child never inherits root auth, Cookie or Origin', () => {
  const selection = between(broker, 'private fun authorizedRequestFor(', 'private fun sanitizeReferer(');
  assert.match(selection, /val observed = observedRequestMaterial\[context\.sessionId\]\?\.get\(normalized\)/);
  assert.match(selection, /observed\.headers\.toMap\(\)/);
  assert.match(selection, /if \(sameOrigin\)/);
  assert.match(selection, /safeCrossOriginHeaders\(context\.requestHeaders\)/);
  assert.match(selection, /captureCookie\(normalized, emptyMap\(\)\)/);
  const fallback = between(broker, 'internal fun safeCrossOriginHeaders(', 'private fun sanitizeReferer(');
  assert.match(fallback, /"accept", "accept-language", "user-agent"/);
  assert.doesNotMatch(fallback, /"origin"|"authorization"|"cookie"/);
  assert.match(fallback, /sanitizeReferer\(value\)/);
  assert.match(broker, /if \(!isSafePublicHttpUrl\(normalized\)\) return null/);
  assert.doesNotMatch(broker, /publicOriginSafetyCache/);
  assert.match(http, /"cookie",\s*"accept-encoding" -> false/);
  assert.match(broker, /observed\.cookieHeader \?: captureCookie\(normalized, observed\.headers\)/);
});
