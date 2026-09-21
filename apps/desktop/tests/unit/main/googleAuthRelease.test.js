const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const desktopRoot = path.resolve(__dirname, "../../..");
const repoRoot = path.resolve(desktopRoot, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("v3.2 Desktop release packages Orion's managed Google Desktop OAuth pair", () => {
  const exporter = read("apps/desktop/scripts/export_bundled_env.js");
  const auth = read("apps/desktop/src/main/ipc/googleAuthIpc.js");
  const prepare = read("scripts/prepare-protected-release-local.ps1");
  const envExample = read("apps/desktop/.env.example");
  const desktopPackage = JSON.parse(
    read("apps/desktop/package.json"),
  );

  assert.ok(
    desktopPackage.build.files.includes(".env"),
    "Electron Builder must package the generated Desktop .env",
  );

  assert.match(
    exporter,
    /sourceEnv\.ORION_GOOGLE_CLIENT_SECRET/,
  );
  assert.match(
    exporter,
    /decryptStoredValue\(store, "google_client_secret"\)/,
  );
  assert.match(
    exporter,
    /ORION_GOOGLE_CLIENT_SECRET=\$\{googleClientSecret\}/,
  );

  assert.match(
    prepare,
    /\$googleClientSecret = Get-EnvFileValue \$desktopEnv "ORION_GOOGLE_CLIENT_SECRET"/,
  );
  assert.match(
    prepare,
    /managed Google Desktop OAuth client secret/,
  );

  const forbiddenBlock = prepare.match(
    /\$forbiddenReleaseKeys = @\(([\s\S]*?)\n\s*\)/,
  );
  assert.ok(forbiddenBlock, "release forbidden-key block must exist");
  assert.doesNotMatch(
    forbiddenBlock[1],
    /ORION_GOOGLE_CLIENT_SECRET/,
    "Google's installed Desktop OAuth credential must not be stripped",
  );
  assert.match(forbiddenBlock[1], /ORION_WYZIE_API_KEY/);
  assert.match(forbiddenBlock[1], /ORION_SUBDL_API_KEY/);

  assert.match(
    auth,
    /const bundledSecret = getEnvValue\("ORION_GOOGLE_CLIENT_SECRET"\)/,
  );
  assert.match(
    auth,
    /const clientSecret = bundledSecret \|\| storedSecret \|\| ""/,
  );
  assert.match(
    auth,
    /if \(clientSecret\) body\.set\("client_secret", clientSecret\)/,
  );

  assert.match(
    envExample,
    /ORION_GOOGLE_CLIENT_SECRET=replace_with_your_google_desktop_client_secret/,
  );
});

test("failed Google refresh converges renderer and persisted account state", () => {
  const auth = read("apps/desktop/src/main/ipc/googleAuthIpc.js");
  const session = read("apps/desktop/src/main/ipc/googleAuthSession.js");

  assert.match(
    auth,
    /require\("\.\/googleAuthSession"\)/,
  );
  assert.match(
    auth,
    /catch \(err\) \{\s*clearGoogleSessionAndReload\(\);\s*throw new Error\("Google connection expired\. Please sign in again\."\);/,
  );

  assert.match(
    session,
    /BrowserWindow\.getAllWindows\(\)/,
  );
  assert.match(
    session,
    /"google_access_token"[\s\S]*"google_refresh_token"[\s\S]*"google_profile"/,
  );
  assert.match(
    session,
    /window\.webContents\.reload\(\)/,
  );

  assert.doesNotMatch(
    auth,
    /BrowserWindow\.getAllWindows\(\)/,
    "renderer reload ownership should stay outside the already-large auth IPC module",
  );
});
