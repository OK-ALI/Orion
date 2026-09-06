const test = require("node:test");
const assert = require("node:assert/strict");
const { createReliableCommandScheduler } = require("../../../src/main/smartConnect/reliableCommandScheduler");

const entry = (id, sequence, revision = 1, action = "select", playbackProtocolVersion) => ({
  command: { id, sequence, action, playbackProtocolVersion },
  controllerRevision: revision,
  connectionId: "conn-a",
});

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("ordinary reliable commands execute strictly in enqueue order", async () => {
  const starts = [];
  const delivered = [];
  const resolvers = [];
  const scheduler = createReliableCommandScheduler({
    execute: (item) => new Promise((resolve) => { starts.push(item.command.id); resolvers.push(resolve); }),
    deliver: (item, result) => delivered.push([item.command.id, result.ok]),
  });

  scheduler.enqueue(entry("a", 1));
  scheduler.enqueue(entry("b", 2));
  await tick();
  assert.deepEqual(starts, ["a"]);
  resolvers.shift()({ id: "a", sequence: 1, ok: true });
  await tick();
  assert.deepEqual(starts, ["a", "b"]);
  resolvers.shift()({ id: "b", sequence: 2, ok: true });
  await tick();
  assert.deepEqual(delivered, [["a", true], ["b", true]]);
});

test("long protocol-v1 play is preempted instead of blocking the next reliable command", async () => {
  const starts = [];
  const delivered = [];
  const pending = new Map();
  const scheduler = createReliableCommandScheduler({
    isPreemptible: (item) => item.command.action === "play" && item.command.playbackProtocolVersion === 1,
    execute: (item) => new Promise((resolve) => { starts.push(item.command.id); pending.set(item.command.id, resolve); }),
    cancelActive: (item, reason) => pending.get(item.command.id)?.({ id: item.command.id, sequence: item.command.sequence, ok: false, error: reason }),
    deliver: (item, result) => delivered.push([item.command.id, result.ok, result.error]),
  });

  scheduler.enqueue(entry("play", 1, 1, "play", 1));
  await tick();
  scheduler.enqueue(entry("click", 2, 1, "cursor_click"));
  await tick();
  assert.deepEqual(starts, ["play", "click"]);
  pending.get("click")({ id: "click", sequence: 2, ok: true });
  await tick();
  assert.equal(delivered[0][0], "play");
  assert.match(delivered[0][2], /Superseded/);
  assert.deepEqual(delivered[1].slice(0, 2), ["click", true]);
});

test("queue depth is bounded while an ordinary command is pending", async () => {
  let release;
  const scheduler = createReliableCommandScheduler({
    maxDepth: 3,
    execute: () => new Promise((resolve) => { release ||= resolve; }),
  });

  assert.equal(scheduler.enqueue(entry("a", 1)).ok, true);
  assert.equal(scheduler.enqueue(entry("b", 2)).ok, true);
  assert.equal(scheduler.enqueue(entry("c", 3)).ok, true);
  const overflow = scheduler.enqueue(entry("d", 4));
  assert.equal(overflow.ok, false);
  assert.equal(overflow.code, "RELIABLE_QUEUE_FULL");
  release({ id: "a", sequence: 1, ok: true });
});

test("stale controller revisions never execute", async () => {
  let currentRevision = 4;
  const starts = [];
  const delivered = [];
  const scheduler = createReliableCommandScheduler({
    isCurrent: (item) => item.controllerRevision === currentRevision,
    execute: async (item) => { starts.push(item.command.id); return { id: item.command.id, sequence: item.command.sequence, ok: true }; },
    deliver: (item, result) => delivered.push([item.command.id, result.code]),
  });

  scheduler.enqueue(entry("stale", 1, 3));
  scheduler.enqueue(entry("current", 2, 4));
  await tick();
  assert.deepEqual(starts, ["current"]);
  assert.deepEqual(delivered[0], ["stale", "CONTROLLER_EPOCH_STALE"]);
});

test("ownership invalidation cancels active and queued reliable work", async () => {
  const delivered = [];
  const pending = new Map();
  const scheduler = createReliableCommandScheduler({
    execute: (item) => new Promise((resolve) => pending.set(item.command.id, resolve)),
    cancelActive: (item, reason) => pending.get(item.command.id)?.({ id: item.command.id, sequence: item.command.sequence, ok: false, error: reason }),
    deliver: (item, result) => delivered.push([item.command.id, result.error]),
  });

  scheduler.enqueue(entry("a", 1));
  scheduler.enqueue(entry("b", 2));
  await tick();
  scheduler.invalidate(() => true, "Controller ownership changed.");
  await tick();
  assert.equal(scheduler.snapshot().queued, 0);
  assert.equal(delivered.length, 2);
  assert.ok(delivered.every(([, reason]) => /ownership changed/i.test(reason)));
});
