const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loader } = require('./helpers/animeModules.cjs');
const { clock, nodes, playbackFixture } = require('./helpers/postPhysicalPlaybackHarness.cjs');
const { libraryFixture, memoryStorage } = require('./helpers/sourceContinuityHarness.cjs');
const { vidsrcIrFrameHost } = require('./helpers/vidsrcIrFrameHarness.cjs');
const load = loader();
const registry = load('packages/shared/src/sources/registry.ts');
const { getMobileEmbedResumeParams } = load('apps/mobile/src/features/playback/providerEmbedSupport.ts');
const movie = { id: '9', type: 'movie', title: 'Movie' }, duration = 8000;
const incoming = ['vixsrc', 'vidlink', 'vidnest', 'vidsrc-ir', 'cinesrc', '111movies'];
const choices = [['resume', 1200], ['replay-30', 1170], ['start-over', 0]];
const surfaceProps = (f, name) => nodes(f.surface.result, name)[0]?.props;
async function openSources(f) {
  surfaceProps(f, 'EmbeddedPlayerHud').onSources(); await f.settle();
  return surfaceProps(f, 'SourcesSheet');
}
async function advance(f, time, positions) {
  for (const position of positions) { time.tick(1000); await f.emit('playing', position, duration); }
}
async function switchChoice(f, time, sourceId, choice) {
  (await openSources(f)).onSelect(sourceId); await f.settle();
  const prompt = surfaceProps(f, 'ResumePlaybackPrompt');
  assert.ok(prompt, 'Existing Orion Resume sheet must be reached');
  assert.equal(prompt.savedTime, 1200, 'Use current verified position, not an older saved target');
  assert.equal(f.props.sourceId === sourceId, false, 'Choosing a row alone must not change source');
  prompt.onChoose(choice); await f.settle(); time.tick(240); await f.settle();
  return prompt;
}
function saved(sourceId, position) {
  const storage = memoryStorage(), seed = libraryFixture(storage);
  seed.library.recordPlayback({ item: { id: 9, title: movie.title }, mediaType: 'movie', sourceId,
    currentTime: position, duration, sessionId: 'saved', evidence: 'provider-message' });
  seed.harness.dispose(); return storage;
}

for (const sourceId of incoming) for (const [choice, target] of choices) {
  test(`${sourceId}: manual switch → existing sheet → ${choice} retains the selected target`, async () => {
    const time = clock(), from = sourceId === 'vixsrc' ? 'vidlink' : 'vixsrc';
    const f = playbackFixture({ ...movie, nextSourceId: from }, memoryStorage());
    try {
      await f.settle(); await advance(f, time, [1198, 1199, 1200]);
      const prompt = await switchChoice(f, time, sourceId, choice);
      assert.equal(prompt.continuityMode, 'seamless');
      assert.equal(f.props.sourceId, sourceId); assert.equal(f.props.initialResumeTime, target);
      assert.equal(f.props.forceStartFromBeginning, target === 0);
      assert.equal(f.library.library.getPlaybackSourcePreference('movie', 9).sourceId, from,
        'Affinity must not change merely because a provider was tapped');
      const url = f.props.embedUrl, mounts = f.mounted, view = surfaceProps(f, 'WebView');
      const params = new URL(url).searchParams;
      if (['vixsrc', 'vidnest', 'vidsrc-ir'].includes(sourceId)) assert.equal(params.get('startAt'), String(target));
      if (sourceId === 'cinesrc') assert.equal(params.has('t'), false, 'CineSrc retains its sole command owner');
      await advance(f, time, [target, target + 1, target + 2, target + 3]);
      assert.equal(f.props.activeHandoffId, null); assert.equal(f.props.continuityError, undefined);
      assert.equal(f.library.library.getPlaybackSourcePreference('movie', 9).sourceId, sourceId);
      time.tick(12000); await f.emit('playing', target + 15, duration);
      assert.equal(f.library.library.getPlaybackProgress('movie', 9).currentTime, target + 15);
      assert.equal(f.props.initialResumeTime, target); assert.equal(f.props.embedUrl, url); assert.equal(f.mounted, mounts);
      assert.equal(surfaceProps(f, 'WebView').shieldSessionId, view.shieldSessionId);
      assert.equal(surfaceProps(f, 'WebView').key, view.key);
      if (sourceId === 'cinesrc') assert.equal(f.injections.filter(s => s.includes('ORION_RESUME_RESULT')).length, 1);
    } finally { f.dispose(); time.restore(); }
  });
}

