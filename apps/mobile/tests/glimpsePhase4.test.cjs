'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loader, read } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const prefix = 'apps/mobile/src/features/glimpse/';
const load = loader({ 'react-native': { Platform: { OS: 'android' } } });
const model = load(prefix + 'glimpseModel.ts');
const metadata = load(prefix + 'glimpseTitleMetadata.ts');
const browse = load(prefix + 'glimpseBrowse.ts');
const library = load('apps/mobile/src/features/library/librarySort.ts');
const prefs = load(prefix + 'glimpsePreferences.ts');
const { GlimpseLikesStore, GLIMPSE_LIKES_KEY } = load(prefix + 'GlimpseLikesStore.ts');
function reel(id, extra = {}) {
 const media = { tmdbId: id, mediaType: 'movie', isAnime: false, season: null, episode: null };
 const key = String(id).padStart(11, '0');
 return { schemaVersion: 1, id: model.glimpseReelId(media, key), media, title: 'Title ' + id, clipTitle: 'Scene',
  video: { provider: 'youtube', key, type: 'Clip', language: null, durationSeconds: null, dimensions: null },
  artworkPath: null, posterPath: null, year: '2026', ...extra };
}
function backend() { const values = new Map(); return { values, getString: key => values.get(key), set: (key, value) => values.set(key, value) }; }
function find(node, predicate) {
 if (!node || typeof node !== 'object') return null;
 if (predicate(node)) return node;
 for (const child of [node.props?.children].flat(Infinity)) { const match = find(child, predicate); if (match) return match; }
 return null;
}
function all(node, predicate, matches = []) {
 if (!node || typeof node !== 'object') return matches;
 if (predicate(node)) matches.push(node);
 [node.props?.children].flat(Infinity).forEach(child => all(child, predicate, matches)); return matches;
}
const catalog = (patch = {}) => ({ rating: 7, voteCount: 20, releaseDate: '2026-02-01', genreIds: [28], originCountries: ['US'], originalLanguage: 'en', ...patch });

