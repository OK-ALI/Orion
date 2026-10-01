'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobile = path.resolve(__dirname, '..');
const repo = path.resolve(mobile, '../..');

function text(relative) {
  return fs.readFileSync(path.join(repo, relative), 'utf8');
}

test('VidLink is download-enabled only as a manual candidate', () => {
  const candidates = text('packages/shared/src/sources/adapters/candidates.ts');
  const block = candidates.match(/id:\s*"vidlink"[\s\S]*?\n\s*},/i)?.[0] || '';
  assert.match(block, /releaseStatus:\s*"candidate"/);
  assert.match(block, /supportsDownloads:\s*true/);
  assert.match(block, /routingMode:\s*"manual-only"/);
  assert.doesNotMatch(block, /routingMode:\s*"automatic"/);
});

test('DASH gateway completion is fail-closed and unavailable fragments abort', () => {
  const runtime = text('apps/mobile/plugins/orion-cinema-webview-native/OrionDownloadYtDlpRuntime.kt');
  assert.match(runtime, /configureDashResumeRoot\([\s\S]*?dash-resume-v1/);
  assert.match(runtime, /stage=dash-transfer-proof complete=\$\{proof\.complete\}/);
  assert.match(runtime, /gateway\.awaitCompletionProof\(\)/);
  assert.match(runtime, /yt-dlp-dash-transfer-incomplete/);
  assert.match(runtime, /--abort-on-unavailable-fragments/);
  assert.match(runtime, /prepareGatewayExecutionOutput/);
  assert.match(runtime, /kind=dash/);
});

test('DASH recovery uses only verified provider-fragment cache across process restarts', () => {
  const gateway = text('apps/mobile/plugins/orion-cinema-webview-native/OrionDownloadYtDlpGateway.kt');
  assert.match(gateway, /fun configureDashResumeRoot\(root: File\): Boolean/);
  assert.match(gateway, /bound\.transferKind !in setOf\("hls", "dash"\)/);
  assert.match(gateway, /orion-\$\{bound\.transferKind\}-resume-v1/);
  assert.match(gateway, /verifiedResumeFile\(fingerprint\)/);
  assert.match(gateway, /commitResumeCapture\(/);
  assert.match(gateway, /markMediaComplete\(routeKey, size, notifyProgress = false\)/);
});

test('generated Android native owners remain exact copies of plugin source', () => {
  for (const name of ['OrionDownloadYtDlpRuntime.kt', 'OrionDownloadYtDlpGateway.kt']) {
    const plugin = text(`apps/mobile/plugins/orion-cinema-webview-native/${name}`);
    const generated = text(`apps/mobile/android/app/src/main/java/com/okali/orion/playback/${name}`);
    assert.equal(generated, plugin, `${name} generated Android parity`);
  }
});
