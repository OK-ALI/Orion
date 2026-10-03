const test = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers/animeModules.cjs');
const { memoryStorage, libraryFixture } = require('./helpers/sourceContinuityHarness.cjs');
const { hookHarness } = require('./helpers/playerHookHarness.cjs');
const { jsx } = require('./helpers/sourceContinuityHarness.cjs');
const load = loader({ '../../services/sourceHealth': { getMobileSourceHealth: () => ({ state: 'failed', cooldownUntil: Date.now() + 900000 }), getMobileSourceHealthV2: () => null } });
const affinity = load('apps/mobile/src/features/library/sourceAffinity.ts');
const mobile = load('apps/mobile/src/features/playback/mobileSources.ts');
const record = (patch = {}) => ({ item: { id: 9, title: 'Scandal' }, mediaType: 'tv', season: 1, episode: 5,
  sourceId: 'vidlink', currentTime: 1122, duration: 3000, evidence: 'provider-message', sessionId: 'successful', ...patch });

test('successful manual sources restore despite automaticTarget=false and unrelated health; Auto stays sealed', () => {
  for (const id of ['vidlink', 'vidnest', 'cinesrc', 'vidsrc-ir', '111movies']) {
    assert.equal(mobile.getMobileSourceContinuityCapability(id).automaticTarget, false);
    for (const type of ['movie', 'tv']) assert.equal(mobile.getPreferredMobileResumeSource(id, type), id);
  }
  assert.equal(mobile.getPreferredMobileResumeSource('aniembed', 'tv'), 'aniembed');
  assert.equal(mobile.getPreferredMobileResumeSource('aniembed', 'movie'), 'vixsrc');
  for (const id of ['invalid', 'videasy', 'vsembed', 'allmanga', 'anilink', 'dropfile']) {
    assert.equal(mobile.getPreferredMobileResumeSource(id, 'tv'), 'vixsrc');
  }
  assert.deepEqual(mobile.MOBILE_PLAYER_SOURCES.map(s => s.id), ['vixsrc', 'vidsrc', 'vidlink', 'vidnest', 'vidsrc-ir', 'cinesrc', '111movies']);
  assert.equal(mobile.mobileSourceSupportsContinuity('vidlink'), false);
  assert.equal(mobile.mobileSourceSupportsContinuity('aniembed'), false);
  assert.equal(mobile.getNextMobileContinuitySource('vidlink', 'tv', []), 'vixsrc');
});

test('real verified Library writer preserves movie provider through Continue, Resume, Start Over and Replay', async () => {
  const f = libraryFixture();
  f.library.recordPlayback(record({ mediaType: 'movie', season: null, episode: null })); await f.harness.settle();
  const entry = f.library.getContinueWatching()[0];
  assert.equal(entry.progress.mediaIdentity.id, 9); assert.equal(entry.progress.sourceId, 'vidlink');
  const progress = f.library.getPlaybackProgress('movie', 9);
  const preference = f.library.getPlaybackSourcePreference('movie', 9);
  const choice = load('apps/mobile/src/features/playback/resumeChoice.ts');
  for (const [action, position] of [['resume', 1122], ['start-over', 0], ['replay-30', 1092]]) {
    assert.equal(mobile.getPreferredMobileResumeSource(preference.sourceId, 'movie'), 'vidlink');
    assert.equal(choice.resolveResumeChoiceTime(action, progress.currentTime), position);
  }
  f.harness.dispose();
  const reopened = libraryFixture(f.storage);
  assert.deepEqual(reopened.library.getPlaybackSourcePreference('movie', 9), { sourceId: 'vidlink' });
  reopened.harness.dispose();
});

