'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { loader, read } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const prefix = 'apps/mobile/src/features/glimpse/';
const load = loader({
  '@orion/shared/api': { isAnimeContent: item => item.genre_ids?.includes(16) && item.original_language === 'ja' },
  '../../services/storageAdapter': { mmkvStorageAdapter: { get: () => null } },
});
const model = load(prefix + 'glimpseModel.ts');
const policy = load(prefix + 'glimpsePolicy.ts');
const embed = load(prefix + 'glimpseEmbed.ts');
const source = load(prefix + 'tmdbGlimpseSource.ts');
const { GlimpseFeedEngine } = load(prefix + 'GlimpseFeedEngine.ts');
const media = (id = 1, extra = {}) => ({ id, media_type: 'movie', title: 'Title ' + id, ...extra });
const reel = (id = 1, extra = {}) => source.normalizeGlimpseVideos(media(id, extra),
  [{ site: 'YouTube', key: String(id).padStart(11, '0'), type: 'Clip', name: 'Scene' }])[0];
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('canonical title and episode identities preserve movie/TV/Anime destination ownership', () => {
  const movie = reel();
  assert.equal(movie.id, 'tmdb:movie:1:youtube:00000000001');
  assert.deepEqual(model.glimpseDestination(movie), { pathname: '/media/[id]', params: { id: '1', type: 'movie' } });
  const anime = reel(2, { media_type: 'tv', name: 'Anime', title: undefined, genre_ids: [16], original_language: 'ja' });
  assert.equal(anime.media.isAnime, true);
  assert.equal(model.glimpseDestination(anime).pathname, '/media/[id]');
  const episode = { ...anime, media: { ...anime.media, season: 2, episode: 7 } };
  assert.equal(model.glimpseReelId(episode.media, episode.video.key), 'tmdb:tv:2:s2:e7:youtube:00000000002');
  const target = model.glimpseDestination(episode);
  assert.equal(target.pathname, '/player/[id]');
  assert.equal(target.params.type, 'tv');
  assert.equal(target.params.season, '2');
  assert.equal(target.params.episode, '7');
  assert.equal('sourceId' in target.params, false);
  assert.throws(() => model.glimpseReelId({ ...anime.media, season: 1 }, anime.video.key));
  assert.throws(() => model.glimpseReelId(movie.media, 'javascript:alert(1)'));
});
test('source selects Clip/Teaser/Promo before trailers, dedupes, and retains unknown duration honestly', () => {
  const entries = ['Trailer', 'Featurette', 'Promo', 'Teaser', 'Clip'].map((type, i) =>
    ({ site: 'YouTube', key: String(i + 1).padStart(11, '0'), type, name: type, iso_639_1: 'en' }));
  entries.push({ ...entries[0] }, { site: 'Vimeo', key: '12', type: 'Clip' }, { site: 'YouTube', key: 'bad', type: 'Clip' });
  const reels = source.normalizeGlimpseVideos(media(), entries);
  assert.deepEqual(reels.map(value => value.video.type), ['Clip', 'Teaser', 'Promo', 'Featurette', 'Trailer']);
  assert.equal(reels.length, 5);
  assert.equal(reels.every(value => value.video.durationSeconds === null), true);
  assert.deepEqual(source.normalizeGlimpseVideos(media(1, { media_type: 'person' }), entries), []);
});
test('feed lazily bounds requests, suppresses duplicate titles, and contains one dead title', async () => {
  let pages = 0; const titles = [];
  const engine = new GlimpseFeedEngine({ page: async () => { pages++; return { items: [media(1), media(1), media(2), media(3)], hasMore: false }; } },
    { candidates: async item => { titles.push(item.id); if (item.id === 2) throw new Error('unavailable'); return [reel(item.id), reel(item.id)]; } });
  assert.equal(pages, 0);
  const result = await engine.extend(new AbortController().signal, 999);
  assert.equal(pages, 1);
  assert.deepEqual(titles, [1, 2, 3]);
  assert.deepEqual(result.reels.map(value => value.media.tmdbId), [1, 3]);
  assert.equal(result.failedTitles, 1);
  assert.equal(result.exhausted, true);
});
test('cancelled requests never commit skipped pages/title identities or stale reels', async () => {
  const pending = deferred(); let calls = 0;
  const engine = new GlimpseFeedEngine({ page: async () => ({ items: [media(1)], hasMore: false }) },
    { candidates: async () => { calls++; return calls === 1 ? pending.promise : [reel(1)]; } });
  const controller = new AbortController();
  const request = engine.extend(controller.signal, 4);
  await new Promise(resolve => setImmediate(resolve));
  controller.abort(); pending.resolve([reel(1)]);
  await assert.rejects(request);
  assert.equal(engine.snapshot().reels.length, 0);
  const recovered = await engine.extend(new AbortController().signal, 4);
  assert.equal(recovered.reels.length, 1);
  assert.equal(calls, 2);
});
test('extended scrolling stays bounded and eviction preserves the canonical active reel', async () => {
  const engine = new GlimpseFeedEngine({ page: async page => ({ items: Array.from({ length: 8 }, (_, i) => media((page - 1) * 8 + i + 1)), hasMore: page < 20 }) },
    { candidates: async item => [reel(item.id)] });
  let current = null;
  for (let batch = 0; batch < 20; batch++) {
    const snapshot = await engine.extend(new AbortController().signal, 8, current);
    assert.ok(snapshot.reels.length <= 48);
    if (current) assert.ok(snapshot.reels.some(value => value.id === current));
    current = snapshot.reels.at(-1)?.id;
  }
  assert.equal(engine.snapshot().reels.length, 48);
});
test('every ownership gate releases active media and profile changes only tune work', () => {
  const state = { focused: true, foreground: true, remoteReady: true, discover: true, scrolling: false, navigating: false, reelId: 'one' };
  assert.equal(policy.activeGlimpseReel(state), 'one');
  for (const gate of ['focused', 'foreground', 'remoteReady', 'discover']) assert.equal(policy.activeGlimpseReel({ ...state, [gate]: false }), null);
  for (const gate of ['scrolling', 'navigating']) assert.equal(policy.activeGlimpseReel({ ...state, [gate]: true }), null);
  assert.equal(policy.glimpseRenderBudget('efficiency').titleBatch, 4);
  assert.equal(policy.glimpseRenderBudget('quality').titleBatch, 6);
  assert.equal(policy.settledGlimpseIndex(1400, 500, 3), 2);
  assert.equal(policy.settledGlimpseIndex(-500, 500, 3), 0);
  assert.equal(policy.settledGlimpseIndex(NaN, 0, 3), 0);
});
test('embed navigation and event bridge reject external schemes, misleading hosts and stale messages', () => {
  const key = '00000000001';
  assert.equal(embed.allowGlimpseNavigation('https://www.youtube-nocookie.com/embed/' + key, key), true);
  for (const url of ['https://www.youtube.com/watch?v=' + key, 'https://www.youtube.com.evil.test/embed/' + key,
    'https://www.youtube.com@evil.test/embed/' + key, 'intent://external', 'javascript:alert(1)', 'file:///private']) {
    assert.equal(embed.allowGlimpseNavigation(url, key), false);
  }
  assert.equal(embed.parseGlimpseVideoEvent(JSON.stringify({ reelId: 'one', token: 'token', type: 'ready' }), 'one', 'token'), 'ready');
  assert.equal(embed.parseGlimpseVideoEvent(JSON.stringify({ reelId: 'two', token: 'token', type: 'ready' }), 'one', 'token'), null);
  assert.equal(embed.parseGlimpseVideoEvent(JSON.stringify({ reelId: 'one', token: 'old', type: 'ready' }), 'one', 'token'), null);
  assert.equal(embed.parseGlimpseVideoEvent('x'.repeat(3000), 'one', 'token'), null);
});
test('real embed script starts muted and destroys the player/timer on visibility loss', () => {
  const calls = []; const events = {}; const messages = []; let options; const timers = new Set();
  const player = { mute: () => calls.push('mute'), unMute: () => calls.push('unmute'), playVideo: () => calls.push('play'),
    pauseVideo: () => calls.push('pause'), destroy: () => calls.push('destroy') };
  const context = { JSON, document: { hidden: false, addEventListener: (type, fn) => { events[type] = fn; },
    createElement: () => ({}), head: { appendChild() {} } },
    setTimeout: fn => { timers.add(fn); return fn; }, clearTimeout: handle => timers.delete(handle),
    YT: { Player: function (_, config) { options = config; return player; } } };
  context.window = { ReactNativeWebView: { postMessage: data => messages.push(JSON.parse(data)) }, addEventListener() {} };
  const html = embed.createGlimpseEmbedHtml(reel(), 'token', true);
  vm.runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1], context);
  context.window.onYouTubeIframeAPIReady();
  options.events.onReady();
  assert.deepEqual(calls, ['mute', 'play']);
  assert.equal(messages[0].reelId, reel().id);
  context.document.hidden = true; events.visibilitychange();
  assert.deepEqual(calls.slice(-2), ['pause', 'destroy']);
  assert.equal(timers.size, 0);
  options.events.onStateChange({ data: 1 });
  assert.equal(messages.length, 1);
});
test('feed hook ignores late responses after blur and resumes the interrupted initial batch', async () => {
  const pending = deferred(); let calls = 0; const harness = hookHarness();
  const hookLoad = loader({ react: harness.react, './tmdbGlimpseSource': {
    glimpseDiscoveryCatalog: { page: async () => ({ items: [media(1)], hasMore: false }) },
    tmdbGlimpseVideoSource: { candidates: async () => ++calls === 1 ? pending.promise : [reel(1)] },
  } });
  const hook = hookLoad(prefix + 'useGlimpseFeed.ts').useGlimpseFeed;
  harness.start(input => hook(input.enabled, 4), { enabled: true });
  await new Promise(resolve => setImmediate(resolve));
  harness.update({ enabled: false }); pending.resolve([reel(1)]);
  await harness.settle();
  assert.equal(harness.result.reels.length, 0);
  harness.update({ enabled: true }); await harness.settle();
  assert.equal(harness.result.reels.length, 1);
  harness.dispose();
});
test('all locked source remains preserved except the exact two gated navigation additions', () => {
  const result = require('../scripts/check-glimpse-preservation.cjs').checkPreservation();
  assert.equal(result.authority, '32ea4f75d8ff64975f44507672ad07db477efaf9');
  assert.equal(result.navigationAdditions, 2);
  assert.ok(result.frozenBaselineFiles > 100);
  const route = read('apps/mobile/app/(tabs)/glimpse.tsx');
  assert.match(route, /if \(!isGlimpsePreviewEnabled\(\)\) return <Redirect href="\/" \/>/);
  assert.match(read(prefix + 'glimpsePreview.ts'), /__DEV__[\s\S]*EXPO_PUBLIC_GLIMPSE_PREVIEW === 'true'/);
});
test('native media teardown destroys the active surface and ignores late callbacks', async () => {
  const harness = hookHarness(); const commands = []; const events = [];
  let listener; let firstRef = true;
  const native = { injectJavaScript: command => commands.push(command) };
  const react = { ...harness.react, useRef(value) {
    const ref = harness.react.useRef(value);
    if (firstRef) { ref.current = native; firstRef = false; }
    return ref;
  } };
  const module = loader({ react,
    'react-native': { Platform: { OS: 'android' }, StyleSheet: { create: value => value }, View: 'View',
      AppState: { addEventListener: (_, callback) => { listener = callback; return { remove() {} }; } } },
    'react-native-webview': { WebView: 'WebView' },
  })(prefix + 'GlimpseVideoSurface.tsx');
  harness.start(() => module.GlimpseVideoSurface({ reel: reel(), muted: true, onEvent: event => events.push(event) }));
  const surface = harness.result.props.children;
  listener('background');
  assert.ok(commands.some(command => command.includes('orionGlimpseStop')));
  surface.props.onError();
  assert.deepEqual(events, []);
  assert.equal(surface.props.onShouldStartLoadWithRequest({ url: 'intent://uncontrolled' }), false);
  harness.dispose();
});
test('Stage ownership follows snap, canonical eviction, offline and Detail return without touching Player', async () => {
  const harness = hookHarness(); let focused = true; let remoteReady = true;
  const feed = { reels: [reel(1), reel(2), reel(3)], status: 'ready', exhausted: true,
    canAutoExtend: true, loadMore: async () => {}, activeId: { current: null } };
  const theme = { background: '#000', border: '#222', text: '#fff', textSecondary: '#ccc', textMuted: '#888', accentSoft: '#111', accent: '#f00' };
  const pushes = [];
  const mockLoad = loader({
    react: harness.react,
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', FlatList: 'FlatList',
      ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value } },
    'expo-router': { useLocalSearchParams: () => ({}), useIsFocused: () => focused, useRouter: () => ({ push: value => pushes.push(value) }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
    '../../context/ThemeContext': { useOrionTheme: () => ({ theme, preferences: { reducedMotion: true }, systemReducedMotion: false }) },
    '../../context/NetworkContext': { useNetworkStatus: () => ({ remoteReady }) },
    '../../context/PerformanceContext': { usePerformanceProfile: () => ({ resolvedProfile: 'balanced' }) },
    '../../services/responsive': { useResponsiveLayout: () => ({ isTablet: false, isLandscape: false }) },
    './useGlimpseForeground': { useGlimpseForeground: () => true },
    './useGlimpseFeed': { useGlimpseFeed: () => feed },
    './glimpsePreferences': { useGlimpsePreferences: () => ({ preferences: { startMuted: true, autoAdvance: false, rememberPosition: false, position: null, sorts: { discover: 'manual', liked: 'manual' } }, unavailable: false, saveError: false, update() {} }) },
    './GlimpseControls': { GlimpseControls: 'Controls' }, '../library/LibrarySortDialog': { LibrarySortDialog: 'SortDialog' },    '@expo/vector-icons': { Ionicons: 'Icon' }, '../../components/MobilePageHeader': { MobilePageHeader: 'Header' }, './GlimpseStage': { GlimpseStage: 'Stage' },
    './useGlimpseLikes': { useGlimpseLikes: () => ({ document: { localRevision: 0, records: {} }, reels: [], unavailable: false, saveError: false, toggle() {} }) },
  });
  const Screen = mockLoad(prefix + 'GlimpseScreen.tsx').default;
  const find = (node, type) => {
    if (!node || typeof node !== 'object') return null;
    if (node.type === type) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const match = find(child, type); if (match) return match; }
    return null;
  };
  const each = (node, callback) => {
    if (!node || typeof node !== 'object') return;
    callback(node);
    [node.props?.children].flat(Infinity).forEach(child => each(child, callback));
  };
  const stages = () => {
    const list = find(harness.result, 'FlatList');
    return list ? list.props.data.map((item, index) => find(list.props.renderItem({ item, index }), 'Stage').props) : [];
  };
  harness.start(Screen);
  let viewport;
  each(harness.result, node => { if (node.props?.onLayout) viewport = node; });
  viewport.props.onLayout({ nativeEvent: { layout: { height: 500 } } });
  await harness.settle();
  assert.deepEqual(stages().filter(stage => stage.active).map(stage => stage.reel.id), [reel(1).id]);
  find(harness.result, 'FlatList').props.onScrollBeginDrag();
  find(harness.result, 'FlatList').props.onScroll({ nativeEvent: { contentOffset: { y: 200 } } });
  await harness.settle();
  assert.equal(stages().filter(stage => stage.active).length, 0);
  find(harness.result, 'FlatList').props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { y: 500 } } });
  await harness.settle();
  assert.deepEqual(stages().filter(stage => stage.active).map(stage => stage.reel.id), [reel(2).id]);
  feed.reels = [reel(2), reel(3), reel(4)]; harness.update();
  assert.equal(stages().filter(stage => stage.active).length, 0, 'Window eviction releases media until the visible offset is realigned');
  await harness.settle();
  assert.deepEqual(stages().filter(stage => stage.active).map(stage => stage.reel.id), [reel(2).id]);
  remoteReady = false; harness.update();
  assert.equal(stages().filter(stage => stage.active).length, 0);
  remoteReady = true; harness.update();
  stages()[0].onView(); await harness.settle();
  assert.equal(pushes[0].pathname, '/media/[id]');
  assert.equal(pushes[0].params.id, '2');
  assert.equal(stages().filter(stage => stage.active).length, 0);
  focused = false; harness.update(); focused = true; harness.update(); await harness.settle();
  assert.deepEqual(stages().filter(stage => stage.active).map(stage => stage.reel.id), [reel(2).id]);
  harness.dispose();
});
test('feed probes past barren batches automatically while bounding each request', async () => {
  const harness = hookHarness(); let calls = 0; let page = 0;
  const hook = loader({ react: harness.react, './tmdbGlimpseSource': {
    glimpseDiscoveryCatalog: { page: async () => ({ items: [media(++page)], hasMore: true }) },
    tmdbGlimpseVideoSource: { candidates: async item => ++calls === 1 || calls === 4 ? [reel(item.id)] : [] },
  } })(prefix + 'useGlimpseFeed.ts').useGlimpseFeed;
  harness.start(() => hook(true, 4)); await harness.settle();
  await harness.result.loadMore(); await harness.settle();
  assert.deepEqual(harness.result.reels.map(r => r.media.tmdbId), [1, 4]);
  assert.equal(calls, 4);
  await harness.result.loadMore(); await harness.settle(); assert.equal(calls, 8);
  assert.equal(harness.result.status, 'ready');
  harness.dispose();
});