test('Glimpse sorting consumes every Library comparator with real metadata and leaves Custom order intact', () => {
 const values = [reel(1, { title: 'Zulu', catalog: catalog({ rating: 5 }) }), reel(2, { title: 'Alpha', catalog: catalog({ releaseDate: '2026-10-01', rating: 8 }) }), reel(3, { title: 'Beta' })];
 assert.deepEqual(metadata.sortGlimpseReels(values, 'manual'), values);
 assert.deepEqual(metadata.sortGlimpseReels(values, 'title').map(r => r.title), ['Alpha', 'Beta', 'Zulu']);
 assert.deepEqual(metadata.sortGlimpseReels(values, 'rating').map(r => r.title), ['Alpha', 'Zulu', 'Beta']);
 assert.deepEqual(metadata.sortGlimpseReels(values, 'year').map(r => r.title), ['Alpha', 'Zulu', 'Beta']);
 for (const option of library.MOBILE_LIBRARY_SORT_OPTIONS) assert.equal(metadata.sortGlimpseReels(values, option.id).length, 3);
 assert.deepEqual(values.map(r => r.title), ['Zulu', 'Alpha', 'Beta']);
});
test('optional catalog metadata preserves old Like bytes and rejects invalid values without publishing', () => {
 const storage = backend(); const store = new GlimpseLikesStore(storage, () => 10);
 store.setLiked(reel(1), true); const bytes = storage.values.get(GLIMPSE_LIKES_KEY);
 assert.equal(new GlimpseLikesStore(storage).getSnapshot().reels[0].catalog, undefined);
 assert.equal(storage.values.get(GLIMPSE_LIKES_KEY), bytes);
 store.setLiked(reel(2, { catalog: catalog() }), true);
 assert.deepEqual(new GlimpseLikesStore(storage).getSnapshot().reels[1].catalog, catalog());
 assert.throws(() => store.setLiked(reel(3, { catalog: catalog({ rating: 11 }) }), true));
 assert.equal(store.getSnapshot().reels.length, 2);
});
test('search and filters use Discovery choices, known canonical metadata and only records supplied by the current tab', () => {
 const discovery = load('apps/mobile/src/features/discover/discoverCatalog.ts');
 assert.deepEqual(browse.glimpseFilterOptions('rating'), discovery.RATING_OPTIONS);
 assert.deepEqual(browse.glimpseFilterOptions('movieGenre').slice(1).map(v => v.label), discovery.MOVIE_GENRES.map(v => v.name));
 const values = [reel(1, { title: 'Alpha', clipTitle: 'Night chase', catalog: catalog() }), reel(2, { title: 'Alpha', clipTitle: 'Comedy' })];
 assert.deepEqual(browse.filterGlimpseReels(values, browse.defaultGlimpseFilters(), 'alpha chase'), [values[0]]);
 const filters = { ...browse.defaultGlimpseFilters(), genre: { type: 'movie', id: 28 }, region: 'hollywood', rating: '7' };
 assert.deepEqual(browse.filterGlimpseReels(values, filters, ''), [values[0]]);
 assert.deepEqual(browse.filterGlimpseReels([values[1]], filters, ''), []);
 assert.deepEqual(browse.filterGlimpseReels(values, { ...filters, type: 'anime' }, ''), []);
 assert.equal(browse.updateGlimpseFilter(filters, 'year', 'forged'), filters);
});
test('preferences persist offline independently of Likes and remember only one canonical position', () => {
 const storage = backend(); const likes = new GlimpseLikesStore(storage); likes.setLiked(reel(1), true);
 const bytes = storage.values.get(GLIMPSE_LIKES_KEY); let store = new prefs.GlimpsePreferencesStore(storage);
 assert.equal(store.getSnapshot().preferences.autoAdvance, false);
 store.set({ autoAdvance: true, startMuted: false, rememberPosition: true, position: { tab: 'liked', reel: reel(1) }, sorts: { discover: 'year', liked: 'title' } });
 store = new prefs.GlimpsePreferencesStore(storage);
 assert.equal(store.getSnapshot().preferences.autoAdvance, true);
 assert.equal(store.getSnapshot().preferences.position.reel.id, reel(1).id);
 assert.equal(storage.values.get(GLIMPSE_LIKES_KEY), bytes);
 store.set({ rememberPosition: false }); assert.equal(store.getSnapshot().preferences.position, null);
});
test('preference write failure and unknown schema preserve bytes and the last published value', () => {
 const storage = backend(); const store = new prefs.GlimpsePreferencesStore(storage); store.set({ autoAdvance: true });
 const before = store.getSnapshot(), bytes = storage.values.get(prefs.GLIMPSE_PREFERENCES_KEY);
 storage.set = () => { throw new Error('disk'); }; assert.throws(() => store.set({ autoAdvance: false }));
 assert.equal(store.getSnapshot(), before); assert.equal(storage.values.get(prefs.GLIMPSE_PREFERENCES_KEY), bytes);
 const unsupported = backend(); unsupported.set(prefs.GLIMPSE_PREFERENCES_KEY, '{"schemaVersion":2}');
 const unavailable = new prefs.GlimpsePreferencesStore(unsupported); assert.equal(unavailable.getSnapshot().unavailable, true);
 assert.throws(() => unavailable.set({ autoAdvance: true })); assert.equal(unsupported.values.get(prefs.GLIMPSE_PREFERENCES_KEY), '{"schemaVersion":2}');
});
test('restored Discover metadata seeds one reel and avoids fetching the same title again', async () => {
 const { GlimpseFeedEngine } = load(prefix + 'GlimpseFeedEngine.ts'); const requests = [];
 const engine = new GlimpseFeedEngine({ page: async () => ({ items: [{ id: 1, media_type: 'movie' }, { id: 2, media_type: 'movie' }], hasMore: false }) },
  { candidates: async item => { requests.push(item.id); return [reel(item.id)]; } }, reel(1));
 assert.deepEqual(engine.snapshot().reels, [reel(1)]); assert.deepEqual(requests, []);
 assert.deepEqual((await engine.extend(new AbortController().signal, 2)).reels.map(r => r.id), [reel(1).id, reel(2).id]);
 assert.deepEqual(requests, [2]);
});
test('production Settings preserves every active section; preview appends Glimpse without losing stored user order', () => {
 const original = ['account', 'appearance', 'performance', 'home', 'accessibility', 'notifications', 'updates', 'downloads'];
 for (const preview of [false, true]) {
  const scoped = loader({ '../glimpse/glimpsePreview': { isGlimpsePreviewEnabled: () => preview }, '../../services/storageAdapter': { mmkvStorageAdapter: { get: () => null } } });
  const architecture = scoped('apps/mobile/src/features/settings/settingsArchitecture.ts');
  assert.deepEqual(architecture.MOBILE_ACTIVE_SETTINGS_SECTIONS.map(v => v.id), preview ? [...original, 'glimpse'] : original);
  const order = scoped('apps/mobile/src/features/settings/settingsSectionOrderPreferences.ts').normalizeSettingsSectionOrderPreferences({ schemaVersion: 1, order: [...original].reverse() }).order;
  assert.deepEqual(order, preview ? [...original].reverse().concat('glimpse') : [...original].reverse());
 }
 assert.match(read('apps/mobile/app/(tabs)/settings.tsx'), /case 'glimpse': \{[\s\S]*?isGlimpsePreviewEnabled\(\)[\s\S]*?recordSectionLayout\('glimpse'\)/);
});
test('Library dialog keeps its original label, choices, selection and motion behavior with optional Glimpse identity', () => {
 const mocks = { 'react-native': { Modal: 'Modal', Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: v => v } },
  '@expo/vector-icons': { Ionicons: 'Icon' }, '../../context/ThemeContext': { useOrionTheme: () => ({ theme: {}, preferences: { reducedMotion: true }, systemReducedMotion: false }) } };
 const Dialog = loader(mocks)('apps/mobile/src/features/library/LibrarySortDialog.tsx').LibrarySortDialog;
 for (const eyebrow of [undefined, 'GLIMPSE']) {
  const selections = []; const tree = Dialog({ eyebrow, visible: true, selected: 'rating', onSelect: value => selections.push(value), onDismiss() {} });
  assert.equal(tree.props.animationType, 'fade'); assert.ok(find(tree, n => n.type === 'Text' && n.props.children === (eyebrow || 'MY LIST')));
  const radios = all(tree, n => n.props?.accessibilityRole === 'radio'); assert.deepEqual(radios.map(n => n.props.accessibilityLabel), library.MOBILE_LIBRARY_SORT_OPTIONS.map(o => o.label));
  assert.deepEqual(radios.map(n => n.props.accessibilityState.checked), [false, false, true, false]); radios[1].props.onPress(); assert.deepEqual(selections, ['title']);
 }
});
function screenHarness(initial = {}, remembered = null, route = {}) {
 const h = hookHarness(), storage = backend(), localStore = new prefs.GlimpsePreferencesStore(storage);
 localStore.set({ ...initial, ...(remembered ? { rememberPosition: true, position: remembered } : {}) });
 const likesStore = new GlimpseLikesStore(storage, () => 100); const pushes = [], seeds = [], announcements = [], opened = [];
 const state = { focused: true, foreground: true, remoteReady: true };
 const feed = { reels: [reel(1, { title: 'Zulu' }), reel(2, { title: 'Alpha' }), reel(3, { title: 'Beta' })], status: 'ready', exhausted: true, canAutoExtend: true, loadMore: async () => {}, activeId: { current: null } };
 const mocks = { react: h.react,
  'react-native': { Linking: { openURL: async value => { opened.push(value); } }, AccessibilityInfo: { announceForAccessibility: value => announcements.push(value) }, View: 'View', Text: 'Text', Pressable: 'Pressable', FlatList: 'FlatList', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: v => v } },
  '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-router': { useLocalSearchParams: () => route, useIsFocused: () => state.focused, useRouter: () => ({ push: value => pushes.push(value) }) },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  '../../context/ThemeContext': { useOrionTheme: () => ({ theme: {}, preferences: { reducedMotion: true }, systemReducedMotion: false }) },
  '../../context/PerformanceContext': { usePerformanceProfile: () => ({ resolvedProfile: 'balanced' }) }, '../../context/NetworkContext': { useNetworkStatus: () => ({ remoteReady: state.remoteReady }) },
  '../../services/responsive': { useResponsiveLayout: () => ({ isLandscape: false }) }, './useGlimpseForeground': { useGlimpseForeground: () => state.foreground },
  './useGlimpseFeed': { useGlimpseFeed: (_, __, seed) => { seeds.push(seed); return feed; } }, './glimpseLikesStorage': { getGlimpseLikesStore: () => likesStore },
  './glimpsePreferences': { useGlimpsePreferences: () => ({ ...localStore.getSnapshot(), saveError: false, update: patch => { localStore.set(patch); return true; } }) },
  '../../components/MobilePageHeader': { MobilePageHeader: 'Header' }, './GlimpseStage': { GlimpseStage: 'Stage' },
  './GlimpseControls': { GlimpseControls: 'Controls' }, '../library/LibrarySortDialog': { LibrarySortDialog: 'SortDialog' } };
 const Screen = loader(mocks)(prefix + 'GlimpseScreen.tsx').default;
 h.start(Screen); find(h.result, n => !!n.props?.onLayout).props.onLayout({ nativeEvent: { layout: { width: 380, height: 500 } } });
 const list = () => find(h.result, n => n.type === 'FlatList');
 const stages = () => list()?.props.data.map((item, index) => find(list().props.renderItem({ item, index }), n => n.type === 'Stage').props) || [];
 const active = () => stages().filter(s => s.active);
 const control = () => find(h.result, n => n.type === 'Controls').props;
 const dialog = () => find(h.result, n => n.type === 'SortDialog').props;
 const tab = value => find(h.result, n => n.props?.accessibilityLabel === value + ' Glimpse').props.onPress();
 const settle = async index => { list().props.onScrollBeginDrag(); list().props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { y: index * 500 } } }); await h.settle(); };
 return { h, state, feed, localStore, likesStore, pushes, seeds, announcements, opened, list, stages, active, control, dialog, tab, settle };
}
test('sorting and append retain canonical Liked/Discover anchors; search stays within each tab', async () => {
 const t = screenHarness(); await t.h.settle(); await t.settle(1); t.stages()[1].onLike(); await t.h.settle();
 t.tab('Liked'); await t.h.settle(); assert.equal(t.active()[0].reel.id, reel(2).id);
 t.likesStore.setLiked(reel(3), true); await t.h.settle(); assert.deepEqual(t.stages().map(s => s.reel.id), [reel(2).id, reel(3).id]); assert.equal(t.active()[0].reel.id, reel(2).id);
 t.control().onSort(); await t.h.settle(); assert.equal(t.active().length, 0); t.dialog().onSelect('title'); await t.h.settle(); assert.deepEqual(t.announcements, ['Glimpse sorted by A–Z.']);
 assert.equal(t.active()[0].reel.id, reel(2).id); t.tab('Discover'); await t.h.settle(); assert.equal(t.active()[0].reel.id, reel(2).id);
 t.control().onQuery('Zulu'); await t.h.settle(); assert.deepEqual(t.stages().map(s => s.reel.id), [reel(1).id]); t.h.dispose();
});
test('auto-advance defaults off and only a settled active clip end advances when enabled', async () => {
 const t = screenHarness(); await t.h.settle(); t.active()[0].onEnded(); await t.h.settle(); assert.equal(t.active()[0].reel.id, reel(1).id);
 t.localStore.set({ autoAdvance: true }); t.h.update(); await t.h.settle(); t.active()[0].onEnded(); await t.h.settle(); assert.equal(t.active()[0].reel.id, reel(2).id);
 t.list().props.onScrollBeginDrag(); t.list().props.onScroll({ nativeEvent: { contentOffset: { y: 700 } } }); t.stages()[1].onEnded(); await t.h.settle(); assert.equal(t.active().length, 0);
 await t.settle(1); t.control().onOcclusion(true); await t.h.settle(); t.stages()[1].onEnded(); await t.h.settle(); assert.equal(t.active().length, 0);
 t.control().onOcclusion(false); await t.h.settle(); t.state.foreground = false; t.h.update(); assert.equal(t.active().length, 0);
 t.state.foreground = true; t.state.remoteReady = false; t.h.update(); assert.equal(t.active().length, 0);
 t.state.remoteReady = true; t.h.update(); await t.h.settle(); t.active()[0].onView(); await t.h.settle(); assert.equal(t.active().length, 0);
 t.state.focused = false; t.h.update(); t.state.focused = true; t.h.update(); await t.h.settle(); assert.equal(t.active()[0].reel.id, reel(2).id); t.h.dispose();
});
test('remembered Discover uses one seed; a removed remembered Like never resurfaces in Liked', async () => {
 const a = screenHarness({}, { tab: 'discover', reel: reel(2) }); await a.h.settle(); assert.equal(a.seeds[0].id, reel(2).id); assert.equal(a.active()[0].reel.id, reel(2).id); a.h.dispose();
 const b = screenHarness({}, { tab: 'liked', reel: reel(2) }); await b.h.settle(); assert.equal(b.list(), null); assert.equal(b.seeds[0], null); b.h.dispose();
});
test('Stage emits one end callback per active ownership and contains every supported source ratio', async () => {
 const h = hookHarness(); let endings = 0;
 const Stage = loader({ react: h.react, 'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', Image: 'Image', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: v => v } },
  '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' }, '@orion/shared/api': { imgUrl: () => null },
  '../../context/ThemeContext': { useOrionTheme: () => ({ theme: {} }) }, './GlimpseVideoSurface': { GlimpseVideoSurface: 'Surface' } })(prefix + 'GlimpseStage.tsx').GlimpseStage;
 const props = { reel: reel(1), active: true, selected: true, muted: true, onEnded: () => endings++, onFailure() {} };
 h.start(Stage, props); find(h.result, n => !!n.props?.onLayout).props.onLayout({ nativeEvent: { layout: { width: 240, height: 350 } } }); await h.settle();
 const surface = () => find(h.result, n => n.type === 'Surface'); surface().props.onEvent('ended'); surface().props.onEvent('ended'); assert.equal(endings, 1);
 h.update({ ...props, active: false }); h.update(props); await h.settle(); surface().props.onEvent('ended'); assert.equal(endings, 2); h.dispose();
 const { fitGlimpseMedia } = load(prefix + 'glimpseLayout.ts');
 for (const dimensions of [{ width: 16, height: 9 }, { width: 9, height: 16 }, { width: 4, height: 3 }, { width: 239, height: 100 }, { width: 7, height: 5 }]) {
  const fit = fitGlimpseMedia({ width: 240, height: 350 }, dimensions); assert.ok(fit.width <= 240 && fit.height <= 350); assert.ok(Math.abs(fit.width / fit.height - dimensions.width / dimensions.height) < 1e-9);
 }
});

