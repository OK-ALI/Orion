const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const broker = fs.readFileSync(
  path.join(ROOT, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadRequestContextBroker.kt'),
  'utf8',
);

test('V8.9 traces safe HLS playlist semantics before qualification', () => {
  assert.match(broker, /stage=hls-preflight-shape/);
  assert.match(broker, /append\(shape\.kind\)/);
  assert.match(broker, /append\(shape\.variantCount\)/);
  assert.match(broker, /append\(shape\.uriCount\)/);
  assert.match(broker, /append\(shape\.extinfCount\)/);
  assert.match(broker, /append\(shape\.totalDurationMs\)/);
  assert.match(broker, /append\(shape\.targetDurationSeconds\)/);
  assert.match(broker, /append\(shape\.endList\)/);
  assert.match(broker, /append\(shape\.mapCount\)/);
  assert.match(broker, /append\(shape\.keyCount\)/);
  assert.match(broker, /append\(shape\.byteRangeCount\)/);
});

test('V8.9 traces safe first HLS media child size and signature without coordinates', () => {
  assert.match(broker, /stage=hls-media-child/);
  assert.match(broker, /append\(media\.contentLength\)/);
  assert.match(broker, /append\(mediaSignature\)/);
  assert.match(broker, /append\(mediaIsPlaylist\)/);
  assert.match(broker, /contentLength = connection\.contentLengthLong/);
  assert.match(broker, /"mpeg-ts-offset"/);
  assert.match(broker, /"iso-bmff-offset"/);
  assert.match(broker, /return "image-png"/);
  assert.match(broker, /return "image-jpeg"/);
  assert.match(broker, /return "gzip"/);
  assert.match(broker, /return "webvtt"/);
  assert.match(broker, /return "text-other"/);

  const diagnosticLines = broker
    .split(/\r?\n/)
    .filter((line) => line.includes('stage=hls-preflight-shape') || line.includes('stage=hls-media-child') || line.includes('stage=hls-media-representative'))
    .join('\n');
  assert.doesNotMatch(diagnosticLines, /rawUrl|playlistUrl|fragment\.url|representative\.url|cookie|authorization|query|header/i);
});

test('V8.9 remains diagnostic-only and does not reject binary-other media yet', () => {
  assert.match(broker, /if \(!mediaIsPlaylist\) \{/);
  assert.doesNotMatch(broker, /mediaSignature\s*!==?\s*"mpeg-ts"/);
  assert.doesNotMatch(broker, /unsupported-hls-media-signature/);
});
