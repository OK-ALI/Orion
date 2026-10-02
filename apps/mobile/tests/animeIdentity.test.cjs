const test = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers/animeModules.cjs');
const { verifyAnimeIdentity } = loader()('packages/shared/src/api/animeIdentity.ts');
const catalog = { tmdbId: '127532', mediaType: 'tv', titles: ['Solo Leveling'], year: 2024,
  season: 1, episode: 4, episodeCount: 12, seasonYear: 2024, seasonTitles: [] };
const first = { id: 151807, titles: ['Solo Leveling', 'Ore dake Level Up na Ken'], format: 'TV', year: 2024, episodes: 12, sequels: [] };

test('Anime lookup keeps canonical TMDb identity and returns the independently verified AniList episode', () => {
  assert.deepEqual(verifyAnimeIdentity(catalog, [first]), { state: 'verified', tmdbId: '127532', anilistId: 151807, season: 1, episode: 4 });
});
test('localized exact alias and punctuation normalization are accepted with matching year/count/format', () => {
  assert.equal(verifyAnimeIdentity({ ...catalog, titles: ['ORE DAKE LEVEL-UP NA KEN'] }, [first]).state, 'verified');
});
for (const [name, patch, reason] of [
  ['loose title', { titles: ['Solo'] }, 'no-exact-match'],
  ['wrong year/remake', { year: 2023 }, 'no-exact-match'],
  ['split cour count', { episodeCount: 24 }, 'no-exact-match'],
  ['special season zero', { season: 0 }, 'unsupported-numbering'],
  ['episode past season', { episode: 13 }, 'unsupported-numbering'],
  ['fractional episode', { episode: 1.5 }, 'unsupported-numbering'],
  ['unknown episode count', { episodeCount: 0 }, 'insufficient-evidence'],
  ['missing year', { year: 0 }, 'insufficient-evidence'],
  ['invalid TMDb ID', { tmdbId: 'tt123' }, 'insufficient-evidence'],
]) test(`Anime identity fails closed for ${name}`, () => {
  assert.deepEqual(verifyAnimeIdentity({ ...catalog, ...patch }, [first]), { state: 'blocked', reason });
});
test('same-name/year candidates remain ambiguous rather than using API ordering', () => {
  assert.equal(verifyAnimeIdentity(catalog, [first, { ...first, id: 99 }]).reason, 'ambiguous-identity');
});
test('a title-matching OVA cannot replace a requested TV season', () => {
  assert.equal(verifyAnimeIdentity(catalog, [{ ...first, format: 'OVA' }]).state, 'blocked');
});
test('sequel requires relation, selected season year/count and an exact season alias', () => {
  const sequel = { ...first, id: 172463, year: 2025, episodes: 13, titles: ['Solo Leveling Season 2 -Arise from the Shadow-'] };
  const season = { ...catalog, season: 2, seasonYear: 2025, episodeCount: 13, seasonTitles: [...sequel.titles] };
  assert.equal(verifyAnimeIdentity(season, [{ ...first, sequels: [sequel] }]).anilistId, 172463);
  assert.equal(verifyAnimeIdentity(season, [first, sequel]).state, 'blocked', 'unrelated search result is insufficient');
  assert.equal(verifyAnimeIdentity({ ...season, seasonTitles: [] }, [{ ...first, sequels: [sequel] }]).state, 'blocked');
  assert.equal(verifyAnimeIdentity({ ...season, episodeCount: 25 }, [{ ...first, sequels: [sequel] }]).state, 'blocked');
});
test('multiple matching sequels fail closed and cyclic relation graphs are bounded', () => {
  const next = { ...first, id: 10, year: 2025, sequels: [] };
  const season = { ...catalog, season: 2, seasonYear: 2025 };
  assert.equal(verifyAnimeIdentity(season, [{ ...first, sequels: [next, { ...next, id: 11 }] }]).reason, 'ambiguous-identity');
  next.sequels.push(next);
  assert.equal(verifyAnimeIdentity(season, [{ ...first, sequels: [next] }]).anilistId, 10);
});
test('a differently named sequel needs a verified relation and matching full premiere date/year/count', () => {
  const next = { ...first, id: 176496, year: 2025, episodes: 13, titles: ['Arise from the Shadow'], releaseDate: '2025-01-04' };
  const season = { ...catalog, season: 2, seasonYear: 2025, episodeCount: 13, seasonAirDate: '2025-01-04' };
  assert.equal(verifyAnimeIdentity(season, [{ ...first, sequels: [next] }]).anilistId, 176496);
  assert.equal(verifyAnimeIdentity({ ...season, seasonAirDate: '2025-07-04' }, [{ ...first, sequels: [next] }]).state, 'blocked');
  assert.equal(verifyAnimeIdentity({ ...season, seasonAirDate: undefined }, [{ ...first, sequels: [next] }]).state, 'blocked');
  assert.equal(verifyAnimeIdentity(season, [first, next]).state, 'blocked');
});
test('film lookup requires film format and episode one; provider film availability remains separate', () => {
  const film = { ...catalog, mediaType: 'movie', season: null, episode: 1, episodeCount: 1 };
  assert.equal(verifyAnimeIdentity(film, [{ ...first, format: 'MOVIE', episodes: 1 }]).state, 'verified');
  assert.equal(verifyAnimeIdentity(film, [first]).state, 'blocked');
  assert.equal(verifyAnimeIdentity({ ...film, episode: 2 }, [first]).state, 'blocked');
});