test('a rapid swipe during extension protects the latest active identity before eviction commits', async () => {
  const delayed = deferred();
  const engine = new GlimpseFeedEngine({ page: async page => ({ items: Array.from({ length: 8 }, (_, i) => media((page - 1) * 8 + i + 1)), hasMore: true }) },
    { candidates: async item => { if (item.id === 49) await delayed.promise; return [reel(item.id)]; } });
  for (let i = 0; i < 6; i++) await engine.extend(new AbortController().signal, 8, engine.snapshot().reels.at(-1)?.id || null);
  let active = reel(48).id;
  const pending = engine.extend(new AbortController().signal, 8, () => active);
  await new Promise(resolve => setImmediate(resolve));
  active = reel(1).id;
  delayed.resolve();
  const result = await pending;
  assert.equal(result.reels.length, 48);
  assert.equal(result.reels[0].id, active);
  assert.equal(result.addedCount, 8);
  assert.deepEqual(result.reels.slice(-8).map(r => r.media.tmdbId), [49, 50, 51, 52, 53, 54, 55, 56]);
});
test('preview exposure requires explicit development opt-in and cannot expose production Glimpse', () => {
  const previousDev = global.__DEV__;
  const previousFlag = process.env.EXPO_PUBLIC_GLIMPSE_PREVIEW;
  const gate = loader({ './glimpseBuild': { GLIMPSE_INTERNAL_PREVIEW: false, GLIMPSE_PRODUCTION_ENABLED: false } })(prefix + 'glimpsePreview.ts').isGlimpsePreviewEnabled;
  try {
    process.env.EXPO_PUBLIC_GLIMPSE_PREVIEW = 'true'; global.__DEV__ = false;
    assert.equal(gate(), false);
    global.__DEV__ = true; delete process.env.EXPO_PUBLIC_GLIMPSE_PREVIEW;
    assert.equal(gate(), false);
    process.env.EXPO_PUBLIC_GLIMPSE_PREVIEW = 'true';
    assert.equal(gate(), true);
  } finally {
    if (previousDev === undefined) delete global.__DEV__; else global.__DEV__ = previousDev;
    if (previousFlag === undefined) delete process.env.EXPO_PUBLIC_GLIMPSE_PREVIEW; else process.env.EXPO_PUBLIC_GLIMPSE_PREVIEW = previousFlag;
  }
});


