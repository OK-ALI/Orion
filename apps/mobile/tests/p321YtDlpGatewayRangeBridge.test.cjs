const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const gateway = fs.readFileSync(
  path.join(ROOT, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpGateway.kt'),
  'utf8',
);

test('V8.4 loopback gateway preserves FFmpeg byte-range semantics without exposing provider authority', () => {
  assert.match(gateway, /val rangeStart: Long\?/);
  assert.match(gateway, /val rangeEndInclusive: Long\?/);
  assert.match(gateway, /val rangeRequested: Boolean/);
  assert.match(gateway, /parseClientRange\(/);
  assert.match(gateway, /startsWith\("bytes=", ignoreCase = true\)/);
  assert.match(gateway, /spec\.contains\(','\)/);
  assert.match(gateway, /effectiveRangeStart/);
  assert.match(gateway, /route\.rangeStart \?: if \(!route\.isKey\) clientRangeStart else null/);
  assert.match(gateway, /rangeStart = effectiveRangeStart/);
  assert.match(gateway, /rangeEndInclusive =\s*effectiveRangeEndInclusive/);
  assert.match(gateway, /stage=provider-route outcome=range-forwarded/);
  assert.match(gateway, /stage=yt-dlp-gateway outcome=summary/);
  assert.match(gateway, /provider2xx=/);
  assert.match(gateway, /provider4xx=/);
  assert.match(gateway, /provider5xx=/);
  assert.doesNotMatch(gateway, /stage=provider-route[^\n]*(?:childUrl|parentUrl|rootUrl|cookie|authorization)/i);
});