function apiEntry() { return { id: 151807, type: 'ANIME', format: 'TV', title: { english: 'Solo Leveling' }, synonyms: [], startDate: { year: 2024 }, episodes: 12, relations: { edges: [] } }; }
function response(page, errors) { return { ok: true, text: async () => JSON.stringify({ data: { Page: page }, errors }) }; }
test('public AniList lookup validates complete bounded results and caches metadata only', async () => {
  const oldFetch = global.fetch; let calls = 0;
  global.fetch = async (url, options) => {
    calls++; assert.equal(url, 'https://graphql.anilist.co');
    assert.equal(options.method, 'POST'); assert.equal(options.headers.Authorization, undefined);
    assert.match(JSON.parse(options.body).query, /pageInfo\{hasNextPage\}/);
    return response({ pageInfo: { hasNextPage: false }, media: [apiEntry()] });
  };
  try {
    const api = loader()('packages/shared/src/api/animeLookup.ts');
    const data = await api.lookupAnimeEntries(['Solo Leveling']);
    assert.equal(data[0].id, 151807); assert.equal(data[0].year, 2024);
    await api.lookupAnimeEntries(['Solo Leveling']); assert.equal(calls, 1);
  } finally { global.fetch = oldFetch; }
});
for (const [name, reply] of [
  ['incomplete search', response({ pageInfo: { hasNextPage: true }, media: [apiEntry()] })],
  ['missing completeness evidence', response({ media: [apiEntry()] })],
  ['GraphQL error', response({ pageInfo: { hasNextPage: false }, media: [] }, [{ message: 'unavailable' }])],
  ['oversized response', { ok: true, text: async () => 'x'.repeat(250_001) }],
  ['HTTP rejection', { ok: false }],
]) test(`AniList lookup rejects ${name}`, async () => {
  const oldFetch = global.fetch; global.fetch = async () => reply;
  try { await assert.rejects(loader()('packages/shared/src/api/animeLookup.ts').lookupAnimeEntries(['Solo Leveling'])); }
  finally { global.fetch = oldFetch; }
});
test('cancelled lookup returns no cached identity', async () => {
  const request = new AbortController(); request.abort();
  await assert.rejects(loader()('packages/shared/src/api/animeLookup.ts').lookupAnimeEntries(['Solo Leveling'], request.signal));
});
