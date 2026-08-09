const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const protocol = require(path.resolve(__dirname, '../../../packages/shared/src/smartConnectProtocol.cjs'));

test('protocol v3 normalizes observable playback without inventing timing', () => {
  assert.equal(protocol.SMART_CONNECT_PROTOCOL_VERSION, 3);
  const value = protocol.normalizePlaybackTelemetry({
    sessionId: 'movie-7', currentTime: 12.5, duration: 100, state: 'playing',
    volume: 0.8, canSeek: true, observedAt: 1000,
  }, 4);
  assert.equal(value.sequence, 5);
  assert.equal(value.currentTime, 12.5);
  assert.equal(value.canSeek, true);
});

test('unobservable playback cannot claim measured seeking', () => {
  const value = protocol.normalizePlaybackTelemetry({ state: 'unobservable', canSeek: true });
  assert.equal(value.currentTime, null);
  assert.equal(value.duration, null);
  assert.equal(value.canSeek, false);
});

test('freshness expires after the Smart Connect telemetry budget', () => {
  assert.equal(protocol.telemetryFreshness({ observedAt: 1000 }, 2400).fresh, true);
  assert.equal(protocol.telemetryFreshness({ observedAt: 1000 }, 2600).fresh, false);
});
