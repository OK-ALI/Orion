const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createTrustState,
  privateAddress,
} = require("../../../src/main/smartConnect/secureTrust");

test("Smart Connect accepts only private LAN and loopback addresses", () => {
  assert.equal(privateAddress("192.168.1.20"), true);
  assert.equal(privateAddress("10.4.3.2"), true);
  assert.equal(privateAddress("172.20.2.1"), true);
  assert.equal(privateAddress("::ffff:127.0.0.1"), true);
  assert.equal(privateAddress("8.8.8.8"), false);
  assert.equal(privateAddress("172.15.2.1"), false);
});

test("socket tickets are short-lived and single-use", () => {
  const trust = createTrustState();
  const ticket = trust.createTicket("device-a", "connection-a");
  assert.equal(trust.consumeTicket(ticket.ticketId)?.deviceId, "device-a");
  assert.equal(trust.consumeTicket(ticket.ticketId), null);
});

test("command sequences are monotonic within one connection", () => {
  const trust = createTrustState();
  assert.equal(trust.acceptEnvelope("device-a", "connection-a", 1, "command-a").ok, true);
  const stale = trust.acceptEnvelope("device-a", "connection-a", 1, "command-b");
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, "STALE_SEQUENCE");
});

test("command IDs remain deduplicated after reconnect", () => {
  const trust = createTrustState();
  assert.equal(trust.acceptEnvelope("device-a", "connection-a", 1, "command-a").ok, true);
  const replayed = trust.acceptEnvelope("device-a", "connection-b", 1, "command-a");
  assert.equal(replayed.ok, false);
  assert.equal(replayed.duplicate, true);
  assert.equal(replayed.reason, "DUPLICATE_COMMAND");
  assert.equal(trust.acceptEnvelope("device-a", "connection-b", 1, "command-b").ok, true);
});

test("pairing requires confirmation from both devices", () => {
  const trust = createTrustState();
  const created = trust.beginTranscript({
    desktopInstanceId: "desktop-a",
    deviceId: "device-a",
    deviceName: "Living room phone",
    publicKey: "public-key",
    fingerprint: "fingerprint",
  });
  assert.equal(created.phrase.words.length, 4);
  assert.equal(trust.confirmTranscript(created.pairingId, "mobile").mobileConfirmed, true);
  const confirmed = trust.confirmTranscript(created.pairingId, "desktop");
  assert.equal(confirmed.desktopConfirmed, true);
  assert.equal(confirmed.mobileConfirmed, true);
});
