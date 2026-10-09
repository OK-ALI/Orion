const test = require('node:test'), assert = require('node:assert/strict');
const { loader, read } = require('./helpers/animeModules.cjs');
const { nodes, playbackFixture } = require('./helpers/postPhysicalPlaybackHarness.cjs');
const { memoryStorage, libraryFixture } = require('./helpers/sourceContinuityHarness.cjs');
const movie = { id: '9', type: 'movie', title: 'Movie' };

test('Player alone takes over the route immediately with its dark root and existing preparing presentation', async () => {
  const layout = () => {}, orientation = {entryReady: false, onPlayerLayout: layout};
  const f = playbackFixture(movie, memoryStorage(), {}, undefined, orientation);
  try {
    await f.settle();
    const root = nodes(f.player.result, 'View').find(node => node.props.onLayout === layout);
    assert.deepEqual(root.props.style, {flex: 1, backgroundColor: '#000'});
    const content = root.props.children[0];
    assert.equal(content.props.style.opacity, 0); assert.equal(content.props.pointerEvents, 'none');
    assert.equal(content.props.accessibilityElementsHidden, true);
    const preparing = root.props.children[1];
    assert.equal(preparing.type, 'PlayerStateOverlay'); assert.equal(preparing.props.state, 'preparing');
    assert.match(read('apps/mobile/app/_layout.tsx'), /name="player\/\[id\]" options=\{\{ animation: 'none', contentStyle: \{ backgroundColor: '#000' \} \}\}/);
    assert.match(read('apps/mobile/app/_layout.tsx'), /animation: motion\.screenAnimation/);
  } finally { f.dispose(); }
});

test('entry reveal keeps one provider/session, exact URL and source-resolution count', async () => {
  const orientation = {entryReady: false, onPlayerLayout() {}};
  const f = playbackFixture(movie, memoryStorage(), {}, undefined, orientation);
  try {
    await f.settle(); const url = f.props.embedUrl, count = f.urlBuilds.length;
    const key = f.props.key, session = f.find('EmbedPlayerSurface').continuityAttemptId;
    assert.equal(f.mounted, 1);
    orientation.entryReady = true; f.player.update({}); await f.settle();
    assert.equal(f.mounted, 1); assert.equal(f.props.key, key); assert.equal(f.props.embedUrl, url);
    assert.equal(f.props.continuityAttemptId, session); assert.equal(f.urlBuilds.length, count);
    assert.equal(nodes(f.player.result, 'PlayerStateOverlay').length, 0);
    const content = nodes(f.player.result, 'View').find(node => node.props.pointerEvents === 'auto');
    assert.equal(content.props.style.opacity, 1); assert.equal(content.props.accessibilityElementsHidden, false);
  } finally { f.dispose(); }
});

test('slow preparation and provider failure do not replace the Player-owned root or add another provider', async () => {
  const anime = {phase: 'checking'}, orientation = {entryReady: false, onPlayerLayout() {}};
  const f = playbackFixture(movie, memoryStorage(), anime, undefined, orientation);
  try {
    await f.settle(); assert.equal(f.mounted, 0);
    orientation.entryReady = true; f.player.update({}); await f.settle();
    assert.equal(nodes(f.player.result, 'PlayerStateOverlay').length, 1);
    assert.equal(f.find('PlayerStateOverlay').state, 'preparing');
    f.anime.phase = 'failed'; f.anime.error = 'Unavailable'; f.anime.providerId = 'anilink';
    f.player.update({}); await f.settle(); assert.equal(f.mounted, 1);
    assert.equal(f.props.sourceId, 'anilink'); assert.equal(f.props.sourceError, 'Unavailable');
    const root = nodes(f.player.result, 'View').find(node => node.props.onLayout === orientation.onPlayerLayout);
    assert.equal(root.props.style.backgroundColor, '#000');
  } finally { f.dispose(); }
});

test('the existing Resume sheet is revealed once after entry without creating a duplicate handoff', async () => {
  const storage = memoryStorage(), seed = libraryFixture(storage);
  seed.library.recordPlayback({item: {id: 9, title: 'Movie'}, mediaType: 'movie', sourceId: 'vixsrc',
    currentTime: 600, duration: 8000, evidence: 'provider-message', sessionId: 'saved'});
  seed.harness.dispose();
  const orientation = {entryReady: false, onPlayerLayout() {}};
  const f = playbackFixture(movie, storage, {}, undefined, orientation);
  try {
    await f.settle(); assert.equal(nodes(f.player.result, 'ResumePlaybackPrompt').length, 0); assert.equal(f.mounted, 0);
    orientation.entryReady = true; f.player.update({}); await f.settle();
    assert.equal(nodes(f.player.result, 'ResumePlaybackPrompt').length, 1); assert.equal(f.find('ResumePlaybackPrompt').savedTime, 600);
    f.find('ResumePlaybackPrompt').onChoose('resume'); await f.settle();
    assert.equal(f.mounted, 1); assert.equal(f.props.initialResumeTime, 600);
    const attempts = f.traces.filter(row => row.event === 'handoff');
    assert.equal(new Set(attempts.map(row => row.attemptId)).size, 1);
    f.player.update({}); await f.settle(); assert.equal(f.mounted, 1);
    assert.equal(f.traces.filter(row => row.event === 'handoff').length, attempts.length);
  } finally { f.dispose(); }
});

test('normal and both reduced-motion authorities reuse the same preparing overlay without a new entry animation', () => {
  const jsx = (type, props) => ({type, props});
  for (const [orion, system] of [[false, false], [true, false], [false, true]]) {
    const overlay = loader({'react/jsx-runtime': {jsx, jsxs: jsx}, '@expo/vector-icons': {Ionicons: 'Icon'},
      'react-native': {ActivityIndicator: 'Spinner', View: 'View', Text: 'Text', Pressable: 'Button', StyleSheet: {create: x => x}},
      '../../context/ThemeContext': {useOrionTheme: () => ({theme: {}, preferences: {reducedMotion: orion}, systemReducedMotion: system})},
    })('apps/mobile/src/components/player/PlayerStateOverlay.tsx').PlayerStateOverlay;
    const rendered = overlay({state: 'preparing'});
    assert.ok(nodes(rendered, 'Text').some(node => node.props.children === 'Preparing source'));
    assert.equal(nodes(rendered, 'Spinner').length, orion || system ? 0 : 1);
  }
  const screen = read('apps/mobile/src/features/playback/PlayerScreen.tsx');
  assert.doesNotMatch(screen, /Animated\.|LayoutAnimation|entry.*setTimeout|setTimeout.*entry/);
});
