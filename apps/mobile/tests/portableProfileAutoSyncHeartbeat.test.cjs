"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const mobileRoot = path.resolve(__dirname, "..");
const heartbeatPath = path.join(mobileRoot, "src/features/account/portableProfileAutoSyncHeartbeat.ts");

function loadHeartbeatModule() {
  const source = fs.readFileSync(heartbeatPath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: heartbeatPath,
  }).outputText;
  const loaded = new Module(heartbeatPath, module);
  loaded.filename = heartbeatPath;
  loaded.paths = module.paths;
  loaded._compile(compiled, heartbeatPath);
  return loaded.exports;
}

test("P8.7 Mobile passive Cloud heartbeat is staggered, bounded, active-only and cleanable", async () => {
  const { startPortableProfileAutoSyncHeartbeat } = loadHeartbeatModule();
  const scheduledTimeouts = [];
  const scheduledIntervals = [];
  const clearedTimeouts = [];
  const clearedIntervals = [];
  let active = false;
  let reconciles = 0;

  const stop = startPortableProfileAutoSyncHeartbeat("watched", () => {
    reconciles += 1;
  }, {
    intervalMs: 20_000,
    setTimeoutImpl: (callback, delay) => {
      scheduledTimeouts.push({ callback, delay });
      return "timeout-1";
    },
    clearTimeoutImpl: (id) => clearedTimeouts.push(id),
    setIntervalImpl: (callback, delay) => {
      scheduledIntervals.push({ callback, delay });
      return "interval-1";
    },
    clearIntervalImpl: (id) => clearedIntervals.push(id),
    isActive: () => active,
  });

  assert.equal(scheduledTimeouts.length, 1);
  assert.equal(scheduledTimeouts[0].delay, 9_000);

  scheduledTimeouts[0].callback();
  await Promise.resolve();
  assert.equal(reconciles, 0, "inactive Mobile must not poll Orion Cloud");
  assert.equal(scheduledIntervals.length, 1);
  assert.equal(scheduledIntervals[0].delay, 20_000);

  active = true;
  scheduledIntervals[0].callback();
  await Promise.resolve();
  assert.equal(reconciles, 1);

  stop();
  assert.deepEqual(clearedTimeouts, ["timeout-1"]);
  assert.deepEqual(clearedIntervals, ["interval-1"]);

  scheduledIntervals[0].callback();
  await Promise.resolve();
  assert.equal(reconciles, 1, "cleanup must fence later timer callbacks");
});

test("P8.7 all three Mobile steady-state domains share the passive heartbeat owner", () => {
  const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");
  const myList = read("src/features/account/MyListSteadyStateSync.tsx");
  const watched = read("src/features/account/WatchedSteadyStateSync.tsx");
  const viewing = read("src/features/account/ViewingActivitySteadyStateSync.tsx");

  assert.match(myList, /startPortableProfileAutoSyncHeartbeat\([\s\S]*'myList'[\s\S]*requestHeartbeatReconcile/);
  assert.match(watched, /startPortableProfileAutoSyncHeartbeat\([\s\S]*'watched'[\s\S]*requestHeartbeatReconcile/);
  assert.match(viewing, /startPortableProfileAutoSyncHeartbeat\([\s\S]*'viewingActivity'[\s\S]*requestHeartbeatReconcile/);

  for (const source of [myList, watched, viewing]) {
    assert.match(source, /AppState\.currentState === 'active'/);
    assert.match(source, /network\.internetReachable === false/);
  }
});
