const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const ipcPath = path.resolve(__dirname, "../../../src/main/ipc/portableProfileIpc.js");

function validProfileJson(profileId = "google-sub-1") {
  return JSON.stringify({
    schemaVersion: 3,
    profileId,
    revision: 1,
    createdAt: 1,
    updatedAt: 2,
    namespaces: {},
  });
}

function registerWithMockElectron(options) {
  const handlers = new Map();
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "electron") {
      return { ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[ipcPath];
    const portableProfileIpc = require(ipcPath);
    portableProfileIpc.register(options);
  } finally {
    Module._load = originalLoad;
    delete require.cache[ipcPath];
  }
  return handlers;
}

test("portable-profile write IPC fails closed before Drive I/O when Google subject identity mismatches", async () => {
  let driveCalls = 0;
  const handlers = registerWithMockElectron({
    driveRequest: async () => { driveCalls += 1; throw new Error("Drive must not run"); },
    getGoogleProfile: () => ({ sub: "google-sub-other" }),
  });
  const handler = handlers.get("portable-profile:write");
  assert.equal(typeof handler, "function");
  const result = await handler(null, {
    profileKey: "orion-primary-profile-v3",
    profileJson: validProfileJson("google-sub-1"),
    expectedRevisionTag: 'etag:"before"',
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "GOOGLE_DRIVE_PROFILE_IDENTITY_MISMATCH");
  assert.equal(driveCalls, 0);
});

test("portable-profile write IPC rejects malformed PortableProfileV3 before Drive I/O", async () => {
  let driveCalls = 0;
  const handlers = registerWithMockElectron({
    driveRequest: async () => { driveCalls += 1; throw new Error("Drive must not run"); },
    getGoogleProfile: () => ({ sub: "google-sub-1" }),
  });
  const result = await handlers.get("portable-profile:write")(null, {
    profileKey: "orion-primary-profile-v3",
    profileJson: JSON.stringify({ profileId: "google-sub-1" }),
    expectedRevisionTag: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "GOOGLE_DRIVE_PROFILE_INVALID");
  assert.equal(driveCalls, 0);
});
