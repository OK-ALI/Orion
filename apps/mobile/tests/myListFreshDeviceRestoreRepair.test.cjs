"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const mobileRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");
const preflight = read("src/features/settings/MyListEnrollmentPreflight.tsx");
const persistence = read("src/features/library/myListPersistence.ts");

function loadTypeScriptModule(relative) {
  const previous = require.extensions[".ts"];
  require.extensions[".ts"] = (loadedModule, filename) => {
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: filename,
    }).outputText;
    loadedModule._compile(output, filename);
  };
  try {
    return require(relative);
  } finally {
    if (previous) require.extensions[".ts"] = previous;
    else delete require.extensions[".ts"];
  }
}

const { replacePersistedMyListV1 } = loadTypeScriptModule("../src/features/library/myListPersistence.ts");

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing section start: ${start}`);
  assert.ok(to > from, `missing section end: ${end}`);
  return source.slice(from, to);
}

test("Phase 8 repair routes fresh-device Restore only to confirmRestore", () => {
  const route = section(preflight, "const confirmReadyAction", "const localCount");
  const dialog = preflight.slice(preflight.lastIndexOf("<OrionDialog"));

  assert.match(route, /if \(restoreReadyState\)[\s\S]*void confirmRestore\(\);[\s\S]*return;/);
  assert.match(route, /state\.phase === 'ready-create' \|\| state\.phase === 'ready-empty'[\s\S]*void confirmEnrollment\(\)/);
  assert.match(dialog, /label: readyRestore \? 'Restore' : 'Sync'/);
  assert.match(dialog, /onPress: confirmReadyAction/);
  assert.doesNotMatch(dialog, /void confirmEnrollment\(\)/);
});

test("Phase 8 repair rejects unexpected confirmation states instead of guessing", () => {
  const route = section(preflight, "const confirmReadyAction", "const localCount");

  assert.match(route, /setShowSyncDialog\(false\)/);
  assert.match(route, /phase: 'error'/);
  assert.match(route, /action is no longer ready/i);
  assert.doesNotMatch(route, /else[\s\S]{0,80}confirmEnrollment/);
});

test("Phase 8 repair keeps confirmation idempotent while restore or enrollment is running", () => {
  const enrollment = section(preflight, "const confirmEnrollment", "const restoreReadyState");
  const restore = section(preflight, "const confirmRestore", "const confirmReadyAction");

  assert.match(enrollment, /if \(operationBusyRef\.current\) return/);
  assert.match(enrollment, /operationBusyRef\.current = true/);
  assert.match(enrollment, /finally[\s\S]*operationBusyRef\.current = false/);
  assert.match(restore, /if \(operationBusyRef\.current\) return/);
  assert.match(restore, /operationBusyRef\.current = true/);
  assert.match(restore, /finally[\s\S]*operationBusyRef\.current = false/);
});

test("Phase 8 repair re-reads and validates cloud and local preflight truth before restore", () => {
  const restore = section(preflight, "const confirmRestore", "const confirmReadyAction");

  assert.match(restore, /readyState\.previewSignature !== previewSignature/);
  assert.match(restore, /preview\.orderedKeys\.length !== 0/);
  assert.match(restore, /store\.read\(PORTABLE_PROFILE_PRIMARY_KEY\)/);
  assert.match(restore, /contextKeyRef\.current !== restoreContextKey/);
  assert.match(restore, /fresh\.revisionTag !== readyState\.baselineRevisionTag/);
  assert.match(restore, /fresh\.profile\.profileId !== profileId/);
  assert.match(restore, /cloudNamespaceSignature !== readyState\.cloudNamespaceSignature/);
  assert.match(restore, /portableMyListPreviewSignatureV1\(cloudPreview\)[\s\S]*portableMyListPreviewSignatureV1\(readyState\.cloudPreview\)/);
});

test("Phase 8 repair verifies exact native saved and savedOrder persistence before checkpoint", () => {
  const replacement = section(persistence, "export function replacePersistedMyListV1", "  } catch (error)");
  const restore = section(preflight, "const confirmRestore", "const confirmReadyAction");
  const replaceAt = restore.indexOf("replaceMyListFromSync(");
  const checkpointAt = restore.indexOf("saveMyListSyncCheckpointV1(");

  assert.match(replacement, /storage\.set\(SAVED_KEY,/);
  assert.match(replacement, /storage\.set\(SAVED_ORDER_KEY,/);
  assert.match(replacement, /storage\.get\(SAVED_KEY\)/);
  assert.match(replacement, /storage\.get\(SAVED_ORDER_KEY\)/);
  assert.match(replacement, /Object\.keys\(persisted\.saved\)\.length !== Object\.keys\(nextSaved\)\.length/);
  assert.match(replacement, /sameStrings\(persisted\.savedOrder, nextSavedOrder\)/);
  assert.match(replacement, /sameStrings\(persistedIdentities, expectedIdentities\)/);
  assert.match(replacement, /normalizedContentSignature !== portableMyListPreviewSignatureV1\(expectedPreview\)/);
  assert.ok(replaceAt >= 0 && checkpointAt > replaceAt, "checkpoint must follow verified persistence receipt");
});

test("Phase 8 repair rolls back failed persistence and keeps Restore recoverable", () => {
  const replacement = persistence;
  const restore = section(preflight, "const confirmRestore", "const confirmReadyAction");

  assert.match(replacement, /const previousSaved = storage\.get/);
  assert.match(replacement, /const previousOrder = storage\.get/);
  assert.match(replacement, /restorePrevious\(storage, previousSaved, previousOrder\)/);
  assert.match(restore, /phase: 'error'[\s\S]*retry: readyState/);
  assert.match(preflight, /state\.phase === 'error' && state\.retry\?\.phase === 'ready-restore'/);
  assert.match(preflight, /readyRestore[\s\S]*\? 'Restore My List'/);
});

test("Phase 8 repair persists cloud identities, count, content and ordering exactly", () => {
  const values = new Map();
  const storage = {
    get: (key) => values.get(key) ?? null,
    set: (key, value) => values.set(key, value),
    remove: (key) => values.delete(key),
  };
  const saved = {
    tv_22: { id: 22, media_type: "tv", name: "Second", title: "Second", poster_path: null, backdrop_path: null, year: "2025" },
    movie_11: { id: 11, media_type: "movie", title: "First", poster_path: "/first.jpg", backdrop_path: null, year: "2024" },
  };
  const order = ["movie_11", "tv_22"];

  const receipt = replacePersistedMyListV1(storage, saved, order);

  assert.deepEqual(receipt.itemIdentities, ["movie_11", "tv_22"]);
  assert.equal(receipt.count, 2);
  assert.deepEqual(receipt.savedOrder, order);
  assert.deepEqual(JSON.parse(values.get("savedOrder")), order);
  assert.deepEqual(Object.keys(JSON.parse(values.get("saved"))).sort(), receipt.itemIdentities);
  assert.equal(typeof receipt.normalizedContentSignature, "string");
});

test("Phase 8 repair rolls back a semantic read-back mismatch", () => {
  const oldSaved = JSON.stringify({ movie_9: { id: 9, media_type: "movie", title: "Old" } });
  const oldOrder = JSON.stringify(["movie_9"]);
  const values = new Map([["saved", oldSaved], ["savedOrder", oldOrder]]);
  let replacementWritten = false;
  const storage = {
    get: (key) => replacementWritten && key === "savedOrder"
      ? JSON.stringify(["tv_22", "movie_11"])
      : values.get(key) ?? null,
    set: (key, value) => {
      values.set(key, value);
      if (key === "savedOrder" && value !== oldOrder) replacementWritten = true;
    },
    remove: (key) => values.delete(key),
  };
  const saved = {
    movie_11: { id: 11, media_type: "movie", title: "First" },
    tv_22: { id: 22, media_type: "tv", name: "Second" },
  };

  assert.throws(
    () => replacePersistedMyListV1(storage, saved, ["movie_11", "tv_22"]),
    /MY_LIST_PERSISTENCE_READBACK_MISMATCH/,
  );
  assert.equal(values.get("saved"), oldSaved);
  assert.equal(values.get("savedOrder"), oldOrder);
});

test("Phase 8 repair rolls back when either half of the native pair cannot be written", () => {
  const oldSaved = JSON.stringify({});
  const oldOrder = JSON.stringify([]);
  const values = new Map([["saved", oldSaved], ["savedOrder", oldOrder]]);
  let failNextOrderWrite = true;
  const storage = {
    get: (key) => values.get(key) ?? null,
    set: (key, value) => {
      if (key === "savedOrder" && failNextOrderWrite && value !== oldOrder) {
        failNextOrderWrite = false;
        throw new Error("WRITE_FAILED");
      }
      values.set(key, value);
    },
    remove: (key) => values.delete(key),
  };

  assert.throws(
    () => replacePersistedMyListV1(
      storage,
      { movie_11: { id: 11, media_type: "movie", title: "First" } },
      ["movie_11"],
    ),
    /WRITE_FAILED/,
  );
  assert.equal(values.get("saved"), oldSaved);
  assert.equal(values.get("savedOrder"), oldOrder);
});

test("Phase 8 restore never writes Orion Cloud or touches unrelated library domains", () => {
  const restore = section(preflight, "const confirmRestore", "const confirmReadyAction");

  assert.doesNotMatch(restore, /store\.write\(/);
  assert.doesNotMatch(restore, /replaceWatchedFromSync|replaceViewingActivityFromSync/);
  assert.doesNotMatch(restore, /history|watched|progress|preferences|credentials/i);
});

test("Phase 8 cloud discovery remains available without a local checkpoint", () => {
  assert.match(preflight, /if \(!steady\.hasCheckpoint && autoSyncEnabled\) void inspectEnrollment\(\)/);
  assert.match(preflight, /preview\.orderedKeys\.length === 0[\s\S]*phase: 'ready-restore'/);
});