test('a source-wide outage can retry the same titles without silently consuming the page', async () => {
 let unavailable = true; const calls = [];
 const engine = new GlimpseFeedEngine({ page: async () => ({ items: [media(1), media(2)], hasMore: false }) },
  { candidates: async item => { calls.push(item.id); if (unavailable) throw Error('network'); return [reel(item.id)]; } });
 await assert.rejects(engine.extend(new AbortController().signal, 4), /sources unavailable/);
 assert.equal(engine.snapshot().exhausted, false); assert.equal(engine.snapshot().reels.length, 0);
 unavailable = false; const result = await engine.extend(new AbortController().signal, 4);
 assert.deepEqual(calls, [1, 2, 1, 2]); assert.deepEqual(result.reels.map(r => r.media.tmdbId), [1, 2]);
});

test('the memory window supports hundreds of appended clips and retains new batches with an early protected identity', async () => {
 const engine = new GlimpseFeedEngine({ page: async page => ({ items: Array.from({ length: 8 }, (_, i) => media((page - 1) * 8 + i + 1)), hasMore: page < 40 }) },
  { candidates: async item => [reel(item.id)] });
 for (let batch = 0; batch < 40; batch++) {
  const protectedId = engine.snapshot().reels[0]?.id || null;
  const result = await engine.extend(new AbortController().signal, 8, protectedId);
  assert.ok(result.reels.length <= 48); assert.equal(result.addedCount, 8);
  if (protectedId) assert.ok(result.reels.some(r => r.id === protectedId));
  assert.deepEqual(result.reels.slice(-8).map(r => r.media.tmdbId), Array.from({ length: 8 }, (_, i) => batch * 8 + i + 1));
  assert.equal(new Set(result.reels.map(r => r.id)).size, result.reels.length);
 }
 assert.equal(engine.snapshot().exhausted, true);
});