test('series preference crosses next/previous/direct episodes and later seasons without copying position', async () => {
  const f = libraryFixture(); f.library.recordPlayback(record()); await f.harness.settle();
  for (const [season, episode] of [[1, 4], [1, 6], [1, 20], [2, 1]]) {
    assert.deepEqual(f.library.getPlaybackSourcePreference('tv', 9), { sourceId: 'vidlink' });
    assert.equal(f.library.getPlaybackProgress('tv', 9, season, episode), null);
  }
  assert.equal(f.library.getPlaybackProgress('tv', 9, 1, 5).currentTime, 1122);
  f.library.recordPlayback(record({ item: { id: 10, title: 'Moving' }, sourceId: 'vixsrc' }));
  f.library.recordPlayback(record({ mediaType: 'movie', item: { id: 9, title: 'Movie A' }, season: null, episode: null, sourceId: 'cinesrc' }));
  await f.harness.settle();
  assert.equal(f.library.getPlaybackSourcePreference('tv', 9).sourceId, 'vidlink');
  assert.equal(f.library.getPlaybackSourcePreference('tv', 10).sourceId, 'vixsrc');
  assert.equal(f.library.getPlaybackSourcePreference('movie', 9).sourceId, 'cinesrc');
  assert.equal(f.library.getPlaybackSourcePreference('tv', 11), null);
  f.harness.dispose();
});

test('opening/tapping/unverified evidence cannot replace success; transient failure does not erase it', async () => {
  const f = libraryFixture(); f.library.recordPlayback(record()); await f.harness.settle();
  for (const patch of [{ evidence: 'opened-only' }, { evidence: null }, { sessionId: null }, { evidence: 'manual-watched' }]) {
    f.library.recordPlayback(record({ sourceId: 'vixsrc', ...patch }));
  }
  await f.harness.settle();
  assert.equal(f.library.getPlaybackSourcePreference('tv', 9).sourceId, 'vidlink');
  assert.equal(f.library.getPlaybackProgress('tv', 9, 1, 5).currentTime, 1122);
  assert.equal(mobile.getPreferredMobileResumeSource('vidlink', 'tv'), 'vidlink');
  f.harness.dispose();
});

for (const variant of ['sub', 'dub']) test(`Anime ${variant} shares the verified library authority; successful General replaces it`, async () => {
  const f = libraryFixture();
  f.library.recordPlayback(record({ sourceId: 'aniembed', sourceVariant: variant })); await f.harness.settle();
  assert.deepEqual(f.library.getPlaybackSourcePreference('tv', 9), { sourceId: 'aniembed', variant });
  assert.equal(f.library.getPlaybackProgress('tv', 9, 1, 5).sourceVariant, variant);
  const reopened = libraryFixture(f.storage);
  assert.deepEqual(reopened.library.getPlaybackSourcePreference('tv', 9), { sourceId: 'aniembed', variant });
  reopened.library.recordPlayback(record({ sourceId: 'vidlink' })); await reopened.harness.settle();
  assert.deepEqual(reopened.library.getPlaybackSourcePreference('tv', 9), { sourceId: 'vidlink' });
  f.harness.dispose(); reopened.harness.dispose();
});

test('completion removes episode progress without losing source; verified history migrates as fallback', async () => {
  const f = libraryFixture(); f.library.recordPlayback(record({ currentTime: 3000, completionVerified: true })); await f.harness.settle();
  assert.equal(f.library.getPlaybackProgress('tv', 9, 1, 5), null);
  assert.deepEqual(f.library.getPlaybackSourcePreference('tv', 9), { sourceId: 'vidlink' });
  f.storage.remove('sourceAffinityV1');
  assert.deepEqual(f.library.getPlaybackSourcePreference('tv', 9), { sourceId: 'vidlink' });
  f.harness.dispose();
});

test('profile isolation, durable/latest legacy precedence and bounded malformed/private payload rejection', () => {
  const first = memoryStorage(), second = memoryStorage();
  const old = { mediaIdentity: { id: 9, mediaType: 'tv' }, sourceId: 'vixsrc', evidence: 'provider-message', sessionId: 'old', lastPlayedAt: 100 };
  const newer = { id: 9, media_type: 'tv', sourceId: 'vidlink', evidence: 'provider-message', sessionId: 'new', updatedAt: 200 };
  assert.deepEqual(affinity.resolveSourcePreference(first, 'tv', 9, { old }, [newer]), { sourceId: 'vidlink' });
  assert.equal(affinity.rememberSourcePreference(first, 'tv', 9, { sourceId: 'cinesrc', secret: 'NO', url: 'PRIVATE' }, 'provider-message', 'current', 300), true);
  assert.deepEqual(affinity.resolveSourcePreference(first, 'tv', 9, { old }, [newer]), { sourceId: 'cinesrc' });
  assert.equal(affinity.resolveSourcePreference(second, 'tv', 9, {}, []), null);
  assert.doesNotMatch(first.get('sourceAffinityV1'), /PRIVATE|secret|NO|episode|season/);
  for (const patch of [{ sourceId: 'allmanga', variant: 'sub' }, { sourceId: 'aniembed', variant: 'raw' }, { sourceId: 'invalid' }]) {
    assert.equal(affinity.rememberSourcePreference(first, 'tv', 9, patch, 'provider-message', 'session', 400), false);
  }
  assert.equal(affinity.rememberSourcePreference(first, 'tv', 9, { sourceId: 'vidlink' }, 'provider-message', 'session', 200), false);
  for (const raw of ['{', '{}', 'x'.repeat(40001), '[null]', '[{"key":"tv:9","sourceId":"allmanga","updatedAt":1}]']) {
    second.set('sourceAffinityV1', raw); assert.equal(affinity.resolveSourcePreference(second, 'tv', 9, { malformed: null }, [null]), null);
  }
});