test('inline filters leave playback available; selection dialogs and keyboard combine their occlusion', async () => {
 const h = hookHarness(), blocked = [], expanded = [];
 const Controls = loader({ react: h.react, 'react-native': { Keyboard: { dismiss() {} }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', View: 'View', StyleSheet: { create: v => v } },
  '@expo/vector-icons': { Ionicons: 'Icon' }, '../../context/ThemeContext': { useOrionTheme: () => ({ theme: {} }) },
  '../discover/discoverStyles': { createDiscoverStyles: () => ({}) }, '../discover/DiscoverFilterModal': { DiscoverFilterModal: 'FilterModal' } })(prefix + 'GlimpseControls.tsx').GlimpseControls;
 h.start(Controls, { query: '', onQuery() {}, sort: 'manual', filters: browse.defaultGlimpseFilters(), onFilters() {}, onSort() {}, onOcclusion: value => blocked.push(value), onExpanded: value => expanded.push(value), unavailable: false });
 const button = label => find(h.result, n => n.props?.accessibilityLabel === label).props.onPress();
 button('Filter Glimpse clips'); await h.settle(); assert.equal(blocked.at(-1), false); assert.equal(expanded.at(-1), true);
 button('Glimpse filter: Media type'); assert.equal(blocked.at(-1), true); await h.settle(); assert.equal(blocked.at(-1), true);
 find(h.result, n => n.type === 'FilterModal').props.onClose(); await h.settle(); assert.equal(blocked.at(-1), false);
 button('Search Glimpse clips'); await h.settle(); find(h.result, n => n.type === 'TextInput').props.onFocus(); await h.settle(); assert.equal(blocked.at(-1), true);
 button('Glimpse filter: Media type'); await h.settle(); button('Close Glimpse filters'); await h.settle(); assert.equal(blocked.at(-1), true);
 find(h.result, n => n.type === 'TextInput').props.onBlur(); await h.settle(); assert.equal(blocked.at(-1), false);
 button('Filter Glimpse clips'); await h.settle(); button('Glimpse filter: Media type'); await h.settle(); button('Close Glimpse search'); await h.settle(); assert.equal(blocked.at(-1), true); h.dispose();
});

test('each Glimpse Settings control writes its actual local preference and exposes honest persistence failures', () => {
 const calls = []; const local = { preferences: prefs.defaultGlimpsePreferences(), unavailable: false, saveError: false, update: patch => calls.push(patch) };
 const Content = loader({ 'react-native': { useWindowDimensions: () => ({ height: 900 }), Switch: 'Switch', Text: 'Text', View: 'View', StyleSheet: { create: v => v } },
  '../../context/ThemeContext': { useOrionTheme: () => ({ theme: {} }) }, './glimpsePreferences': { useGlimpsePreferences: () => local } })(prefix + 'GlimpseSettingsContent.tsx').GlimpseSettingsContent;
 const controls = all(Content(), n => n.type === 'Switch'); assert.deepEqual(controls.map(n => n.props.value), [true, false, true, false]);
 controls.forEach(n => n.props.onValueChange(!n.props.value)); assert.deepEqual(calls, [{ startMuted: false }, { autoAdvance: true }, { ambientGlow: false }, { rememberPosition: true }]);
 local.unavailable = true; assert.ok(all(Content(), n => n.type === 'Switch').every(n => n.props.disabled));
 assert.ok(find(Content(), n => n.type === 'Text' && n.props.children === 'Glimpse preferences are unavailable on this device.'));
});

test('an end event racing control occlusion cannot advance before the next render', async () => {
 const t = screenHarness({ autoAdvance: true }); await t.h.settle(); const previous = t.active()[0];
 t.control().onOcclusion(true); previous.onEnded(); await t.h.settle();
 assert.equal(t.active().length, 0); t.control().onOcclusion(false); await t.h.settle(); assert.equal(t.active()[0].reel.id, reel(1).id); t.h.dispose();
});

test('Glimpse Settings first-entry jump retries after native content grows; original sections retain their scroll behavior', async t => {
 const previousFrame = global.requestAnimationFrame; t.after(() => { global.requestAnimationFrame = previousFrame; });
 for (const [preview, requested, reduced] of [[true, 'glimpse', false], [true, 'glimpse', true], [true, 'appearance', false], [false, 'appearance', true]]) {
  const h = hookHarness(), frames = [], calls = []; let maxOffset = 400;
  global.requestAnimationFrame = callback => frames.push(callback);
  const order = preview ? ['account', 'appearance', 'glimpse'] : ['account', 'appearance'];
  let route = { section: requested, glimpseEntry: undefined };
  const noop = () => {};
  const Settings = loader({ react: h.react,
   'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable', Switch: 'Switch', TextInput: 'TextInput', StyleSheet: { create: v => v } },
   '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-router': { useLocalSearchParams: () => route },
   '../../src/features/glimpse/glimpsePreview': { isGlimpsePreviewEnabled: () => preview },
   '../glimpse/glimpsePreview': { isGlimpsePreviewEnabled: () => preview },
   '../../src/features/glimpse/GlimpseSettingsContent': { GlimpseSettingsContent: 'GlimpseContent' },
   '../../src/context/ThemeContext': { ORION_MOBILE_THEMES: [], useOrionTheme: () => ({ theme: {}, preferences: { reducedMotion: reduced }, systemReducedMotion: false,
     setTheme: noop, setReducedMotion: noop, setFollowSystem: noop, setCustomAccent: noop }) },
   '../../src/context/PerformanceContext': { usePerformanceProfile: () => ({ selection: 'balanced', resolvedProfile: 'balanced', setSelection: noop }) },
   '../../src/services/responsive': { useResponsiveLayout: () => ({ isTablet: false }) }, '../../src/components/MobilePageHeader': { MobilePageHeader: 'Header' },
   '../../src/features/settings/settingsSectionOrderPreferences': { useSettingsSectionOrderPreferences: () => ({ order, save: noop }) },
   '../../src/features/settings/SettingsSectionNavigator': { SettingsSectionNavigator: 'Navigator' },
   ...Object.fromEntries(['AccountSettingsContent', 'UpdatesSettingsContent', 'NotificationSettingsContent', 'HomeLayoutSettingsContent'].map(name => [`../../src/features/settings/${name}`, { [name]: name }])),
   '../../src/features/downloads/DownloadSettingsContent': { DownloadSettingsContent: 'DownloadsContent' },
  })('apps/mobile/app/(tabs)/settings.tsx').default;
  h.start(Settings); const scroll = find(h.result, n => n.type === 'ScrollView');
  scroll.props.ref.current = { scrollTo: value => calls.push({ ...value, actual: Math.min(value.y, maxOffset) }) };
  const section = find(h.result, n => n.type?.name === 'SettingsSection' && n.props.sectionId === requested);
  section.props.onLayout({ nativeEvent: { layout: { y: 1600 } } }); while (frames.length) frames.shift()();
  assert.equal(calls.length, 1); assert.equal(calls[0].actual, 400);
  maxOffset = 5000; scroll.props.onContentSizeChange(400, 5500); while (frames.length) frames.shift()();
  if (requested === 'glimpse') { assert.equal(calls.length, 2); assert.equal(calls.at(-1).actual, 1592); }
  else assert.equal(calls.length, 1);
  assert.equal(calls.at(-1).animated, requested === 'glimpse' ? false : !reduced);
  scroll.props.onScroll({nativeEvent:{contentOffset:{y:1592}}});await h.settle();
  assert.equal(find(h.result,n=>n.type==='Navigator').props.currentSectionId,requested);
  scroll.props.onContentSizeChange(400, 5600); while (frames.length) frames.shift()(); assert.equal(calls.length, requested === 'glimpse' ? 2 : 1);
  if (requested === 'glimpse') { route = { section: requested, glimpseEntry: 'second-entry' }; h.update(); while (frames.length) frames.shift()(); assert.equal(calls.length, 3); assert.equal(calls.at(-1).actual, 1592); }
  await h.settle(); h.dispose();
 }
});