test('title search streams every associated clip without a total feed cap or duplicate IDs', async () => {
  const clips = Array.from({ length: 129 }, (_, i) => ({ ...reel(1), id: 'clip:' + i, video: { ...reel(1).video, key: String(i).padStart(11, '0') } }));
  const engine = new GlimpseFeedEngine({ page: async () => ({ items: [media(1), media(1)], hasMore: false }) },
    { candidates: async () => [...clips, clips[0]] }, null, true);
  const delivered = new Set(); let protectedId = null, batches = 0;
  while (!engine.snapshot().exhausted) {
    const before = new Set(engine.snapshot().reels.map(reel => reel.id));
    const next = await engine.extend(new AbortController().signal, 4, protectedId);
    const arrivals = next.reels.filter(reel => !before.has(reel.id));
    assert.ok(arrivals.length <= 4); assert.ok(next.reels.length <= 48);
    for (const clip of arrivals) { assert.equal(delivered.has(clip.id), false); delivered.add(clip.id); }
    if (protectedId) assert.ok(next.reels.some(reel => reel.id === protectedId));
    protectedId ||= next.reels[0]?.id; assert.ok(++batches < 100);
  }
  assert.equal(delivered.size, 129);
});

test('search cursor rollback retains undelivered associated clips after cancellation or source outage', async () => {
  const clips = Array.from({ length: 10 }, (_, i) => { const key=String(i).padStart(11,'0'); return { ...reel(1), id: model.glimpseReelId(reel(1).media,key), video: { ...reel(1).video,key } }; });
  let mode = 'ok'; const pending = deferred();
  const engine = new GlimpseFeedEngine({ page: async () => ({ items: [media(1)], hasMore: false }) },
    { candidates: async () => { if (mode === 'error') throw new Error('offline'); return mode === 'wait' ? pending.promise : clips; } }, null, true);
  assert.equal((await engine.extend(new AbortController().signal, 4)).reels.length, 4);
  assert.equal(engine.snapshot().exhausted, false);
  mode = 'error'; await assert.rejects(engine.extend(new AbortController().signal, 4));
  mode = 'wait'; const controller = new AbortController(); const request = engine.extend(controller.signal, 4);
  await new Promise(resolve => setImmediate(resolve)); controller.abort(); pending.resolve(clips); await assert.rejects(request);
  assert.equal(engine.snapshot().reels.length, 4); assert.equal(engine.snapshot().exhausted, false);
  mode = 'ok'; assert.equal((await engine.extend(new AbortController().signal, 4)).reels.length, 8);
  const final = await engine.extend(new AbortController().signal, 4); assert.equal(final.reels.length, 10); assert.equal(final.exhausted, true);
});

