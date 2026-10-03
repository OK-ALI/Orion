const test = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
function fixture({ anime = true, rejectEpisode = 0, catalogError = false } = {}) {
  const harness = hookHarness(); const requests = []; const chosen = []; const values = new Map();
  const mocks = { react: harness.react,
    '@orion/shared/api': { isAnimeContent: value => value?.anime === true,
      tmdbFetch: async () => { if (catalogError) throw new Error('unavailable'); return { id: 62715, anime }; }, lookupAnimeEntries() {} },
    './animeIdentityDiagnostics': { createAnimeIdentityTrace: () => () => {} },
    './animeIdentityRequest': { resolveAnimeTestIdentity: async input => {
      requests.push(input);
      return input.episode === rejectEpisode ? { state: 'blocked' } : { state: 'verified', tmdbId: input.id,
        anilistId: 21175, season: input.season, episode: input.episode };
    } }, '../../services/storageAdapter': { mmkvStorageAdapter: { get: key => values.get(key) || null, set: (key, value) => values.set(key, value) } } };
  const load = loader(mocks); const hook = load('apps/mobile/src/features/playback/useAnimeSource.ts').useAnimeSource;
  const affinity = load('apps/mobile/src/features/playback/animeSourceAffinity.ts');
  const props = { id: '62715', type: 'tv', season: 1, episode: 1, enabled: true, onPreferred: value => chosen.push(value) };
  harness.start(hook, props);
  return { harness, requests, chosen, props, affinity };
}
test('qualified initial preference requires safe Anime detection and exact current episode identity', async () => {
  const f = fixture(); await f.harness.settle();
  assert.equal(f.harness.result.phase, 'anime'); assert.equal(f.chosen.length, 1);
  assert.equal(f.chosen[0].identity.episode, 1); assert.equal(f.chosen[0].variant, 'sub');
  assert.equal(f.affinity.getAnimeAffinity('62715'), null, 'opening alone cannot persist success');
  f.harness.result.recordSuccess('aniembed'); assert.equal(f.affinity.getAnimeAffinity('62715').variant, 'sub');
  f.harness.dispose();
});
for (const variant of ['sub', 'dub']) test(`next episode freshly resolves identity while retaining AniEmbed ${variant}`, async () => {
  const f = fixture(); await f.harness.settle();
  const selection = await f.harness.result.prepare(variant); f.harness.result.activate(selection);
  await f.harness.settle(); f.harness.result.recordSuccess('aniembed');
  f.harness.update({ ...f.props, episode: 2, routedSource: 'aniembed', routedVariant: variant });
  assert.equal(f.harness.result.phase, 'checking'); await f.harness.settle();
  assert.equal(f.chosen.at(-1).identity.episode, 2); assert.equal(f.chosen.at(-1).variant, variant);
  assert.equal(f.requests.at(-1).episode, 2);
  assert.equal('currentTime' in f.chosen.at(-1), false, 'affinity never carries a previous episode timestamp');
  f.harness.dispose();
});
test('manual General selection suppresses Anime preference on subsequent episode navigation', async () => {
  const f = fixture(); await f.harness.settle(); f.harness.result.manualGeneral('vixsrc');
  f.harness.update({ ...f.props, episode: 2, routedSource: 'vixsrc' }); await f.harness.settle();
  assert.equal(f.harness.result.phase, 'general'); assert.equal(f.chosen.length, 1);
  const selection = await f.harness.result.prepare('dub'); assert.ok(f.harness.result.activate(selection));
  await f.harness.settle(); assert.equal(f.harness.result.phase, 'anime'); f.harness.dispose();
});
test('failed continuation has clean failure, no General fallback and no stale episode identity', async () => {
  const f = fixture({ rejectEpisode: 2 }); await f.harness.settle(); f.harness.result.recordSuccess('aniembed');
  f.harness.update({ ...f.props, episode: 2, routedSource: 'aniembed', routedVariant: 'sub' }); await f.harness.settle();
  assert.equal(f.harness.result.phase, 'failed'); assert.equal(f.harness.result.selection, null);
  assert.equal(f.harness.result.error, 'Could not continue this episode with AniEmbed.');
  assert.equal(f.chosen.length, 1); f.harness.dispose();
});
test('non-Anime, movies, specials, offline and download-resolution do not enter Anime preference', async () => {
  const f = fixture({ anime: false }); await f.harness.settle();
  assert.equal(f.harness.result.phase, 'general'); assert.equal(f.requests.length, 0);
  for (const patch of [{ type: 'movie' }, { season: 0 }, { enabled: false }]) {
    f.harness.update({ ...f.props, ...patch }); await f.harness.settle();
    assert.equal(f.harness.result.phase, 'general'); assert.equal(f.requests.length, 0);
  }
  assert.equal(f.chosen.length, 0); f.harness.dispose();
});
test('route replacement aborts old identity work and cannot activate a stale episode', async () => {
  const f = fixture(); f.harness.update({ ...f.props, episode: 3 }); await f.harness.settle();
  assert.equal(f.chosen.length, 1); assert.equal(f.chosen[0].identity.episode, 3);
  assert.equal(f.harness.result.activate({ identity: { ...f.chosen[0].identity, episode: 1 }, variant: 'sub' }), false);
  f.harness.dispose();
});
test('canonical metadata failure on an explicit Anime continuation fails closed without General hopping', async () => {
  const f = fixture({ anime: false });
  f.harness.update({ ...f.props, routedSource: 'aniembed', routedVariant: 'sub' }); await f.harness.settle();
  assert.equal(f.harness.result.phase, 'failed'); assert.equal(f.chosen.length, 0);
  assert.equal(f.harness.result.selection, null); f.harness.dispose();
});
test('manual General intent remains authoritative even if Anime affinity exists and catalog is unavailable', async () => {
  const f = fixture({ catalogError: true });
  f.affinity.rememberAnimeAffinity('62715', { providerId: 'aniembed', variant: 'dub' });
  f.harness.update({ ...f.props, routedSource: 'vixsrc' }); await f.harness.settle();
  assert.equal(f.harness.result.phase, 'general'); assert.equal(f.chosen.length, 0); f.harness.dispose();
});
