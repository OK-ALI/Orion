const test = require('node:test');
const assert = require('node:assert/strict');
const { loader, read } = require('./helpers/animeModules.cjs');
const baseLoad = loader();
const identity = baseLoad('packages/shared/src/api/animeIdentity.ts');
const diagnostics = baseLoad('packages/shared/src/api/animeIdentityDiagnostics.ts');
const apiMocks = { ...identity, ...diagnostics, isAnimeContent: baseLoad('packages/shared/src/api/tmdb.ts').isAnimeContent };
const catalog = { tmdbId: '62715', mediaType: 'tv', titles: ['Dragon Ball Super'], year: 2015,
  season: 1, episode: 1, episodeCount: 131, seasonYear: 2015, seasonTitles: [], seasonAirDate: '2015-07-05' };
const media = (patch = {}) => ({ id: 21175, type: 'ANIME', format: 'TV', title: { english: 'Dragon Ball Super', romaji: 'Dragon Ball Super', native: 'ドラゴンボール超' },
  synonyms: [], episodes: 131, startDate: { year: 2015, month: 7, day: 5 }, relations: { edges: [] }, ...patch });
const response = (entries, more = false) => ({ ok: true, text: async () => JSON.stringify({ data: { Page: { pageInfo: { hasNextPage: more }, media: entries } } }) });
const details = { id: 62715, name: 'Dragon Ball Super', original_name: 'ドラゴンボール超（スーパー）', first_air_date: '2015-07-05', genres: [{ id: 16 }], original_language: 'ja' };
const season = { season_number: 1, name: 'Season 1', air_date: '2015-07-05', episodes: Array.from({ length: 131 }, (_, i) => ({ episode_number: i + 1, air_date: '2015-07-05' })) };
const input = (patch = {}) => ({ id: '62715', type: 'tv', season: 1, episode: 1, detail: details, variant: 'sub', signal: new AbortController().signal, ...patch });
const entry = { id: 21175, titles: ['Dragon Ball Super', 'ドラゴンボール超'], format: 'TV', year: 2015, episodes: 131, sequels: [], releaseDate: '2015-07-05' };
const requestModule = () => loader({ '@orion/shared/api': apiMocks })('apps/mobile/src/features/playback/animeIdentityRequest.ts');

