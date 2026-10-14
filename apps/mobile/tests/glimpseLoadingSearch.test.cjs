'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { loader } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const prefix = 'apps/mobile/src/features/glimpse/';
const load = loader({ 'react-native': { Platform: { OS: 'android' } } });
const { createGlimpseCatalogPager } = load(prefix + 'glimpseCatalogPager.ts');
const search = load(prefix + 'glimpseSearch.ts');
const browse = load(prefix + 'glimpseBrowse.ts');
const metadata = load(prefix + 'glimpseTitleMetadata.ts');
const failure = load(prefix + 'glimpseLoadFailure.ts');
const { GlimpseLikesStore, GLIMPSE_LIKES_KEY } = load(prefix + 'GlimpseLikesStore.ts');
const media = id => ({ id, title: 'Title ' + id, media_type: 'movie' });
const reel = (id, extra = {}) => ({ schemaVersion: 1, id: 'tmdb:movie:' + id + ':youtube:' + String(id).padStart(11, '0'),
 media: { tmdbId: id, mediaType: 'movie', isAnime: false, season: null, episode: null }, title: 'Title ' + id, clipTitle: 'Scene',
 video: { provider: 'youtube', key: String(id).padStart(11, '0'), type: 'Clip', language: null, durationSeconds: null, dimensions: null },
 artworkPath: null, posterPath: null, year: '2026', ...extra });
const catalog = { rating: null, voteCount: null, releaseDate: null, genreIds: [], originCountries: [], originalLanguage: null };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function timers(t) {
 const previous = { setTimeout: global.setTimeout, clearTimeout: global.clearTimeout }, live = new Map(); let now = 0, id = 0;
 global.setTimeout = (callback, delay) => { live.set(++id, { callback, at: now + delay, delay }); return id; };
 global.clearTimeout = key => live.delete(key);
 t.after(() => Object.assign(global, previous));
 return { live, tick(ms) { now += ms; for (const [key, timer] of [...live]) if (timer.at <= now) { live.delete(key); timer.callback(); } } };
}
function feedHarness(source) {
 const h = hookHarness(); let page = 0;
 const hook = loader({ react: h.react, './tmdbGlimpseSource': { glimpseDiscoveryCatalog: { page: async () => ({ items: [media(++page)], hasMore: true }) },
   tmdbGlimpseVideoSource: { candidates: source } } })(prefix + 'useGlimpseFeed.ts').useGlimpseFeed;
 h.start(input => hook(input.enabled, 4), { enabled: true }); return h;
}

test('one failed catalog retains successful reels and retries precisely its own page', async () => {
 let televisionDown = true; const calls = [];
 const pager = createGlimpseCatalogPager(['movie', 'tv'], async (type, page) => {
   calls.push(type + ':' + page); if (type === 'tv' && televisionDown) throw Error('TMDB unreachable');
   return { results: [{ id: type === 'movie' ? page : 100 + page }], total_pages: type === 'movie' ? 1 : 2 };
 }, () => 0);
 const signal = new AbortController().signal, first = await pager.page(1, signal);
 assert.deepEqual(first.items.map(item => item.id), [1]); assert.equal(first.hasMore, true);
 televisionDown = false; const next = await pager.page(2, signal);
 assert.deepEqual(calls, ['movie:1', 'tv:1', 'tv:1']); assert.deepEqual(next.items.map(item => item.id), [101]);
 assert.equal(next.items[0].media_type, 'tv'); const final = await pager.page(3, signal);
 assert.deepEqual(final.items.map(item => item.id), [102]); assert.equal(final.hasMore, false);
});

test('catalog replay survives later engine rollback and cancellation never advances its cursors', async () => {
 const pending = deferred(); let calls = 0;
 const pager = createGlimpseCatalogPager(['movie'], async () => { calls++; return calls === 1 ? pending.promise : { results: [{ id: calls }], total_pages: 3 }; }, () => 0);
 const controller = new AbortController(), old = pager.page(1, controller.signal); controller.abort(); pending.resolve({ results: [{ id: 1 }], total_pages: 3 });
 await assert.rejects(old, /cancelled/); const recovered = await pager.page(1, new AbortController().signal);
 assert.deepEqual(recovered.items.map(item => item.id), [2]); assert.equal(await pager.page(1, new AbortController().signal), recovered);
 assert.equal(calls, 2); assert.deepEqual((await pager.page(2, new AbortController().signal)).items.map(item => item.id), [3]);
});

test('all failed catalogs remain retryable and valid titles without posters remain searchable', async () => {
 let down = true, requests = 0;
 const pager = createGlimpseCatalogPager(['tv'], async (_, page) => { requests++; if (down) throw Error('TMDB 503'); return { results: [{ id: 10, name: 'No poster' }, { id: -1 }], total_pages: page }; }, () => 0);
 const signal = new AbortController().signal; await assert.rejects(pager.page(1, signal), /503/);
 down = false; const result = await pager.page(1, signal); assert.equal(requests, 2); assert.deepEqual(result.items.map(item => item.id), [10]); assert.equal(result.hasMore, false);
});

