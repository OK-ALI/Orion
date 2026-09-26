'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const broker = fs.readFileSync(
  path.join(root, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadRequestContextBroker.kt'),
  'utf8',
);

test('V8.11 tolerates MIME-only HTML mismatch only for keyed opaque HLS ciphertext', () => {
  assert.match(
    broker,
    /private fun tolerateKeyedOpaqueMimeMismatch\(probe: ChildProbe, keyed: Boolean\): ChildProbe/,
  );
  assert.match(
    broker,
    /if \(!keyed \|\| probe\.code != "invalid-media" \|\| probe\.bytes\.isEmpty\(\)\) return probe/,
  );
  assert.match(
    broker,
    /declaredDocument[\s\S]*text\/html[\s\S]*application\/json/,
  );
  assert.match(
    broker,
    /declaredDocument && signature == "binary-other"/,
  );
  assert.match(
    broker,
    /probe\.copy\(code = null, reason = null\)/,
  );
});

test('V8.11 applies keyed opaque MIME tolerance to first and representative HLS media probes', () => {
  const occurrences = broker.match(
    /tolerateKeyedOpaqueMimeMismatch\(probe, plan\.keyUrls\.isNotEmpty\(\)\)/g,
  ) || [];
  assert.equal(occurrences.length, 2);
  assert.match(
    broker,
    /val media = probeChild\(context, fragment, 4096, false, mediaBytes = true\)\.let/,
  );
  assert.match(
    broker,
    /val representativeProbe = probeChild\(context, representative\.url, 4096, false, mediaBytes = true\)\.let/,
  );
});

test('V8.11 keeps actual HTML JSON text and unkeyed invalid-media rejection intact', () => {
  const child = broker.slice(
    broker.indexOf('private fun probeChild('),
    broker.indexOf('private fun isHlsPlaylistProbe('),
  );
  assert.match(child, /type\.contains\("text\/html"\)/);
  assert.match(child, /type\.contains\("application\/json"\)/);
  assert.match(child, /code = "invalid-media"/);
  assert.match(broker, /signature == "binary-other"/);
  assert.doesNotMatch(
    broker,
    /tolerateKeyedOpaqueMimeMismatch\(probe,\s*true\)/,
  );
});

test('V8.11 does not alter request replay transport or trust policy', () => {
  assert.match(
    broker,
    /val request = authorizedRequestFor\(context, url\)/,
  );
  assert.match(
    broker,
    /if \(!descendantAllowed\(context, url\)\)/,
  );
  assert.match(
    broker,
    /if \(!redirectAllowed\(context, url\)\)/,
  );
});
