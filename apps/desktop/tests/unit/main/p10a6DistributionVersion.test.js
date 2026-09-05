const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const desktopRoot = path.resolve(__dirname, "../../..");
const repoRoot = path.resolve(desktopRoot, "../..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("P10A.6 Desktop candidate owns 2.2.17 without rewriting frozen Mobile identity", () => {
  const desktopPackage = readJson(path.join(desktopRoot, "package.json"));
  const rootPackage = readJson(path.join(repoRoot, "package.json"));
  const packageLock = readJson(path.join(repoRoot, "package-lock.json"));
  const mobilePackage = readJson(path.join(repoRoot, "apps/mobile/package.json"));
  const mobileApp = readJson(path.join(repoRoot, "apps/mobile/app.json"));

  assert.equal(desktopPackage.version, "2.2.17");
  assert.equal(packageLock.packages["apps/desktop"].version, "2.2.17");

  assert.equal(rootPackage.version, "2.1.2");
  assert.equal(packageLock.version, "2.1.2");
  assert.equal(packageLock.packages[""].version, "2.1.2");

  assert.equal(mobilePackage.version, "2.2.16");
  assert.equal(packageLock.packages["apps/mobile"].version, "2.2.16");
  assert.equal(mobileApp.expo.version, "2.2.16");
  assert.equal(mobileApp.expo.android.versionCode, 50);
});
