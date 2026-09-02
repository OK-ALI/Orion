'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'src/features/media-detail');
const read = (name) => fs.readFileSync(path.join(dir, name), 'utf8');
const files = ['MediaDetailScreen.tsx', 'useMediaDetailRemoteState.ts', 'useMediaDetailLocalAvailability.ts', 'MediaDetailFallback.tsx', 'MovieCollectionTab.tsx'];
const compiledCache = new Map();
const emptyRepository = () => ({ schemaVersion: 1, jobs: [], assets: [], offlineEntries: [], updatedAt: 1 });
function downloaded(type = 'movie', id = 1, season = null, episode = null, assetId = 'asset-1') {
  const media = { schemaVersion: 1, id, mediaType: type, title: 'Local title', year: 2024, season, episode,
    libraryKind: type === 'movie' ? 'movie' : 'series', seriesTitle: type === 'tv' ? 'Local series' : null,
    episodeTitle: type === 'tv' ? `Local episode ${episode}` : null };
  return { ...emptyRepository(), assets: [{ assetId, media, destination: 'orion-library', storageTarget: { mode: 'user-folder' },
    availability: 'verified', artifacts: [{ role: 'primary', availability: 'verified' }] }],
  offlineEntries: [{ entryId: 'entry-' + assetId, media, title: media.title, seriesTitle: media.seriesTitle,
    episodeTitle: media.episodeTitle, primaryAssetId: assetId, assetIds: [assetId], posterPath: '/local-poster', backdropPath: '/local-backdrop' }] };
}
const titleResponse = (id = 1, type = 'movie') => ({ id, title: 'Remote title ' + id, name: 'Remote series ' + id,
  release_date: '2024-01-01', first_air_date: '2024-01-01', number_of_seasons: 3, overview: 'Loaded overview',
  credits: { cast: [] }, recommendations: { results: [] }, videos: { results: [{ id: 'trailer', key: 'key' }] }, media_type: type });