test('VidSrc outgoing-only still reaches the same sheet, preserves its restriction and starts at zero', async () => {
  const time = clock(), f = playbackFixture(movie, memoryStorage());
  try {
    await f.settle(); await advance(f, time, [1198, 1199, 1200]);
    const prompt = await switchChoice(f, time, 'vidsrc', 'start-over');
    assert.equal(prompt.continuityMode, 'outgoing-only'); assert.equal(f.props.initialResumeTime, 0);
    assert.equal(f.props.activeHandoffId, null); assert.equal(new URL(f.props.embedUrl).searchParams.has('startAt'), false);
  } finally { f.dispose(); time.restore(); }
});

test('canceling the existing switch sheet leaves the current source, progress and session intact', async () => {
  const time = clock(), f = playbackFixture(movie, memoryStorage());
  try {
    await f.settle(); await advance(f, time, [1198, 1199, 1200]);
    const view = surfaceProps(f, 'WebView'); (await openSources(f)).onSelect('vidnest'); await f.settle();
    surfaceProps(f, 'ResumePlaybackPrompt').onCancel(); await f.settle();
    assert.equal(f.props.sourceId, 'vixsrc'); assert.equal(surfaceProps(f, 'WebView').shieldSessionId, view.shieldSessionId);
    assert.equal(f.library.library.getPlaybackProgress('movie', 9).currentTime, 1200);
  } finally { f.dispose(); time.restore(); }
});

test('explicit zero uses each existing URL contract while ordinary opening, positive Resume and command seeking stay intact', () => {
  for (const sourceId of registry.ALL_CINEMA_SOURCES.map(s => s.id)) for (const type of ['movie', 'tv']) {
    for (const position of [0, 600, 570]) assert.deepEqual(getMobileEmbedResumeParams(sourceId, position, type),
      sourceId === 'cinesrc' ? {} : registry.getSourceResumeParams(sourceId, position, type));
    assert.deepEqual(getMobileEmbedResumeParams(sourceId, 600, type, true), getMobileEmbedResumeParams(sourceId, 600, type));
  }
  assert.deepEqual(getMobileEmbedResumeParams('vidsrc-ir', 0, 'movie', true), { startAt: 0 });
  assert.deepEqual(getMobileEmbedResumeParams('vidsrc-ir', 0, 'tv', true), { startAt: 0 });
  assert.deepEqual(getMobileEmbedResumeParams('vidnest', 0, 'tv', true), { progress: 0 });
  assert.deepEqual(getMobileEmbedResumeParams('cinesrc', 0, 'movie', true), {});
  assert.deepEqual(getMobileEmbedResumeParams('vidsrc', 0, 'movie', true), {});
});

test('VidSrc.ir saved progress → Start Over sends explicit zero through the selected-frame bridge and persists natural forward progress', async () => {
  const time = clock(), storage = saved('vidsrc-ir', 6580), f = playbackFixture(movie, storage); let reopened;
  try {
    f.find('ResumePlaybackPrompt').onChoose('start-over'); await f.settle();
    assert.equal(f.props.sourceId, 'vidsrc-ir'); assert.equal(f.props.initialResumeTime, 0);
    assert.equal(f.props.forceStartFromBeginning, true); assert.equal(f.props.activeHandoffId, null);
    const url = f.props.embedUrl, mounts = f.mounted, view = surfaceProps(f, 'WebView');
    assert.equal(new URL(url).searchParams.get('startAt'), '0');
    assert.equal(view.source.uri, url, 'Preserve the accepted direct top-level VidSrc.ir topology');
    const p = vidsrcIrFrameHost(view.injectedJavaScriptBeforeContentLoaded,
      raw => surfaceProps(f, 'WebView').onMessage({ nativeEvent: { data: raw } }), url);
    const event = position => ({ type: 'PLAYER_EVENT', data: { player_info: { tmdb: 9, mediaType: 'movie' },
      player_status: 'playing', player_progress: position, player_duration: duration } });
    for (const position of [0, 5.4, 10.8, 16.2]) { time.tick(5400); p.send(event(position)); await f.settle(); }
    assert.equal(f.library.library.getPlaybackProgress('movie', 9).currentTime, 16.2);
    assert.equal(f.props.initialResumeTime, 0); assert.equal(f.props.embedUrl, url); assert.equal(f.mounted, mounts);
    assert.equal(surfaceProps(f, 'WebView').shieldSessionId, view.shieldSessionId);
    p.send(event(6580), 'https://unrelated.example'); await f.settle();
    assert.equal(f.library.library.getPlaybackProgress('movie', 9).currentTime, 16.2);
    f.dispose(); reopened = playbackFixture(movie, storage); await reopened.settle();
    assert.equal(reopened.props.initialResumeTime, 16.2, 'Reopen uses the new beginning progress, never the old target');
  } finally { f.dispose(); reopened?.dispose(); time.restore(); }
});

