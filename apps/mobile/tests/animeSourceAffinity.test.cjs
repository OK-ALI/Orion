const test = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers/animeModules.cjs');
const { memoryStorage } = require('./helpers/sourceContinuityHarness.cjs');
function fixture() {
  const values = new Map();
  const affinity = loader({ '../../services/storageAdapter': { mmkvStorageAdapter: {
    get: key => values.get(key) || null, set: (key, value) => values.set(key, value) } } })('apps/mobile/src/features/playback/animeSourceAffinity.ts');
  const shared = loader()('apps/mobile/src/features/library/sourceAffinity.ts');
  const storage = memoryStorage();
  return { affinity, values, shared, storage };
}
for (const variant of ['sub', 'dub']) test(`verified AniEmbed ${variant} affinity preserves provider/variant across episodes and reopen`, () => {
  const { affinity, shared, storage } = fixture();
  const choice = { providerId: 'aniembed', variant };
  affinity.setAnimeFlowChoice('62715', choice);
  assert.deepEqual(affinity.preferredAnimeSource('62715'), choice);
  shared.rememberSourcePreference(storage, 'tv', '62715', { sourceId: choice.providerId, variant }, 'provider-video-event', 'session');
  affinity.clearAnimeFlowChoice('62715');
  const saved = shared.resolveSourcePreference(storage, 'tv', '62715', {}, []);
  assert.deepEqual(affinity.preferredAnimeSource('62715', undefined, undefined, saved), choice);
  assert.deepEqual(saved, { sourceId: 'aniembed', variant });
});
test('manual General choice wins in the current Anime flow and never rewrites saved Anime preference', () => {
  const { affinity } = fixture();
  const saved = { sourceId: 'aniembed', variant: 'dub' };
  affinity.setAnimeFlowChoice('62715', { generalSourceId: 'vixsrc' });
  assert.equal(affinity.preferredAnimeSource('62715'), null);
  assert.equal(affinity.preferredAnimeSource('62715', 'vixsrc'), null);
  assert.deepEqual(saved, { sourceId: 'aniembed', variant: 'dub' });
  affinity.clearAnimeFlowChoice('62715');
  assert.equal(affinity.preferredAnimeSource('62715', undefined, undefined, saved).variant, 'dub');
});
test('affinity storage is bounded, validated and contains only title key, source/variant and success recency', () => {
  const { affinity, shared, storage } = fixture();
  for (let i = 1; i <= 220; i++) shared.rememberSourcePreference(storage, 'tv', i, { sourceId: 'aniembed', variant: 'sub', token: 'SECRET', t: 900 }, 'provider-video-event', 'session', i);
  const entries = JSON.parse(storage.get('sourceAffinityV1'));
  assert.equal(entries.length, 200); assert.equal(entries[0].key, 'tv:220');
  assert.deepEqual(Object.keys(entries[0]).sort(), ['key', 'sourceId', 'updatedAt', 'variant']);
  assert.doesNotMatch(JSON.stringify(entries), /SECRET|token|https|anilist|900/);
  for (const variant of ['raw', 'unknown', null]) assert.equal(affinity.validAnimeAffinity({ providerId: 'aniembed', variant }), false);
  for (const providerId of ['vixsrc', 'allmanga', 'anilink']) assert.equal(affinity.validAnimeAffinity({ providerId, variant: 'sub' }), false);
  for (const raw of ['invalid', '{}', 'x'.repeat(9000), '[{"tmdbId":"bad","providerId":"aniembed","variant":"sub"}]']) assert.deepEqual(affinity.parseAnimeAffinities(raw), []);
});
test('routed variants are checked and malformed affinity cannot promote an unqualified provider', () => {
  const { affinity } = fixture();
  assert.equal(affinity.preferredAnimeSource('62715', 'aniembed', 'dub').variant, 'dub');
  assert.equal(affinity.preferredAnimeSource('62715', 'aniembed', 'raw'), null);
  affinity.setAnimeFlowChoice('62715', { generalSourceId: 'allmanga' });
  assert.equal(affinity.preferredAnimeSource('62715').providerId, 'aniembed');
});
