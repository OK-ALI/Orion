const test = require('node:test');
const assert = require('node:assert/strict');
const { clock, nodes, playbackFixture } = require('./helpers/postPhysicalPlaybackHarness.cjs');
const { libraryFixture, memoryStorage } = require('./helpers/sourceContinuityHarness.cjs');
const { loader } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const route = { id: '9', type: 'tv', title: 'Episode 5', seriesTitle: 'Series', season: '1', episode: '5' };
const save = (sourceId, episode, currentTime, sourceVariant) => ({ item: { id: 9, title: 'Series' }, mediaType: 'tv',
  season: 1, episode, sourceId, sourceVariant, currentTime, duration: 3000, evidence: 'provider-video-event', sessionId: `episode-${episode}` });
for (const [source, variant] of [['vidlink', undefined], ['aniembed', 'sub']]) {
  test(`${source}: Next Episode relinquishes old surface before navigation, retains affinity and mounts new identity once`, async () => {
    const time = clock(), storage = memoryStorage(), seed = libraryFixture(storage);
    seed.library.recordPlayback(save(source, 5, 0, variant)); seed.library.recordPlayback(save(source, 6, 70, variant)); seed.harness.dispose();
    const anime = source === 'aniembed' ? { phase: 'anime', selection: { variant, identity: { anilistId: 21175, tmdbId: '9', season: 1, episode: 5 } } } : {};
    const f = playbackFixture(route, storage, anime);
    try {
      await f.settle(); await f.emit('playing', 2979); time.tick(1000); await f.emit('playing', 2980);
      const old = f.props, mounted = f.mounted; assert.ok(f.find('NextEpisodePrompt'));
      f.find('NextEpisodePrompt').onPlayNow(); await f.settle();
      assert.equal(f.props, undefined, 'old URL must not remount with zero target while router is still on episode N');
      assert.equal(f.mounted, mounted); assert.equal(f.find('PlayerStateOverlay').state, 'preparing');
      const target = f.navigation[0].params; assert.equal(target.nextSourceId, source); assert.equal(target.nextAnimeVariant, variant);
      old.onVerifiedPlaybackCompletion({ sourceId: source }); await f.settle(); assert.equal(f.find('NextEpisodePrompt'), undefined);
      if (source === 'aniembed') { f.anime.phase = 'checking'; f.anime.selection = null; }
      f.update(target); assert.equal(f.props, undefined); await f.settle();
      if (source === 'aniembed') {
        assert.equal(f.props, undefined, 'new Anime identity must resolve before mounting');
        f.anime.phase = 'anime'; f.anime.selection = { variant, identity: { anilistId: 21175, tmdbId: '9', season: 1, episode: 6 } };
        f.update(target); await f.settle();
      }
      assert.equal(f.find('ResumePlaybackPrompt').savedTime, 70);
      f.find('ResumePlaybackPrompt').onChoose('resume'); await f.settle();
      assert.equal(f.props.sourceId, source); assert.equal(f.props.initialResumeTime, 70);
      assert.equal(f.props.continuityError, undefined); assert.equal(f.mounted, mounted + 1);
      assert.match(f.props.embedUrl, source === 'aniembed' ? /\/21175\/6\?/ : /\/tv\/9\/1\/6/);
      assert.deepEqual(f.failures, []); assert.equal(f.library.library.getPlaybackProgress('tv', 9, 1, 6).currentTime, 70);
      assert.equal(f.library.library.getPlaybackSourcePreference('tv', 9).sourceId, source);
    } finally { f.dispose(); time.restore(); }
  });
}

