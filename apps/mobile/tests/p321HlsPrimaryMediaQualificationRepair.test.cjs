const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const brokerPath = path.join(root, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadRequestContextBroker.kt');
const broker = fs.readFileSync(brokerPath, 'utf8');

test('V8.10 rejects WebVTT and other obvious non-AV payloads from primary HLS qualification', () => {
  assert.match(broker, /private fun isPrimaryHlsMediaSignature\(signature: String\): Boolean = when \(signature\)/);
  for (const signature of ['webvtt', 'text-other', 'html', 'json', 'image-png', 'image-jpeg', 'image-gif', 'image-webp', 'gzip', 'zip']) {
    assert.ok(broker.includes(`\"${signature}\"`), `missing rejected signature ${signature}`);
  }
  assert.match(broker, /code = \"hls-primary-media-not-av\"/);
  assert.match(broker, /!mediaIsPlaylist && !isPrimaryHlsMediaSignature\(mediaSignature\)/);
});

test('V8.10 preserves opaque AES-128 media eligibility instead of requiring a plaintext container signature', () => {
  assert.match(broker, /Unknown binary remains eligible[\s\S]*AES-128 media is intentionally opaque before decryption/);
  assert.doesNotMatch(broker, /\"binary-other\"\s*->\s*false/);
  assert.match(broker, /append\(\" keyed=\"\)\.append\(plan\.keyUrls\.isNotEmpty\(\)\)/);
});

test('V8.10 traces safe first-segment failure shape before returning invalid-media', () => {
  const probeIndex = broker.indexOf('val media = probeChild(context, fragment, 4096, false, mediaBytes = true)');
  const traceIndex = broker.indexOf('stage=hls-media-child', probeIndex);
  const returnIndex = broker.indexOf('if (media.code != null) return MediaProbe', probeIndex);
  assert.ok(probeIndex >= 0 && traceIndex > probeIndex && returnIndex > traceIndex,
    'safe HLS media-child trace must happen before an invalid-media return');
  for (const field of [' status=', ' type=', ' signature=', ' keyed=', ' context=', ' outcome=']) {
    assert.ok(broker.includes(`append(\"${field}\")`), `missing safe trace field ${field}`);
  }
  assert.match(broker, /private fun requestContextClass[\s\S]*exact-observed[\s\S]*same-root-origin[\s\S]*observed-origin[\s\S]*cross-origin-fallback/);
});

test('V8.10 keeps invalid-media response bytes for classification without logging raw payloads or coordinates', () => {
  assert.match(broker, /if \(mediaBytes &&[\s\S]*return ChildProbe\([\s\S]*bytes = bytes,[\s\S]*contentType = type,[\s\S]*contentLength = connection\.contentLengthLong,[\s\S]*status = status,[\s\S]*code = \"invalid-media\"/);
  assert.doesNotMatch(broker, /append\(.*rawUrl/);
  assert.doesNotMatch(broker, /append\(.*request\.headers/);
  assert.doesNotMatch(broker, /append\(.*cookie/i);
});
