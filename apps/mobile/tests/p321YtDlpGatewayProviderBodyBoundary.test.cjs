const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const gateway = fs.readFileSync(
  path.join(ROOT, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpGateway.kt'),
  'utf8',
);

test('V8.7 distinguishes provider read, loopback write, EOF and safe media signature boundaries', () => {
  assert.match(gateway, /providerAttemptCount = AtomicInteger\(0\)/);
  assert.match(gateway, /providerReadByteCount = AtomicLong\(0L\)/);
  assert.match(gateway, /providerWrittenByteCount = AtomicLong\(0L\)/);
  assert.match(gateway, /providerEofCount = AtomicInteger\(0\)/);
  assert.match(gateway, /providerReadErrorCount = AtomicInteger\(0\)/);
  assert.match(gateway, /providerWriteErrorCount = AtomicInteger\(0\)/);

  assert.match(gateway, /stage=provider-response attempt=\$providerAttempt/);
  assert.match(gateway, /status=\$status/);
  assert.match(gateway, /length=\$\{contentLengthState\(contentLength\)\}/);
  assert.match(gateway, /contentRange=\$\{contentRangeState\(/);
  assert.match(gateway, /contentType=\$\{contentTypeClass\(providerContentType\)\}/);

  assert.match(gateway, /stage=provider-body attempt=\$providerAttempt firstRead=bytes count=\$read signature=\$\{mediaSignatureClass\(buffer, read\)\}/);
  assert.match(gateway, /stage=provider-body attempt=\$providerAttempt firstRead=eof/);
  assert.match(gateway, /stage=provider-body attempt=\$providerAttempt outcome=read-error/);
  assert.match(gateway, /stage=provider-client attempt=\$providerAttempt firstWrite=ok/);
  assert.match(gateway, /stage=provider-client attempt=\$providerAttempt outcome=write-error/);
  assert.match(gateway, /stage=provider-client attempt=\$providerAttempt outcome=flush-error/);
  assert.match(gateway, /providerReadBytes=\$\{providerReadByteCount\.get\(\)\}/);
  assert.match(gateway, /providerWrittenBytes=\$\{providerWrittenByteCount\.get\(\)\}/);

  assert.match(gateway, /return "mpeg-ts"/);
  assert.match(gateway, /return "iso-bmff"/);
  assert.match(gateway, /return "aac-adts"/);
  assert.match(gateway, /return "hls"/);
  assert.match(gateway, /return "html"/);
  assert.match(gateway, /return "json"/);

  // Diagnostics must remain structural only. Never emit provider coordinates,
  // cookies, authorization material, or raw body/header payloads.
  const diagnosticLines = gateway
    .split(/\r?\n/)
    .filter((line) => line.includes('stage=provider-response') || line.includes('stage=provider-body') || line.includes('stage=provider-client'))
    .join('\n');
  assert.doesNotMatch(diagnosticLines, /childUrl|parentUrl|rootUrl|cookie|authorization|capability|routeKey/i);
  assert.doesNotMatch(diagnosticLines, /getHeaderField\("(?:Set-Cookie|Location|Authorization)"\)/i);
});
