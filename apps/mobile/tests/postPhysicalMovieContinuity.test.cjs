const test = require('node:test');
const assert = require('node:assert/strict');
const { clock, playbackFixture } = require('./helpers/postPhysicalPlaybackHarness.cjs');
const { libraryFixture, memoryStorage } = require('./helpers/sourceContinuityHarness.cjs');
const { loader } = require('./helpers/animeModules.cjs');
const policy = loader()('apps/mobile/src/features/playback/handoffPolicy.ts');
const movie = { id: '9', type: 'movie', title: 'Movie A' };
const save = (sourceId, id = 9, currentTime = 300) => ({ item: { id, title: `Movie ${id}` }, mediaType: 'movie', sourceId,
  currentTime, duration: 3000, sessionId: `verified-${id}`, evidence: 'provider-video-event' });

test('actual Movie player -> telemetry -> Library -> destroyed route -> Continue restores successful manual provider', async () => {
  const time = clock(), storage = memoryStorage(), f = playbackFixture(movie, storage);
  let reopened;
  try {
    await f.settle(); assert.equal(f.props.sourceId, 'vixsrc');
    assert.equal(f.props.onSourceChange('vidlink', null, 'manual'), true); await f.settle();
    await f.emit('playing', 1); time.tick(1000); await f.emit('playing', 2);
    time.tick(6000); await f.emit('playing', 300); f.dispose();
    const library = libraryFixture(storage);
    const entry = library.library.getContinueWatching()[0];
    assert.equal(entry.progress.sourceId, 'vidlink');
    assert.equal(library.library.getPlaybackSourcePreference('movie', 9).sourceId, 'vidlink');
    library.harness.dispose();
    reopened = playbackFixture({ ...movie, id: String(entry.progress.mediaIdentity.id) }, storage);
    assert.ok(reopened.find('ResumePlaybackPrompt'));
    reopened.find('ResumePlaybackPrompt').onChoose('resume'); await reopened.settle();
    assert.equal(reopened.props.sourceId, 'vidlink'); assert.equal(reopened.props.initialResumeTime, 300);
  } finally { f.dispose(); reopened?.dispose(); time.restore(); }
});

for (const provider of ['vidlink', 'cinesrc']) test(`slow manual Movie Resume settles after provisional timeout, persists ${provider} and reopens without VixSrc`, async () => {
  const time = clock(), storage = memoryStorage(), seed = libraryFixture(storage);
  seed.library.recordPlayback(save('vixsrc')); seed.harness.dispose();
  const f = playbackFixture(movie, storage); let reopened;
  try {
    f.find('ResumePlaybackPrompt').onChoose('start-over'); await f.settle();
    assert.equal(f.props.onSourceChange(provider, null, 'manual', 300), true); await f.settle();
    const transaction = f.props.activeHandoffId;
    time.tick(policy.HANDOFF_CONFIRMATION_TIMEOUT_MS); await f.settle();
    assert.match(f.props.continuityError, /saved position/); assert.equal(f.props.sourceId, provider);
    assert.equal(f.library.library.getPlaybackSourcePreference('movie', 9).sourceId, 'vixsrc');
    time.tick(1000); await f.emit('playing', 300);
    time.tick(1000); await f.emit('playing', 302);
    assert.match(f.props.continuityError, /saved position/, 'first verified target sample alone is insufficient');
    time.tick(1000); await f.emit('playing', 304);
    assert.equal(f.props.continuityError, undefined, 'late same-provider forward playback supersedes provisional timeout');
    assert.equal(f.props.activeHandoffId, null); assert.equal(f.props.sourceId, provider);
    time.tick(1000); await f.emit('playing', 306);
    assert.equal(f.library.library.getPlaybackProgress('movie', 9).sourceId, provider);
    assert.equal(f.library.library.getPlaybackSourcePreference('movie', 9).sourceId, provider);
    assert.deepEqual(f.failures, []); assert.ok(transaction); f.dispose();
    reopened = playbackFixture(movie, storage);
    reopened.find('ResumePlaybackPrompt').onChoose('resume'); await reopened.settle();
    assert.equal(reopened.props.sourceId, provider); assert.equal(reopened.props.initialResumeTime, 306);
  } finally { f.dispose(); reopened?.dispose(); time.restore(); }
});