test('Dragon Ball Super uses complete bounded pages without recursively expanding unrelated search graphs', async () => {
  const oldFetch = global.fetch; const events = []; let calls = 0;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body); calls++;
    assert.equal(body.variables.search, 'Dragon Ball Super');
    assert.doesNotMatch(body.query, /node\s*\{\s*id type format/);
    // The former graph-expanding request is deliberately over the old bound.
    if (body.query.includes('node{id type format')) return { ok: true, text: async () => 'x'.repeat(250_001) };
    return body.variables.page === 1
      ? response([media(), ...Array.from({ length: 9 }, (_, i) => media({ id: i + 1, title: { english: `Unrelated ${i}` } }))], true)
      : response([media({ id: 133898, format: 'MOVIE', episodes: 1, startDate: { year: 2022 }, title: { english: 'Dragon Ball Super: Super Hero' } })]);
  };
  try {
    const lookup = loader()('packages/shared/src/api/animeLookup.ts').lookupAnimeEntries;
    const entries = await lookup(catalog.titles, undefined, { catalog, diagnostic: event => events.push(event) });
    assert.equal(calls, 2);
    assert.deepEqual(identity.verifyAnimeIdentity(catalog, entries, event => events.push(event)),
      { state: 'verified', tmdbId: '62715', anilistId: 21175, season: 1, episode: 1 });
    assert.equal(events.at(-1).reason, 'verified');
    assert.ok(events.some(event => event.stage === 'candidate' && event.anilistId === 21175 && event.titleMatch && event.yearMatch && event.countMatch));
  } finally { global.fetch = oldFetch; }
});
test('search completeness is still required at the three-page bound; partial exact matches cannot escape', async () => {
  const oldFetch = global.fetch; let calls = 0;
  global.fetch = async () => { calls++; return response([media()], true); };
  try {
    await assert.rejects(loader()('packages/shared/src/api/animeLookup.ts').lookupAnimeEntries(catalog.titles),
      error => error.reason === 'lookup-incomplete-search');
    assert.equal(calls, 3);
  } finally { global.fetch = oldFetch; }
});
test('an oversized shallow response retains the 250000-character rejection boundary', async () => {
  const oldFetch = global.fetch;
  global.fetch = async () => ({ ok: true, text: async () => 'x'.repeat(250_001) });
  try { await assert.rejects(loader()('packages/shared/src/api/animeLookup.ts').lookupAnimeEntries(catalog.titles), error => error.reason === 'lookup-response-too-large'); }
  finally { global.fetch = oldFetch; }
});
test('later seasons hydrate only the uniquely verified base sequel graph with exact naming/date/year/count proof', async () => {
  const oldFetch = global.fetch; const idsRequested = []; let searches = 0;
  const next = media({ id: 176496, title: { english: 'Arise from the Shadow' }, episodes: 13, startDate: { year: 2025, month: 1, day: 4 } });
  const original = media({ id: 151807, title: { english: 'Solo Leveling' }, episodes: 12, startDate: { year: 2024 },
    relations: { edges: [{ relationType: 'SEQUEL', node: { id: 176496, type: 'ANIME' } }] } });
  const selected = { ...catalog, tmdbId: '127532', titles: ['Solo Leveling'], year: 2024,
    season: 2, seasonYear: 2025, episodeCount: 13, seasonAirDate: '2025-01-04' };
  global.fetch = async (_url, options) => {
    const variables = JSON.parse(options.body).variables;
    if (variables.search) { searches++; return response([original, media({ id: 9, title: { english: 'Unrelated' }, relations: { edges: [{ relationType: 'SEQUEL', node: { id: 99, type: 'ANIME' } }] } })]); }
    idsRequested.push(...variables.ids); return response([next]);
  };
  try {
    const lookup = loader()('packages/shared/src/api/animeLookup.ts').lookupAnimeEntries;
    const seasonOne = await lookup(selected.titles, undefined, { catalog: { ...selected, season: 1 } });
    assert.equal(idsRequested.length, 0);
    const result = await lookup(selected.titles, undefined, { catalog: selected });
    assert.deepEqual(idsRequested, [176496]); assert.equal(searches, 1);
    assert.equal(identity.verifyAnimeIdentity(selected, result).anilistId, 176496);
    assert.equal(seasonOne.find(entry => entry.id === 151807).sequels.length, 0, 'cached root metadata was not mutated');
  } finally { global.fetch = oldFetch; }
});
test('ambiguous base entries do not trigger sequel guesses', async () => {
  const oldFetch = global.fetch; let calls = 0;
  global.fetch = async () => { calls++; return response([media(), media({ id: 2 })]); };
  try {
    const selected = { ...catalog, season: 2 };
    const entries = await loader()('packages/shared/src/api/animeLookup.ts').lookupAnimeEntries(selected.titles, undefined, { catalog: selected });
    assert.equal(calls, 1); assert.equal(identity.verifyAnimeIdentity(selected, entries).reason, 'ambiguous-identity');
  } finally { global.fetch = oldFetch; }
});
test('missing requested sequel metadata fails closed rather than accepting a partial relation graph', async () => {
  const oldFetch = global.fetch;
  global.fetch = async (_url, options) => JSON.parse(options.body).variables.search
    ? response([media({ relations: { edges: [{ relationType: 'SEQUEL', node: { id: 9, type: 'ANIME' } }] } })]) : response([]);
  try { await assert.rejects(loader()('packages/shared/src/api/animeLookup.ts').lookupAnimeEntries(catalog.titles, undefined, { catalog: { ...catalog, season: 2 } }), error => error.reason === 'lookup-relation-incomplete'); }
  finally { global.fetch = oldFetch; }
});
test('sequel fanout is bounded before request construction', async () => {
  const oldFetch = global.fetch; let calls = 0;
  global.fetch = async () => { calls++; return response([media({ relations: { edges: Array.from({ length: 25 }, (_, i) => ({ relationType: 'SEQUEL', node: { id: i + 1, type: 'ANIME' } })) } })]); };
  try {
    await assert.rejects(loader()('packages/shared/src/api/animeLookup.ts').lookupAnimeEntries(catalog.titles, undefined, { catalog: { ...catalog, season: 2 } }), error => error.reason === 'lookup-relation-limit');
    assert.equal(calls, 1);
  } finally { global.fetch = oldFetch; }
});
test('the canonical Dragon Ball Super button pipeline accepts Sub and Dub without changing history identity', async () => {
  for (const variant of ['sub', 'dub']) {
    const events = [];
    const result = await requestModule().resolveAnimeTestIdentity(input({ variant }), {
      fetchSeason: async (path) => { assert.equal(path, '/tv/62715/season/1'); return season; },
      lookup: async (titles, _signal, options) => { assert.ok(titles.includes('Dragon Ball Super')); assert.equal(options.catalog.episodeCount, 131); return [entry]; },
    }, event => events.push(event));
    assert.equal(result.anilistId, 21175); assert.equal(result.tmdbId, '62715'); assert.equal(result.episode, 1);
    assert.equal(events[0].variant, variant); assert.equal(events.at(-1).outcome, 'accepted');
  }
});
for (const [name, patch, selectedSeason, reason] of [
  ['missing metadata', { detail: null }, season, 'missing-metadata'],
  ['wrong catalog identity', { detail: { ...details, id: 99 } }, season, 'metadata-id-mismatch'],
  ['non-Anime', { detail: { ...details, genres: [{ id: 18 }], original_language: 'en' } }, season, 'non-anime'],
  ['movie diagnostic lane', { type: 'movie' }, season, 'unsupported-media'],
  ['missing season', { season: null }, season, 'missing-season'],
  ['missing episode', { episode: null }, season, 'missing-episode'],
  ['wrong season metadata', {}, { ...season, season_number: 2 }, 'season-number-mismatch'],
  ['missing episode list', {}, { ...season, episodes: [] }, 'missing-episode-list'],
  ['outside canonical episode count', { episode: 132 }, season, 'episode-out-of-range'],
  ['unsupported episode numbering', {}, { ...season, episodes: [{ episode_number: 2 }] }, 'noncontiguous-episodes'],
  ['unreleased episode', {}, { ...season, episodes: [{ episode_number: 1, air_date: '2200-01-01' }] }, 'episode-not-released'],
]) test(`request trace identifies ${name} without provider launch`, async () => {
  const events = []; let lookupCalls = 0;
  const result = await requestModule().resolveAnimeTestIdentity(input(patch), { fetchSeason: async () => selectedSeason,
    lookup: async () => { lookupCalls++; return [entry]; } }, event => events.push(event));
  assert.equal(result.state, 'blocked'); assert.equal(events.at(-1).reason, reason); assert.equal(lookupCalls, 0);
});
test('network rejection emits only the enum, never raw auth/error material', async () => {
  const events = [];
  const result = await requestModule().resolveAnimeTestIdentity(input(), { fetchSeason: async () => { throw new Error('https://private/?token=SECRET'); }, lookup: async () => [] }, event => events.push(event));
  assert.equal(result.reason, 'tmdb-season-lookup-failed'); assert.doesNotMatch(JSON.stringify(events), /SECRET|private/);
});
test('lookup failure and stale aborted attempts cannot advance to verification or provider launch', async () => {
  const events = []; const request = new AbortController();
  const result = await requestModule().resolveAnimeTestIdentity(input({ signal: request.signal }), {
    fetchSeason: async () => season, lookup: async () => { request.abort(); return [entry]; },
  }, event => events.push(event));
  assert.equal(result.reason, 'lookup-cancelled'); assert.equal(events.at(-1).outcome, 'rejected');
});
for (const [name, patch, candidates, reason] of [
  ['ordinary season one', {}, [entry], 'verified'],
  ['alternate native title', { titles: ['ドラゴンボール超'] }, [entry], 'verified'],
  ['ambiguous exact candidates', {}, [entry, { ...entry, id: 99 }], 'ambiguous-base-candidates'],
  ['candidate episode count exceeded', { episode: 131 }, [{ ...entry, episodes: 130 }], 'episode-out-of-range'],
  ['exact title absent', {}, [{ ...entry, titles: ['Dragon Ball'] }], 'candidate-title-mismatch'],
  ['release year differs', {}, [{ ...entry, year: 2016 }], 'candidate-year-mismatch'],
  ['wrong format/OVA', {}, [{ ...entry, format: 'OVA' }], 'candidate-format-mismatch'],
  ['no candidates', {}, [], 'no-candidates'],
  ['unresolved sequel', { season: 2 }, [entry], 'sequel-relation-unresolved'],
]) test(`verification diagnostic names the ${name} decision`, () => {
  const events = []; identity.verifyAnimeIdentity({ ...catalog, ...patch }, candidates, event => events.push(event));
  assert.equal(events.at(-1).reason, reason);
});
test('diagnostic callback failures cannot change exact identity results', () => {
  assert.deepEqual(identity.verifyAnimeIdentity(catalog, [entry], () => { throw new Error('bridge unavailable'); }),
    identity.verifyAnimeIdentity(catalog, [entry]));
});
test('large search diagnostics prioritize the verified candidate without dropping competitors from verification', () => {
  const candidates = [...Array.from({ length: 60 }, (_, i) => ({ ...entry, id: i + 1, titles: [`Unrelated ${i}`] })), entry];
  const events = [];
  assert.equal(identity.verifyAnimeIdentity(catalog, candidates, event => events.push(event)).anilistId, 21175);
  assert.equal(events[0].anilistId, 21175);
  assert.equal(events.filter(event => event.stage === 'candidate').length, 12);
  assert.equal(identity.verifyAnimeIdentity(catalog, [...candidates, { ...entry, id: 99 }]).reason, 'ambiguous-identity');
});
test('public query descriptions refuse URL/auth-shaped titles before normalization', () => {
  for (const value of ['https://private/?token=SECRET', 'Bearer SECRET', 'cookie=SECRET', 'Authorization SECRET']) {
    assert.equal(diagnostics.describeAnimeLookupTitle(value), 'redacted');
  }
  assert.equal(diagnostics.describeAnimeLookupTitle('ドラゴンボール超（スーパー）'), 'ドラゴンボール超 スーパー');
  assert.ok(diagnostics.describeAnimeLookupTitle('x'.repeat(300)).length <= 100);
});
test('release native bridge reconstructs allowlisted facts and preserves the shared decision enum', () => {
  const kotlin = read('apps/mobile/plugins/orion-cinema-webview-native/OrionAnimeIdentityModule.kt');
  const nativeReasons = [...kotlin.match(/private val REASONS = setOf\(([\s\S]*?)\n    \)/)[1].matchAll(/"([a-z-]+)"/g)].map(match => match[1]);
  assert.deepEqual(nativeReasons.sort(), [...diagnostics.ANIME_IDENTITY_REASONS].sort());
  assert.match(kotlin, /Log\.i\("OrionAnimeIdentity", safe\.toString\(\)\)/);
  assert.doesNotMatch(kotlin, /BuildConfig\.DEBUG|Log\.\w+\([^\n]*(?:payload|input|Exception)/);
  assert.match(kotlin, /sequence !in 1L\.\.64L/); assert.match(kotlin, /payload\.length > 4096/);
  assert.match(read('apps/mobile/plugins/orion-cinema-webview-native/OrionCinemaWebViewPackage.kt'), /OrionAnimeIdentityModule\(reactContext\)/);
});
test('logcat trace stays bounded, reserves a decision and strips unknown/request-context fields', () => {
  const output = [];
  const bridge = loader({ '@orion/shared/api': apiMocks, 'react-native': { Platform: { OS: 'android' }, NativeModules: {} } })('apps/mobile/src/features/playback/animeIdentityDiagnostics.ts');
  const trace = bridge.createAnimeIdentityTrace(payload => output.push(JSON.parse(payload)));
  trace({ stage: 'request', tmdbId: '62715', mediaType: 'tv', season: 1, episode: 1,
    token: 'SECRET', cookies: 'SECRET', requestContext: 'SECRET', rawResponse: 'SECRET' });
  trace({ stage: 'lookup', query: 'https://private/token=SECRET', unknown: 'SECRET' });
  for (let i = 0; i < 100; i++) trace({ stage: 'candidate', anilistId: 21175, format: 'TV', year: 2015, episodes: 131 });
  trace({ stage: 'decision', outcome: 'accepted', reason: 'verified', anilistId: 21175 });
  assert.equal(output.length, 64); assert.equal(output.at(-1).stage, 'decision');
  assert.doesNotMatch(JSON.stringify(output), /SECRET|private|requestContext|cookies|rawResponse|token/);
  assert.ok(output.every((line, index) => line.sequence === index + 1 && JSON.stringify(line).length < 4096));
  assert.equal(bridge.sanitizeAnimeIdentityDiagnostic({ stage: 'unknown' }), null);
});
test('Android release uses the native logger and unavailable/non-Android logging cannot change identity', () => {
  const output = [];
  const android = loader({ '@orion/shared/api': apiMocks, 'react-native': { Platform: { OS: 'android' }, NativeModules: { OrionAnimeIdentity: { logEvent: payload => output.push(payload) } } } })('apps/mobile/src/features/playback/animeIdentityDiagnostics.ts');
  android.createAnimeIdentityTrace()({ stage: 'decision', outcome: 'rejected', reason: 'lookup-response-too-large' });
  assert.equal(JSON.parse(output[0]).reason, 'lookup-response-too-large');
  const other = loader({ '@orion/shared/api': apiMocks, 'react-native': { Platform: { OS: 'ios' }, NativeModules: {} } })('apps/mobile/src/features/playback/animeIdentityDiagnostics.ts');
  assert.doesNotThrow(() => other.createAnimeIdentityTrace()({ stage: 'request' }));
});
