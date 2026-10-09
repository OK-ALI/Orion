const test = require('node:test'), assert = require('node:assert/strict');
const { loader } = require('./helpers/animeModules.cjs');
const load = loader(), { getAniLinkResumeDiagnosticUrl: control } = load('apps/mobile/src/features/playback/aniLinkResumeDiagnostic.ts');
const registry = load('packages/shared/src/sources/registry.ts');
const support = load('apps/mobile/src/features/playback/providerEmbedSupport.ts');
const { aniLinkFrameHost, event } = require('./helpers/aniLinkFrameHarness.cjs');
const full = 'https://anilink.cc/watch/21175/1?autoplay=true&autonext=false&start=167&variant=sub';

test('normal builds keep the registered production URL and capabilities unchanged', () => {
  assert.equal(process.env.EXPO_PUBLIC_ORION_ANILINK_RESUME_CONTROL, undefined);
  const url = registry.getSourceUrl('anilink', 'tv', { anilistId: 21175 }, 1, 1, { start: 167, variant: 'sub' });
  assert.equal(url, full); assert.equal(control('anilink', url), full);
  for (const mode of ['', 'full', 'unknown']) assert.equal(control('anilink', url, mode), full);
  const source = registry.getRegisteredSource('anilink');
  assert.equal(source.releaseStatus, 'candidate'); assert.equal(source.routingMode, 'manual-only');
  assert.equal(source.supportsDownloads, false); assert.equal(source.animeProvider.playbackQualified, false);
});

test('explicit opt-in selects only the documented minimal positive route for the same identity and variant', () => {
  assert.equal(control('anilink', full, 'minimal'), 'https://anilink.cc/watch/21175/1?variant=sub&start=167');
  for (const target of [137, 167, 240]) for (const variant of ['sub', 'dub']) {
    const input = full.replace('start=167', `start=${target}`).replace('variant=sub', `variant=${variant}`);
    const result = new URL(control('anilink', input, 'minimal'));
    assert.equal(result.pathname, '/watch/21175/1'); assert.equal(result.searchParams.get('start'), String(target));
    assert.equal(result.searchParams.get('variant'), variant); assert.equal([...result.searchParams].length, 2);
  }
});

test('explicit Start Over, ordinary opens, other providers and malformed/private URLs are never rewritten', () => {
  for (const value of [full.replace('start=167', 'start=0'), full.replace('&start=167', ''),
    full.replace('https:', 'http:'), full.replace('anilink.cc', 'evil.invalid'), full.replace('https://', 'https://secret@'),
    full + '#fragment', full + '&token=PRIVATE', full + '&start=167', full.replace('start=167', 'start=-1'),
    full.replace('start=167', 'start=NaN'), full.replace('variant=sub', 'variant=raw'), full.replace('/21175/', '/0/'), 'invalid']) {
    assert.equal(control('anilink', value, 'minimal'), value);
  }
  for (const id of ['aniembed', 'vixsrc', 'vidsrc', 'vidsrc-ir', 'cinesrc', 'vidlink']) assert.equal(control(id, full, 'minimal'), full);
});

test('minimal URL reaches the same wrapper, CSP and exact-frame bridge with the positive target intact', () => {
  const url = control('anilink', full, 'minimal'), source = registry.getRegisteredSource('anilink');
  const wrapper = support.createProviderWebViewSource(source, url);
  assert.equal(wrapper.baseUrl, 'https://orion.local/player/'); assert.match(wrapper.html, /frame-src https:\/\/anilink\.cc/);
  assert.match(wrapper.html, /variant=sub&amp;start=167/);
  const host = aniLinkFrameHost(url);
  for (const position of [167, 167.8, 168.9]) host.send(event('progress', { position, duration: 1402 }));
  assert.deepEqual(host.messages.map(row => row.currentTime), [167, 167.8, 168.9]);
  host.send(event(), 'https://evil.invalid'); host.send(event(), 'https://anilink.cc', {});
  host.frame.src = full; host.send(event()); assert.equal(host.messages.length, 3);
});
