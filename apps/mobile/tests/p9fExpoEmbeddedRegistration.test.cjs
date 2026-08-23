const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDirectory = path.resolve(__dirname, "..", "..", "..");
const patcher = require(path.join(
  rootDirectory,
  "scripts",
  "patch-expo-updates-embedded-registration.cjs"
));

test("P9-F6 backport transforms the audited vulnerable Expo loader shape", () => {
  const fixture = [
    patcher.__test.IMPORT_ROOM_OLD,
    patcher.__test.IMPORT_CANCELLATION_OLD,
    patcher.__test.PROCESS_UPDATE_OLD,
    patcher.__test.DOWNLOAD_SIGNATURE_OLD,
    patcher.__test.FINALIZE_OLD,
  ].join("\n\n");

  const fixed = patcher.transformLoaderSource(fixture);

  assert.equal(patcher.isFixedLoaderSource(fixed), true);
  assert.match(fixed, /database\.withTransaction \{/);
  assert.match(fixed, /insertUpdateEntityOnFinish = newUpdateEntity\.status == UpdateStatus\.EMBEDDED/);
  assert.doesNotMatch(
    fixed,
    /no update already exists with this ID, so we need to insert it and download everything\./
  );
});

test("P9-F6 current expo-updates Loader.kt contains the atomic embedded-registration fix", () => {
  const packageJsonPath = require.resolve("expo-updates/package.json", {
    paths: [path.join(rootDirectory, "apps", "mobile")],
  });
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const loaderPath = path.join(
    path.dirname(packageJsonPath),
    "android",
    "src",
    "main",
    "java",
    "expo",
    "modules",
    "updates",
    "loader",
    "Loader.kt"
  );
  const source = fs.readFileSync(loaderPath, "utf8");

  assert.equal(packageJson.version, patcher.VULNERABLE_EXPO_UPDATES_VERSION);
  assert.equal(patcher.isFixedLoaderSource(source), true);
});

test("P9-F6 root install lifecycle reapplies the audited Expo backport", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(rootDirectory, "package.json"), "utf8")
  );

  assert.equal(
    packageJson.scripts?.postinstall,
    "node scripts/patch-expo-updates-embedded-registration.cjs"
  );
  assert.equal(
    packageJson.scripts?.["patch:expo-updates"],
    "node scripts/patch-expo-updates-embedded-registration.cjs"
  );
  assert.equal(
    patcher.UPSTREAM_FIX_COMMIT,
    "ef84af66b9b77aaa33e7f2f8d344c297a3d1e51b"
  );
});
