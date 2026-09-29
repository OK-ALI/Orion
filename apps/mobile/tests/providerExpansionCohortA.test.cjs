'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLoader, cohortIds, sharedSources } = require('./helpers/providerExpansionCohortA.cjs');

const load = createLoader({
  '../../services/sourceHealth': { getMobileSourceHealth: () => null, getMobileSourceHealthV2: () => null },
  '../../services/storageAdapter': { mmkvStorageAdapter: { get: () => null, set() {} } },
});
const registry = load(sharedSources);
const contracts = load('packages/shared/src/sources/contracts.ts');
const mobile = load('apps/mobile/src/features/playback/mobileSources.ts');
const desktop = load('apps/desktop/src/renderer/features/player/sources/registry.js');
const support = load('apps/mobile/src/features/playback/providerEmbedSupport.ts');
const presentation = load('apps/mobile/src/features/playback/presentationPreferences.ts');

const cases = [
  ['mapple', 'https://mapple.fun', '/watch/movie/550', '/watch/tv/1399-1-2', 'startAt', 'autoPlay', 'true'],
  ['stellar', 'https://stellar.rip', '/en/watch/embed/movie/550', '/en/watch/embed/tv/1399-1-2', 'startAt', 'autoPlay', 'true'],
  ['chillflix', 'https://www.chillflix.lol', '/embed/movie/550', '/embed/tv/1399/1/2', 'startAt', 'autoplay', 'true'],
  ['vidsrc-sh', 'https://vidsrc.sh', '/embed/movie/tt0137523', '/embed/tv/tt0944947/1/2', 'startAt', 'autoplay', '1'],
  ['vidapi', 'https://vaplayer.ru', '/embed/movie/tt0137523', '/embed/tv/tt0944947/1/2', 'resumeAt', 'autoplay', '1'],
];

test('Cohort A registers unique candidates with enforced, least-privilege request manifests', () => {
  assert.equal(contracts.assertSourceRegistry([...registry.ALL_CINEMA_SOURCES]), true);
  assert.equal(new Set(registry.ALL_CINEMA_SOURCES.map(source => source.id)).size, registry.ALL_CINEMA_SOURCES.length);
  for (const [id, origin] of cases) {
    const source = registry.getRegisteredSource(id);
    assert.deepEqual(contracts.validateSourceDescriptor(source), []);
    assert.equal(source.releaseStatus, 'candidate');
    assert.equal(source.routingMode, 'manual-only');
    assert.equal(source.supportsDownloads, false);
    assert.equal(source.supportsDiagnosticCapture, true);
    assert.equal(source.progressStrategy, 'player-event');
    assert.equal(source.resumeStrategy, 'url-param');
    assert.equal(source.requiresIframeWrapper, true);
    assert.deepEqual(source.media, { movie: true, tv: true, anime: false });
    assert.deepEqual(source.expectedOrigins, [origin]);
    assert.deepEqual(source.allowedNavigationOrigins, ['https://orion.local', origin]);
    assert.deepEqual(source.requiredRequestOrigins, [origin]);
    assert.equal(source.requestManifest.mode, 'enforce');
    assert.equal(source.requestManifest.popupPolicy, 'block');
    assert.deepEqual(source.requestManifest.mediaOrigins, []);
    assert.deepEqual(source.requestManifest.artworkOrigins, []);
    assert.deepEqual(source.requestManifest.subtitleOrigins, []);
    assert.deepEqual(source.requestManifest.rules, registry.getRegisteredSource('vixsrc').requestManifest.rules);
  }
});