test('TV switching uses only current-episode progress and preserves series affinity across subsequent episodes and seasons', async () => {
  const time = clock(), storage = memoryStorage(), route = { id: '10', type: 'tv', title: 'Series', season: '1', episode: '5' };
  const seed = libraryFixture(storage);
  seed.library.recordPlayback({ item: { id: 10, title: 'Series' }, mediaType: 'tv', season: 1, episode: 4,
    sourceId: 'vixsrc', currentTime: 500, duration, sessionId: 'previous', evidence: 'provider-message' }); seed.harness.dispose();
  const f = playbackFixture(route, storage);
  try {
    await f.settle(); await advance(f, time, [1198, 1199, 1200]);
    await switchChoice(f, time, 'vidnest', 'resume');
    assert.equal(new URL(f.props.embedUrl).searchParams.get('progress'), '1200');
    await advance(f, time, [1200, 1201, 1202, 1203]);
    assert.equal(f.library.library.getPlaybackSourcePreference('tv', 10).sourceId, 'vidnest');
    assert.equal(f.library.library.getPlaybackProgress('tv', 10, 1, 4).currentTime, 500);
    assert.equal(f.library.library.getPlaybackProgress('tv', 10, 1, 5).currentTime, 1203);
    for (const next of [{ season: '1', episode: '6' }, { season: '2', episode: '1' }]) {
      f.update({ ...route, ...next }); await f.settle();
      assert.equal(f.props.sourceId, 'vidnest'); assert.equal(f.props.initialResumeTime, 0);
      assert.equal(f.props.forceStartFromBeginning, false); assert.equal(new URL(f.props.embedUrl).searchParams.has('progress'), false);
    }
  } finally { f.dispose(); time.restore(); }
});

test('CineSrc manual switch retains one command submission across readiness repetition, acknowledgement and forward playback', async () => {
  const time = clock(), f = playbackFixture(movie, memoryStorage());
  try {
    await f.settle(); await advance(f, time, [1198, 1199, 1200]); await switchChoice(f, time, 'cinesrc', 'resume');
    const listeners = new Map(), commands = [], native = [];
    const window = { location: { origin: 'https://cinesrc.st' }, postMessage: (data, origin) => commands.push({ data, origin }),
      ReactNativeWebView: { postMessage: raw => native.push(JSON.parse(raw)) },
      addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
      removeEventListener(name, fn) { listeners.get(name)?.delete(fn); } };
    const context = vm.createContext({ window, document: { querySelector: () => null }, Date, setTimeout, clearTimeout });
    await advance(f, time, [1, 2]);
    const scripts = f.injections.filter(s => s.includes('ORION_RESUME_RESULT')); assert.equal(scripts.length, 1);
    vm.runInContext(scripts[0], context);
    const send = (type, currentTime) => { for (const fn of [...(listeners.get('message') || [])]) fn({
      source: window, origin: 'https://cinesrc.st', data: { type: `cinesrc:${type}`, currentTime, duration } }); };
    send('ready'); send('loadedmetadata'); time.tick(4000); send('ready');
    assert.equal(commands.length, 1); assert.equal(commands[0].data.command, 'seek');
    assert.deepEqual([...commands[0].data.args], [1200]); assert.equal(commands[0].origin, 'https://cinesrc.st');
    send('seeked', 1200); time.tick(10000); send('ready');
    assert.equal(commands.length, 1); assert.equal(native.filter(m => m.status === 'applied').length, 1);
    await advance(f, time, [1200, 1201, 1202, 1203]);
    assert.equal(f.props.continuityError, undefined); assert.equal(f.injections.filter(s => s.includes('ORION_RESUME_RESULT')).length, 1);
  } finally { f.dispose(); time.restore(); }
});
