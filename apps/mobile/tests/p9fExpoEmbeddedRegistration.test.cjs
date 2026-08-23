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

test("P9-F6 legacy-state healing transforms the audited Expo LoaderTask shape", () => {
  const fixture = [
    patcher.__test.LOADER_TASK_IMPORT_STATUS_OLD,
    patcher.__test.LOADER_TASK_EMBEDDED_SELECTION_OLD,
  ].join("\n\n");

  const fixed = patcher.transformLoaderTaskSource(fixture);

  assert.equal(patcher.isFixedLoaderTaskSource(fixed), true);
  assert.match(fixed, /it\.status == UpdateStatus\.EMBEDDED/);
  assert.match(fixed, /loadLaunchAssetForUpdate\(it\.id\) == null/);
  assert.match(fixed, /embeddedRegistrationNeedsRepair \|\|/);
  assert.match(
    fixed,
    /Detected an incomplete embedded update registration with no launch asset\./
  );
  assert.doesNotMatch(fixed, /deleteUpdates/);
});

test("P9-F6 current expo-updates sources contain prevention and legacy-state healing", () => {
  const packageJsonPath = require.resolve("expo-updates/package.json", {
    paths: [path.join(rootDirectory, "apps", "mobile")],
  });
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const packageRoot = path.dirname(packageJsonPath);
  const loaderPath = path.join(
    packageRoot,
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
  const loaderTaskPath = path.join(
    packageRoot,
    "android",
    "src",
    "main",
    "java",
    "expo",
    "modules",
    "updates",
    "loader",
    "LoaderTask.kt"
  );
  const loaderSource = fs.readFileSync(loaderPath, "utf8");
  const loaderTaskSource = fs.readFileSync(loaderTaskPath, "utf8");

  assert.equal(packageJson.version, patcher.VULNERABLE_EXPO_UPDATES_VERSION);
  assert.equal(patcher.isFixedLoaderSource(loaderSource), true);
  assert.equal(patcher.isFixedLoaderTaskSource(loaderTaskSource), true);
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
