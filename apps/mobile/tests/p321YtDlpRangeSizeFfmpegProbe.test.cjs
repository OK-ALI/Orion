const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const gateway = fs.readFileSync(
  path.join(ROOT, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpGateway.kt'),
  'utf8',
);
const runtime = fs.readFileSync(
  path.join(ROOT, 'plugins', 'orion-cinema-webview-native', 'OrionDownloadYtDlpRuntime.kt'),
  'utf8',
);

test('V8.8 exposes numeric provider range dimensions without provider coordinates', () => {
  assert.match(gateway, /responseLength=\$contentLength/);
  assert.match(gateway, /rangeStart=\$\{providerRangeMetrics\?\.start \?: -1L\}/);
  assert.match(gateway, /rangeEnd=\$\{providerRangeMetrics\?\.endInclusive \?: -1L\}/);
  assert.match(gateway, /rangeTotal=\$\{providerRangeMetrics\?\.total \?: -1L\}/);
  assert.match(gateway, /rangeLength=\$\{providerRangeMetrics\?\.length \?: -1L\}/);
  assert.match(gateway, /rangeLengthMatch=\$\{rangeLengthMatch\(contentLength, providerRangeMetrics\)\}/);
  assert.match(gateway, /private fun parseProviderContentRange\(/);

  const responseDiagnostics = gateway
    .split(/\r?\n/)
    .filter((line) => line.includes('stage=provider-response'))
    .join('\n');
  assert.doesNotMatch(responseDiagnostics, /childUrl|parentUrl|rootUrl|cookie|authorization|capability|routeKey/i);
});

test('V8.8 proves the read/write gap is the pending failed write, not omitted first-write accounting', () => {
  assert.match(gateway, /output\.write\([\s\S]*?buffer,[\s\S]*?0,[\s\S]*?read,[\s\S]*?\)[\s\S]*?deliveredBytes \+= read[\s\S]*?providerWrittenByteCount\.addAndGet\(read\.toLong\(\)\)/);
  assert.match(gateway, /pendingWriteBytes=\$read readAheadGap=\$\{readBytes - deliveredBytes\}/);
});

test('V8.8 strengthens safe media signature classification', () => {
  assert.match(gateway, /return "mpeg-ts"/);
  assert.match(gateway, /return "mpeg-ps"/);
  assert.match(gateway, /return "iso-bmff"/);
  assert.match(gateway, /"binary-high-entropy"/);
  assert.match(gateway, /"binary-other"/);
  assert.match(gateway, /cadence\(4, 192\)/);
});

test('V8.8 classifies yt-dlp\/FFmpeg output without logging raw lines', () => {
  assert.match(runtime, /safeExecutionDiagnosticClass\(line\)/);
  assert.match(runtime, /stage=yt-dlp-output class=\$diagnosticClass/);
  assert.match(runtime, /"error when loading first segment" in line -> "hls-first-segment-error"/);
  assert.match(runtime, /"invalid data found when processing input" in line -> "invalid-media"/);
  assert.match(runtime, /"could not find codec parameters" in line -> "codec-parameters-missing"/);
  assert.match(runtime, /"detected only with low score" in line -> "probe-score-low"/);
  assert.match(runtime, /"moov atom not found" in line -> "moov-missing"/);

  const diagnosticLogLines = runtime
    .split(/\r?\n/)
    .filter((line) => line.includes('stage=yt-dlp-output'))
    .join('\n');
  assert.doesNotMatch(diagnosticLogLines, /rawLine|\$line|rootUrl|http:|https:|cookie|authorization/i);
});