test('expanding controls and resizing the Stage preserve a settled canonical playback owner', async () => {
 const t = screenHarness(); await t.h.settle(); await t.settle(1);
 const id = t.active()[0].reel.id;
 t.control().onExpanded(true); await t.h.settle();
 const viewport = find(t.h.result, n => !!n.props?.onLayout);
 viewport.props.onLayout({ nativeEvent: { layout: { width: 380, height: 360 } } }); await t.h.settle();
 assert.equal(t.active().length, 1); assert.equal(t.active()[0].reel.id, id);
 t.control().onExpanded(false); viewport.props.onLayout({ nativeEvent: { layout: { width: 380, height: 560 } } }); await t.h.settle();
 assert.equal(t.active()[0].reel.id, id); t.h.dispose();
 const { glimpseStageWidth } = load(prefix + 'glimpseLayout.ts');
 assert.equal(glimpseStageWidth(380, 560, false), 324); assert.equal(glimpseStageWidth(380, 360, false), 324);
 assert.ok(glimpseStageWidth(300, 360, false) + 44 <= 300); assert.equal(glimpseStageWidth(900, 350, true), 720);
});

test('continuous appends keep the same active surface until its canonical offset changes', async () => {
 const t = screenHarness(); await t.h.settle(); await t.settle(1);
 const previous = t.active()[0].reel.id;
 t.feed.reels = [...t.feed.reels, reel(4)]; t.h.update();
 assert.equal(t.active()[0].reel.id, previous, 'Append must not create an inactive render and reload');
 await t.h.settle(); assert.equal(t.active()[0].reel.id, previous);
 t.feed.reels = [t.feed.reels[1], ...t.feed.reels.slice(2)]; t.h.update();
 assert.equal(t.active().length, 0, 'Eviction changing the native offset must release before alignment');
 await t.h.settle(); assert.equal(t.active()[0].reel.id, previous); t.h.dispose();
});

