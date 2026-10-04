const test = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers/animeModules.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const { nodes } = require('./helpers/postPhysicalPlaybackHarness.cjs');
const jsx = (type, props, key) => ({ type, props: { ...props, key } });
const rn = { Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
  StyleSheet: { create: x => x }, useWindowDimensions: () => ({ width: 800, height: 450 }) };
const health = { getMobileSourceHealthV2: () => null };
const load = loader({ '../../services/sourceHealth': health });
const mobile = load('apps/mobile/src/features/playback/mobileSources.ts');
const registry = load('packages/shared/src/sources/registry.ts');
const copies = { vixsrc: 'Reliable default', vidlink: 'Fast alternative', vidnest: 'Flexible source',
  'vidsrc-ir': 'Slow start, solid', cinesrc: 'Smooth resume', '111movies': 'Streaming only' };
const visible = ['vixsrc', 'vidsrc', 'vidlink', 'vidnest', 'vidsrc-ir', 'cinesrc', '111movies'];
const downloadIds = ['vixsrc', 'vidsrc', 'vidlink', 'vidsrc-ir', 'cinesrc'];

test('From Selection eligibility removes only 111Movie while playback, registered download contracts and Auto stay intact', () => {
  assert.deepEqual(mobile.MOBILE_PLAYER_SOURCES.map(s => s.id), visible);
  for (const type of ['movie', 'tv']) assert.deepEqual(mobile.getMobileDownloadSourceChoices(type).map(s => s.id), downloadIds);
  assert.equal(registry.getRegisteredSource('111movies').supportsDownloads, true, 'Do not change the Downloads engine admission contract');
  assert.equal(registry.getSourceUrl('111movies', 'movie', { tmdbId: 9 }), 'https://111movies.net/movie/9');
  assert.equal(mobile.MOBILE_DEFAULT_CINEMA_SOURCE_ID, 'vixsrc');
  assert.deepEqual(mobile.MOBILE_PLAYER_SOURCES.filter(s => mobile.mobileSourceSupportsContinuity(s.id)).map(s => s.id), ['vixsrc']);
  assert.equal(mobile.getNextMobileContinuitySource('vidnest', 'movie'), 'vixsrc');
  assert.equal(mobile.getNextMobileContinuitySource('vixsrc', 'movie'), null);
  for (const sourceId of visible.filter(s => s !== 'vixsrc')) assert.equal(mobile.getMobileSourceContinuityCapability(sourceId).automaticTarget, false);
});

for (const [sourceId, description] of Object.entries(copies)) test(`${sourceId}: exact short description and existing manual capability boundary`, () => {
  const capability = mobile.getMobileSourceContinuityCapability(sourceId);
  assert.equal(capability.description, description);
  assert.ok(description.split(/\s+/).length >= 2 && description.split(/\s+/).length <= 4);
  assert.doesNotMatch(description, /best|perfect|100%|fastest|resume may vary/i);
  assert.equal(capability.canReceivePosition, true); assert.equal(capability.canTransferOut, true);
  assert.equal(capability.canTrackProgress, true); assert.equal(capability.automaticTarget, sourceId === 'vixsrc');
});