test('target reached before deadline settles on late forward proof; playback at the wrong target cannot clear recovery', () => {
  const pending = policy.createPlaybackHandoff({ reason: 'return', fromSessionId: null, fromSourceId: 'vidlink',
    targetSourceId: 'vidlink', requestedTime: 300, strategy: 'verified-seek', now: 1000 });
  const reached = policy.confirmPlaybackHandoff(pending, { sourceId: 'vidlink', sessionId: 'same', currentTime: 300,
    observedAt: 12000, state: 'seeking' }, 12000);
  const timeout = policy.updateHandoffStatus(reached, 'unconfirmed', 'TARGET_NOT_CONFIRMED', 13000);
  const late = { sourceId: 'vidlink', sessionId: 'same', currentTime: 302, observedAt: 14000, state: 'playing' };
  assert.equal(policy.confirmPlaybackHandoff(timeout, late, 14000).status, 'confirmed');
  const unreached = policy.updateHandoffStatus(pending, 'unconfirmed', 'TARGET_NOT_CONFIRMED', 13000);
  assert.equal(policy.confirmPlaybackHandoff(unreached, { ...late, currentTime: 2 }, 14000), null);
});

for (const provider of ['vidlink', 'cinesrc']) test(`${provider} Movie startup waits for its existing seek instead of rejecting the initial loading position`, async () => {
  const time = clock(), storage = memoryStorage(), seed = libraryFixture(storage);
  seed.library.recordPlayback(save(provider)); seed.harness.dispose(); const f = playbackFixture(movie, storage);
  try {
    f.find('ResumePlaybackPrompt').onChoose('resume'); await f.settle(); time.tick(5000);
    await f.emit('playing', 1); time.tick(1000); await f.emit('playing', 2);
    assert.equal(f.props.continuityError, undefined); assert.ok(f.props.activeHandoffId);
    assert.equal(f.injections.filter(value => value.includes('ORION_RESUME_RESULT')).length, 1);
  } finally { f.dispose(); time.restore(); }
});

test('late reconciliation remains bounded, same-session/target/source-only and rejects definitive failure', () => {
  const pending = policy.createPlaybackHandoff({ reason: 'return', fromSessionId: null, fromSourceId: 'vidlink',
    targetSourceId: 'vidlink', requestedTime: 300, strategy: 'url-param', now: 1000 });
  const timedOut = policy.updateHandoffStatus(pending, 'unconfirmed', 'TARGET_NOT_CONFIRMED', 13000);
  const sample = { sourceId: 'vidlink', sessionId: 'target', currentTime: 300, state: 'playing', observedAt: 14000 };
  const reached = policy.confirmPlaybackHandoff(timedOut, sample, 14000);
  assert.ok(reached); assert.equal(reached.status, 'unconfirmed', 'provisional error is retained until forward proof');
  assert.equal(policy.confirmPlaybackHandoff(reached, { ...sample, currentTime: 302, observedAt: 15000 }, 15000).status, 'confirmed');
  for (const patch of [{ sourceId: 'vixsrc' }, { sessionId: 'other' }, { state: 'paused' }, { observedAt: 12000 }, { currentTime: 300 }]) {
    assert.equal(policy.confirmPlaybackHandoff(reached, { ...sample, currentTime: 302, observedAt: 15000, ...patch }, 15000), null);
  }
  for (const failureCode of ['SEEK_UNAVAILABLE', 'NO_CONFIRMED_TARGET']) {
    assert.equal(policy.confirmPlaybackHandoff({ ...timedOut, failureCode }, sample, 14000), null);
  }
  assert.equal(policy.confirmPlaybackHandoff(timedOut, { ...sample, observedAt: 15000 }, 100000), null, 'stale observations cannot recover a provisional handoff');
  assert.equal(policy.confirmPlaybackHandoff({ ...timedOut, reason: 'automatic' }, sample, 14000), null);
});