test('small drags preserve playback, intentional scrolling releases it, and settling acquires only one reel', async () => {
 const t = screenHarness({ autoAdvance: true }); await t.h.settle();
 t.list().props.onScrollBeginDrag();
 t.list().props.onScroll({ nativeEvent: { contentOffset: { y: 8 } } }); await t.h.settle();
 assert.equal(t.active()[0].reel.id, reel(1).id);
 t.active()[0].onEnded(); await t.h.settle(); assert.equal(t.active()[0].reel.id, reel(1).id, 'A touch wins an end-event race');
 t.list().props.onScrollEndDrag({ nativeEvent: { velocity: { y: 0 }, contentOffset: { y: 0 } } });
 await t.h.settle(); assert.equal(t.active()[0].reel.id, reel(1).id);
 t.list().props.onScrollBeginDrag(); t.list().props.onScroll({ nativeEvent: { contentOffset: { y: 100 } } });
 await t.h.settle(); assert.equal(t.active().length, 0);
 await t.settle(2); assert.deepEqual(t.active().map(s => s.reel.id), [reel(3).id]); t.h.dispose();
});

test('auto-advance waits for a delayed next batch and manual swipes or disabling the preference cancel it', async () => {
 for (const cancel of [null, 'drag', 'preference', 'background', 'modal']) {
  const t = screenHarness({ autoAdvance: true }); await t.h.settle(); await t.settle(2);
  t.feed.exhausted = false; t.feed.status = 'loading'; t.h.update();
  t.active()[0].onEnded(); await t.h.settle(); assert.equal(t.active()[0].reel.id, reel(3).id);
  if (cancel === 'drag') { t.list().props.onScrollBeginDrag(); await t.settle(2); }
  if (cancel === 'preference') { t.localStore.set({ autoAdvance: false }); t.h.update(); }
  if (cancel === 'background') { t.state.foreground = false; t.h.update(); await t.h.settle(); t.state.foreground = true; t.h.update(); }
  if (cancel === 'modal') { t.control().onOcclusion(true); await t.h.settle(); t.control().onOcclusion(false); }
  await t.h.settle(); t.feed.reels = [...t.feed.reels, reel(4)]; t.feed.status = 'ready'; t.h.update(); await t.h.settle();
  assert.equal(t.active()[0].reel.id, reel(cancel ? 3 : 4).id, String(cancel)); t.h.dispose();
 }
});

test('prefetch uses the visible sorted end; it pauses offline and offers Retry only on actual errors', async () => {
 const t = screenHarness({ sorts: { discover: 'title', liked: 'manual' } }); await t.h.settle();
 let requests = 0; t.feed.exhausted = false; t.feed.loadMore = async () => { requests++; };
 t.h.update(); await t.h.settle();
 await new Promise(r => setTimeout(r, 420)); assert.equal(requests, 1, 'Zulu is last in A–Z but first in raw catalog order');
 assert.equal(find(t.h.result, n => n.props?.accessibilityLabel === 'Load another Glimpse batch'), null);
 t.state.remoteReady = false; t.h.update(); t.feed.reels = [...t.feed.reels, reel(4)]; t.h.update();
 await new Promise(r => setTimeout(r, 420)); assert.equal(requests, 1);
 t.state.remoteReady = true; t.feed.status = 'error'; t.h.update();
 assert.ok(find(t.h.result, n => n.props?.accessibilityLabel === 'Retry Glimpse clips')); t.h.dispose();
});