const prompt = loader({ 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': rn,
  '@expo/vector-icons': { Ionicons: 'Icon' }, '../../context/ThemeContext': { useOrionTheme: () => ({ theme: {} }) },
})('apps/mobile/src/features/playback/ResumePlaybackPrompt.tsx').ResumePlaybackPrompt;
for (const sourceId of visible) test(`${sourceId}: the established Resume sheet renders only the supported existing actions`, () => {
  const selected = [], capability = mobile.getMobileSourceContinuityCapability(sourceId);
  const tree = prompt({ title: 'Movie', savedTime: 1200, targetSourceLabel: registry.getRegisteredSource(sourceId).label,
    continuityMode: capability.mode, onChoose: choice => selected.push(choice), onCancel() {} });
  const buttons = nodes(tree, 'Pressable').filter(n => n.props.key !== 'cancel');
  const actions = capability.canReceivePosition ? ['resume', 'replay-30', 'start-over'] : ['start-over'];
  assert.deepEqual(buttons.map(n => n.props.key), actions);
  buttons.forEach(n => n.props.onPress()); assert.deepEqual(selected, actions);
  const text = JSON.stringify(nodes(tree, 'Text').map(n => n.props.children));
  if (capability.canReceivePosition) assert.doesNotMatch(text, /may vary|hasn't been confirmed|own saved place|Try resuming|Try from beginning/i);
  else assert.match(text, /can't continue from your current spot/);
});

function modalFixture(type, withPrepared111) {
  const h = hookHarness(), calls = [];
  const target = { itemKey: `${type}:9`, media: { mediaType: type, tmdbId: 9, title: 'Title', season: type === 'tv' ? 1 : null,
    episode: type === 'tv' ? 1 : null } };
  const snapshots = withPrepared111 ? [{ itemKey: target.itemKey, candidate: { sourceId: '111movies' } }] : [];
  const noSubscription = () => () => {};
  const preferences = { preferredQuality: 'best', subtitlePreference: 'none', libraryStorageTarget: null };
  const mocks = {
    react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': rn, '@expo/vector-icons': { Ionicons: 'Icon' },
    '../context/ThemeContext': { useOrionTheme: () => ({ theme: {} }) }, './OrionDialog': { OrionDialog: 'Dialog' },
    './DownloadModalPresentation': { ChoicePill: 'ChoicePill', SummaryRow: 'SummaryRow', StatusCard: 'StatusCard', downloadModalStyles: {} },
    '../services/responsive': { useResponsiveLayout: () => ({ isTablet: false }) },
    '../services/downloadManager': { getMobileDownloadCapability: () => ({ available: true }) },
    '../features/playback/mobileSources': mobile,
    '../features/downloads/downloadCandidateCapture': { getMobileDownloadCandidateSnapshotsV1: () => snapshots,
      getMobileDownloadSourceResolutionIntentV1: () => null, getMobileDownloadSourceResolutionFailureV1: () => null,
      subscribeMobileDownloadCandidatesV1: noSubscription,
      selectMobileDownloadCandidateForItemV1: (_key, _method, _values, _destination, sourceId) =>
        withPrepared111 && sourceId === '111movies' ? { candidate: snapshots[0].candidate } : null },
    '../features/downloads/downloadPreferences': { getMobileDownloadPreferencesV1: () => preferences, subscribeMobileDownloadPreferencesV1: noSubscription },
    '../features/downloads/nativeDownloadEngine': { validateNativeLibraryStorageTargetV1: async () => null },
    '../features/downloads/downloadStart': { startMobileDownloadFromSelectionV1: async () => { throw new Error('No transfer permitted in a presentation test'); } },
    '../features/downloads/downloadRepository': { readMobileDownloadRepositoryV1: () => ({ jobs: [], assets: [] }), subscribeMobileDownloadRepositoryV1: noSubscription },
    '../features/downloads/downloadSubtitles': {},
  };
  h.start(loader(mocks)('apps/mobile/src/components/DownloadModal.tsx').DownloadModal,
    { visible: true, target, onClose() {}, onResolveSource: (...args) => calls.push(args) });
  return { h, calls };
}
for (const type of ['movie', 'tv']) for (const prepared of [false, true]) {
  test(`actual ${type} Download Modal omits 111Movie from provider choices, including prepared=${prepared}`, async () => {
    const f = modalFixture(type, prepared);
    try {
      await f.h.settle();
      const choices = nodes(f.h.result, 'ChoicePill').filter(n => n.props.icon === 'play-circle-outline' || n.props.icon === 'sparkles-outline');
      assert.deepEqual(choices.map(n => n.props.label), ['Auto', ...downloadIds.map(id => registry.getRegisteredSource(id).label)]);
      assert.equal(choices.some(n => /111/.test(n.props.label)), false);
      choices.find(n => n.props.label === 'VidLink').props.onPress(); await f.h.settle();
      assert.equal(f.calls.length, 0, 'Selection stays local until the existing preparation action');
    } finally { f.h.dispose(); }
  });
}
