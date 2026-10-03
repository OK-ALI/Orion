const { loader } = require('./animeModules.cjs');
const { hookHarness } = require('./playerHookHarness.cjs');
const { libraryFixture } = require('./sourceContinuityHarness.cjs');
const jsx = (type, props, key) => ({ type, props: { ...props, ...(key == null ? {} : { key }) } });
function clock() {
  let now = 100000, sequence = 0; const timers = new Map();
  const original = [Date.now, global.setTimeout, global.clearTimeout];
  Date.now = () => now;
  global.setTimeout = (fn, delay) => { timers.set(++sequence, { fn, at: now + delay }); return sequence; };
  global.clearTimeout = id => timers.delete(id);
  return { tick(ms) { const end = now + ms; let next;
    while ((next = [...timers].sort((a, b) => a[1].at - b[1].at).find(([, value]) => value.at <= end))) {
      now = next[1].at; timers.delete(next[0]); next[1].fn();
    } now = end;
  }, restore() { [Date.now, global.setTimeout, global.clearTimeout] = original; } };
}
function nodes(tree, name, result = []) {
  if (!tree || typeof tree !== 'object') return result;
  if (tree.type === name || tree.type?.name === name) result.push(tree);
  for (const child of [tree.props?.children].flat(Infinity)) nodes(child, name, result);
  return result;
}
function playbackFixture(initialRoute, storage, animeOverrides = {}, fetchOverride) {
  const library = libraryFixture(storage), player = hookHarness();
  let route = initialRoute, surface = null, surfaceKey = null, mounted = 0, sequence = 0, sessionId = null, disposed = false;
  const navigation = [], failures = [], success = [], diagnostics = [], updates = [], injections = [], episodeRequests = [], traces = [], urlBuilds = [];
  const controller = { state: { overlay: 'none', hudState: 'hidden', presentation: 'fit', playback: { playing: false }, loadingState: null },
    setLoading(value) { controller.state.loadingState = value; }, registerSurface: () => () => {},
    updatePlayback(value) { controller.state.playback = value; controller.state.loadingState = value.state === 'buffering' ? 'buffering' : value.state === 'error' ? 'failed' : null; },
    openOverlay(value) { controller.state.overlay = value; }, closeOverlay() { controller.state.overlay = 'none'; }, reveal() {}, dismiss() {}, toggleChromeFromUserTap() {} };
  const general = { phase: 'general', selection: null, detail: null, error: null, manualGeneral() {}, recordSuccess() {}, prepare() {}, activate: () => false, retry() {}, ...animeOverrides };
  const diagnosticMock = { reportMobileDiagnosticError: value => diagnostics.push(value), updateMobileDiagnostics: value => updates.push(value), clearMobileDiagnosticError() {}, traceMobilePlayback: (event, value) => traces.push({ event, ...value }) };
  const api = { tmdbFetch: async path => {
    if (fetchOverride) return fetchOverride(path);
    if (path.includes('/season/')) { episodeRequests.push(path); return { episodes: [{ season_number: 1, episode_number: 6, name: 'Next episode', air_date: '2020-01-01' }] }; }
    return { imdb_id: null };
  } };
  const sources = loader()('packages/shared/src/sources/registry.ts');
  const loadPlayer = loader({ react: player.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { View: 'View' },
    '@orion/shared/sources': { ...sources, getSourceUrl: (...args) => { const url = sources.getSourceUrl(...args); urlBuilds.push(url); return url; } },
    'expo-router': { useLocalSearchParams: () => route, useRouter: () => ({ back() {}, replace: value => navigation.push(value) }) },
    '@orion/shared/api': api, '../../context/LibraryContext': { useLibraryPlaybackActions: () => library.library },
    '../../services/sourceHealth': { getMobileSourceHealth: () => null, getMobileSourceHealthV2: () => null, hydrateMobileSourceHealth() {} },
    '../../services/mobileDiagnostics': diagnosticMock,
    './EmbedPlayerSurface': { EmbedPlayerSurface: 'EmbedPlayerSurface' }, './AnimeSourceChoices': { AnimeSourceChoices: 'AnimeSourceChoices' },
    './useAnimeSource': { useAnimeSource: () => general }, './animeSourceAffinity': { clearAnimeFlowChoice() {} },
    './OrionFinalizedPlayerActivitySurface': { OrionFinalizedPlayerActivitySurface: 'FinalizedPlayer' },
    './OrionOfflinePlayerSurface': { OrionOfflinePlayerSurface: 'OfflinePlayer' },
    '../downloads/nativeDownloadEngine': { classifyNativeOfflinePlaybackV1: async () => ({ sourceKind: 'file' }) },
    './ResumePlaybackPrompt': { ResumePlaybackPrompt: 'ResumePlaybackPrompt' },
    '../downloads/downloadCandidateCapture': { getMobileDownloadSourceResolutionIntentV1: () => null },
    './MobilePlayerController': { MobilePlayerControllerProvider: 'Controller', useMobilePlayerController: () => controller },
    './NextEpisodePrompt': { NextEpisodePrompt: 'NextEpisodePrompt' },
    '../../components/player/PlayerStateOverlay': { PlayerStateOverlay: 'PlayerStateOverlay' },
    './usePlayerOrientation': { usePlayerOrientation: () => ({ isLandscape: true, toggleOrientation() {}, releaseOrientation: async () => {} }) } });
  player.start(loadPlayer('apps/mobile/src/features/playback/PlayerScreen.tsx').default, {});
  function reconcile() {
    const node = nodes(player.result, 'EmbedPlayerSurface')[0];
    if (!node) { surface?.dispose(); surface = null; surfaceKey = null; return; }
    if (surface && node.props.key === surfaceKey) { surface.update(node.props); return; }
    surface?.dispose(); surface = hookHarness(); surfaceKey = node.props.key; mounted++; sequence = 0;
    const loadSurface = loader({ react: surface.react, 'react/jsx-runtime': { jsx, jsxs: jsx },
      'react-native': { Platform: { OS: 'android' }, View: 'View', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 800, height: 450 }) },
      '../../components/player/SourcesSheet': { SourcesSheet: 'SourcesSheet' }, '../../components/player/PresentationSheet': { PresentationSheet: 'PresentationSheet' },
      '../../components/player/PlayerStateOverlay': { PlayerStateOverlay: 'PlayerStateOverlay' },
      '../../context/LibraryContext': { useLibraryPlaybackActions: () => library.library }, '../../services/mobileDiagnostics': diagnosticMock,
      '../../services/sourceHealth': { markMobileSourceFailure: (...args) => { failures.push(args); return { state: 'failed' }; },
        markMobileSourceSuccess: (...args) => { success.push(args); return { state: 'ready' }; } },
      './playbackRepository': { recordRecentOpen() {}, removeRecentOpen() {} }, './OrionCinemaWebView': { OrionCinemaWebView: 'WebView' },
      './subtitleDiscovery': { clearSubtitleSession() {}, getInternalSubtitleTrack: () => null }, './ResumePlaybackPrompt': { ResumePlaybackPrompt: 'ResumePlaybackPrompt' },
      './MobilePlayerController': { useMobilePlayerController: () => controller },
      './presentationPreferences': { getEmbeddedPresentationModes: () => ['fit', 'fill', 'provider'], getPresentationPreference: () => 'fit', savePresentationPreference() {} },
      './immersiveSystemUi': { usePlayerImmersiveSystemUi() {} }, './EmbeddedPlayerHud': { EmbeddedPlayerHud: 'EmbeddedPlayerHud' }, './ProviderControlsReturn': { ProviderControlsReturn: 'ProviderControlsReturn' },
      '../downloads/downloadCandidateCapture': { beginMobileDownloadCaptureSessionV1: () => () => {} }, '../downloads/useDownloadSourceAutoReturn': { useDownloadSourceAutoReturnV1() {} } });
    surface.start(loadSurface('apps/mobile/src/features/playback/EmbedPlayerSurface.tsx').EmbedPlayerSurface, node.props);
    const view = nodes(surface.result, 'WebView')[0]?.props;
    if (view) { sessionId = view.shieldSessionId; view.ref.current = { injectJavaScript: value => injections.push(value) }; }
  }
  async function settle() { await player.settle(); reconcile(); await surface?.settle(); await library.harness.settle(); }
  async function emit(state, currentTime, duration = 3000) {
    const props = nodes(player.result, 'EmbedPlayerSurface')[0].props;
    const origin = new URL(props.embedUrl).origin;
    nodes(surface.result, 'WebView')[0].props.onMessage({ nativeEvent: { data: JSON.stringify({
      type: 'ORION_PLAYBACK_TELEMETRY', sessionId, sourceId: props.sourceId, origin,
      sequence: ++sequence, evidence: 'provider-video-event', state, currentTime, duration, observedAt: Date.now(),
    }) } }); await settle();
  }
  reconcile();
  return { library, player, navigation, failures, success, diagnostics, updates, injections, episodeRequests, traces, urlBuilds, anime: general, emit, settle,
    get mounted() { return mounted; }, get surface() { return surface; },
    get props() { return nodes(player.result, 'EmbedPlayerSurface')[0]?.props; },
    find(name) { return nodes(player.result, name)[0]?.props; },
    update(next) { route = next; player.update({}); reconcile(); },
    dispose() { if (disposed) return; disposed = true; surface?.dispose(); player.dispose(); library.harness.dispose(); } };
}
module.exports = { clock, nodes, playbackFixture };
