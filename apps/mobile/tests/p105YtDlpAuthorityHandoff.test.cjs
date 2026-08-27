const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const plugin = fs.readFileSync(path.join(ROOT, 'plugins', 'withOrionCinemaWebView.js'), 'utf8');
const nativeRoot = path.join(ROOT, 'plugins', 'orion-cinema-webview-native');
const authority = fs.readFileSync(path.join(nativeRoot, 'OrionDownloadYtDlpAuthority.kt'), 'utf8');
const runtime = fs.readFileSync(path.join(nativeRoot, 'OrionDownloadYtDlpRuntime.kt'), 'utf8');
const transfer = fs.readFileSync(path.join(nativeRoot, 'OrionDownloadTransferRuntime.kt'), 'utf8');

test('P10.5 Candidate 3 creates a broker-backed fail-closed yt-dlp authority handoff', () => {
  assert.match(plugin, /'OrionDownloadYtDlpAuthority\.kt'/);
  assert.match(authority, /internal data class OrionYtDlpAuthority/);
  assert.match(authority, /internal object OrionDownloadYtDlpAuthorityBroker/);
  assert.match(authority, /OrionDownloadRequestContextBroker\.resolveForJob\(/);
  assert.match(authority, /GLOBAL_SAFE_HEADER_NAMES = setOf\([\s\S]*"accept"[\s\S]*"accept-language"[\s\S]*"user-agent"/);
  assert.match(authority, /!request\.cookieHeader\.isNullOrBlank\(\)/);
  assert.match(authority, /request\.headers\.keys\.any \{ it\.lowercase\(Locale\.US\) !in GLOBAL_SAFE_HEADER_NAMES \}/);
  assert.match(authority, /networkEnforcementRequired = true/);
  assert.doesNotMatch(authority, /safeGlobalHeaders\s*=.*cookie/i);

  assert.match(runtime, /authority: OrionYtDlpAuthority/);

  // Candidate 5 may orchestrate a BoundTransferContext above the raw process
  // boundary. Candidate 3's invariant is that the raw execute() boundary
  // itself accepts only OrionYtDlpAuthority.
  const rawExecuteStart = runtime.indexOf('  fun execute(\n');
  const rawExecuteEnd = runtime.indexOf('  fun stop(', rawExecuteStart);
  assert.ok(
    rawExecuteStart >= 0 && rawExecuteEnd > rawExecuteStart,
    'raw yt-dlp execute() boundary must remain identifiable',
  );
  const rawExecute = runtime.slice(rawExecuteStart, rawExecuteEnd);
  assert.match(rawExecute, /authority: OrionYtDlpAuthority/);
  assert.doesNotMatch(rawExecute, /bound: BoundTransferContext/);

  assert.match(runtime, /authority\.scopedCredentialsRequired/);
  assert.match(runtime, /yt-dlp-scoped-credentials-required/);
  assert.match(runtime, /authority\.networkEnforcementRequired/);
  assert.match(runtime, /yt-dlp-network-enforcement-required/);
  assert.match(runtime, /authority\.safeGlobalHeaders/);
  assert.doesNotMatch(runtime, /cookieHeader/);

  const guard = runtime.indexOf('if (authority.networkEnforcementRequired)');
  const init = runtime.indexOf('FFmpeg.getInstance().init(appContext)');
  assert.ok(guard >= 0 && init >= 0 && guard < init, 'network enforcement guard must fail closed before process initialization');

  assert.doesNotMatch(transfer, /OrionDownloadYtDlpRuntime\.execute\(/);
});