test('legacy Anime variant can migrate only with matching verified profile-local playback evidence', () => {
  const storage = memoryStorage(), legacy = { sourceId: 'aniembed', variant: 'dub' };
  assert.equal(affinity.resolveSourcePreference(storage, 'tv', 9, {}, [], legacy), null);
  const playback = { id: 9, media_type: 'tv', sourceId: 'aniembed', evidence: 'provider-video-event', sessionId: 'legacy' };
  assert.deepEqual(affinity.resolveSourcePreference(storage, 'tv', 9, {}, [playback], legacy), legacy);
  assert.equal(affinity.resolveSourcePreference(storage, 'tv', 10, {}, [playback], legacy), null);
});

function playerRouteFixture(library, initialRoute) {
  const harness = hookHarness(); let route = initialRoute;
  const general = { phase: 'general', selection: null, detail: null, error: null, manualGeneral() {}, recordSuccess() {}, prepare() {}, activate: () => false, retry() {} };
  const loadPlayer = loader({ react: harness.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { View: 'View' },
    'expo-router': { useLocalSearchParams: () => route, useRouter: () => ({ back() {}, replace() {} }) },
    '@orion/shared/api': { tmdbFetch: async () => ({ imdb_id: null }) },
    '../../context/LibraryContext': { useLibraryPlaybackActions: () => library.library },
    '../../services/sourceHealth': { getMobileSourceHealth: () => null, getMobileSourceHealthV2: () => null, hydrateMobileSourceHealth() {} },
    '../../services/mobileDiagnostics': { reportMobileDiagnosticError() {}, updateMobileDiagnostics() {} },
    './EmbedPlayerSurface': { EmbedPlayerSurface: 'EmbedPlayerSurface' }, './AnimeSourceChoices': { AnimeSourceChoices: 'AnimeSourceChoices' },
    './useAnimeSource': { useAnimeSource: () => general }, './animeSourceAffinity': { clearAnimeFlowChoice() {} },
    './OrionFinalizedPlayerActivitySurface': { OrionFinalizedPlayerActivitySurface: 'FinalizedPlayer' },
    './OrionOfflinePlayerSurface': { OrionOfflinePlayerSurface: 'OfflinePlayer' },
    '../downloads/nativeDownloadEngine': {}, './ResumePlaybackPrompt': { ResumePlaybackPrompt: 'ResumePlaybackPrompt' },
    '../downloads/downloadCandidateCapture': { getMobileDownloadSourceResolutionIntentV1: () => null },
    './MobilePlayerController': { MobilePlayerControllerProvider: 'Controller', useMobilePlayerController() {} },
    './NextEpisodePrompt': { NextEpisodePrompt: 'NextEpisodePrompt' },
    '../../components/player/PlayerStateOverlay': { PlayerStateOverlay: 'PlayerStateOverlay' },
    './usePlayerOrientation': { usePlayerOrientation: () => ({ isLandscape: true, toggleOrientation() {}, releaseOrientation: async () => {} }) } });
  harness.start(loadPlayer('apps/mobile/src/features/playback/PlayerScreen.tsx').default, {});
  function find(name, tree) {
    if (arguments.length === 1) tree = harness.result;
    if (!tree || typeof tree !== 'object') return null;
    if (tree.type === name) return tree.props;
    for (const child of [tree.props?.children].flat(Infinity)) { const match = find(name, child); if (match) return match; }
    return null;
  }
  return { harness, find, update(next) { route = next; harness.update({}); } };
}
for (const type of ['movie', 'tv']) for (const [choice, time] of [['resume', 1122], ['replay-30', 1092], ['start-over', 0]]) {
  test(`real Continue route -> ${type} Player ${choice} retains successful VidLink and the exact position`, async () => {
    const f = libraryFixture(); f.library.recordPlayback(record({ mediaType: type, season: type === 'tv' ? 1 : null, episode: type === 'tv' ? 5 : null }));
    await f.harness.settle(); const identity = f.library.getContinueWatching()[0].progress.mediaIdentity;
    const p = playerRouteFixture(f, { id: String(identity.id), type: identity.mediaType, title: identity.title,
      season: identity.season ? String(identity.season) : undefined, episode: identity.episode ? String(identity.episode) : undefined });
    await p.harness.settle(); assert.equal(p.find('EmbedPlayerSurface'), null);
    p.find('ResumePlaybackPrompt').onChoose(choice); await p.harness.settle();
    const surface = p.find('EmbedPlayerSurface'); assert.equal(surface.sourceId, 'vidlink'); assert.equal(surface.initialResumeTime, time);
    assert.equal(Boolean(surface.activeHandoffId), time > 0);
    assert.match(surface.embedUrl, type === 'tv' ? /\/tv\/9\/1\/5/ : /\/movie\/9/);
    if (time > 0) {
      const session = { sessionId: 'target', sourceId: 'vidlink', evidence: 'provider-video-event', duration: 3000, state: 'seeking', currentTime: time, observedAt: Date.now() };
      surface.onPlaybackSnapshot(session); await p.harness.settle();
      p.find('EmbedPlayerSurface').onPlaybackSnapshot({ ...session, state: 'playing', currentTime: time + 2, observedAt: session.observedAt + 10 });
      await p.harness.settle(); assert.equal(p.find('EmbedPlayerSurface').activeHandoffId, null);
    }
    p.harness.dispose(); f.harness.dispose();
  });
}
test('same mounted Player direct later-season route cannot render the old episode timestamp even for one frame', async () => {
  const f = libraryFixture(); f.library.recordPlayback(record()); await f.harness.settle();
  const p = playerRouteFixture(f, { id: '9', type: 'tv', title: 'Scandal', season: '1', episode: '5' });
  p.find('ResumePlaybackPrompt').onChoose('resume'); await p.harness.settle();
  p.update({ id: '9', type: 'tv', title: 'Scandal', season: '2', episode: '1' });
  assert.equal(p.find('EmbedPlayerSurface'), null, 'new identity waits for its own position reset before mounting');
  await p.harness.settle();
  const surface = p.find('EmbedPlayerSurface'); assert.equal(surface.sourceId, 'vidlink'); assert.equal(surface.initialResumeTime, 0);
  assert.match(surface.embedUrl, /\/tv\/9\/2\/1/); assert.equal(surface.activeHandoffId, null);
  p.harness.dispose(); f.harness.dispose();
});

test('manual General recovery with no mounted/verified position starts the chosen source without a false Resume failure', async () => {
  const f = libraryFixture(), p = playerRouteFixture(f, { id: '9', type: 'tv', title: 'Title', season: '1', episode: '1' });
  assert.equal(p.find('EmbedPlayerSurface'), null, 'IMDb provider waits for catalog identity before its sole mount');
  assert.equal(p.find('PlayerStateOverlay').state, 'preparing');
  await p.harness.settle();
  const source = p.find('EmbedPlayerSurface'); assert.equal(source.sourceId, 'vixsrc');
  assert.equal(source.onSourceChange('vidlink', null, 'manual'), true); await p.harness.settle();
  const recovery = p.find('EmbedPlayerSurface'); assert.equal(recovery.sourceId, 'vidlink'); assert.equal(recovery.initialResumeTime, 0);
  assert.equal(recovery.activeHandoffId, null); assert.equal(recovery.continuityError, undefined); assert.match(recovery.embedUrl, /\/tv\/9\/1\/1/);
  assert.equal(f.library.getPlaybackSourcePreference('tv', 9), null, 'manual tapping alone is not a durable preference');
  p.harness.dispose(); f.harness.dispose();
});
