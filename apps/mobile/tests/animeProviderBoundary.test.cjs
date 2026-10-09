const test = require('node:test');
const assert = require('node:assert/strict');
const { loader, read } = require('./helpers/animeModules.cjs');
const load = loader();
const registry = load('packages/shared/src/sources/registry.ts');
const contracts = load('packages/shared/src/sources/contracts.ts');
const provider = registry.getRegisteredSource('aniembed');

test('AniEmbed is registered through Orion with physically proven Sub playback and independently unqualified downloads', () => {
  assert.deepEqual(contracts.validateSourceDescriptor(provider), []);
  assert.equal(provider.animeOnly, true); assert.equal(provider.routingMode, 'manual-only');
  assert.equal(provider.releaseStatus, 'candidate'); assert.equal(provider.supportsDownloads, false);
  assert.deepEqual(provider.animeProvider, { variants: ['sub', 'dub'], variantParam: 'lang', playbackQualified: true, downloadQualified: false });
  assert.equal(provider.media.movie, false);
  assert.ok(!registry.AUTOMATIC_PLAYER_SOURCES.some((source) => source.id === 'aniembed'));
});
test('contract rejects unsafe Anime routing, duplicate/unknown variants and unqualified downloads', () => {
  for (const patch of [{ routingMode: 'automatic' }, { animeOnly: false }, { supportsDownloads: true },
    { animeProvider: { ...provider.animeProvider, variants: ['raw', 'raw'] } },
    { animeProvider: { ...provider.animeProvider, variants: ['unknown'] } }]) {
    assert.ok(contracts.validateSourceDescriptor({ ...provider, ...patch }).length > 0);
  }
});
test('URL building uses explicit AniList evidence and exact language/episode parameters', () => {
  assert.equal(registry.getSourceUrl('aniembed', 'tv', { tmdbId: '127532', anilistId: 151807 }, 1, 4),
    'https://aniembed.se/e/151807/4?lang=sub&autoplay=1&t=0');
  assert.equal(registry.getSourceUrl('aniembed', 'tv', { anilistId: 172463 }, 2, 3, { lang: 'dub' }),
    'https://aniembed.se/e/172463/3?lang=dub&autoplay=1&t=0');
  assert.deepEqual(registry.getSourceResumeParams('aniembed', 140, 'tv'), {}, 'verified seek owns the positive target; URL stays at zero');
  for (const ids of [{ tmdbId: 151807 }, { imdbId: 'tt151807' }, { anilistId: 0 }, { anilistId: 1.5 }, 151807]) {
    assert.throws(() => registry.getSourceUrl('aniembed', 'tv', ids, 1, 1));
  }
  assert.throws(() => registry.getSourceUrl('aniembed', 'movie', { anilistId: 151807 }, 1, 1));
  assert.throws(() => registry.getSourceUrl('aniembed', 'tv', { anilistId: 151807 }, 1, 0));
  assert.throws(() => registry.getSourceUrl('aniembed', 'tv', { anilistId: 151807 }, 1, 1, { lang: 'raw' }));
});
test('new provider manifest grants one explicit page origin and no guessed dependencies', () => {
  assert.equal(provider.requestManifest.mode, 'enforce');
  for (const field of ['allowedNavigationOrigins', 'requiredOrigins']) assert.deepEqual(provider.requestManifest[field], ['https://aniembed.se']);
  for (const field of ['mediaOrigins', 'subtitleOrigins', 'artworkOrigins']) assert.deepEqual(provider.requestManifest[field], []);
  assert.equal(provider.requestManifest.popupPolicy, 'block');
});
test('existing Mobile source order/default/Auto/download choices remain intact; Anime preference is separate from General Auto', () => {
  const mobile = loader({ '../../services/sourceHealth': { getMobileSourceHealth: () => null, getMobileSourceHealthV2: () => null } })('apps/mobile/src/features/playback/mobileSources.ts');
  assert.deepEqual(mobile.MOBILE_PLAYER_SOURCES.map((source) => source.id), ['vixsrc', 'vidsrc', 'vidlink', 'vidnest', 'vidsrc-ir', 'cinesrc', '111movies']);
  assert.equal(mobile.MOBILE_DEFAULT_CINEMA_SOURCE_ID, 'vixsrc');
  assert.equal(mobile.mobileSourceSupportsContinuity('aniembed'), false);
  assert.ok(!mobile.getMobileDownloadSourceChoices('tv').some((source) => source.id === 'aniembed'));
  const screen = read('apps/mobile/src/features/playback/PlayerScreen.tsx');
  assert.match(screen, /sourceExtras=\{\(select\) => !downloadResolutionOnly && !handoffIsPending\(handoff\) && anime.detail/);
  assert.match(screen, /pendingAnimeSelection.current = selection; select\(selection.providerId \|\| 'aniembed', true\)/);
  assert.match(screen, /isManualAnimeProvider\(sourceId\) \? `-\$\{animeAttempt\}` : ''/);
  assert.match(read('apps/mobile/src/features/playback/EmbedPlayerSurface.tsx'), /sourceExtras=\{sourceExtras\?\.\(selectSource\)\}/);
  assert.match(screen, /onAutomaticFailover:[\s\S]{0,100}isManualAnimeProvider\(sourceId\)/);
  assert.match(read('apps/mobile/src/features/playback/useAnimeSource.ts'), /isAnimeContent\(detail\)/);
});
test('wrapper extraction preserves legacy Videasy CSP and direct source contract', () => {
  const helper = load('apps/mobile/src/features/playback/providerEmbedSupport.ts');
  assert.deepEqual(helper.createProviderWebViewSource(provider, 'https://aniembed.se/e/151807/1'), { uri: 'https://aniembed.se/e/151807/1' });
  const wrapper = { ...provider, requiresIframeWrapper: true, expectedOrigins: ['https://player.videasy.net'] };
  const source = helper.createProviderWebViewSource(wrapper, 'https://player.videasy.net/movie/1');
  assert.equal(source.baseUrl, 'https://orion.local/player/');
  assert.match(source.html, /frame-src https:\/\/player.videasy.net https:\/\/player.videasy.to/);
  assert.deepEqual(helper.createProviderWebViewSource(wrapper, 'https://player.videasy.net.evil/movie/1'), { uri: 'about:blank' });
  assert.deepEqual(helper.createProviderWebViewSource(wrapper, 'http://player.videasy.net/movie/1'), { uri: 'about:blank' });
});
test('Anime navigation cannot change episode, origin or requested audio variant', () => {
  const helper = load('apps/mobile/src/features/playback/providerEmbedSupport.ts');
  const selected = 'https://aniembed.se/e/151807/4?lang=dub&autoplay=1&t=0';
  assert.equal(helper.isSelectedAnimeNavigation(selected, selected), true);
  for (const url of ['https://aniembed.se/e/151807/5?lang=dub', 'https://aniembed.se/e/151807/4?lang=sub',
    'https://aniembed.se/e/151807/4', 'https://aniembed.se.evil/e/151807/4?lang=dub',
    'http://aniembed.se/e/151807/4?lang=dub', 'javascript:alert(1)', 'https://x:y@aniembed.se/e/151807/4?lang=dub']) {
    assert.equal(helper.isSelectedAnimeNavigation(url, selected), false);
  }
});
test('manifest extraction returns existing enforced manifests verbatim and preserves the old fallback', () => {
  const helper = load('apps/mobile/src/features/playback/providerEmbedSupport.ts');
  assert.equal(helper.getProviderShieldManifest('aniembed', provider), provider.requestManifest);
  const fallback = helper.getProviderShieldManifest('legacy', { expectedOrigins: ['https://example.org'] });
  assert.deepEqual(fallback.allowedNavigationOrigins, ['https://example.org']);
  assert.deepEqual(fallback.requiredOrigins, ['https://example.org']);
  assert.equal(fallback.mode, 'observe'); assert.deepEqual(fallback.mediaOrigins, []);
});