test('selected filter pills expose the same option label and selection as their modal and Clear restores labels', async () => {
 const h = hookHarness(); let filters = browse.defaultGlimpseFilters();
 const Controls = loader({ react: h.react, 'react-native': { Keyboard: { dismiss() {} }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', View: 'View', StyleSheet: { create: v => v } },
  '@expo/vector-icons': { Ionicons: 'Icon' }, '../../context/ThemeContext': { useOrionTheme: () => ({ theme: {} }) },
  '../discover/discoverStyles': { createDiscoverStyles: () => ({}) }, '../discover/DiscoverFilterModal': { DiscoverFilterModal: 'FilterModal' } })(prefix + 'GlimpseControls.tsx').GlimpseControls;
 const props = () => ({ query: '', onQuery() {}, sort: 'manual', filters, onFilters: value => { filters = value; h.update(props()); }, onSort() {}, onOcclusion() {}, unavailable: false });
 h.start(Controls, props()); find(h.result, n => n.props?.accessibilityLabel === 'Filter Glimpse clips').props.onPress(); await h.settle();
 for (const category of browse.GLIMPSE_FILTER_CATEGORIES) {
  const option = browse.glimpseFilterOptions(category.id, filters).find(o => o.id !== browse.selectedGlimpseFilter(browse.defaultGlimpseFilters(), category.id));
  filters = browse.updateGlimpseFilter(filters, category.id, option.id); h.update(props()); await h.settle();
  const pill = find(h.result, n => n.props?.accessibilityLabel === 'Glimpse filter: ' + category.label);
  assert.equal(pill.props.accessibilityValue.text, option.label); assert.equal(pill.props.accessibilityState.selected, true);
  assert.ok(find(pill, n => n.type === 'Text' && n.props.children === option.label));
 }
 find(h.result, n => n.props?.accessibilityLabel === 'Clear Glimpse filters').props.onPress(); await h.settle();
 for (const category of browse.GLIMPSE_FILTER_CATEGORIES) {
  const pill = find(h.result, n => n.props?.accessibilityLabel === 'Glimpse filter: ' + category.label);
  if (category.id === 'subfilter') { assert.equal(pill, null); continue; }
  assert.equal(pill.props.accessibilityValue.text, category.label); assert.equal(pill.props.accessibilityState.selected, false);
 }
 h.dispose();
});

test('Glimpse region catalog requests Discovery country/language parameters instead of filtering global trending', async () => {
 const calls = [];
 const source = loader({ '@orion/shared/api': { tmdbFetch: async (url, options) => { calls.push({ url, options }); return { results: [{ id: 1, title: 'Indian title', poster_path: '/one' }], total_pages: 2 }; }, isAnimeContent: () => false },
  '../../services/storageAdapter': { mmkvStorageAdapter: { get: () => null } } })(prefix + 'tmdbGlimpseSource.ts');
 const filters = { ...browse.defaultGlimpseFilters(), type: 'movie', region: 'bollywood', subfilter: 'hi' };
 const catalogSource = source.createGlimpseCatalog(filters, '');
 const signal = new AbortController().signal, result = await catalogSource.page(2, signal);
 assert.equal(calls.length, 1); assert.match(calls[0].url, /^\/discover\/movie\?/);
 assert.match(calls[0].url, /with_origin_country=IN/); assert.match(calls[0].url, /with_original_language=hi/);
 assert.match(calls[0].url, /page=2/); assert.equal(calls[0].options.signal, signal);
 assert.equal(result.items[0].media_type, 'movie'); assert.equal(result.hasMore, false);
 assert.deepEqual(browse.glimpseFilterOptions('subfilter', filters).map(v => v.label), load('apps/mobile/src/features/discover/discoverCatalog.ts').SUBFILTER_PRESETS.bollywood.map(v => v.name));
});

test('title search paginates movie/TV identities and ranks exact Dragon Ball matches first without unrelated reels', async () => {
 const calls = [];
 const source = loader({ '@orion/shared/api': { tmdbFetch: async url => { calls.push(url); return { total_pages: 3, results: [
  { id: 1, title: 'Dragon Ball Z', name: 'Dragon Ball Z', poster_path: '/one' },
  { id: 2, title: 'Dragon Ball', name: 'Dragon Ball', poster_path: '/two' },
  { id: 3, title: 'Unrelated', name: 'Unrelated', poster_path: '/three' }] }; }, isAnimeContent: () => false },
  '../../services/storageAdapter': { mmkvStorageAdapter: { get: () => null } } })(prefix + 'tmdbGlimpseSource.ts');
 const page = await source.createGlimpseCatalog(browse.defaultGlimpseFilters(), 'Dragon Ball').page(1, new AbortController().signal);
 assert.equal(calls.length, 2); assert.ok(calls.every(url => /\/search\/(movie|tv)\?query=Dragon%20Ball/.test(url)));
 assert.equal(page.items[0].title, 'Dragon Ball'); assert.equal(page.hasMore, true);
 const values = [reel(1, { title: 'Dragon Ball Z' }), reel(2, { title: 'Dragon Ball' }), reel(3, { title: 'Unrelated' })];
 const matches = browse.rankGlimpseSearch(browse.filterGlimpseReels(values, browse.defaultGlimpseFilters(), 'Dragon Ball'), 'Dragon Ball');
 assert.deepEqual(matches.map(r => r.title), ['Dragon Ball', 'Dragon Ball Z']);
});

test('video/details response supplies real country/language metadata for Bollywood and its language subfilter', async () => {
 const calls = [];
 const source = loader({ '@orion/shared/api': { tmdbFetch: async url => { calls.push(url); return {
  id: 1, title: 'Indian title', original_language: 'hi', origin_country: ['IN'], genres: [{ id: 28 }],
  videos: { results: [{ site: 'YouTube', key: '00000000001', type: 'Clip', name: 'Scene' }] }, results: [] }; }, isAnimeContent: () => false },
  '../../services/storageAdapter': { mmkvStorageAdapter: { get: () => '"en-US"' } } })(prefix + 'tmdbGlimpseSource.ts');
 const [candidate] = await source.tmdbGlimpseVideoSource.candidates({ id: 1, media_type: 'movie', title: 'Indian title', original_language: 'hi' }, new AbortController().signal);
 assert.match(calls[0], /^\/movie\/1\?append_to_response=videos$/); assert.deepEqual(candidate.catalog.originCountries, ['IN']);
 assert.deepEqual(candidate.catalog.genreIds, [28]); assert.equal(candidate.catalog.originalLanguage, 'hi');
 const hindi = { ...browse.defaultGlimpseFilters(), region: 'bollywood', subfilter: 'hi' };
 assert.deepEqual(browse.filterGlimpseReels([candidate], hindi, ''), [candidate]);
 assert.deepEqual(browse.filterGlimpseReels([candidate], { ...hindi, subfilter: 'ta' }, ''), []);
 assert.equal(browse.updateGlimpseFilter(hindi, 'region', 'asian').subfilter, 'all');
});

test('query changes cancel old catalog requests and cannot publish stale global results into a searched feed', async () => {
 const h = hookHarness(); let release;
 const pending = new Promise(resolve => { release = resolve; });
 const makeCatalog = query => ({ page: async () => ({ items: [{ id: query ? 2 : 1, media_type: 'movie' }], hasMore: false }) });
 const hook = loader({ react: h.react, './tmdbGlimpseSource': { glimpseDiscoveryCatalog: makeCatalog(''),
  createGlimpseCatalog: (_, query) => makeCatalog(query), tmdbGlimpseVideoSource: { candidates: async item => item.id === 1 ? pending : [reel(2, { title: 'Dragon Ball' })] } }
 })(prefix + 'useGlimpseFeed.ts').useGlimpseFeed;
 const view = query => ({ filters: browse.defaultGlimpseFilters(), query });
 h.start(input => hook(true, 4, null, input), view('')); await new Promise(r => setImmediate(r));
 h.update(view('Dragon Ball')); release([reel(1, { title: 'Unrelated' })]); await h.settle();
 assert.deepEqual(h.result.reels.map(r => r.title), ['Dragon Ball']); assert.equal(h.result.status, 'ready'); h.dispose();
});

test('unavailable search edge stops its player, fetches the next batch and never advances an unrelated saved Like', async () => {
 const t = screenHarness(); await t.h.settle(); await t.settle(2);
 t.feed.exhausted = false; let loads = 0; t.feed.loadMore = async () => { loads++; }; t.h.update();
 t.active()[0].onFailure({ kind: 'embedding', code: 101 }); await t.h.settle();
 assert.equal(t.active().length, 0); assert.equal(loads, 1); assert.equal(t.stages()[2].failure.code, 101);
 t.feed.reels = [...t.feed.reels, reel(4)]; t.h.update(); await t.h.settle(); assert.equal(t.active()[0].reel.id, reel(4).id);
 t.likesStore.setLiked(reel(1), true); t.likesStore.setLiked(reel(2), true); t.tab('Liked'); await t.h.settle();
 t.active()[0].onFailure({ kind: 'unavailable', code: 100 }); await t.h.settle();
 assert.equal(t.active().length, 0); assert.equal(t.stages()[0].selected, true); assert.equal(t.likesStore.getSnapshot().reels.length, 2);
 t.stages()[0].onRetry(); await t.h.settle(); assert.equal(t.active()[0].reel.id, reel(1).id); t.h.dispose();
});

test('an explicit YouTube handoff releases playback before opening the validated clip and recovers on foreground return', async t => {
 const oldFrame = global.requestAnimationFrame; t.after(() => { global.requestAnimationFrame = oldFrame; });
 const frames = []; global.requestAnimationFrame = callback => frames.push(callback);
 const s = screenHarness(); await s.h.settle(); s.active()[0].onOpenYouTube(); await s.h.settle();
 assert.equal(s.active().length, 0); assert.deepEqual(s.opened, []);
 frames.shift()(); await s.h.settle(); assert.deepEqual(s.opened, ['https://www.youtube.com/watch?v=00000000001']);
 s.state.foreground = false; s.h.update(); await s.h.settle(); assert.equal(s.active().length, 0);
 s.state.foreground = true; s.h.update(); await s.h.settle(); assert.equal(s.active().length, 1); s.h.dispose();
});

test('source exhaustion leaves an honest failure with Retry and YouTube controls instead of claiming another reel exists', async () => {
 const h = hookHarness();
 const Stage = loader({ react: h.react, 'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', Image: 'Image', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: v => v } },
  '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' }, '@orion/shared/api': { imgUrl: () => null },
  '../../context/ThemeContext': { useOrionTheme: () => ({ theme: {} }) }, './GlimpseVideoSurface': { GlimpseVideoSurface: 'Surface' } })(prefix + 'GlimpseStage.tsx').GlimpseStage;
 let retried = 0, opened = 0;
 h.start(Stage, { reel: reel(1), active: false, selected: true, failed: true, failure: { kind: 'embedding', code: 150 }, onRetry: () => retried++, onOpenYouTube: () => opened++ });
 assert.equal(find(h.result, n => n.type === 'Surface'), null);
 assert.ok(find(h.result, n => n.type === 'Text' && /uploader does not allow/.test(String(n.props.children))));
 find(h.result, n => n.props?.accessibilityLabel === 'Retry this clip').props.onPress();
 find(h.result, n => n.props?.accessibilityLabel === 'Open clip in YouTube').props.onPress();
 assert.equal(retried, 1); assert.equal(opened, 1); h.dispose();
});
test('Bollywood combines media type and genre while keeping seasonal Indian series and excluding serials', () => {
 const indian = catalog({ originCountries: ['IN'], originalLanguage: 'hi' });
 const film = reel(1, { title: 'Indian film', catalog: indian });
 const television = (id, seriesFormat, genreIds = [18]) => reel(id, { media: { ...reel(id).media, mediaType: 'tv' }, catalog: { ...indian, genreIds, ...(seriesFormat ? { seriesFormat } : {}) } });
 const seasonal = television(2, 'seasonal'), serial = television(3, 'serial'), soap = television(4, undefined, [10766]), unknown = television(5);
 const bollywood = browse.updateGlimpseFilter(browse.defaultGlimpseFilters(), 'region', 'bollywood');
 assert.equal(bollywood.type, 'all'); assert.equal(bollywood.subfilter, 'all');
 assert.deepEqual(browse.filterGlimpseReels([film, seasonal, serial, soap, unknown], bollywood, ''), [film, seasonal, unknown]);
 assert.deepEqual(browse.filterGlimpseReels([serial, soap], browse.defaultGlimpseFilters(), ''), [serial, soap]);
 const hindi = browse.updateGlimpseFilter(bollywood, 'subfilter', 'hi');
 for (const value of ['all', 'movie', 'tv', 'anime']) {
  const changed = browse.updateGlimpseFilter(hindi, 'type', value); assert.equal(changed.type, value); assert.equal(changed.region, 'bollywood'); assert.equal(changed.subfilter, 'hi');
 }
 const drama = browse.updateGlimpseFilter(hindi, 'tvGenre', '18'); assert.equal(drama.region, 'bollywood'); assert.equal(drama.type, 'tv');
 assert.deepEqual(browse.filterGlimpseReels([film, seasonal, serial, soap], drama, ''), [seasonal]);
 const movies = browse.updateGlimpseFilter(drama, 'type', 'movie'); assert.equal(movies.genre, null); assert.equal(movies.region, 'bollywood');
 const action = browse.updateGlimpseFilter(drama, 'movieGenre', '28'); assert.equal(action.type, 'movie'); assert.equal(action.genre.type, 'movie'); assert.equal(action.region, 'bollywood');
 assert.deepEqual(browse.filterGlimpseReels([film, seasonal], action, ''), [film]);
 assert.deepEqual(browse.filterGlimpseReels([seasonal], { ...drama, subfilter: 'ta' }, ''), []);
 assert.equal(browse.updateGlimpseFilter(hindi, 'region', 'asian').subfilter, 'all');
});