test('ordinary Discover retains title variety while search includes all eligible matching associated clips', async () => {
  const catalog = { page: async () => ({ items: [media(1), media(2)], hasMore: false }) };
  const source = { candidates: async item => [reel(item.id), { ...reel(item.id), id: model.glimpseReelId(reel(item.id).media, String(item.id+100).padStart(11,'0')), video: { ...reel(item.id).video, key: String(item.id+100).padStart(11,'0') } }] };
  const ordinary = await new GlimpseFeedEngine(catalog, source).extend(new AbortController().signal, 4);
  assert.deepEqual(ordinary.reels.map(r => r.media.tmdbId), [1, 2]);
  const search = await new GlimpseFeedEngine(catalog, source, null, true).extend(new AbortController().signal, 4);
  assert.deepEqual(search.reels.map(r => r.media.tmdbId), [1, 1, 2, 2]);
});

test('failed bridge preserves validated YouTube reasons without asserting a regional cause', () => {
  const failure = patch => JSON.stringify({ reelId: 'one', token: 'token', type: 'failed', ...patch });
  for (const [code, kind] of [[101, 'embedding'], [150, 'embedding'], [100, 'unavailable'], [153, 'identity'], [2, 'player'], [5, 'player']]) {
    assert.deepEqual(embed.parseGlimpseVideoFailure(failure({ errorCode: code }), 'one', 'token'), { kind, code });
  }
  assert.equal(embed.parseGlimpseVideoFailure(failure({ token: 'old', errorCode: 101 }), 'one', 'token'), null);
  assert.equal(embed.parseGlimpseVideoFailure(failure({ reelId: 'other', errorCode: 101 }), 'one', 'token'), null);
  assert.equal(embed.parseGlimpseVideoFailure('x'.repeat(3000), 'one', 'token'), null);
  assert.equal(embed.parseGlimpseVideoFailure(failure({ type: 'ready', errorCode: 101 }), 'one', 'token'), null);
  assert.deepEqual(embed.parseGlimpseVideoFailure(failure({ errorCode: '101', reason: 'forged' }), 'one', 'token'), { kind: 'unknown', code: null });
  assert.deepEqual(embed.parseGlimpseVideoFailure(failure({ reason: 'timeout' }), 'one', 'token'), { kind: 'timeout', code: null });
  assert.doesNotMatch(embed.glimpseFailureCopy({ kind: 'unknown', code: null }), /region|another reel/i);
  assert.equal(embed.glimpseYouTubeUrl(reel()), 'https://www.youtube.com/watch?v=00000000001');
  assert.throws(() => embed.glimpseYouTubeUrl({ ...reel(), video: { ...reel().video, key: 'intent://bad' } }));
});

test('real iframe error forwards the YouTube code and stops late errors after teardown', () => {
  const messages = []; let options;
  const context = { JSON, document: { addEventListener() {}, createElement: () => ({}), head: { appendChild() {} } },
    setTimeout: () => 1, clearTimeout() {},
    YT: { Player: function (_, config) { options = config; return { pauseVideo() {}, destroy() {} }; } } };
  context.window = { ReactNativeWebView: { postMessage: data => messages.push(JSON.parse(data)) }, addEventListener() {} };
  vm.runInNewContext(embed.createGlimpseEmbedHtml(reel(), 'token', true).match(/<script>([\s\S]*)<\/script>/)[1], context);
  context.window.onYouTubeIframeAPIReady(); options.events.onError({ data: 150 });
  assert.equal(messages[0].type, 'failed'); assert.equal(messages[0].errorCode, 150);
  context.window.orionGlimpseStop(); options.events.onError({ data: 153 }); assert.equal(messages.length, 1);
});