// Deterministic hook/effect runner, real screen/hydration/repository selectors, mocked
// platform services. Deferred promises let tests resolve pre-loss requests last.
function harness({ state = 'online', epoch = 0, repository = emptyRepository(), reconciliation = 'ready', mode = 'screen', type = 'movie',
  themeId = 'midnight-premiere', width = 400, height = 800, fontScale = 1 } = {}) {
  const slots = [], requests = [], routes = [], saves = [], sourceRequests = [];
  const repositoryListeners = new Set(), reconciliationListeners = new Set(), modules = new Map();
  let network = { productState: state, remoteReady: state === 'online', recoveryEpoch: epoch };
  let params = { id: '1', type }, options = { id: '1', type, selectedSeason: 1, activeTab: 'info', showTrailerModal: false };
  let cursor = 0, dirty = false, effects = [], result, watched = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    createContext: () => ({}),
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, (next) => { const value = typeof next === 'function' ? next(slots[i].value) : next;
        if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; if (!slots[i]) slots[i] = { current: initial }; return slots[i]; },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: fn(), deps }; return slots[i].value; },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) effects.push({ i, fn, deps, cleanup: slots[i]?.cleanup }); },
  };
  const element = (type, props) => ({ type, props: props || {} });
  const router = { push: (route) => routes.push(route), back() {} };
  const watchedActions = { movieWatched: false, isEpisodeWatched: () => false, toggleMovieWatched: () => watched++, toggleEpisodeWatched: () => watched++ };
  const mocks = {
    react, 'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    'react-native': { ...Object.fromEntries(['View', 'Text', 'Image', 'ScrollView', 'ActivityIndicator', 'Pressable', 'FlatList', 'Modal'].map((s) => [s, s])),
      StyleSheet: { create: (s) => s, absoluteFill: {}, hairlineWidth: 1 }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width, height, fontScale }),
      Animated: { Value: class {}, ScrollView: 'ScrollView', sequence: () => ({ start() {} }), timing: () => ({}) }, Share: { share: async () => {} } },
    'expo-router': { useRouter: () => router, useLocalSearchParams: () => params, useFocusEffect: (fn) => react.useEffect(fn, [fn]) },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' }, 'expo-blur': { BlurView: 'BlurView' }, '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 10, bottom: 10 }) },
    '@orion/shared/api': { tmdbFetch: (url) => new Promise((resolve, reject) => requests.push({ url, resolve, reject })), imgUrl: (value) => value },
    '../../context/NetworkContext': { useNetworkStatus: () => network }, './NetworkContext': { useNetworkStatus: () => network },
    '../../context/ThemeContext': { useOrionTheme: () => ({ theme }) },
    '../../context/LibraryContext': { useLibraryVisual: () => ({ toggleSave: (record) => saves.push(record), isSaved: () => false }), useLibraryPlaybackActions: () => ({ getPlaybackProgress: () => null }) },
    '../../context/PerformanceContext': { usePerformanceProfile: () => ({ resolvedProfile: 'balanced' }) },
    '../../services/responsive': { useResponsiveLayout: () => ({ width, isTablet: Math.min(width, height) >= 600 }) },
    '../../services/listPerformance': { getRailRenderBudget: () => ({}) },
    './useMediaDetailWatched': { useMediaDetailWatched: () => watchedActions },
    '../services/storageAdapter': { mmkvStorageAdapter: {} },
    './EpisodeOverview': { EpisodeOverview: 'EpisodeOverview' },
    './WatchedControls': Object.fromEntries(['EpisodeWatchedButton', 'MovieWatchedBadge', 'SeasonWatchedControl', 'WatchedFeedback'].map((s) => [s, s])),
    '../trailers/trailerCandidateService': { normalizeTrailerCandidates: (videos, seasons) => [...videos, ...seasons] },
    '../library/playbackLibrary': { isVerifiedPlaybackEvidence: () => true },
    '../downloads/downloadRepository': { readMobileDownloadRepositoryV1: () => repository,
      subscribeMobileDownloadRepositoryV1: (fn) => { repositoryListeners.add(fn); return () => repositoryListeners.delete(fn); } },
    '../downloads/nativeDownloadEngine': { getMobileDownloadReconciliationStateV1: () => reconciliation,
      subscribeMobileDownloadReconciliationV1: (fn) => { reconciliationListeners.add(fn); fn(reconciliation); return () => reconciliationListeners.delete(fn); } },
    '../downloads/downloadCandidateCapture': { cancelMobileDownloadSourceResolutionV1() {}, requestMobileDownloadSourceResolutionV1: (...args) => sourceRequests.push(args) },
    '../../components/DownloadModal': { DownloadModal: 'DownloadModal' }, '../../components/TrailerModal': { TrailerModal: 'TrailerModal' },
    '../../components/MediaCard': { MediaCard: 'MediaCard' },
  };
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    if (!compiledCache.has(file)) compiledCache.set(file, ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: file,
    }).outputText);
    const module = { exports: {} }; modules.set(file, module);
    const requireLocal = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      assert.ok(name.startsWith('.'), 'Unexpected external module ' + name);
      const base = path.resolve(path.dirname(file), name);
      return load(['.ts', '.tsx'].map((ext) => base + ext).find((p) => fs.existsSync(p)));
    };
    new Function('require', 'module', 'exports', compiledCache.get(file))(requireLocal, module, module.exports);
    return module.exports;
  }
  mocks['@orion/shared/tokens'] = load(path.resolve(root, '../../packages/shared/src/tokens/index.ts'));
  const theme = load(path.join(root, 'src/context/ThemeContext.tsx')).ORION_MOBILE_THEMES[themeId];
  const remoteHook = load(path.join(dir, 'useMediaDetailRemoteState.ts')).useMediaDetailRemoteState;
  const Screen = load(path.join(dir, 'MediaDetailScreen.tsx')).default;
  const Collection = load(path.join(dir, 'MovieCollectionTab.tsx')).MovieCollectionTab;
  const selector = load(path.join(dir, 'useMediaDetailLocalAvailability.ts')).selectMediaDetailLocalCopies;
  function render() {
    let count = 0;
    do { assert.ok(++count < 30, 'Render loop'); cursor = 0; dirty = false; effects = [];
      result = mode === 'remote' ? remoteHook(options) : mode === 'collection' ? Collection({ collectionId: 10, collectionName: 'Collection', currentMovieId: '1', onOpenMovie() {}, remote: remoteHook(options) }) : Screen();
      for (const e of effects) e.cleanup?.();
      for (const e of effects) slots[e.i] = { deps: e.deps, cleanup: e.fn() };
    } while (dirty);
    return result;
  }
  function nodes(node) { if (Array.isArray(node)) return node.flatMap(nodes); if (!node?.props) return []; return [node, ...nodes(node.props.children)]; }
  function find(label) { const node = nodes(result).find((n) => n.props.accessibilityLabel === label); assert.ok(node, 'Missing ' + label); return node; }
  render();
  return { requests, routes, saves, sourceRequests, selector, render, theme,
    get result() { return result; }, get watched() { return watched; },
    find, nodes: () => nodes(result), press(label) { find(label).props.onPress({ stopPropagation() {} }); render(); },
    localChoiceNodes() {
      const list = nodes(result).find((node) => node.type?.name === 'MediaDetailLocalCopies');
      const props = list?.props || result.props;
      return nodes(load(path.join(dir, 'MediaDetailFallback.tsx')).MediaDetailLocalCopies(props));
    },
    component(name) { return nodes(result).find((node) => (typeof node.type === 'function' ? node.type.name : node.type) === name); },
    connect(state, epoch = network.recoveryEpoch) { network = { productState: state, remoteReady: state === 'online', recoveryEpoch: epoch }; render(); },
    options(next) { options = { ...options, ...next }; params = { ...params, ...next }; render(); },
    repository(next, ready = reconciliation) { repository = next; reconciliation = ready; repositoryListeners.forEach((fn) => fn(repository)); reconciliationListeners.forEach((fn) => fn(ready)); render(); },
    async settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); render(); },
    unmount() { slots.forEach((s) => s?.cleanup?.()); },
  };
}

