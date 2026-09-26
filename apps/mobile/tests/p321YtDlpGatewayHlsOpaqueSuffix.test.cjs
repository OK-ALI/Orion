const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const gateway = fs.readFileSync(
  path.join(ROOT, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpGateway.kt'),
  'utf8',
);
const hls = fs.readFileSync(
  path.join(ROOT, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpHlsGateway.kt'),
  'utf8',
);

test('V8.6 gives opaque HLS media routes an FFmpeg-accepted local suffix without exposing provider coordinates', () => {
  assert.match(gateway, /routeSuffix: String = "bin"/);
  assert.match(gateway, /return registerRoute\(\s*routeSuffix,/);
  assert.match(hls, /routeSuffix = if \(isKey\) "bin" else "ts"/);
  assert.match(hls, /allowed_segment_extensions/);
  assert.doesNotMatch(hls, /routeSuffix\s*=\s*[^\n]*(?:childUrl|parentUrl|rootUrl)/);
  assert.doesNotMatch(hls, /routeSuffix\s*=\s*[^\n]*substringAfter/);
});