for (const [id, origin, moviePath, tvPath, resumeParam, autoplayParam, autoplayValue] of cases) {
  test(`${id} builds documented movie/episode URLs, explicit resume, and canonical IDs`, () => {
    for (const [type, ids, expectedPath] of [
      ['movie', { tmdbId: 550, imdbId: 'tt0137523' }, moviePath],
      ['tv', { tmdbId: 1399, imdbId: 'tt0944947' }, tvPath],
    ]) {
      const initial = new URL(registry.getSourceUrl(id, type, ids, 1, 2));
      assert.equal(initial.origin + initial.pathname, origin + expectedPath);
      assert.equal(initial.searchParams.get(resumeParam), '0');
      assert.equal(initial.searchParams.get(autoplayParam), autoplayValue);
      assert.equal(initial.searchParams.has('prefer4k'), false);
      const params = registry.getSourceResumeParams(id, 92.8, type);
      assert.deepEqual(params, { [resumeParam]: 92 });
      const resumed = new URL(registry.getSourceUrl(id, type, ids, 1, 2, params));
      assert.equal(resumed.searchParams.get(resumeParam), '92');
      assert.equal(resumed.searchParams.getAll(resumeParam).length, 1);
      assert.equal(new URL(registry.getSourceUrl(id, type, ids, 1, 2, { [resumeParam]: 0 })).searchParams.get(resumeParam), '0');
    }
    const source = registry.getRegisteredSource(id);
    assert.equal(new URL(source.buildMovieUrl(550)).pathname.endsWith('/550'), true);
    const specials = new URL(source.buildEpisodeUrl(1399, 0, 1));
    assert.match(specials.pathname, /(?:-0-1|\/0\/1)$/);
    for (const badId of ['', 'https://evil.example/', '../550?startAt=999', 0, -1]) {
      assert.throws(() => source.buildMovieUrl(badId), /ID is required/);
    }
    for (const [season, episode] of [[-1, 1], [1, 0], [1.5, 1], [1, NaN]]) {
      assert.throws(() => source.buildEpisodeUrl(1399, season, episode), /season and episode/);
    }
    if (source.idPolicy.movie === 'tmdb') {
      assert.throws(() => source.buildMovieUrl('tt0137523'), /TMDb ID/);
    } else {
      assert.equal(registry.resolveSourceMediaId(id, 'movie', { tmdbId: 550, imdbId: 'tt0137523' }), 'tt0137523');
      assert.equal(registry.resolveSourceMediaId(id, 'movie', { tmdbId: 550 }), 550);
    }
  });
}

test('Cohort A disables provider advancement and exposes only documented subtitle contracts', () => {
  for (const id of ['mapple', 'stellar']) {
    const params = registry.getRegisteredSource(id).params;
    assert.equal(params.autoNext, 'false');
    assert.equal(params.nextButton, 'false');
    assert.equal(params.title, 'false');
    assert.equal(params.poster, 'false');
  }
  assert.equal(registry.getRegisteredSource('chillflix').params.autonext, 'false');
  assert.equal(registry.getRegisteredSource('chillflix').params.watchparty, 'false');
  assert.equal(registry.getRegisteredSource('vidsrc-sh').params.autonext, '0');
  for (const id of ['vidsrc-sh', 'vidapi']) {
    const source = registry.getRegisteredSource(id);
    assert.equal(source.supportsExternalSubtitles, true);
    const subtitle = 'https://subtitles.example/en.vtt?language=en&track=2';
    const url = new URL(registry.getSourceUrl(id, 'movie', 550, 1, 1, {
      [source.externalSubtitleParam]: subtitle,
      [source.externalSubtitleLabelParam]: 'English & commentary',
      [source.externalSubtitleLanguageParam]: 'en',
    }, null, 'en'));
    assert.equal(url.searchParams.get('sub_url'), subtitle);
    assert.equal(url.searchParams.get('sub_label'), 'English & commentary');
    assert.equal(url.searchParams.get('sub_lang'), 'en');
    assert.equal(url.searchParams.get('ds_lang'), 'en');
  }
  for (const id of ['mapple', 'stellar', 'chillflix']) {
    assert.equal(registry.getRegisteredSource(id).supportsExternalSubtitles, false);
    assert.equal(registry.getRegisteredSource(id).subtitleStrategy, 'provider');
  }
});

test('Cohort A stays manual on Mobile and invisible on Desktop, including status restoration', () => {
  const status = load('packages/shared/src/types/providerStatus.ts');
  const restored = status.applyOrionProviderStatusV1(registry.ALL_CINEMA_SOURCES, {
    statuses: cohortIds.map(sourceId => ({ sourceId, action: 'restore', availability: 'ready', message: 'Restored' })),
  });
  assert.equal(mobile.MOBILE_DEFAULT_CINEMA_SOURCE_ID, 'vixsrc');
  for (const id of cohortIds) {
    assert.equal(mobile.MOBILE_PLAYER_SOURCES.some(source => source.id === id), true);
    assert.equal(registry.AUTOMATIC_PLAYER_SOURCES.some(source => source.id === id), false);
    assert.equal(restored.find(source => source.id === id).routingMode, 'manual-only');
    assert.equal(restored.find(source => source.id === id).supportsDownloads, false);
    const capability = mobile.getMobileSourceContinuityCapability(id);
    assert.equal(capability.mode, 'resume-unverified');
    assert.equal(capability.automaticTarget, false);
    assert.equal(capability.canReceivePosition, true);
    assert.equal(mobile.mobileSourceSupportsContinuity(id), false);
    assert.equal(mobile.getPreferredMobileResumeSource(id, 'movie'), 'vixsrc');
    for (const type of ['movie', 'tv']) {
      assert.equal(mobile.getMobileDownloadSourceChoices(type).some(source => source.id === id), false);
    }
  }
  assert.equal(mobile.getNextMobileContinuitySource('vixsrc', 'movie'), null);
  assert.deepEqual(desktop.PLAYER_SOURCES.map(source => source.id), ['vixsrc', 'vidsrc', 'vidlink', '111movies', 'vidnest', 'vidsrc-ir', 'cinesrc']);
  assert.deepEqual(desktop.AUTOMATIC_PLAYER_SOURCES.map(source => source.id), ['vixsrc']);
});

