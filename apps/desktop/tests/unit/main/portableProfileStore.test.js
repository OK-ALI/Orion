const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPortableProfileReader,
  profileFileName,
  revisionTag,
} = require("../../../src/main/ipc/portableProfileStore");

function response(body, { status = 200, etag = null } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => name.toLowerCase() === "etag" ? etag : null },
    text: async () => typeof body === "string" ? body : JSON.stringify(body),
  };
}

test("Desktop portable profile filename matches the Mobile SHA-256 appDataFolder contract", () => {
  assert.equal(
    profileFileName("orion-primary-profile-v3"),
    "orion-portable-profile-v3-0c3003a538fb837dd9c1b4c34fc6da8b.json",
  );
});

test("read-only Desktop bridge reports missing without creating a cloud profile", async () => {
  const calls = [];
  const read = createPortableProfileReader({
    driveRequest: async (url) => {
      calls.push(url);
      return response({ files: [] });
    },
  });

  assert.deepEqual(await read("orion-primary-profile-v3"), { state: "missing", revisionTag: null });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /spaces=appDataFolder/);
});

test("read-only Desktop bridge returns a stable Mobile-compatible profile snapshot", async () => {
  const body = JSON.stringify({ schemaVersion: 3, profileId: "google-sub-1", revision: 4, createdAt: 1, updatedAt: 2, namespaces: {} });
  let metadataReads = 0;
  const read = createPortableProfileReader({
    driveRequest: async (url) => {
      if (url.includes("spaces=appDataFolder")) return response({ files: [{ id: "drive-file" }] });
      if (url.includes("alt=media")) return response(body);
      metadataReads += 1;
      return response({ id: "drive-file", version: "17", modifiedTime: "2026-08-19T00:00:00.000Z" }, { etag: '"strong-etag"' });
    },
  });

  const result = await read("orion-primary-profile-v3");
  assert.equal(result.state, "found");
  assert.equal(result.profileJson, body);
  assert.equal(result.revisionTag, 'etag:"strong-etag"');
  assert.equal(result.remoteModifiedAt, Date.parse("2026-08-19T00:00:00.000Z"));
  assert.equal(metadataReads, 2);
});

test("read-only Desktop bridge refuses duplicate portable profile files", async () => {
  const read = createPortableProfileReader({
    driveRequest: async () => response({ files: [{ id: "one" }, { id: "two" }] }),
  });
  await assert.rejects(() => read("orion-primary-profile-v3"), (error) => error.code === "GOOGLE_DRIVE_PROFILE_DUPLICATE");
});

test("revision tags match Mobile semantics: strong ETag first, Drive version fallback", () => {
  assert.equal(revisionTag({ etag: '"abc"', version: "7" }), 'etag:"abc"');
  assert.equal(revisionTag({ etag: 'W/"abc"', version: "7" }), "version:7");
});
