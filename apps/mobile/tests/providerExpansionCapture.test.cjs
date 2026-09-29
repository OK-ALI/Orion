'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLoader, cohortIds, readyNativeCandidate, sharedSources } = require('./helpers/providerExpansionCohortA.cjs');

function captureHarness() {
  let onCandidate;
  const released = [];
  const bound = [];
  const load = createLoader({
    'react-native': {
      Platform: { OS: 'android' },
      DeviceEventEmitter: { addListener: (_name, listener) => { onCandidate = listener; return { remove() {} }; } },
      NativeModules: {
        OrionDownloadCapture: {
          releaseSession: id => released.push(id),
          releaseJobContext() {},
          bindRequestContext: async (id, jobId) => { bound.push([id, jobId]); return { ok: true, requestContextId: 'opaque', expiresAt: Date.now() + 1000 }; },
        },
      },
    },
  });
  return {
    capture: load('apps/mobile/src/features/downloads/downloadCandidateCapture.ts'),
    registry: load(sharedSources),
    support: load('apps/mobile/src/features/playback/providerEmbedSupport.ts'),
    emit: payload => onCandidate(payload), released, bound,
  };
}

const sessionFor = (sourceId, suffix = '1') => ({
  playbackSessionId: `${sourceId}-${suffix}`, sourceId, providerClass: 'candidate', itemKey: 'movie:550',
  media: { schemaVersion: 1, id: 550, mediaType: 'movie', title: 'Test Movie', season: null, episode: null, libraryKind: 'movie' },
});

for (const id of cohortIds) {
  test(`${id} P102 observation cannot admit ready Direct/HLS/DASH media for download`, () => {
    const { capture, registry, support, emit, released, bound } = captureHarness();
    const policy = support.getProviderCapturePolicy(registry.getRegisteredSource(id));
    assert.equal(policy.captureEnabled, true);
    const session = { ...sessionFor(id), diagnosticOnly: policy.diagnosticOnly };
    const end = capture.beginMobileDownloadCaptureSessionV1(session);
    for (const kind of ['direct', 'hls', 'dash']) {
      const ready = readyNativeCandidate(session, kind);
      assert.equal(capture.normalizeMobileDownloadCandidateEventV1(ready, session), null);
      emit(ready);
      assert.deepEqual(capture.getMobileDownloadCandidateSnapshotsV1(), []);
      assert.equal(capture.getLatestMobileDownloadCandidateForItemV1(session.itemKey), null);
      for (const method of ['auto', 'fragments']) {
        for (const destination of ['orion-library', 'device-storage']) {
          assert.equal(capture.selectMobileDownloadCandidateForItemV1(session.itemKey, method, undefined, destination, id), null);
        }
      }
      assert.equal(capture.getMobileDownloadSourceResolutionStateV1(session.itemKey, id), 'empty');
    }
    end();
    assert.deepEqual(released, [session.playbackSessionId]);
    assert.deepEqual(bound, []);
    emit(readyNativeCandidate(session));
    assert.deepEqual(capture.getMobileDownloadCandidateSnapshotsV1(), []);
  });
}

test('diagnostic sessions release immediately during pending preparation and preserve qualified providers', () => {
  const { capture, emit, released } = captureHarness();
  const prepared = sessionFor('vixsrc');
  capture.requestMobileDownloadSourceResolutionV1(prepared.itemKey, 'auto', prepared.sourceId);
  const endPrepared = capture.beginMobileDownloadCaptureSessionV1(prepared);
  emit(readyNativeCandidate(prepared));
  assert.equal(capture.selectMobileDownloadCandidateForItemV1(prepared.itemKey).candidate.sourceId, 'vixsrc');
  endPrepared();
  assert.deepEqual(released, []);

  const diagnostic = { ...sessionFor('stellar'), diagnosticOnly: true };
  const endDiagnostic = capture.beginMobileDownloadCaptureSessionV1(diagnostic);
  emit(readyNativeCandidate(diagnostic));
  endDiagnostic();
  assert.deepEqual(released, [diagnostic.playbackSessionId]);
  assert.equal(capture.selectMobileDownloadCandidateForItemV1(prepared.itemKey).candidate.sourceId, 'vixsrc');
  assert.equal(capture.getMobileDownloadCandidateSnapshotsV1().length, 1);
  capture.cancelMobileDownloadSourceResolutionV1(prepared.itemKey);
  assert.deepEqual(released, [diagnostic.playbackSessionId, prepared.playbackSessionId]);
});

test('stale diagnostic cleanup releases its own context without disarming a newer capture', () => {
  const { capture, emit, released } = captureHarness();
  const diagnostic = { ...sessionFor('mapple'), diagnosticOnly: true };
  const endDiagnostic = capture.beginMobileDownloadCaptureSessionV1(diagnostic);
  const replacement = { ...sessionFor('vixsrc', 'replacement'), itemKey: 'movie:551' };
  const endReplacement = capture.beginMobileDownloadCaptureSessionV1(replacement);
  endDiagnostic();
  assert.deepEqual(released, [diagnostic.playbackSessionId]);
  emit(readyNativeCandidate(diagnostic));
  assert.deepEqual(capture.getMobileDownloadCandidateSnapshotsV1(), []);
  emit(readyNativeCandidate(replacement));
  assert.equal(capture.selectMobileDownloadCandidateForItemV1(replacement.itemKey).candidate.sourceId, 'vixsrc');
  endReplacement();
  assert.deepEqual(released, [diagnostic.playbackSessionId, replacement.playbackSessionId]);
});

test('legacy captures retain their accepted behavior when diagnosticOnly is absent or false', () => {
  const { capture, emit, released } = captureHarness();
  for (const diagnosticOnly of [undefined, false]) {
    const session = { ...sessionFor('vixsrc', String(diagnosticOnly)), diagnosticOnly };
    const end = capture.beginMobileDownloadCaptureSessionV1(session);
    const ready = readyNativeCandidate(session);
    assert.notEqual(capture.normalizeMobileDownloadCandidateEventV1(ready, session), null);
    emit(ready);
    assert.equal(capture.selectMobileDownloadCandidateForItemV1(session.itemKey).candidate.sourceId, 'vixsrc');
    end();
    assert.deepEqual(capture.getMobileDownloadCandidateSnapshotsV1(), []);
  }
  assert.equal(released.length, 2);
});
