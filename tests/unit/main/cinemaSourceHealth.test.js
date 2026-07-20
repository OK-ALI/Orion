const test = require("node:test");
const assert = require("node:assert/strict");
const { createSourceHealthStore, cleanText } = require("../../../src/main/player/sources/healthStore");

test("Cinema source health requires repeated failures before cooldown", () => {
  let time = 1_000;
  const store = createSourceHealthStore({ now: () => time });
  const first = store.record({ sourceId: "vidsrc", mediaType: "movie", state: "failed", reasonCode: "startup-timeout" });
  assert.equal(first.consecutiveFailures, 1);
  assert.equal(store.isCoolingDown("vidsrc", "movie"), false);
  time += 100;
  const second = store.record({ sourceId: "vidsrc", mediaType: "movie", state: "failed", reasonCode: "startup-timeout" });
  assert.equal(second.consecutiveFailures, 2);
  assert.equal(store.isCoolingDown("vidsrc", "movie"), true);
});

test("successful evidence clears failure streak and cooldown", () => {
  let time = 2_000;
  const store = createSourceHealthStore({ now: () => time });
  store.record({ sourceId: "vidking", mediaType: "tv", state: "failed" });
  time += 10;
  store.record({ sourceId: "vidking", mediaType: "tv", state: "failed" });
  time += 10;
  const ready = store.record({ sourceId: "vidking", mediaType: "tv", state: "ready", startupMs: 3210 });
  assert.equal(ready.consecutiveFailures, 0);
  assert.equal(ready.cooldownUntil, null);
  assert.equal(ready.startupMs, 3210);
});

test("health diagnostics redact URLs and sensitive query values", () => {
  const value = cleanText("Failed https://cdn.test/file.m3u8?token=secret&sig=abc");
  assert.equal(value.includes("cdn.test"), false);
  assert.equal(value.includes("secret"), false);
});

test("health records are separated by media type", () => {
  const store = createSourceHealthStore();
  store.record({ sourceId: "videasy", mediaType: "movie", state: "ready" });
  store.record({ sourceId: "videasy", mediaType: "tv", state: "failed" });
  assert.equal(store.get("videasy", "movie").state, "ready");
  assert.equal(store.get("videasy", "tv").state, "failed");
  assert.equal(store.list("tv").length, 1);
});