test('IMDb route mounts once after resolution, retains title ID across episodes and fences stale title responses', async () => {
  const time = clock(), storage = memoryStorage(), seed = libraryFixture(storage), requests = [];
  seed.library.recordPlayback(save('vidsrc', 5, 0)); seed.harness.dispose();
  const pending = new Map();
  const f = playbackFixture(route, storage, {}, path => { requests.push(path); return new Promise(resolve => pending.set(path, resolve)); });
  try {
    await f.settle(); assert.equal(f.props, undefined); assert.equal(f.mounted, 0);
    pending.get('/tv/9/external_ids')({ imdb_id: 'tt1234567' }); await f.settle();
    assert.match(f.props.embedUrl, /tt1234567/); assert.equal(f.mounted, 1);
    f.update({ ...route, episode: '6', title: 'Episode 6' }); await f.settle();
    assert.match(f.props.embedUrl, /tt1234567/); assert.match(f.props.embedUrl, /6/); assert.equal(f.mounted, 2);
    assert.equal(requests.filter(path => path === '/tv/9/external_ids').length, 1);
    f.update({ ...route, id: '10', nextSourceId: 'vidsrc' }); await f.settle(); assert.equal(f.props, undefined);
    f.update({ ...route, id: '11', nextSourceId: 'vidsrc' }); await f.settle();
    pending.get('/tv/10/external_ids')({ imdb_id: 'tt9999999' }); await f.settle(); assert.equal(f.props, undefined);
    pending.get('/tv/11/external_ids')({ imdb_id: 'tt7654321' }); await f.settle();
    assert.match(f.props.embedUrl, /tt7654321/); assert.doesNotMatch(f.props.embedUrl, /tt9999999/);
  } finally { f.dispose(); time.restore(); }
});

test('real Anime hook gates each new exact episode identity while retaining the series variant', async () => {
  const h = hookHarness(), identities = [], pending = [];
  const detail = { id: 9, name: 'Anime' };
  const useAnimeSource = loader({ react: h.react,
    '@orion/shared/api': { isAnimeContent: () => true, tmdbFetch: async () => detail, lookupAnimeEntries() {} },
    './animeIdentityDiagnostics': { createAnimeIdentityTrace: () => () => {} },
    './animeIdentityRequest': { resolveAnimeTestIdentity: value => { identities.push(value); return new Promise(resolve => pending.push(resolve)); } },
    './animeSourceAffinity': { getAnimeFlowChoice: () => null, preferredAnimeSource: () => ({ providerId: 'aniembed', variant: 'sub' }), setAnimeFlowChoice() {} },
  })('apps/mobile/src/features/playback/useAnimeSource.ts').useAnimeSource;
  const props = { id: '9', type: 'tv', season: 1, episode: 5, enabled: true, preference: { sourceId: 'aniembed', variant: 'sub' }, onPreferred() {} };
  try {
    h.start(useAnimeSource, props); await h.settle();
    pending[0]({ state: 'verified', tmdbId: '9', anilistId: 21175, season: 1, episode: 5 }); await h.settle();
    assert.equal(h.result.selection.identity.episode, 5);
    h.update({ ...props, episode: 6 }); assert.equal(h.result.selection, null); assert.equal(h.result.phase, 'checking'); await h.settle();
    pending[1]({ state: 'verified', tmdbId: '9', anilistId: 21175, season: 1, episode: 6 }); await h.settle();
    assert.equal(h.result.selection.identity.episode, 6); assert.equal(h.result.selection.variant, 'sub');
    assert.deepEqual(identities.map(value => [value.season, value.episode, value.variant]), [[1, 5, 'sub'], [1, 6, 'sub']]);
  } finally { h.dispose(); }
});

test('offline route still skips every external lookup and uses the existing finalized native asset surface', async () => {
  const requests = [], f = playbackFixture({ ...route, isOffline: 'true', offlineAssetId: 'verified-asset' }, undefined, {},
    path => { requests.push(path); return Promise.resolve({}); });
  try {
    await f.settle(); assert.deepEqual(requests, []); assert.equal(f.props, undefined);
    assert.equal(f.find('FinalizedPlayer').assetId, 'verified-asset'); assert.equal(f.find('FinalizedPlayer').sourceId, 'local');
  } finally { f.dispose(); }
});