test('Bollywood requests movies and TV when appropriate; only its TV discover requests exclude Soap', async () => {
 const urls = [];
 const api = loader({ '@orion/shared/api': { isAnimeContent: () => false, tmdbFetch: async url => { urls.push(url); return { results: [], total_pages: 1 }; } },
  '../../services/storageAdapter': { mmkvStorageAdapter: { get: () => null } } })(prefix + 'tmdbGlimpseSource.ts');
 const filters = { ...browse.defaultGlimpseFilters(), region: 'bollywood', subfilter: 'hi' };
 await api.createGlimpseCatalog(filters, '').page(1, new AbortController().signal);
 assert.equal(urls.length, 2); assert.ok(urls.every(url => url.includes('with_origin_country=IN') && url.includes('with_original_language=hi')));
 assert.ok(urls.find(url => url.startsWith('/discover/tv?')).includes('without_genres=10766'));
 assert.ok(!urls.find(url => url.startsWith('/discover/movie?')).includes('without_genres=10766'));
 urls.length = 0; await api.createGlimpseCatalog(filters, 'Indian title').page(1, new AbortController().signal);
 assert.equal(urls.length, 2); assert.ok(urls.some(url => url.startsWith('/search/tv?'))); assert.ok(urls.some(url => url.startsWith('/search/movie?')));
 urls.length = 0; await api.createGlimpseCatalog({ ...filters, type: 'tv', genre: { type: 'tv', id: 18 } }, '').page(1, new AbortController().signal);
 assert.equal(urls.length, 1); assert.match(urls[0], /^\/discover\/tv\?/); assert.ok(urls[0].includes('with_genres=18') && urls[0].includes('without_genres=10766'));
});

test('series classification distinguishes actual seasonal structures from serials without excluding every Drama or every TV title', () => {
 const { classifyGlimpseSeries: classify } = load(prefix + 'glimpseSeriesFormat.ts');
 const details = counts => ({ type: 'Scripted', genres: [{ id: 18 }], seasons: counts.map((episode_count, i) => ({ season_number: i + 1, episode_count })) });
 assert.equal(classify(details([9, 10, 10])), 'seasonal'); // Mirzapur catalog structure.
 assert.equal(classify(details([10, 9, 7])), 'seasonal'); // The Family Man catalog structure.
 assert.equal(classify(details([1547, 104])), 'serial'); // C.I.D. remains Scripted + Drama in the catalog.
 assert.equal(classify({ ...details([8]), genres: [{ id: 10766 }] }), 'serial');
 assert.equal(classify({ type: 'Soap Opera', seasons: [] }), 'serial');
 assert.equal(classify(details([79])), 'seasonal'); assert.equal(classify(details([80])), 'serial');
 assert.equal(classify({ ...details([10]), seasons: [{ season_number: 0, episode_count: 1000 }, { season_number: 1, episode_count: 10 }] }), 'seasonal');
 assert.equal(classify({ type: 'Scripted', seasons: [] }), 'unknown');
 assert.equal(classify({ type: 'Reality', seasons: details([100]).seasons }), 'unknown');
});

test('TV details supply series format in the same request; optional format persists in private Likes without rewriting old metadata', async () => {
 const calls = [];
 const source = loader({ '@orion/shared/api': { tmdbFetch: async url => { calls.push(url); return { id: 1, name: 'Indian seasons', type: 'Scripted', original_language: 'hi',
  origin_country: ['IN'], genres: [{ id: 18 }], seasons: [{ season_number: 1, episode_count: 10 }], videos: { results: [{ site: 'YouTube', key: '00000000001', type: 'Clip', name: 'Scene' }] }, results: [] }; }, isAnimeContent: () => false },
  '../../services/storageAdapter': { mmkvStorageAdapter: { get: () => null } } })(prefix + 'tmdbGlimpseSource.ts');
 const [candidate] = await source.tmdbGlimpseVideoSource.candidates({ id: 1, media_type: 'tv', name: 'Indian seasons', original_language: 'hi' }, new AbortController().signal);
 assert.match(calls[0], /^\/tv\/1\?append_to_response=videos$/); assert.equal(candidate.catalog.seriesFormat, 'seasonal'); assert.equal(calls.length, 2);
 const storage = backend(), likes = new GlimpseLikesStore(storage); likes.setLiked(candidate, true);
 assert.equal(new GlimpseLikesStore(storage).getSnapshot().reels[0].catalog.seriesFormat, 'seasonal');
 assert.deepEqual(metadata.normalizeGlimpseTitleMetadata(catalog()), catalog());
 assert.throws(() => metadata.normalizeGlimpseTitleMetadata(catalog({ seriesFormat: 'forged' })));
});

