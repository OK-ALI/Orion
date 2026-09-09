const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const desktopRoot = path.resolve(__dirname, "../../..");
const repoRoot = path.resolve(desktopRoot, "../..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("Orion v3.1 production release owns aligned Desktop and Mobile 3.1.1 identities", () => {
  const desktopPackage = readJson(path.join(desktopRoot, "package.json"));
  const rootPackage = readJson(path.join(repoRoot, "package.json"));
  const packageLock = readJson(path.join(repoRoot, "package-lock.json"));
  const mobilePackage = readJson(path.join(repoRoot, "apps/mobile/package.json"));
  const mobileApp = readJson(path.join(repoRoot, "apps/mobile/app.json"));

  assert.equal(desktopPackage.version, "3.1.1");
  assert.equal(packageLock.packages["apps/desktop"].version, "3.1.1");

  assert.equal(rootPackage.version, "3.1.1");
  assert.equal(packageLock.version, "3.1.1");
  assert.equal(packageLock.packages[""].version, "3.1.1");

  assert.equal(mobilePackage.version, "3.1.1");
  assert.equal(packageLock.packages["apps/mobile"].version, "3.1.1");
  assert.equal(mobileApp.expo.version, "3.1.1");
  assert.equal(mobileApp.expo.android.versionCode, 58);
});
