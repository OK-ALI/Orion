const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const desktopRoot = path.resolve(__dirname, "../../..");
const repoRoot = path.resolve(desktopRoot, "../..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("Orion v3.2 production release owns aligned Desktop and Mobile identities", () => {
  const desktopPackage = readJson(path.join(desktopRoot, "package.json"));
  const rootPackage = readJson(path.join(repoRoot, "package.json"));
  const packageLock = readJson(path.join(repoRoot, "package-lock.json"));
  const mobilePackage = readJson(path.join(repoRoot, "apps/mobile/package.json"));
  const mobileApp = readJson(path.join(repoRoot, "apps/mobile/app.json"));

  assert.equal(desktopPackage.version, "3.2.0");
  assert.equal(packageLock.packages["apps/desktop"].version, "3.2.0");

  assert.equal(rootPackage.version, "3.2.0");
  assert.equal(packageLock.version, "3.2.0");
  assert.equal(packageLock.packages[""].version, "3.2.0");

  assert.equal(mobilePackage.version, "3.2.0");
  assert.equal(packageLock.packages["apps/mobile"].version, "3.2.0");
  assert.equal(mobileApp.expo.version, "3.2.0");
  assert.equal(mobileApp.expo.android.versionCode, 58);
  assert.equal(mobileApp.expo.runtimeVersion, "orion-mobile-native-r2");
});

test("Orion keeps Windows signing local and exact release assets private until qualification", () => {
  const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/release.yml"), "utf8");
  const prepare = fs.readFileSync(path.join(repoRoot, "scripts/prepare-protected-release-local.ps1"), "utf8");
  const syscontrolBuilder = fs.readFileSync(path.join(desktopRoot, "scripts/build-syscontrol.js"), "utf8");
  const draft = fs.readFileSync(path.join(repoRoot, "scripts/create-private-release-draft-local.ps1"), "utf8");
  const qualification = readJson(path.join(repoRoot, "config/release-qualification-3.2.0.json"));
  const previewJob = workflow.indexOf("\n  publish-preview:");
  const previewQualification = workflow.indexOf("check-release-qualification.cjs --phase preview");
  const stableJob = workflow.indexOf("\n  promote:");
  const stableQualification = workflow.indexOf("check-release-qualification.cjs --phase stable");

  assert.doesNotMatch(workflow, /self-hosted/);
  assert.doesNotMatch(workflow, /dist:win/);
  assert.match(prepare, /LOCAL PROTECTED RELEASE PREPARATION/);
  assert.match(prepare, /npm\.cmd["']?\s*,?\s*@\("run", "dist:win"/);
  assert.match(prepare, /verify-release-artifacts\.ps1/);
  assert.match(prepare, /ORION_WINDOWS_SIGN_SYSCONTROL/);
  assert.match(prepare, /ORION_WINDOWS_SIGN_CERT_SHA1/);
  assert.match(prepare, /ORION_WINDOWS_SIGN_CERT_SHA256/);
  assert.match(prepare, /Verified signed SysControl helper before release staging/);
  assert.match(syscontrolBuilder, /ORION_WINDOWS_SIGN_SYSCONTROL/);
  assert.match(syscontrolBuilder, /Set-AuthenticodeSignature/);
  assert.match(syscontrolBuilder, /Get-AuthenticodeSignature/);
  assert.match(syscontrolBuilder, /orion-sign-syscontrol-/);
  assert.match(prepare, /orion-local-candidate-evidence\.json/);
  assert.match(draft, /--draft/);
  assert.match(draft, /Refusing to replace or mutate existing release assets/);
  assert.match(draft, /verify-release-bundle\.cjs/);
  assert.ok(previewJob >= 0, "Preview publication must remain a separate approved job");
  assert.ok(previewQualification > previewJob, "physical Desktop qualification must gate Preview");
  assert.ok(stableJob > previewQualification, "Stable promotion must remain a separate later job");
  assert.ok(stableQualification > stableJob, "full in-app upgrade qualification must gate Stable");
  assert.match(workflow, /Re-download and verify the exact private-draft assets/);
  assert.match(workflow, /Re-download and verify the exact Preview assets/);
  assert.doesNotMatch(workflow, /build:android:release/);
  for (const gate of ["acceptedMobileApkVerified", "windowsCleanInstall", "windowsUpgradeFrom3_1_0"]) {
    assert.equal(typeof qualification[gate], "boolean");
  }
});

test("release qualification blocks missing evidence and each required physical gate", () => {
  const filename = path.join(repoRoot, "scripts/check-release-qualification.cjs");
  const source = fs.readFileSync(filename, "utf8");
  const map = readJson(path.join(repoRoot, "config/orion-release-map-v1.json"));
  const template = readJson(path.join(repoRoot, "config/release-qualification-3.2.0.json"));
  const ready = Object.fromEntries(Object.entries(template).map(([key, value]) => [key, typeof value === "boolean" ? true : value]));
  ready.evidence = Object.fromEntries(Object.keys(template.evidence).map((key) => [key, "test-evidence"]));
  const run = (qualification) => vm.runInNewContext(source, {
    __dirname: path.join(repoRoot, "scripts"), console: { log() {}, error() {} },
    process: { argv: ["node", filename, "--phase", "stable"], exit: (code) => { throw new Error(`qualification exit ${code}`); } },
    require: (name) => name === "node:fs" ? {
      readFileSync: (target) => JSON.stringify(target.endsWith("orion-release-map-v1.json") ? map : qualification),
    } : require(name),
  });
  assert.doesNotThrow(() => run(ready));
  for (const [gate, value] of Object.entries(ready)) {
    if (value === true) assert.throws(() => run({ ...ready, [gate]: false }), /qualification exit 1/);
  }
  assert.throws(() => run({ ...ready, evidence: { ...ready.evidence, desktopInstallerSha256: "" } }), /qualification exit 1/);
});