test('side controls have separate large targets and preserve settled playback and end-state navigation', async () => {
 const t = screenHarness(); await t.h.settle();
 const row = () => t.list().props.renderItem({ item: t.list().props.data[0], index: 0 });
 const previous = find(t.h.result, n => n.props?.accessibilityLabel === 'Previous reel');
 const next = find(t.h.result, n => n.props?.accessibilityLabel === 'Next reel');
 assert.equal(find(row(), n => n.props?.style?.maxWidth).props.style.width, '100%');
 assert.equal(find(row(), n => n.props?.accessibilityLabel === 'Previous reel'), null);
 assert.equal(find(row(), n => n.props?.accessibilityLabel === 'Next reel'), null);
 assert.equal(all(t.h.result, n => n.props?.accessibilityLabel === 'Next reel').length, 1);
 assert.equal(previous.props.disabled, true); assert.ok(previous.props.style[0].minHeight >= 44);
 assert.equal(find(previous, n => n.type === 'Text').props.children, 'Prev');
 assert.equal(find(next, n => n.type === 'View').props.style[0].width, 44);
 next.props.onPress(); await t.h.settle(); assert.equal(t.active()[0].reel.id, reel(2).id);
 await t.settle(2); const last = t.list().props.renderItem({ item: t.list().props.data[2], index: 2 });
 assert.equal(find(t.h.result, n => n.props?.accessibilityLabel === 'Next reel').props.disabled, true); t.h.dispose();
});

test('loading errors keep the settled player and footer space stable without false offline advice', async () => {
 const t = screenHarness(); await t.h.settle(); const activeId = t.active()[0].reel.id;
 const footer = () => find(t.h.result, n => n.type === 'View' && n.props?.style?.paddingRight === 60);
 const space = footer().props.style.minHeight;
 t.feed.exhausted = false; t.feed.status = 'error'; t.feed.failure = { kind: 'timeout', retryable: true }; t.h.update(); await t.h.settle();
 assert.equal(t.active()[0].reel.id, activeId); assert.equal(footer().props.style.minHeight, space);
 assert.ok(find(t.h.result, n => n.type === 'Text' && n.props.children === 'Loading more clips took too long. Try again.'));
 assert.equal(find(t.h.result, n => n.type === 'Text' && String(n.props.children).includes('Retry when connected')), null); t.h.dispose();
});

test('loading newer batches preserves the visible Discover clip and ignores stale alignment events', async()=>{
 const t=screenHarness({sorts:{discover:'newest',liked:'custom'}});await t.h.settle();
 const initial=t.active()[0].reel.id;
 t.feed.reels=[...t.feed.reels,reel(4,{year:'2027',catalog:{...catalog,releaseDate:'2027-01-01'}})];t.h.update();
 assert.equal(t.active()[0].reel.id,initial);await t.h.settle();assert.equal(t.active()[0].reel.id,initial);
 t.list().props.onMomentumScrollBegin();t.list().props.onMomentumScrollEnd({nativeEvent:{contentOffset:{y:1000}}});await t.h.settle();assert.equal(t.active()[0].reel.id,initial);
 assert.equal(t.list().props.removeClippedSubviews,false);
 await t.settle(1);assert.notEqual(t.active()[0].reel.id,initial);assert.equal(t.active().length,1);t.h.dispose();
});


test('ambient preference preserves older bytes and other preferences across restart; invalid values never publish', () => {
 const storage=backend(), old={schemaVersion:1,startMuted:false,autoAdvance:true,rememberPosition:false,sorts:{discover:'year',liked:'title'},position:null};
 const bytes=JSON.stringify(old);storage.set(prefs.GLIMPSE_PREFERENCES_KEY,bytes);
 let local=new prefs.GlimpsePreferencesStore(storage);assert.equal(local.getSnapshot().preferences.ambientGlow,true);assert.equal(storage.getString(prefs.GLIMPSE_PREFERENCES_KEY),bytes);
 local.set({ambientGlow:false});local=new prefs.GlimpsePreferencesStore(storage);assert.equal(local.getSnapshot().preferences.ambientGlow,false);assert.equal(local.getSnapshot().preferences.autoAdvance,true);assert.equal(local.getSnapshot().preferences.sorts.discover,'year');
 const before=local.getSnapshot();assert.throws(()=>local.set({ambientGlow:'yes'}));assert.equal(local.getSnapshot(),before);
});

test('only the settled active reel requests ambient artwork; leaving, offline and preference off suppress it', async () => {
 const t=screenHarness();await t.h.settle();
 const frames=()=>t.stages().map(stage=>({enabled:stage.ambientGlow}));
 assert.equal(frames().filter(f=>f.enabled).length,1);
 await t.settle(1);assert.equal(frames()[0].enabled,false);assert.equal(frames()[1].enabled,true);
 t.state.remoteReady=false;t.h.update();await t.h.settle();assert.equal(frames().some(f=>f.enabled),false);
 t.state.remoteReady=true;t.h.update();await t.h.settle();t.localStore.set({ambientGlow:false});t.h.update();await t.h.settle();assert.equal(frames().some(f=>f.enabled),false);
 t.h.dispose();
});

test('ambient frame bypasses playback work in Efficiency mode or while paused', () => {
 const h=hookHarness(),requested=[];class Value { setValue(){} stopAnimation(){} interpolate(){return 1;} }
 const Frame=loader({react:h.react,'react-native':{Animated:{Value,View:'AnimatedView'},Image:'Image',View:'View',StyleSheet:{create:v=>v}},'expo-linear-gradient':{LinearGradient:'Gradient'},'@orion/shared/api':{imgUrl:(path,size)=>{requested.push(size);return path?path+':'+size:null;}}})(prefix+'GlimpseAmbientFrame.tsx').GlimpseAmbientFrame;
 const props={artworkPath:'/art.jpg',enabled:true,playing:true,reducedMotion:true,palette:null,profile:'balanced',children:'player'};
 h.start(Frame,props);assert.equal(all(h.result,n=>n.type==='Image').length,1);assert.equal(requested.at(-1),'w185');
 h.update({...props,profile:'quality'});assert.equal(requested.at(-1),'w300');const count=requested.length;
 h.update({...props,profile:'efficiency'});assert.equal(all(h.result,n=>n.type==='Image').length,0);assert.equal(requested.length,count);
 h.update({...props,playing:false});assert.equal(all(h.result,n=>n.type==='Image').length,0);assert.equal(h.result.props.children[1],'player');h.dispose();
});

test('welcome entry explicitly opens Discover while ordinary entry retains remembered Liked', async () => {
 const ordinary = screenHarness({}, { tab: 'liked', reel: reel(2) }); await ordinary.h.settle(); assert.equal(ordinary.list(), null); ordinary.h.dispose();
 const welcome = screenHarness({}, { tab: 'liked', reel: reel(2) }, { welcomeDiscover: '1' }); await welcome.h.settle(); assert.ok(welcome.list()); assert.ok(welcome.active().length <= 1); welcome.h.dispose();
});
