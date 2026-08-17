"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const sharedRoot = path.resolve(mobileRoot, "..", "..", "packages", "shared", "src");
const readShared = (relative) => fs.readFileSync(path.join(sharedRoot, relative), "utf8");

test("P8.2 introduces PortableProfileV3 as a record envelope instead of raw storage blobs", () => {
  const profile = readShared("types/portableProfile.ts");
  const typesIndex = readShared("types/index.ts");

  assert.match(profile, /PORTABLE_PROFILE_SCHEMA_VERSION = 3/);
  assert.match(profile, /"myList"[\s\S]*"history"[\s\S]*"watched"[\s\S]*"progress"[\s\S]*"preferences"/);
  assert.match(profile, /revision: number/);
  assert.match(profile, /updatedAt: number/);
  assert.match(profile, /updatedBy: string/);
  assert.match(profile, /deletedAt: number \| null/);
  assert.match(profile, /value: PortableJsonValue \| null/);
  assert.match(typesIndex, /export \* from "\.\/portableProfile"/);

  assert.doesNotMatch(profile, /import[\s\S]*?(?:mmkv|SecureStore|storageAdapter)/i);
  assert.doesNotMatch(profile, /mmkvStorageAdapter\.(?:get|set|remove)/);
  assert.doesNotMatch(profile, /window\.localStorage/);
  assert.doesNotMatch(profile, /savedOrder\s*:/);
});

test("P8.2 PortableProfileV3 preserves unknown namespaces and keeps tombstones explicit", () => {
  const profile = readShared("types/portableProfile.ts");

  assert.match(profile, /Unknown namespaces are[\s\S]*retained as opaque JSON/i);
  assert.match(profile, /const opaque = normalizeJsonValue\(namespace\)/);
  assert.match(profile, /namespaces\[name\] = opaque/);
  assert.match(profile, /if \(deletedAt != null\)[\s\S]*value !== null[\s\S]*value: null/);
  assert.doesNotMatch(profile, /delete records\[/);
});

test("P8.2 CloudProfileStore is concurrency-aware and backend-neutral", () => {
  const store = readShared("api/cloudProfileStore.ts");
  const apiIndex = readShared("api/index.ts");

  assert.match(store, /interface CloudProfileStore/);
  assert.match(store, /read\(profileKey: string\)/);
  assert.match(store, /expectedRevisionTag: string \| null/);
  assert.match(store, /state: "conflict"/);
  assert.match(store, /revisionTag: string \| null/);
  assert.match(apiIndex, /CloudProfileStore/);

  assert.doesNotMatch(store, /from ["'].*(?:google|drive|mmkv|storage)/i);
  assert.doesNotMatch(store, /appDataFolder|accessToken|refreshToken|clientSecret/i);
  assert.doesNotMatch(store, /window\.localStorage|mmkvStorageAdapter/);
});

test("P8.2 foundation does not activate cloud writes or library migration", () => {
  const account = fs.readFileSync(path.join(mobileRoot, "src", "context", "AccountContext.tsx"), "utf8");
  const library = fs.readFileSync(path.join(mobileRoot, "src", "context", "LibraryContext.tsx"), "utf8");

  assert.doesNotMatch(account, /CloudProfileStore|PortableProfileV3|drive\.appdata|appDataFolder/);
  assert.doesNotMatch(library, /CloudProfileStore|PortableProfileV3|drive\.appdata|appDataFolder/);
});