test('the slice consumes existing owners and stays within source-size boundaries', () => {
  const remote = read('useMediaDetailRemoteState.ts'), local = read('useMediaDetailLocalAvailability.ts'), screen = read('MediaDetailScreen.tsx');
  assert.match(remote, /useNetworkStatus\(\)/); assert.match(remote, /useRemoteRecoveryEffect\(/);
  assert.match(local, /readMobileDownloadRepositoryV1/); assert.match(local, /subscribeMobileDownloadRepositoryV1/);
  assert.match(local, /getMobileDownloadReconciliationStateV1/);
  for (const file of files) { const source = read(file); assert.ok(source.split(/\r?\n/).length <= 800, file);
    assert.doesNotMatch(source, /NetInfo|createContext|probeRemoteService|setInterval|setRecoveryEpoch|AsyncStorage|mmkvStorageAdapter|writeMobileDownloadRepositoryV1/);
    assert.doesNotMatch(source, /ResumePlaybackPrompt|prePhase3UiPolish|Readiness-Audit|router\.replace|Updates\.reload/); }
  assert.match(screen, /useMediaDetailRemoteState/); assert.match(screen, /useMediaDetailLocalAvailability/);
  assert.match(screen, /isOffline: 'true', offlineAssetId: asset\.assetId/);
  assert.match(screen, /onPress=\{\(\) => toggleSave/);
  assert.match(screen, /watchedActions\.toggleEpisodeWatched/);
  assert.match(read('MediaDetailFallback.tsx'), /theme\.onAccent/);
  assert.match(read('MediaDetailFallback.tsx'), /accessibilityState=\{\{ disabled: !remoteReady \|\| loading \}\}/);
});

for (const state of ['offline', 'degraded', 'checking', 'reconnecting']) {
  test(`${state}: no remote calls, useful local fallback, exact existing offline route`, () => {
    const h = harness({ state, repository: downloaded() });
    const fallback = h.component('MediaDetailFallback');
    assert.equal(fallback.props.title, 'Local title'); assert.equal(fallback.props.copies.length, 1);
    assert.equal(h.requests.length, 0); assert.doesNotMatch(fallback.props.message, /not found|could not load/);
    fallback.props.onPlay(fallback.props.copies[0]);
    assert.deepEqual(h.routes[0], { pathname: '/player/[id]', params: { id: '1', type: 'movie', title: 'Local title', year: 2024,
      seriesTitle: undefined, season: undefined, episode: undefined, episodeTitle: undefined,
      posterPath: '/local-poster', backdropPath: '/local-backdrop', isOffline: 'true', offlineAssetId: 'asset-1' } });
    fallback.props.onSave(); fallback.props.onWatched(); assert.equal(h.saves.length, 1); assert.equal(h.watched, 1);
    fallback.props.onRetry(); assert.equal(h.requests.length, 0); h.unmount();
  });
}

test('cold offline without a local copy uses connection copy and no fabricated metadata', () => {
  const h = harness({ state: 'offline' }); const fallback = h.component('MediaDetailFallback');
  assert.equal(fallback.props.title, undefined); assert.equal(fallback.props.message, 'This title needs a connection.');
  assert.equal(fallback.props.copies.length, 0); assert.equal(h.requests.length, 0); h.unmount();
});

test('asset selection rejects mismatches, unavailable copies, and unverified primary artifacts', () => {
  const h = harness({ state: 'offline' });
  for (const mutate of [s => s.assets[0].availability = 'missing', s => s.assets[0].availability = 'checking',
    s => s.assets[0].artifacts[0].availability = 'unavailable', s => s.assets[0].destination = 'device-storage',
    s => s.assets[0].storageTarget.mode = 'device-storage', s => s.assets[0].media = { ...s.assets[0].media, id: 2 },
    s => s.offlineEntries[0].assetIds = s.offlineEntries[0].primaryAssetId = []]) {
    const snapshot = downloaded(); mutate(snapshot); assert.equal(h.selector(snapshot, '1', 'movie', true).length, 0);
  }
  assert.equal(h.selector(downloaded(), '1', 'movie', false).length, 0);
  assert.equal(h.selector(downloaded('tv', 1, 1, 1), '1', 'movie', true).length, 0);
  const copies = downloaded(); copies.assets.push({ ...copies.assets[0], assetId: 'alternate' });
  copies.assets[0].availability = 'missing'; copies.offlineEntries[0].assetIds.push('alternate');
  assert.equal(h.selector(copies, '1', 'movie', true)[0].asset.assetId, 'alternate'); h.unmount();
});

test('repository reconciliation and removal update local capability; stale play handlers recheck truth', () => {
  const snapshot = downloaded(); const h = harness({ state: 'offline', repository: snapshot, reconciliation: 'checking' });
  assert.equal(h.component('MediaDetailFallback').props.copies.length, 0);
  h.repository(snapshot, 'ready'); const fallback = h.component('MediaDetailFallback'); assert.equal(fallback.props.copies.length, 1);
  h.repository(emptyRepository()); fallback.props.onPlay(fallback.props.copies[0]); assert.equal(h.routes.length, 0); h.unmount();
});

test('TV fallback preserves exact episode identity and does not invent episode metadata', () => {
  const h = harness({ state: 'offline', type: 'tv', repository: downloaded('tv', 1, 2, 3) });
  const fallback = h.component('MediaDetailFallback'); assert.equal(fallback.props.title, 'Local series');
  fallback.props.onPlay(fallback.props.copies[0]); assert.equal(h.routes[0].params.season, 2); assert.equal(h.routes[0].params.episode, 3);
  assert.equal(h.routes[0].params.episodeTitle, 'Local episode 3'); assert.equal(fallback.props.onWatched, undefined); h.unmount();
});

test('online Watch Now streams; mid-session loss preserves details and promotes local playback', async () => {
  const h = harness({ repository: downloaded() }); h.requests[0].resolve(titleResponse()); await h.settle();
  h.press('Watch Remote title 1'); assert.equal(h.routes[0].params.isOffline, undefined);
  h.connect('offline'); assert.equal(h.component('MediaDetailFallback'), undefined);
  h.press('Play Remote title 1 offline'); assert.equal(h.routes[1].params.offlineAssetId, 'asset-1');
  h.press('Add Remote title 1 to My List'); assert.equal(h.saves.length, 1); h.unmount();
});

test('offline remote actions do not navigate, acquire sources, or open a trailer', async () => {
  const h = harness(); h.requests[0].resolve(titleResponse()); await h.settle();
  const watch = h.find('Watch Remote title 1').props.onPress, trailer = h.find('Play Remote title 1 trailer').props.onPress;
  h.press('Download Remote title 1'); const modal = h.component('DownloadModal'); assert.ok(modal.props.target);
  const resolve = modal.props.onResolveSource, target = modal.props.target;
  h.connect('offline'); assert.equal(h.find('Watch Remote title 1').props.disabled, true);
  assert.equal(h.find('Download Remote title 1').props.disabled, true); assert.equal(h.find('Play Remote title 1 trailer').props.disabled, true);
  watch(); trailer(); resolve(target, 'auto'); h.render(); assert.equal(h.routes.length, 0); assert.equal(h.sourceRequests.length, 0);
  assert.equal(h.component('DownloadModal'), undefined); assert.equal(h.component('TrailerModal').props.visible, false); h.unmount();
});

test('remote failure retains local fallback and recovery upgrades it once', async () => {
  const h = harness({ repository: downloaded() }); h.requests[0].reject(new Error('failure')); await h.settle();
  assert.equal(h.component('MediaDetailFallback').props.copies.length, 1);
  h.connect('degraded'); h.connect('online', 1); assert.equal(h.requests.length, 2);
  h.requests[1].resolve(titleResponse()); await h.settle(); assert.equal(h.component('MediaDetailFallback'), undefined); h.unmount();
});

test('late online mount, checking-to-online, and repeated recoveries issue one hydration each', () => {
  for (const initial of ['online', 'checking']) {
    const h = harness({ state: initial, epoch: 7, mode: 'remote' });
    if (initial === 'checking') assert.equal(h.requests.length, 0);
    h.connect('online', 7); assert.equal(h.requests.length, 1);
    h.connect('online', 7); assert.equal(h.requests.length, 1);
    h.connect('offline', 7); h.connect('reconnecting', 7); h.connect('online', 8); assert.equal(h.requests.length, 2);
    h.connect('checking', 8); h.connect('online', 8); assert.equal(h.requests.length, 3);
    h.connect('degraded', 8); h.connect('online', 9); assert.equal(h.requests.length, 4); assert.equal(h.routes.length, 0); h.unmount();
  }
});

test('stale title work is fenced across route, type, loss, and unmount; loaded detail survives failure', async () => {
  const h = harness({ mode: 'remote' }); h.options({ id: '2' }); h.options({ type: 'tv' });
  h.connect('offline'); h.connect('online', 1);
  h.requests.at(-1).resolve(titleResponse(2, 'tv')); await h.settle();
  for (const request of h.requests.slice(0, -1)) request.resolve(titleResponse(1)); await h.settle();
  assert.equal(h.result.data.id, 2); assert.equal(h.result.data.media_type, 'tv');
  h.connect('degraded'); assert.equal(h.result.data.id, 2); h.connect('online', 2);
  h.requests.at(-1).reject(new Error('failure')); await h.settle(); assert.equal(h.result.data.id, 2);
  h.options({ id: '3' }); h.unmount(); h.requests.at(-1).resolve(titleResponse(3)); await h.settle(); assert.equal(h.result.data, null);
});

test('episodes and season videos are lazy, blocked offline, and fenced across season and recovery', async () => {
  const h = harness({ mode: 'remote', type: 'tv' }); assert.equal(h.requests.length, 1);
  h.options({ activeTab: 'episodes', showTrailerModal: true }); assert.equal(h.requests.length, 3);
  h.options({ selectedSeason: 2 }); assert.equal(h.requests.length, 5);
  h.connect('offline'); assert.equal(h.result.episodesLoading, false); assert.equal(h.result.episodesLoaded, false);
  h.connect('online', 1); assert.equal(h.requests.length, 8);
  h.requests[6].resolve({ episodes: [{ id: 22, episode_number: 2 }] });
  h.requests[7].resolve({ results: [{ id: 'new' }] }); await h.settle();
  for (const request of h.requests.slice(0, 5)) request.resolve({ episodes: [{ id: 11 }], results: [{ id: 'old' }] });
  await h.settle(); assert.equal(h.result.episodes[0].id, 22); assert.equal(h.result.seasonVideos[0].id, 'new');
  h.connect('offline'); assert.equal(h.result.episodes[0].id, 22); h.options({ selectedSeason: 3 });
  assert.equal(h.result.episodes.length, 0); assert.equal(h.result.episodesLoaded, false); h.unmount();
});

test('failed episodes remain unavailable instead of becoming a successful empty season', async () => {
  const h = harness({ mode: 'remote', type: 'tv' }); h.options({ activeTab: 'episodes' });
  h.requests[1].reject(new Error('failure')); await h.settle(); assert.equal(h.result.episodesLoaded, false);
  assert.equal(h.result.episodesError, true); assert.equal(h.result.episodesLoading, false); h.unmount();
});

test('collection hydration respects the parent gate and preserves loaded collection offline', async () => {
  const h = harness({ mode: 'collection', state: 'offline' }); assert.equal(h.requests.length, 0);
  h.connect('online', 1); assert.equal(h.requests.filter((r) => r.url === '/collection/10').length, 1);
  h.requests.find((r) => r.url === '/collection/10').resolve({ id: 10, parts: [{ id: 1 }] }); await h.settle();
  h.connect('offline'); assert.ok(h.nodes().some((n) => n.type === 'FlatList' && n.props.data.length === 1)); h.unmount();
});

function episodeCopies() {
  const snapshots = [downloaded('tv', 1, 2, 4, 's2e4'), downloaded('tv', 1, 1, 3, 's1e3'), downloaded('tv', 1, 1, 1, 's1e1')];
  return { ...emptyRepository(), assets: snapshots.flatMap((s) => s.assets), offlineEntries: snapshots.flatMap((s) => s.offlineEntries) };
}

for (const type of ['movie', 'tv']) {
  test(`${type} with one downloaded item: primary Play Offline uses its exact asset`, async () => {
    const snapshot = type === 'movie' ? downloaded('movie', 1, null, null, 'movie-only') : downloaded('tv', 1, 2, 3, 'episode-only');
    const h = harness({ type, repository: snapshot });
    h.requests[0].resolve(titleResponse(1, type)); await h.settle(); h.connect('offline');
    const title = type === 'movie' ? 'Remote title 1' : 'Remote series 1';
    assert.ok(h.nodes().some((node) => node.type === 'Text' && node.props.children === 'Play Offline'));
    h.press(`Play ${title} offline`);
    assert.equal(h.routes.length, 1); assert.equal(h.routes[0].pathname, '/player/[id]');
    assert.equal(h.routes[0].params.isOffline, 'true');
    assert.equal(h.routes[0].params.offlineAssetId, type === 'movie' ? 'movie-only' : 'episode-only');
    if (type === 'tv') {
      assert.equal(h.routes[0].params.season, 2); assert.equal(h.routes[0].params.episode, 3);
      assert.equal(h.routes[0].params.episodeTitle, 'Local episode 3');
    }
    h.unmount();
  });
}

test('multiple TV episodes: show primary focuses Offline Episodes without choosing an asset', async () => {
  const h = harness({ type: 'tv', repository: episodeCopies() });
  h.requests[0].resolve(titleResponse(1, 'tv')); await h.settle();
  h.press('Watch Remote series 1'); assert.equal(h.routes[0].params.isOffline, undefined); h.routes.length = 0;
  h.connect('offline');
  const scrollCalls = [];
  h.nodes().find((node) => node.type === 'ScrollView' && node.props.ref).props.ref.current = { scrollTo: (value) => scrollCalls.push(value) };
  const layouts = h.nodes().filter((node) => node.props.onLayout);
  assert.equal(layouts.length, 2);
  layouts[0].props.onLayout({ nativeEvent: { layout: { y: 120 } } });
  layouts[1].props.onLayout({ nativeEvent: { layout: { y: 240 } } });
  assert.match(h.find('Offline Episodes').props.accessibilityHint, /Choose an episode/);
  h.press('Offline Episodes');
  assert.equal(h.routes.length, 0);
  assert.deepEqual(scrollCalls, [{ y: 344, animated: false }]);
  const choices = h.localChoiceNodes();
  assert.ok(choices.some((node) => node.props.accessibilityRole === 'header' && node.props.children === 'Offline Episodes'));
  assert.equal(choices.filter((node) => node.type === 'Pressable').length, 3);
  h.unmount();
});

test('an individually chosen downloaded episode retains exact playback identity among multiple episodes', () => {
  const h = harness({ state: 'offline', type: 'tv', repository: episodeCopies() });
  const selected = h.localChoiceNodes().find((node) => node.props.accessibilityLabel === 'Play Offline · S1 E3 · Local episode 3');
  assert.ok(selected); selected.props.onPress();
  assert.equal(h.routes.length, 1);
  const { params } = h.routes[0];
  assert.equal(params.season, 1); assert.equal(params.episode, 3); assert.equal(params.episodeTitle, 'Local episode 3');
  assert.equal(params.offlineAssetId, 's1e3'); assert.equal(params.isOffline, 'true'); h.unmount();
});

test('local TV display is season/episode ordered regardless of repository array order', () => {
  const h = harness({ state: 'offline', type: 'tv', repository: episodeCopies() });
  const labels = () => h.localChoiceNodes().filter((node) => node.type === 'Pressable').map((node) => node.props.accessibilityLabel);
  const expected = ['Play Offline · S1 E1 · Local episode 1', 'Play Offline · S1 E3 · Local episode 3', 'Play Offline · S2 E4 · Local episode 4'];
  assert.deepEqual(labels(), expected);
  const shuffled = episodeCopies(); shuffled.assets.reverse(); shuffled.offlineEntries.reverse(); h.repository(shuffled);
  assert.deepEqual(labels(), expected); assert.equal(h.routes.length, 0); h.unmount();
});

test('a stale one-episode primary rechecks repository truth and never selects after more episodes arrive', async () => {
  const h = harness({ type: 'tv', repository: downloaded('tv', 1, 1, 1, 's1e1') });
  h.requests[0].resolve(titleResponse(1, 'tv')); await h.settle(); h.connect('offline');
  const oldPrimary = h.find('Play Remote series 1 offline').props.onPress;
  h.repository(episodeCopies()); oldPrimary(); h.render();
  assert.equal(h.routes.length, 0); assert.ok(h.find('Offline Episodes')); assert.equal(h.localChoiceNodes().filter((node) => node.type === 'Pressable').length, 3);
  h.unmount();
});

test('cold offline TV fallback exposes choices and refuses an unspecified episode', () => {
  const h = harness({ state: 'offline', type: 'tv', repository: episodeCopies() });
  const fallback = h.component('MediaDetailFallback');
  assert.equal(fallback.props.copies.length, 3);
  fallback.props.onPlay(); h.render();
  assert.equal(h.routes.length, 0); assert.equal(h.requests.length, 0);
  assert.match(h.component('MediaDetailFallback').props.message, /Choose a downloaded episode/);
  assert.ok(h.localChoiceNodes().some((node) => node.props.children === 'Offline Episodes')); h.unmount();
});


const style = (value) => Object.assign({}, ...(Array.isArray(value) ? value.flat(Infinity).filter(Boolean) : [typeof value === 'function' ? value({ pressed: false }) : value]).flat(Infinity));

// Compare complete rendered geometry/content outside the intentionally variable
// local capability, including Download, Watch Now, secondary actions and tabs.
function presentationTree(node) {
  if (Array.isArray(node)) return node.map(presentationTree);
  if (!node?.props) return node;
  const type = typeof node.type === 'function' ? node.type.name : node.type;
  if (type === 'MediaDetailLocalCopies') return { type };
  const props = Object.fromEntries(Object.entries(node.props).filter(([key, value]) => key !== 'children' && key !== 'ref' && (key === 'style' || typeof value !== 'function'))
    .map(([key, value]) => [key, key === 'style' ? style(value) : value]));
  return { type, props, children: presentationTree(node.props.children) };
}

for (const themeId of ['midnight-premiere', 'amoled', 'mocha', 'slate', 'projector-silver', 'custom']) {
  test(themeId + ': online verified copy is compact, semantic and secondary to unchanged Watch Now', async () => {
    const h = harness({ repository: downloaded(), themeId }); h.requests[0].resolve(titleResponse()); await h.settle();
    assert.equal(h.component('MediaDetailLocalCopies').props.presentation, 'compact');
    const all = h.localChoiceNodes(), row = style(all[0].props.style);
    for (const key of ['borderWidth', 'borderRadius', 'backgroundColor', 'padding', 'paddingVertical', 'height']) assert.equal(row[key], undefined, key);
    assert.equal(row.flexDirection, 'row'); assert.equal(row.flexWrap, 'wrap'); assert.equal(row.rowGap, 4);
    assert.equal(all.some(n => n.props.accessibilityRole === 'header'), false);
    const label = all.find(n => n.props.children === 'Available offline');
    assert.equal(style(label.props.style).color, h.theme.textSecondary); assert.equal(style(label.props.style).fontSize, 13);
    const icon = all.find(n => n.type === 'Ionicons'); assert.equal(icon.props.color, h.theme.textSecondary); assert.equal(icon.props.accessible, false);
    const button = all.find(n => n.props.accessibilityLabel === 'Play Offline'), buttonStyle = style(button.props.style);
    assert.equal(buttonStyle.minHeight, 44); assert.equal(buttonStyle.minWidth, 44);
    assert.equal(buttonStyle.backgroundColor, h.theme.surface); assert.equal(buttonStyle.borderColor, h.theme.border);
    assert.equal(style(button.props.style({ pressed: true })).backgroundColor, h.theme.surfaceHover);
    assert.equal(style(button.props.children.props.style).color, h.theme.text);
    const watch = h.find('Watch Remote title 1'); assert.equal(style(watch.props.style).width, '100%');
    assert.equal(watch.props.accessibilityHint, 'Streams this title'); assert.equal(watch.props.disabled, false);
    assert.ok(h.nodes().some(n => n.props.children === 'Watch Now'));
    h.press('Watch Remote title 1'); button.props.onPress();
    assert.equal(h.routes[0].params.isOffline, undefined); assert.equal(h.routes[0].params.offlineAssetId, undefined);
    assert.equal(h.routes[1].params.isOffline, 'true'); assert.equal(h.routes[1].params.offlineAssetId, 'asset-1');
    h.repository(emptyRepository()); button.props.onPress(); assert.equal(h.routes.length, 2, 'stale compact action must recheck existing repository owner');
    assert.deepEqual(h.localChoiceNodes(), []); h.unmount();
  });
}

test('online without downloads retains identical surrounding Media Detail geometry, actions and content', async () => {
  const empty = harness(), local = harness({ repository: downloaded() });
  for (const h of [empty, local]) { h.requests[0].resolve(titleResponse()); await h.settle(); }
  assert.deepEqual(empty.localChoiceNodes(), []);
  assert.deepEqual(presentationTree(empty.result), presentationTree(local.result));
  assert.equal(style(local.find('Download Remote title 1').props.style).width, 36);
  assert.equal(style(local.find('Download Remote title 1').props.style).right, 20);
  assert.equal(style(local.find('Add Remote title 1 to My List').props.style).height, 48);
  assert.equal(style(local.find('Play Remote title 1 trailer').props.style).height, 48);
  assert.equal(style(local.find('More actions').props.style).width, 48);
  const all = local.nodes();
  assert.ok(all.indexOf(local.component('MediaDetailLocalCopies')) < all.indexOf(local.find('Watch Remote title 1')));
  assert.ok(all.indexOf(local.find('Watch Remote title 1')) < all.indexOf(local.find('More actions')));
  empty.press('Watch Remote title 1'); local.press('Watch Remote title 1'); assert.deepEqual(empty.routes, local.routes);
  empty.unmount(); local.unmount();
});

for (const hasCopy of [false, true]) {
  test('offline ' + (hasCopy ? 'downloaded' : 'not downloaded') + ' preserves cold and loaded presentation', async () => {
    const repository = hasCopy ? downloaded() : emptyRepository();
    const cold = harness({ state: 'offline', repository }), loaded = harness({ repository });
    loaded.requests[0].resolve(titleResponse()); await loaded.settle();
    for (const state of ['offline', 'checking', 'degraded', 'reconnecting']) {
      loaded.connect(state); assert.equal(loaded.component('MediaDetailLocalCopies').props.presentation, 'card');
      const choices = loaded.localChoiceNodes();
      assert.deepEqual(presentationTree(choices), presentationTree(cold.localChoiceNodes()));
      if (hasCopy) {
        assert.equal(style(choices[0].props.style).padding, 16); assert.equal(style(choices[0].props.style).borderRadius, 16);
        const button = choices.find(n => n.props.accessibilityLabel === 'Play Offline');
        assert.equal(style(button.props.style).backgroundColor, loaded.theme.accent); button.props.onPress();
        assert.equal(loaded.routes.at(-1).params.offlineAssetId, 'asset-1');
      } else { assert.deepEqual(choices, []); assert.equal(loaded.find('Watch Remote title 1').props.disabled, true); }
    }
    assert.equal(cold.requests.length, 0); cold.unmount(); loaded.unmount();
  });
}

test('compact capability wraps without fixed heights, clipped labels or full-width secondary actions', async () => {
  for (const [width, height, fontScale] of [[320, 700, 1], [320, 700, 2], [800, 1200, 1.5]]) {
    const h = harness({ width, height, fontScale, repository: downloaded() }); h.requests[0].resolve(titleResponse()); await h.settle();
    const all = h.localChoiceNodes(), row = style(all[0].props.style);
    assert.equal(row.flexWrap, 'wrap'); assert.equal(row.columnGap, 12); assert.equal(row.marginTop, 8);
    for (const n of all) {
      const s = style(n.props.style); assert.equal(s.height, undefined); assert.equal(s.overflow, undefined);
      if (n.type === 'Text') { assert.equal(n.props.numberOfLines, undefined); assert.notEqual(n.props.allowFontScaling, false); assert.equal(s.flexShrink, 1); }
      if (n.type === 'Pressable') { assert.equal(s.width, undefined); assert.equal(s.maxWidth, '100%'); assert.equal(s.paddingVertical, 8); assert.equal(s.minHeight, 44); }
    }
    h.unmount();
  }
  const source = read('MediaDetailFallback.tsx'); assert.doesNotMatch(source, /#[0-9a-f]{3,8}|rgba\(|Animated|LayoutAnimation|useWindowDimensions|useNetworkStatus/i);
});

test('compact TV choices preserve explicit episode identity and access to all downloads', async () => {
  const snapshots = Array.from({ length: 9 }, (_, i) => downloaded('tv', 1, 1, i + 1, 'episode-' + (i + 1)));
  const repository = { ...emptyRepository(), assets: snapshots.flatMap(s => s.assets), offlineEntries: snapshots.flatMap(s => s.offlineEntries) };
  const h = harness({ type: 'tv', repository }); h.requests[0].resolve(titleResponse(1, 'tv')); await h.settle();
  const choices = h.localChoiceNodes(); assert.equal(choices.filter(n => n.type === 'Pressable').length, 9);
  choices.find(n => n.props.accessibilityLabel === 'Play Offline · S1 E3 · Local episode 3').props.onPress();
  assert.equal(h.routes[0].params.offlineAssetId, 'episode-3'); assert.equal(h.routes[0].params.episode, 3);
  const seeAll = choices.find(n => n.props.accessibilityLabel === 'See all downloads');
  assert.equal(style(seeAll.props.style).minHeight, 44); assert.equal(style(seeAll.props.style).borderColor, h.theme.border);
  seeAll.props.onPress(); assert.equal(h.routes[1], '/(tabs)/downloads'); h.unmount();
});