test('punctuation, accents and word prefixes match without admitting unrelated or partial-term titles', () => {
 const values = [reel(1, { title: 'Spider-Man: Homecoming' }), reel(2, { title: 'Amélie' }), reel(3, { title: 'Dragon Ball Super' }), reel(4, { title: 'Dragon Quest' })];
 assert.deepEqual(browse.filterGlimpseReels(values, browse.defaultGlimpseFilters(), 'spider man').map(r => r.media.tmdbId), [1]);
 assert.deepEqual(browse.filterGlimpseReels(values, browse.defaultGlimpseFilters(), 'amelie').map(r => r.media.tmdbId), [2]);
 assert.deepEqual(browse.filterGlimpseReels(values, browse.defaultGlimpseFilters(), 'dragon bal').map(r => r.media.tmdbId), [3]);
 assert.equal(search.normalizeGlimpseSearch('ドラゴン・ボール'), 'ドラゴン ボール');
 assert.deepEqual(browse.filterGlimpseReels(values, browse.defaultGlimpseFilters(), 'dragon ball villain'), []);
});

test('supplied original titles participate in relevance and survive private Likes without rewriting older records', () => {
 const alias = reel(1, { title: 'Localized title', catalog: { ...catalog, titleAliases: ['Dragon Ball Super'] } });
 const related = reel(2, { title: 'Dragon Ball Super: Super Hero' }), unrelated = reel(3, { title: 'Other' });
 const matches = browse.rankGlimpseSearch(browse.filterGlimpseReels([related, alias, unrelated], browse.defaultGlimpseFilters(), 'dragon ball super'), 'dragon ball super');
 assert.deepEqual(matches.map(r => r.media.tmdbId), [2, 1]);
 const values = new Map(), storage = { getString: key => values.get(key), set: (key, value) => values.set(key, value) };
 let likes = new GlimpseLikesStore(storage, () => 10); likes.setLiked(reel(4), true);
 const oldBytes = values.get(GLIMPSE_LIKES_KEY); likes = new GlimpseLikesStore(storage); assert.equal(values.get(GLIMPSE_LIKES_KEY), oldBytes);
 likes.setLiked(alias, true); likes = new GlimpseLikesStore(storage); assert.deepEqual(likes.getSnapshot().reels[1].catalog.titleAliases, ['Dragon Ball Super']);
 assert.throws(() => metadata.normalizeGlimpseTitleMetadata({ ...catalog, titleAliases: Array(5).fill('Alias') }));
});

test('a slow barren probe does not use up the deadline of the next viable batch', async t => {
 const clock = timers(t), first = deferred(), second = deferred();
 const h = feedHarness(item => item.id === 1 ? first.promise : second.promise); t.after(() => h.dispose());
 await h.settle(); clock.tick(18000); first.resolve([]); await h.settle();
 clock.tick(3000); assert.equal(h.result.status, 'loading'); second.resolve([reel(2)]); await h.settle();
 assert.equal(h.result.status, 'ready'); assert.deepEqual(h.result.reels.map(r => r.media.tmdbId), [2]); assert.equal(clock.live.size, 0);
});

test('transient errors recover automatically, with a finite retry budget and no work while backgrounded', async t => {
 const clock = timers(t); let calls = 0, down = true;
 const h = feedHarness(async item => { calls++; if (down) throw Error('TMDB unreachable'); return [reel(item.id)]; }); t.after(() => h.dispose());
 await h.settle(); assert.equal(h.result.status, 'error'); assert.equal(h.result.failure.kind, 'network');
 clock.tick(1500); await h.settle(); clock.tick(3000); await h.settle(); assert.equal(calls, 3); assert.equal(clock.live.size, 0);
 down = false; await h.result.loadMore(); await h.settle(); assert.equal(h.result.status, 'ready'); assert.equal(h.result.reels.length, 1);
 down = true; await h.result.loadMore(); await h.settle(); assert.equal(clock.live.size, 1);
 h.update({ enabled: false }); await h.settle(); const pausedCalls = calls; clock.tick(10000); await h.settle(); assert.equal(calls, pausedCalls);
});

test('load messages distinguish timeout, rate limits and authorization without claiming that a connected device is offline', () => {
 assert.equal(failure.classifyGlimpseLoadFailure(Error('TMDB 401')).retryable, false);
 assert.equal(failure.classifyGlimpseLoadFailure(Error('Glimpse sources unavailable', { cause: Error('TMDB 429') })).kind, 'rateLimit');
 assert.match(failure.glimpseLoadFailureCopy({ kind: 'timeout', retryable: true }), /took too long/);
 assert.doesNotMatch(failure.glimpseLoadFailureCopy(), /connected|offline/);
});

test('a competing original-title alias cannot outrank the requested canonical title prefix',async()=>{
 const direct=reel(280,{title:'Terminator 2: Judgment Day'}),alias=reel(66664,{title:'Shocking Dark',catalog:{...catalog,titleAliases:['Terminator 2']}});
 const ranked=browse.rankGlimpseSearch(browse.filterGlimpseReels([alias,direct],browse.defaultGlimpseFilters(),'Terminator 2'),'Terminator 2');assert.deepEqual(ranked.map(r=>r.media.tmdbId),[280,66664]);
 const source=loader({'@orion/shared/api':{isAnimeContent:()=>false,tmdbFetch:async url=>({results:url.startsWith('/search/movie')?[{id:66664,media_type:'movie',title:'Shocking Dark',original_title:'Terminator 2',popularity:1},{id:280,media_type:'movie',title:'Terminator 2: Judgment Day',original_title:'Terminator 2: Judgment Day',popularity:40}]:[],total_pages:1})},'../../services/storageAdapter':{mmkvStorageAdapter:{get:()=>null}}})(prefix+'tmdbGlimpseSource.ts');
 const page=await source.createGlimpseCatalog(browse.defaultGlimpseFilters(),'Terminator 2').page(1,new AbortController().signal);assert.equal(page.items[0].id,280);
});
