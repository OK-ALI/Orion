const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPortableProfileReader,
  createPortableProfileWriter,
  profileFileName,
  revisionTag,
  parsePortableProfileJsonV3,
} = require("../../../src/main/ipc/portableProfileStore");

function portableProfileJson(profileId = "google-sub-1") {
  return JSON.stringify({
    schemaVersion: 3,
    profileId,
    revision: 1,
    createdAt: 1,
    updatedAt: 2,
    namespaces: {},
  });
}

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


test("Desktop portable profile writer validates the PortableProfileV3 envelope before any Drive mutation", () => {
  assert.equal(parsePortableProfileJsonV3(portableProfileJson()).parsed.profileId, "google-sub-1");
  assert.throws(
    () => parsePortableProfileJsonV3(JSON.stringify({ profileId: "google-sub-1" })),
    (error) => error.code === "GOOGLE_DRIVE_PROFILE_INVALID",
  );
  assert.throws(
    () => parsePortableProfileJsonV3(JSON.stringify({
      schemaVersion: 3, profileId: "google-sub-1", revision: 1, createdAt: 1, updatedAt: 2,
      namespaces: { watched: { schemaVersion: 1, revision: 1, updatedAt: 2, records: { movie_1: { revision: 0 } } } },
    })),
    (error) => error.code === "GOOGLE_DRIVE_PROFILE_INVALID",
  );
});

test("Desktop portable profile writer creates only when the profile is still missing", async () => {
  const calls = [];
  let searchCount = 0;
  const write = createPortableProfileWriter({
    driveRequest: async (url, options = {}) => {
      calls.push({ url, options });
      if (url.includes("spaces=appDataFolder")) {
        searchCount += 1;
        return response({ files: searchCount === 1 ? [] : [{ id: "created" }] });
      }
      if (url.includes("uploadType=multipart")) return response({ id: "created" });
      return response({ id: "created", version: "2", modifiedTime: "2026-08-19T01:00:00.000Z" }, { etag: '"created-etag"' });
    },
  });
  const result = await write("orion-primary-profile-v3", portableProfileJson(), null);
  assert.equal(result.state, "written");
  assert.equal(result.revisionTag, 'etag:"created-etag"');
  const upload = calls.find((call) => call.url.includes("uploadType=multipart"));
  assert.equal(upload.options.method, "POST");
  assert.match(upload.options.body, /appDataFolder/);
  assert.match(upload.options.body, /orion-portable-profile-v3-0c3003a538fb837dd9c1b4c34fc6da8b\.json/);
});

test("Desktop portable profile writer treats create-on-existing as a conflict", async () => {
  const write = createPortableProfileWriter({
    driveRequest: async (url) => {
      if (url.includes("spaces=appDataFolder")) return response({ files: [{ id: "existing" }] });
      return response({ id: "existing", version: "7", modifiedTime: "2026-08-19T01:00:00.000Z" }, { etag: '"existing-etag"' });
    },
  });
  const result = await write("orion-primary-profile-v3", portableProfileJson(), null);
  assert.deepEqual(result, { state: "conflict", revisionTag: 'etag:"existing-etag"' });
});

test("Desktop portable profile writer uses strong ETag If-Match for conditional updates", async () => {
  const calls = [];
  let metadataCount = 0;
  const write = createPortableProfileWriter({
    driveRequest: async (url, options = {}) => {
      calls.push({ url, options });
      if (url.includes("spaces=appDataFolder")) return response({ files: [{ id: "existing" }] });
      if (url.includes("uploadType=media")) return response("");
      metadataCount += 1;
      return metadataCount === 1
        ? response({ id: "existing", version: "7", modifiedTime: "2026-08-19T01:00:00.000Z" }, { etag: '"before"' })
        : response({ id: "existing", version: "8", modifiedTime: "2026-08-19T01:01:00.000Z" }, { etag: '"after"' });
    },
  });
  const result = await write("orion-primary-profile-v3", portableProfileJson(), 'etag:"before"');
  assert.equal(result.state, "written");
  assert.equal(result.revisionTag, 'etag:"after"');
  const upload = calls.find((call) => call.url.includes("uploadType=media"));
  assert.equal(upload.options.method, "PATCH");
  assert.equal(upload.options.headers["If-Match"], '"before"');
});

test("Desktop portable profile writer refuses stale or non-atomic revision tokens", async () => {
  const stale = createPortableProfileWriter({
    driveRequest: async (url) => {
      if (url.includes("spaces=appDataFolder")) return response({ files: [{ id: "existing" }] });
      return response({ id: "existing", version: "7", modifiedTime: "2026-08-19T01:00:00.000Z" }, { etag: '"current"' });
    },
  });
  assert.deepEqual(
    await stale("orion-primary-profile-v3", portableProfileJson(), 'etag:"stale"'),
    { state: "conflict", revisionTag: 'etag:"current"' },
  );

  const versionOnly = createPortableProfileWriter({
    driveRequest: async (url) => {
      if (url.includes("spaces=appDataFolder")) return response({ files: [{ id: "existing" }] });
      return response({ id: "existing", version: "7", modifiedTime: "2026-08-19T01:00:00.000Z" });
    },
  });
  await assert.rejects(
    () => versionOnly("orion-primary-profile-v3", portableProfileJson(), "version:7"),
    (error) => error.code === "GOOGLE_DRIVE_PROFILE_CONDITIONAL_UNAVAILABLE",
  );
});

test("Desktop portable profile writer maps HTTP 412 to conflict and rejects oversized profiles", async () => {
  let metadataCount = 0;
  const write = createPortableProfileWriter({
    driveRequest: async (url) => {
      if (url.includes("spaces=appDataFolder")) return response({ files: [{ id: "existing" }] });
      if (url.includes("uploadType=media")) return response("", { status: 412 });
      metadataCount += 1;
      return response(
        { id: "existing", version: String(7 + metadataCount - 1), modifiedTime: "2026-08-19T01:00:00.000Z" },
        { etag: metadataCount === 1 ? '"before"' : '"latest"' },
      );
    },
  });
  const result = await write("orion-primary-profile-v3", portableProfileJson(), 'etag:"before"');
  assert.equal(result.state, "conflict");
  assert.equal(result.revisionTag, 'etag:"latest"');

  const noIo = createPortableProfileWriter({ driveRequest: async () => { throw new Error("should not run"); } });
  await assert.rejects(
    () => noIo("orion-primary-profile-v3", `{"x":"${"x".repeat(2 * 1024 * 1024)}"}`, null),
    (error) => error.code === "GOOGLE_DRIVE_PROFILE_TOO_LARGE",
  );
});
