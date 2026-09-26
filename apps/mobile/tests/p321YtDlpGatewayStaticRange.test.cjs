const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const gateway = fs.readFileSync(
  path.join(ROOT, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpGateway.kt'),
  'utf8',
);

test('V8.5 loopback static manifests honor FFmpeg single-byte-range semantics before provider dispatch', () => {
  assert.match(gateway, /is StaticRoute ->[\s\S]{0,320}clientRangeStart = request\.rangeStart/);
  assert.match(gateway, /clientRangeEndInclusive = request\.rangeEndInclusive/);
  assert.match(gateway, /clientRangeRequested = request\.rangeRequested/);
  assert.match(gateway, /private fun writeStatic\([\s\S]{0,260}clientRangeRequested: Boolean/);
  assert.match(gateway, /if \(clientRangeRequested\)/);
  assert.match(gateway, /status = HttpURLConnection\.HTTP_PARTIAL/);
  assert.match(gateway, /"Content-Range" to "bytes \$start-\$end\/\$bodySize"/);
  assert.match(gateway, /"Accept-Ranges" to "bytes"/);
  assert.match(gateway, /route\.body,[\s\S]{0,80}start\.toInt\(\),[\s\S]{0,80}length\.toInt\(\)/);
  assert.match(gateway, /stage=static-route outcome=range-served/);
  assert.match(gateway, /stage=static-route outcome=range-unsatisfied/);
  assert.match(gateway, /"Content-Range" to "bytes \*\/\$bodySize"/);
  assert.doesNotMatch(gateway, /stage=static-route[^\n]*(?:childUrl|parentUrl|rootUrl|cookie|authorization)/i);
});
