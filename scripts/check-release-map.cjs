const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const map = read("config/orion-release-map-v1.json");
const rootPackage = read("package.json");
const desktopPackage = read("apps/desktop/package.json");
const mobilePackage = read("apps/mobile/package.json");
const app = read("apps/mobile/app.json").expo;

const checks = [
  ["root package", rootPackage.version, map.productVersion],
  ["Desktop package", desktopPackage.version, map.desktopVersion],
  ["Mobile package", mobilePackage.version, map.mobileVersion],
  ["Mobile display version", app.version, map.mobileVersion],
  ["Android version code", app.android?.versionCode, map.androidVersionCode],
  ["Mobile runtime", app.runtimeVersion, map.mobileRuntimeVersion],
  ["Git tag", map.gitTag, `v${map.productVersion}`],
  ["Windows installer", map.artifacts?.windowsInstaller, `Orion.Setup.${map.productVersion}.exe`],
  ["Windows archive", map.artifacts?.windowsArchive, `Orion-${map.productVersion}-win.zip`],
  ["Android installer", map.artifacts?.androidInstaller, `orion-mobile-v${map.productVersion}.apk`],
  ["Desktop NSIS artifact", desktopPackage.build?.nsis?.artifactName, "Orion.Setup.${version}.${ext}"],
  ["Desktop archive artifact", desktopPackage.build?.artifactName, "Orion-${version}-win.${ext}"],
];

const failures = checks.filter(([, actual, expected]) => actual !== expected);
if (failures.length) {
  for (const [name, actual, expected] of failures) {
    console.error(`${name}: expected ${expected}, received ${actual}`);
  }
  process.exit(1);
}
console.log(`Orion ${map.productVersion} release map is consistent.`);