test('an initially missed URL target is provisional; later exact target plus same-session forward proof clears it', () => {
  const pending = policy.createPlaybackHandoff({ reason: 'return', fromSessionId: null, fromSourceId: 'vixsrc',
    targetSourceId: 'vixsrc', requestedTime: 300, strategy: 'url-param', now: 1000 });
  const sample = { sourceId: 'vixsrc', sessionId: 'mounted', currentTime: 2, state: 'playing', observedAt: 6000 };
  assert.equal(policy.handoffTargetMissedPosition(pending, sample, 6000), true);
  const missed = { ...policy.updateHandoffStatus(pending, 'unconfirmed', 'POSITION_NOT_RESTORED', 6000), targetSessionId: sample.sessionId };
  assert.equal(policy.confirmPlaybackHandoff(missed, { ...sample, currentTime: 300, sessionId: 'other', observedAt: 8000 }, 8000), null);
  const reached = policy.confirmPlaybackHandoff(missed, { ...sample, currentTime: 300, observedAt: 8000 }, 8000);
  assert.equal(reached.status, 'unconfirmed');
  assert.equal(policy.confirmPlaybackHandoff(reached, { ...sample, currentTime: 303, observedAt: 9000 }, 9000).status, 'confirmed');
  assert.equal(policy.confirmPlaybackHandoff({ ...missed, status: 'failed' }, { ...sample, currentTime: 300, observedAt: 8000 }, 8000), null);
});

test('Movie completion retains independent affinity and all Resume choices after route destruction', async () => {
  const time = clock(), storage = memoryStorage(), library = libraryFixture(storage);
  try {
    for (const [source, id] of [['vidlink', 9], ['cinesrc', 10], ['vixsrc', 11]]) library.library.recordPlayback(save(source, id));
    library.library.recordPlayback({ ...save('vidlink'), currentTime: 3000, completionVerified: true });
    await library.harness.settle(); assert.equal(library.library.getPlaybackProgress('movie', 9), null);
    for (const [source, id] of [['vidlink', 9], ['cinesrc', 10], ['vixsrc', 11]]) {
      const f = playbackFixture({ ...movie, id: String(id) }, storage);
      if (id !== 9) f.find('ResumePlaybackPrompt').onChoose('start-over');
      await f.settle(); assert.equal(f.props.sourceId, source); assert.equal(f.props.initialResumeTime, 0); f.dispose();
    }
  } finally { library.harness.dispose(); time.restore(); }
});

test('catalog preparation cannot spend the Resume deadline before a real source mounts', async () => {
  const time = clock(), storage = memoryStorage(), seed = libraryFixture(storage); let resolve;
  seed.library.recordPlayback(save('vidlink')); seed.harness.dispose();
  const f = playbackFixture(movie, storage, {}, () => new Promise(done => { resolve = done; }));
  try {
    f.find('ResumePlaybackPrompt').onChoose('start-over'); await f.settle();
    f.props.onSourceChange('vidsrc-ir', null, 'manual', 300); await f.settle();
    assert.equal(f.props, undefined); time.tick(15000); await f.settle();
    assert.equal(f.updates.filter(value => 'handoffState' in value).at(-1).handoffState, 'preparing');
    resolve({ imdb_id: 'tt1234567' }); await f.settle();
    assert.equal(f.props.sourceId, 'vidsrc-ir'); assert.equal(f.props.continuityError, undefined);
    assert.ok(f.props.activeHandoffId); assert.match(f.props.embedUrl, /tt1234567/);
    time.tick(1000); await f.emit('playing', 300); time.tick(1000); await f.emit('playing', 302);
    time.tick(1000); await f.emit('playing', 304); assert.equal(f.props.activeHandoffId, null);
  } finally { f.dispose(); time.restore(); }
});
