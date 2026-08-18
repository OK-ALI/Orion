const test = require("node:test");
const assert = require("node:assert/strict");
const {
  LEGACY_CLOUD_VIEWING_FENCE_MARKER,
  prepareLegacySyncUploadPayload,
} = require("../../../src/main/ipc/legacyCloudSyncFence");

test("legacy cloud fence freezes old viewing state while allowing other backup fields to update", async () => {
  const next = await prepareLegacySyncUploadPayload({
    fileId: "drive-file",
    data: {
      saved: { movie_2: { id: 2 } },
      history: undefined,
      [LEGACY_CLOUD_VIEWING_FENCE_MARKER]: true,
    },
    loadExisting: async () => ({
      history: [{ id: 1 }],
      progress: { movie_1: 42 },
      progressDetails: { movie_1: { currentTime: 42, duration: 100 } },
      watched: { movie_1: true },
      saved: { movie_1: { id: 1 } },
    }),
  });

  assert.deepEqual(next.saved, { movie_2: { id: 2 } });
  assert.deepEqual(next.history, [{ id: 1 }]);
  assert.deepEqual(next.progress, { movie_1: 42 });
  assert.deepEqual(next.watched, { movie_1: true });
  assert.equal(Object.hasOwn(next, LEGACY_CLOUD_VIEWING_FENCE_MARKER), false);
});

test("new legacy sync files omit viewing state and the internal fence marker", async () => {
  let loaded = false;
  const next = await prepareLegacySyncUploadPayload({
    fileId: null,
    data: { saved: { movie_2: { id: 2 } }, [LEGACY_CLOUD_VIEWING_FENCE_MARKER]: true },
    loadExisting: async () => { loaded = true; return {}; },
  });

  assert.equal(loaded, false);
  assert.deepEqual(next, { saved: { movie_2: { id: 2 } } });
});
