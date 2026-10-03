const test = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers/animeModules.cjs');
function fixture() {
  const values = new Map();
  const affinity = loader({ '../../services/storageAdapter': { mmkvStorageAdapter: {
    get: key => values.get(key) || null, set: (key, value) => values.set(key, value) } } })('apps/mobile/src/features/playback/animeSourceAffinity.ts');
  return { affinity, values };
}
for (const variant of ['sub', 'dub']) test(`verified AniEmbed ${variant} affinity preserves provider/variant across episodes and reopen`, () => {
  const { affinity, values } = fixture();
  const choice = { providerId: 'aniembed', variant };
  affinity.setAnimeFlowChoice('62715', choice);
  assert.deepEqual(affinity.preferredAnimeSource('62715'), choice);
  affinity.rememberAnimeAffinity('62715', choice);
  affinity.clearAnimeFlowChoice('62715');
  assert.deepEqual(affinity.preferredAnimeSource('62715'), choice);
  assert.deepEqual(JSON.parse([...values.values()][0]), [{ tmdbId: '62715', ...choice }]);
});
test('manual General choice wins in the current Anime flow and never rewrites saved Anime preference', () => {
  const { affinity } = fixture();
  affinity.rememberAnimeAffinity('62715', { providerId: 'aniembed', variant: 'dub' });
  affinity.setAnimeFlowChoice('62715', { generalSourceId: 'vixsrc' });
  assert.equal(affinity.preferredAnimeSource('62715'), null);
  assert.equal(affinity.preferredAnimeSource('62715', 'vixsrc'), null);
  assert.deepEqual(affinity.getAnimeAffinity('62715'), { providerId: 'aniembed', variant: 'dub' });
  affinity.clearAnimeFlowChoice('62715');
  assert.equal(affinity.preferredAnimeSource('62715').variant, 'dub');
});
test('affinity storage is bounded, validated and contains no identity, timestamp, URL or request context', () => {
  const { affinity, values } = fixture();
  for (let i = 1; i <= 50; i++) affinity.rememberAnimeAffinity(String(i), { providerId: 'aniembed', variant: 'sub', token: 'SECRET', t: 900 });
  const entries = JSON.parse([...values.values()][0]);
  assert.equal(entries.length, 32); assert.equal(entries[0].tmdbId, '50');
  assert.deepEqual(Object.keys(entries[0]).sort(), ['providerId', 'tmdbId', 'variant']);
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