test('Cohort A wrappers use exact HTTPS CSP and the existing Orion presentation modes', () => {
  for (const [id, origin] of cases) {
    const source = registry.getRegisteredSource(id);
    const target = registry.getSourceUrl(id, 'movie', 550, 1, 1);
    const wrapped = support.createProviderWebViewSource(target, source);
    assert.equal(wrapped.baseUrl, 'https://orion.local/player/');
    assert.match(wrapped.html, /default-src 'none'; style-src 'unsafe-inline'; frame-src /);
    assert.equal(wrapped.html.includes(`frame-src ${origin}"`), true);
    assert.equal((wrapped.html.match(/<iframe\b/g) || []).length, 1);
    assert.match(wrapped.html, /referrerpolicy="origin"/);
    assert.doesNotMatch(wrapped.html, /<script|popups|frame-src[^";]*\*/);
    assert.equal(wrapped.html.includes('&amp;'), true);
    assert.deepEqual(presentation.getEmbeddedPresentationModes(id), ['provider', 'fit', 'fill']);
    assert.deepEqual(support.getProviderCapturePolicy(source), { captureEnabled: true, diagnosticOnly: true });
    for (const unsafe of ['http://mapple.fun/watch/movie/550', 'https://evil.example/', 'https://mapple.fun.evil.example/', 'javascript:alert(1)', `${origin.replace('https://', 'https://user:password@')}/movie/550`]) {
      assert.deepEqual(support.createProviderWebViewSource(unsafe, source), { uri: 'about:blank' });
    }
    assert.throws(() => support.createProviderIframeDocument(target, [`${origin}/path`]), /origin/);
  }
  assert.deepEqual(support.getProviderCapturePolicy(undefined), { captureEnabled: false, diagnosticOnly: false });
});

test('shared extraction preserves legacy wrappers, capture eligibility, and primary URL contracts', () => {
  const target = 'https://player.videasy.to/movie/550?overlay=true';
  const wrapped = support.createProviderWebViewSource(target, registry.getRegisteredSource('videasy'));
  assert.match(wrapped.html, /frame-src https:\/\/player\.videasy\.net https:\/\/player\.videasy\.to/);
  assert.deepEqual(support.createProviderWebViewSource('https://vixsrc.to/movie/550', registry.getRegisteredSource('vixsrc')), { uri: 'https://vixsrc.to/movie/550' });
  for (const id of ['vixsrc', 'vidsrc', 'vidlink', 'vidnest', 'vidsrc-ir', 'cinesrc']) {
    assert.deepEqual(support.getProviderCapturePolicy(registry.getRegisteredSource(id)), { captureEnabled: true, diagnosticOnly: false });
  }
  const ids = { tmdbId: 533535, imdbId: 'tt6263850' };
  assert.equal(registry.getSourceUrl('vixsrc', 'movie', ids, 1, 1, {}, '#e50914', 'en'), 'https://vixsrc.to/movie/tt6263850?autoplay=true&primaryColor=e50914&lang=en');
  assert.equal(registry.getSourceUrl('vidsrc', 'movie', ids, 1, 1, {}, '#e50914', 'en'), 'https://vsembed.su/embed/movie/tt6263850?ds_lang=en');
  assert.equal(mobile.getMobileSourceContinuityCapability('vixsrc').automaticTarget, true);
  assert.equal(mobile.getMobileSourceContinuityCapability('vidsrc').mode, 'outgoing-only');
});

test('descriptor validation rejects malformed optional event, handshake, and diagnostic capabilities', () => {
  const source = registry.getRegisteredSource('stellar');
  for (const overrides of [
    { supportsDiagnosticCapture: 'true' }, { playerEventContract: 'unknown' },
    { requiresIframeWrapper: false }, { progressStrategy: 'none' },
    { expectedOrigins: ['http://stellar.rip'] }, { expectedOrigins: 'https://stellar.rip' },
    { playerMessageHandshake: null }, { playerMessageHandshake: { readyType: '*', initType: 'INIT' } },
    { playerMessageHandshake: { readyType: 'READY', initType: 'READY' } },
    { playerMessageHandshake: { readyType: 'READY', initType: 'A'.repeat(65) } },
  ]) {
    assert.notDeepEqual(contracts.validateSourceDescriptor({ ...source, ...overrides }), []);
  }
});
