const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const {
  requireMobileProductionConfig,
  verifyMobileProductionConfigEmbedded,
} = require("./orion-google-production-config.cjs");

const androidDirectory = path.resolve(__dirname, "..", "android");
const gradleWrapper = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const projectDirectory = path.resolve(__dirname, "..");
const debugApk = path.join(
  androidDirectory,
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk",
);
const embeddedBundle = path.join(
  androidDirectory,
  "app",
  "src",
  "main",
  "assets",
  "index.android.bundle",
);
const embeddedManifest = path.join(
  androidDirectory,
  "app",
  "src",
  "main",
  "assets",
  "app.manifest",
);
const androidResources = path.join(androidDirectory, "app", "src", "main", "res");
const standaloneDirectory = path.join(
  androidDirectory,
  "app",
  "build",
  "outputs",
  "apk",
  "standalone",
);
const standaloneApk = path.join(standaloneDirectory, "orion-mobile-standalone.apk");
const defaultWindowsSdk = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk")
  : "";
const androidSdk = process.env.ANDROID_HOME
  || process.env.ANDROID_SDK_ROOT
  || (defaultWindowsSdk && fs.existsSync(defaultWindowsSdk) ? defaultWindowsSdk : "");

const cinemaNativeSourceDirectory = path.join(
  projectDirectory,
  "plugins",
  "orion-cinema-webview-native",
);
const cinemaNativeTargetDirectory = path.join(
  androidDirectory,
  "app",
  "src",
  "main",
  "java",
  "com",
  "okali",
  "orion",
  "playback",
);
const cinemaConfigPlugin = require(path.join(
  projectDirectory,
  "plugins",
  "withOrionCinemaWebView.js",
));
const cinemaNativeFiles = cinemaConfigPlugin.CINEMA_NATIVE_FILES;
if (!Array.isArray(cinemaNativeFiles) || cinemaNativeFiles.length === 0) {
  throw new Error("Orion Cinema native source manifest is missing or empty.");
}
const cinemaNativeTestSourceDirectory = path.join(
  projectDirectory,
  "plugins",
  "orion-cinema-webview-native-tests",
);
const cinemaNativeTestTargetDirectory = path.join(
  androidDirectory,
  "app",
  "src",
  "test",
  "java",
  "com",
  "okali",
  "orion",
  "playback",
);
const cinemaNativeTestFiles = cinemaConfigPlugin.CINEMA_NATIVE_TEST_FILES;
if (!Array.isArray(cinemaNativeTestFiles) || cinemaNativeTestFiles.length === 0) {
  throw new Error("Orion Cinema native test source manifest is missing or empty.");
}
const cinemaNativeResourceFiles = cinemaConfigPlugin.CINEMA_NATIVE_RESOURCE_FILES;
if (!Array.isArray(cinemaNativeResourceFiles) || cinemaNativeResourceFiles.length === 0) {
  throw new Error("Orion Cinema native resource manifest is missing or empty.");
}
const cinemaNativeResourceSourceDirectory = path.join(
  projectDirectory,
  "plugins",
  "orion-cinema-webview-native-res",
);
const cinemaAndroidDependencyMarker = cinemaConfigPlugin.CINEMA_ANDROID_DEPENDENCY_MARKER;
const cinemaAndroidDependencies = cinemaConfigPlugin.CINEMA_ANDROID_DEPENDENCIES;
if (
  typeof cinemaAndroidDependencyMarker !== "string"
  || !Array.isArray(cinemaAndroidDependencies)
  || cinemaAndroidDependencies.length === 0
) {
  throw new Error("Orion Cinema Android dependency manifest is missing or empty.");
}

const googleIdentityNativeSourceDirectory = path.join(
  projectDirectory,
  "plugins",
  "orion-google-identity-native",
);
const googleIdentityNativeTargetDirectory = path.join(
  androidDirectory,
  "app",
  "src",
  "main",
  "java",
  "com",
  "okali",
  "orion",
  "identity",
);
const googleIdentityNativeFiles = [
  "OrionGoogleIdentityModule.kt",
  "OrionGoogleIdentityPackage.kt",
];
const androidAppBuildGradle = path.join(androidDirectory, "app", "build.gradle");
const androidMainApplication = path.join(
  androidDirectory,
  "app",
  "src",
  "main",
  "java",
  "com",
  "okali",
  "orion",
  "MainApplication.kt",
);
const googleIdentityDependencyMarker = "// ORION_GOOGLE_IDENTITY_DEPENDENCIES";
const googleIdentityDependencies = [
  'implementation "androidx.credentials:credentials:1.6.0"',
  'implementation "androidx.credentials:credentials-play-services-auth:1.6.0"',
  'implementation "com.google.android.libraries.identity.googleid:googleid:1.2.0"',
];

const googleDriveAuthorizationNativeSourceDirectory = path.join(
  projectDirectory,
  "plugins",
  "orion-google-drive-authorization-native",
);
const googleDriveAuthorizationNativeTargetDirectory = path.join(
  androidDirectory,
  "app",
  "src",
  "main",
  "java",
  "com",
  "okali",
  "orion",
  "cloud",
);
const googleDriveAuthorizationNativeFiles = [
  "OrionGoogleDriveAuthorizationModule.kt",
  "OrionGoogleDriveProfileStoreModule.kt",
  "OrionGoogleDriveAuthorizationPackage.kt",
];
const googleDriveAuthorizationDependencyMarker = "// ORION_GOOGLE_DRIVE_AUTHORIZATION_DEPENDENCIES";
const googleDriveAuthorizationDependencies = [
  'implementation "com.google.android.gms:play-services-auth:21.6.0"',
];


const orionUpdateNativeSourceDirectory = path.join(
  projectDirectory,
  "plugins",
  "orion-updates-native",
);
const orionUpdateNativeTargetDirectory = path.join(
  androidDirectory,
  "app",
  "src",
  "main",
  "java",
  "com",
  "okali",
  "orion",
  "updates",
);
const orionUpdateNativeFiles = ["OrionUpdateModule.kt", "OrionUpdatePackage.kt"];
const androidManifest = path.join(androidDirectory, "app", "src", "main", "AndroidManifest.xml");
const androidXmlDirectory = path.join(androidDirectory, "app", "src", "main", "res", "xml");
const downloadFilePathsXml = path.join(androidXmlDirectory, "orion_download_file_paths.xml");
const updateFilePathsXml = path.join(androidXmlDirectory, "orion_update_file_paths.xml");
const appConfigJson = path.join(projectDirectory, "app.json");
const androidValuesDirectory = path.join(androidDirectory, "app", "src", "main", "res", "values");
const androidStringsXml = path.join(androidValuesDirectory, "strings.xml");

function ensureAndroidAppVersion() {
  const appConfig = JSON.parse(fs.readFileSync(appConfigJson, "utf8")).expo || {};
  const versionName =
    typeof appConfig.version === "string" ? appConfig.version.trim() : "";
  const versionCode = appConfig.android?.versionCode;

  if (!versionName) {
    throw new Error("Orion app version is missing from app.json.");
  }

  if (!Number.isInteger(versionCode) || versionCode < 1) {
    throw new Error(
      "Orion Android versionCode must be a positive integer in app.json.",
    );
  }

  let contents = fs.readFileSync(androidAppBuildGradle, "utf8");

  const versionCodeMatches =
    contents.match(/^\s*versionCode\s+\d+\s*$/gm) || [];
  const versionNameMatches =
    contents.match(/^\s*versionName\s+"[^"]+"\s*$/gm) || [];

  if (versionCodeMatches.length !== 1) {
    throw new Error(
      `Expected exactly one Android versionCode declaration, found ${versionCodeMatches.length}.`,
    );
  }

  if (versionNameMatches.length !== 1) {
    throw new Error(
      `Expected exactly one Android versionName declaration, found ${versionNameMatches.length}.`,
    );
  }

  contents = contents
    .replace(
      /^(\s*)versionCode\s+\d+\s*$/m,
      `$1versionCode ${versionCode}`,
    )
    .replace(
      /^(\s*)versionName\s+"[^"]+"\s*$/m,
      `$1versionName "${versionName}"`,
    );

  fs.writeFileSync(androidAppBuildGradle, contents, "utf8");

  const verified = fs.readFileSync(androidAppBuildGradle, "utf8");

  if (
    !verified.includes(`versionCode ${versionCode}`) ||
    !verified.includes(`versionName "${versionName}"`)
  ) {
    throw new Error(
      "Orion Android app version did not persist to generated Gradle.",
    );
  }

  console.log(
    `[Android] App version materialized: ${versionName} (versionCode ${versionCode}).`,
  );
}
function syncCinemaNativeSources() {
  const sha256 = (filePath) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  fs.mkdirSync(cinemaNativeTargetDirectory, { recursive: true });
  for (const fileName of cinemaNativeFiles) {
    const source = path.join(cinemaNativeSourceDirectory, fileName);
    const target = path.join(cinemaNativeTargetDirectory, fileName);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing authoritative Cinema native source: ${source}`);
    }
    fs.copyFileSync(source, target);
    if (sha256(source) !== sha256(target)) {
      throw new Error(`Cinema native source did not synchronize: ${fileName}`);
    }
  }
  fs.mkdirSync(cinemaNativeTestTargetDirectory, { recursive: true });
  for (const fileName of cinemaNativeTestFiles) {
    const source = path.join(cinemaNativeTestSourceDirectory, fileName);
    const target = path.join(cinemaNativeTestTargetDirectory, fileName);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing authoritative Cinema native test source: ${source}`);
    }
    fs.copyFileSync(source, target);
    if (sha256(source) !== sha256(target)) {
      throw new Error(`Cinema native test source did not synchronize: ${fileName}`);
    }
  }
  for (const resource of cinemaNativeResourceFiles) {
    const source = path.join(cinemaNativeResourceSourceDirectory, resource.directory, resource.name);
    const targetDirectory = path.join(androidResources, resource.directory);
    const target = path.join(targetDirectory, resource.name);
    if (!fs.existsSync(source)) throw new Error(`Missing authoritative Cinema native resource: ${source}`);
    fs.mkdirSync(targetDirectory, { recursive: true });
    fs.copyFileSync(source, target);
    if (sha256(source) !== sha256(target)) {
      throw new Error(`Cinema native resource did not synchronize: ${resource.name}`);
    }
  }
  console.log(`[Android] Synchronized and SHA-256 verified ${cinemaNativeFiles.length} Cinema native sources, ${cinemaNativeTestFiles.length} JVM tests, and ${cinemaNativeResourceFiles.length} resources.`);
}

function ensureCinemaGradleDependencies() {
  let contents = fs.readFileSync(androidAppBuildGradle, "utf8");
  if (!contents.includes(cinemaAndroidDependencyMarker)) {
    const dependencyMatch = /dependencies\s*\{/;
    if (!dependencyMatch.test(contents)) {
      throw new Error(`Unable to locate Android app dependencies block: ${androidAppBuildGradle}`);
    }
    const block = [
      cinemaAndroidDependencyMarker,
      ...cinemaAndroidDependencies,
    ].map((line) => `    ${line}`).join("\n");
    contents = contents.replace(dependencyMatch, (match) => `${match}\n${block}`);
    fs.writeFileSync(androidAppBuildGradle, contents, "utf8");
  }
  const verified = fs.readFileSync(androidAppBuildGradle, "utf8");
  for (const dependency of cinemaAndroidDependencies) {
    if (!verified.includes(dependency)) {
      throw new Error(`Orion Cinema Android dependency is missing: ${dependency}`);
    }
  }
  console.log("[Android] Orion Cinema Gradle dependencies verified.");
}

function ensureCinemaPlayerActivity() {
  let contents = fs.readFileSync(androidManifest, "utf8");
  const playerActivityName = "com.okali.orion.playback.OrionPlayerActivity";
  if (!contents.includes(`android:name="${playerActivityName}"`)) {
    const activity = [
      `    <activity android:name="${playerActivityName}" android:exported="false" android:hardwareAccelerated="true" android:screenOrientation="sensorLandscape" android:configChanges="keyboard|keyboardHidden|orientation|screenSize|uiMode"/>`,
    ].join("\n");
    if (!contents.includes("  </application>")) throw new Error("Unable to locate Android application for Orion Player.");
    contents = contents.replace("  </application>", `${activity}\n  </application>`);
    fs.writeFileSync(androidManifest, contents, "utf8");
  }
  const verified = fs.readFileSync(androidManifest, "utf8");
  for (const required of [
    `android:name="${playerActivityName}"`,
    'android:exported="false"',
    'android:hardwareAccelerated="true"',
    'android:screenOrientation="sensorLandscape"',
  ]) {
    if (!verified.includes(required)) throw new Error(`Orion Player manifest prerequisite is missing: ${required}`);
  }
  console.log("[Android] Orion Player Activity manifest verified.");
}

function ensureCinemaDownloadFileProvider() {
  let contents = fs.readFileSync(androidManifest, "utf8");
  if (!contents.includes('${applicationId}.orion-downloads')) {
    const provider = [
      '    <provider android:name="androidx.core.content.FileProvider" android:authorities="${applicationId}.orion-downloads" android:exported="false" android:grantUriPermissions="true">',
      '      <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/orion_download_file_paths"/>',
      '    </provider>',
    ].join("\n");
    if (!contents.includes("  </application>")) throw new Error("Unable to locate Android application for Orion download sharing.");
    contents = contents.replace("  </application>", `${provider}\n  </application>`);
    fs.writeFileSync(androidManifest, contents, "utf8");
  }
  fs.mkdirSync(androidXmlDirectory, { recursive: true });
  fs.writeFileSync(
    downloadFilePathsXml,
    '<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android">\n  <files-path name="orion_downloads" path="orion-downloads/library/"/>\n</paths>\n',
    "utf8",
  );
  const verified = fs.readFileSync(androidManifest, "utf8");
  if (!verified.includes('${applicationId}.orion-downloads') || !fs.existsSync(downloadFilePathsXml)) {
    throw new Error("Orion download FileProvider prerequisites did not persist.");
  }
  console.log("[Android] Orion download FileProvider verified.");
}

function syncGoogleIdentityNativeSources() {
  fs.mkdirSync(googleIdentityNativeTargetDirectory, { recursive: true });
  for (const fileName of googleIdentityNativeFiles) {
    const source = path.join(googleIdentityNativeSourceDirectory, fileName);
    const target = path.join(googleIdentityNativeTargetDirectory, fileName);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing authoritative Google Identity native source: ${source}`);
    }
    fs.copyFileSync(source, target);
    if (!fs.readFileSync(source).equals(fs.readFileSync(target))) {
      throw new Error(`Google Identity native source did not synchronize: ${fileName}`);
    }
  }
  console.log(`[Android] Synchronized ${googleIdentityNativeFiles.length} Google Identity sources.`);
}

function ensureGoogleIdentityGradleDependencies() {
  let contents = fs.readFileSync(androidAppBuildGradle, "utf8");
  if (!contents.includes(googleIdentityDependencyMarker)) {
    const dependencyMatch = /dependencies\s*\{/;
    if (!dependencyMatch.test(contents)) {
      throw new Error(`Unable to locate Android app dependencies block: ${androidAppBuildGradle}`);
    }
    const block = [
      googleIdentityDependencyMarker,
      ...googleIdentityDependencies,
    ].map((line) => `    ${line}`).join("\n");
    contents = contents.replace(dependencyMatch, (match) => `${match}\n${block}`);
    fs.writeFileSync(androidAppBuildGradle, contents, "utf8");
  }

  const verified = fs.readFileSync(androidAppBuildGradle, "utf8");
  for (const dependency of googleIdentityDependencies) {
    if (!verified.includes(dependency)) {
      throw new Error(`Google Identity Android dependency is missing: ${dependency}`);
    }
  }
  console.log("[Android] Google Identity Gradle dependencies verified.");
}

function syncGoogleDriveAuthorizationNativeSources() {
  fs.mkdirSync(googleDriveAuthorizationNativeTargetDirectory, { recursive: true });
  for (const fileName of googleDriveAuthorizationNativeFiles) {
    const source = path.join(googleDriveAuthorizationNativeSourceDirectory, fileName);
    const target = path.join(googleDriveAuthorizationNativeTargetDirectory, fileName);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing authoritative Google Drive authorization native source: ${source}`);
    }
    fs.copyFileSync(source, target);
    if (!fs.readFileSync(source).equals(fs.readFileSync(target))) {
      throw new Error(`Google Drive authorization native source did not synchronize: ${fileName}`);
    }
  }
  console.log(`[Android] Synchronized ${googleDriveAuthorizationNativeFiles.length} Google Drive authorization sources.`);
}

function ensureGoogleDriveAuthorizationGradleDependencies() {
  let contents = fs.readFileSync(androidAppBuildGradle, "utf8");
  if (!contents.includes(googleDriveAuthorizationDependencyMarker)) {
    const dependencyMatch = /dependencies\s*\{/;
    if (!dependencyMatch.test(contents)) {
      throw new Error(`Unable to locate Android app dependencies block: ${androidAppBuildGradle}`);
    }
    const block = [
      googleDriveAuthorizationDependencyMarker,
      ...googleDriveAuthorizationDependencies,
    ].map((line) => `    ${line}`).join("\n");
    contents = contents.replace(dependencyMatch, (match) => `${match}\n${block}`);
    fs.writeFileSync(androidAppBuildGradle, contents, "utf8");
  }

  const verified = fs.readFileSync(androidAppBuildGradle, "utf8");
  for (const dependency of googleDriveAuthorizationDependencies) {
    if (!verified.includes(dependency)) {
      throw new Error(`Google Drive authorization Android dependency is missing: ${dependency}`);
    }
  }
  console.log("[Android] Google Drive authorization Gradle dependencies verified.");
}

function ensureGoogleDriveAuthorizationPackageRegistration() {
  let contents = fs.readFileSync(androidMainApplication, "utf8");
  const packageImport = "import com.okali.orion.cloud.OrionGoogleDriveAuthorizationPackage";
  const packageRegistration = "add(OrionGoogleDriveAuthorizationPackage())";

  if (!contents.includes(packageImport)) {
    const firstImport = contents.indexOf("import ");
    if (firstImport < 0) {
      throw new Error(`Unable to locate MainApplication imports: ${androidMainApplication}`);
    }
    contents = `${contents.slice(0, firstImport)}${packageImport}\n${contents.slice(firstImport)}`;
  }

  if (!contents.includes(packageRegistration)) {
    const packageApply = /PackageList\(this\)\.packages\.apply\s*\{/;
    if (!packageApply.test(contents)) {
      throw new Error(`Unable to locate React Native package list: ${androidMainApplication}`);
    }
    contents = contents.replace(
      packageApply,
      (match) => `${match}\n          ${packageRegistration}`,
    );
  }

  fs.writeFileSync(androidMainApplication, contents, "utf8");
  const verified = fs.readFileSync(androidMainApplication, "utf8");
  if (!verified.includes(packageImport) || !verified.includes(packageRegistration)) {
    throw new Error("Google Drive authorization native package registration did not persist.");
  }
  console.log("[Android] Google Drive authorization package registration verified.");
}

function ensureGoogleIdentityPackageRegistration() {
  let contents = fs.readFileSync(androidMainApplication, "utf8");
  const packageImport = "import com.okali.orion.identity.OrionGoogleIdentityPackage";
  const packageRegistration = "add(OrionGoogleIdentityPackage())";

  if (!contents.includes(packageImport)) {
    const firstImport = contents.indexOf("import ");
    if (firstImport < 0) {
      throw new Error(`Unable to locate MainApplication imports: ${androidMainApplication}`);
    }
    contents = `${contents.slice(0, firstImport)}${packageImport}\n${contents.slice(firstImport)}`;
  }

  if (!contents.includes(packageRegistration)) {
    const packageApply = /PackageList\(this\)\.packages\.apply\s*\{/;
    if (!packageApply.test(contents)) {
      throw new Error(`Unable to locate React Native package list: ${androidMainApplication}`);
    }
    contents = contents.replace(
      packageApply,
      (match) => `${match}\n          ${packageRegistration}`,
    );
  }

  fs.writeFileSync(androidMainApplication, contents, "utf8");
  const verified = fs.readFileSync(androidMainApplication, "utf8");
  if (!verified.includes(packageImport) || !verified.includes(packageRegistration)) {
    throw new Error("Google Identity native package registration did not persist.");
  }
  console.log("[Android] Google Identity package registration verified.");
}


function syncOrionUpdateNativeSources() {
  fs.mkdirSync(orionUpdateNativeTargetDirectory, { recursive: true });
  for (const fileName of orionUpdateNativeFiles) {
    const source = path.join(orionUpdateNativeSourceDirectory, fileName);
    const target = path.join(orionUpdateNativeTargetDirectory, fileName);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing authoritative Orion Updates native source: ${source}`);
    }
    fs.copyFileSync(source, target);
    if (!fs.readFileSync(source).equals(fs.readFileSync(target))) {
      throw new Error(`Orion Updates native source did not synchronize: ${fileName}`);
    }
  }
  console.log(`[Android] Synchronized ${orionUpdateNativeFiles.length} Orion Updates sources.`);
}

function ensureOrionUpdatePackageRegistration() {
  let contents = fs.readFileSync(androidMainApplication, "utf8");
  const packageImport = "import com.okali.orion.updates.OrionUpdatePackage";
  const packageRegistration = "add(OrionUpdatePackage())";
  if (!contents.includes(packageImport)) {
    const firstImport = contents.indexOf("import ");
    if (firstImport < 0) {
      throw new Error(`Unable to locate MainApplication imports: ${androidMainApplication}`);
    }
    contents = `${contents.slice(0, firstImport)}${packageImport}\n${contents.slice(firstImport)}`;
  }
  if (!contents.includes(packageRegistration)) {
    const packageApply = /PackageList\(this\)\.packages\.apply\s*\{/;
    if (!packageApply.test(contents)) {
      throw new Error(`Unable to locate React Native package list: ${androidMainApplication}`);
    }
    contents = contents.replace(packageApply, (match) => `${match}\n          ${packageRegistration}`);
  }
  fs.writeFileSync(androidMainApplication, contents, "utf8");
  const verified = fs.readFileSync(androidMainApplication, "utf8");
  if (!verified.includes(packageImport) || !verified.includes(packageRegistration)) {
    throw new Error("Orion Updates package registration did not persist.");
  }
  console.log("[Android] Orion Updates package registration verified.");
}

function ensureDirectUpdateManifest() {
  let contents = fs.readFileSync(androidManifest, "utf8");
  const permission = '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/>';
  if (!contents.includes(permission)) {
    contents = contents.replace(/(<manifest\b[^>]*>)/, `$1\n  ${permission}`);
  }
  if (!contents.includes('${applicationId}.orion-updates')) {
    const provider = [
      '    <provider android:name="androidx.core.content.FileProvider" android:authorities="${applicationId}.orion-updates" android:exported="false" android:grantUriPermissions="true">',
      '      <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/orion_update_file_paths"/>',
      '    </provider>',
    ].join("\n");
    contents = contents.replace("  </application>", `${provider}\n  </application>`);
  }
  fs.writeFileSync(androidManifest, contents, "utf8");
  fs.mkdirSync(androidXmlDirectory, { recursive: true });
  fs.writeFileSync(
    updateFilePathsXml,
    '<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android">\n  <cache-path name="orion_updates" path="orion-updates/"/>\n</paths>\n',
    "utf8",
  );
  const verified = fs.readFileSync(androidManifest, "utf8");
  if (!verified.includes(permission) || !verified.includes('${applicationId}.orion-updates')) {
    throw new Error("Direct APK update manifest prerequisites did not persist.");
  }
  console.log("[Android] Direct APK update manifest prerequisites verified.");
}


function escapeXmlAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function upsertAndroidMetaData(contents, name, value) {
  const line = `    <meta-data android:name="${name}" android:value="${escapeXmlAttribute(value)}"/>`;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\s*<meta-data\\s+android:name="${escapedName}"[^>]*/>`);
  if (pattern.test(contents)) return contents.replace(pattern, `\n${line}`);
  if (!contents.includes("  </application>")) {
    throw new Error(`Unable to locate Android application block for ${name}.`);
  }
  return contents.replace("  </application>", `${line}\n  </application>`);
}

function removeAndroidMetaData(contents, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\s*<meta-data\\s+android:name="${escapedName}"[^>]*/>`, "g");
  return contents.replace(pattern, "");
}

function ensureExpoRuntimeUpdatesRetired() {
  const appConfig = JSON.parse(fs.readFileSync(appConfigJson, "utf8")).expo || {};
  const updates = appConfig.updates || {};
  const runtimeVersion = appConfig.runtimeVersion;

  if (updates.enabled !== false) {
    throw new Error("Orion production builds must keep Expo runtime updates disabled.");
  }
  if (updates.checkAutomatically !== "NEVER") {
    throw new Error("Orion production builds must never check Expo runtime updates.");
  }
  if (updates.url != null || updates.requestHeaders != null) {
    throw new Error("Orion production builds must not carry an Expo update URL or runtime channel headers.");
  }
  if (typeof runtimeVersion !== "string" || !runtimeVersion.trim()) {
    throw new Error("Orion transitional bundled-manifest runtimeVersion is missing from app.json.");
  }

  let manifest = fs.readFileSync(androidManifest, "utf8");
  manifest = upsertAndroidMetaData(manifest, "expo.modules.updates.ENABLED", "false");
  manifest = upsertAndroidMetaData(manifest, "expo.modules.updates.EXPO_RUNTIME_VERSION", "@string/expo_runtime_version");
  manifest = upsertAndroidMetaData(manifest, "expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH", "NEVER");
  manifest = upsertAndroidMetaData(manifest, "expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS", "0");
  manifest = upsertAndroidMetaData(manifest, "expo.modules.updates.HAS_EMBEDDED_UPDATE", "true");
  manifest = removeAndroidMetaData(manifest, "expo.modules.updates.EXPO_UPDATE_URL");
  manifest = removeAndroidMetaData(manifest, "expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY");
  fs.writeFileSync(androidManifest, manifest, "utf8");

  fs.mkdirSync(androidValuesDirectory, { recursive: true });
  let strings = fs.existsSync(androidStringsXml)
    ? fs.readFileSync(androidStringsXml, "utf8")
    : '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n';
  const runtimeLine = `  <string name="expo_runtime_version" translatable="false">${runtimeVersion}</string>`;
  const runtimePattern = /\s*<string\s+name="expo_runtime_version"[^>]*>[^<]*<\/string>/;
  if (runtimePattern.test(strings)) {
    strings = strings.replace(runtimePattern, `\n${runtimeLine}`);
  } else if (strings.includes("</resources>")) {
    strings = strings.replace("</resources>", `${runtimeLine}\n</resources>`);
  } else {
    throw new Error("Unable to locate Android strings resources for the transitional bundled manifest runtime version.");
  }
  fs.writeFileSync(androidStringsXml, strings, "utf8");

  const verifiedManifest = fs.readFileSync(androidManifest, "utf8");
  const required = [
    'android:name="expo.modules.updates.ENABLED" android:value="false"',
    'android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="NEVER"',
    'android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="@string/expo_runtime_version"',
  ];
  for (const marker of required) {
    if (!verifiedManifest.includes(marker)) {
      throw new Error(`Expo retirement Android metadata did not persist: ${marker}`);
    }
  }
  for (const forbidden of [
    "expo.modules.updates.EXPO_UPDATE_URL",
    "expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY",
  ]) {
    if (verifiedManifest.includes(forbidden)) {
      throw new Error(`Retired Expo remote-update metadata is still present: ${forbidden}`);
    }
  }
  console.log("[Android] Expo runtime updates retired; production will boot only the bundled app runtime.");
}


function prepareExpoEmbeddedUpdateManifest(entryFile) {
  let expoUpdatesPackageJson;
  try {
    expoUpdatesPackageJson = require.resolve("expo-updates/package.json", {
      paths: [projectDirectory],
    });
  } catch (error) {
    throw new Error(
      `Unable to resolve expo-updates for embedded manifest generation: ${error.message}`,
    );
  }

  const createUpdatesResourcesScript = path.join(
    path.dirname(expoUpdatesPackageJson),
    "utils",
    "build",
    "createUpdatesResources.js",
  );
  if (!fs.existsSync(createUpdatesResourcesScript)) {
    throw new Error(
      `Expo embedded update resource generator is missing: ${createUpdatesResourcesScript}`,
    );
  }

  fs.mkdirSync(path.dirname(embeddedManifest), { recursive: true });
  fs.rmSync(embeddedManifest, { force: true });

  const result = spawnSync(
    process.execPath,
    [
      createUpdatesResourcesScript,
      "android",
      projectDirectory,
      path.dirname(embeddedManifest),
      "all",
      entryFile,
    ],
    {
      cwd: projectDirectory,
      env: {
        ...process.env,
        NODE_ENV: "production",
      },
      shell: false,
      stdio: "inherit",
    },
  );

  if (result.error || result.status !== 0 || !fs.existsSync(embeddedManifest)) {
    throw new Error(
      `Unable to create Expo embedded update manifest: ${result.error?.message || "app.manifest generation failed"}`,
    );
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(embeddedManifest, "utf8"));
  } catch (error) {
    throw new Error(`Expo embedded update manifest is invalid JSON: ${error.message}`);
  }

  if (
    typeof manifest.id !== "string" ||
    !manifest.id ||
    typeof manifest.commitTime !== "number" ||
    !Array.isArray(manifest.assets)
  ) {
    throw new Error("Expo embedded update manifest is missing its required embedded-update fields.");
  }

  console.log("[Android] Expo embedded update manifest prepared: app.manifest");
}


if (process.argv.includes("--sync-native-only")) {
  try {
    syncCinemaNativeSources();
    ensureCinemaGradleDependencies();
    ensureCinemaPlayerActivity();
    ensureCinemaDownloadFileProvider();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  console.log("[Android] Native synchronization complete; bundling and Gradle assembly were not started.");
  process.exit(0);
}

let mobileProductionConfig;
try {
  mobileProductionConfig = requireMobileProductionConfig(projectDirectory);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

try {
  ensureAndroidAppVersion();
  syncCinemaNativeSources();
  ensureCinemaGradleDependencies();
  ensureCinemaPlayerActivity();
  ensureCinemaDownloadFileProvider();
  syncGoogleIdentityNativeSources();
  syncGoogleDriveAuthorizationNativeSources();
  syncOrionUpdateNativeSources();
  ensureGoogleIdentityGradleDependencies();
  ensureGoogleDriveAuthorizationGradleDependencies();
  ensureGoogleIdentityPackageRegistration();
  ensureGoogleDriveAuthorizationPackageRegistration();
  ensureOrionUpdatePackageRegistration();
  ensureDirectUpdateManifest();
  ensureExpoRuntimeUpdatesRetired();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const entryResult = spawnSync(
  process.execPath,
  ["-e", "require('expo/scripts/resolveAppEntry')", projectDirectory, "android", "absolute"],
  { encoding: "utf8" },
);

if (entryResult.error || entryResult.status !== 0) {
  console.error(
    `Unable to resolve the Android entry point: ${entryResult.error?.message || entryResult.stderr || "resolution failed"}`,
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(embeddedBundle), { recursive: true });
const bundleResult = spawnSync(
  process.execPath,
  [
    require.resolve("expo/bin/cli"),
    "export:embed",
    "--entry-file",
    entryResult.stdout.trim(),
    "--platform",
    "android",
    "--dev",
    "false",
    "--minify",
    "true",
    "--bytecode",
    "--bundle-output",
    embeddedBundle,
    "--assets-dest",
    androidResources,
  ],
  {
    cwd: projectDirectory,
    env: { ...process.env, NODE_ENV: "production" },
    shell: false,
    stdio: "inherit",
  },
);

if (bundleResult.error || bundleResult.status !== 0 || !fs.existsSync(embeddedBundle)) {
  console.error(`Unable to create the embedded Android bundle: ${bundleResult.error?.message || "bundle failed"}`);
  process.exit(bundleResult.status ?? 1);
}

try {
  verifyMobileProductionConfigEmbedded(embeddedBundle, mobileProductionConfig);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
console.log("[Android] Required mobile production configuration verified in the embedded bundle.");

try {
  prepareExpoEmbeddedUpdateManifest(entryResult.stdout.trim());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (process.argv.includes("--prepare-only")) {
  console.log("[Android] Production bundle and native release prerequisites prepared.");
  process.exit(0);
}

const result = spawnSync(
  gradleWrapper,
  [
    // The production bundle is generated explicitly above. Keeping the native
    // build in Debug avoids Windows' release-CMake path limit while producing a
    // debug-signed APK that works without Metro.
    "assembleDebug",
    "--no-daemon",
    "--no-parallel",
    "--console=plain",
    "-PreactNativeArchitectures=arm64-v8a",
  ],
  {
    cwd: androidDirectory,
    env: {
      ...process.env,
      NODE_ENV: "production",
      ...(androidSdk ? { ANDROID_HOME: androidSdk, ANDROID_SDK_ROOT: androidSdk } : {}),
    },
    shell: process.platform === "win32",
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(`Unable to start the Android build: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!fs.existsSync(debugApk)) {
  console.error(`Standalone APK was not produced at ${debugApk}`);
  process.exit(1);
}

const javaHomeJar = process.env.JAVA_HOME
  ? path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "jar.exe" : "jar")
  : "";
const jarCommand = javaHomeJar && fs.existsSync(javaHomeJar) ? javaHomeJar : "jar";
const archiveListing = spawnSync(jarCommand, ["tf", debugApk], {
  encoding: "utf8",
  shell: process.platform === "win32" && jarCommand === "jar",
});

if (archiveListing.error || archiveListing.status !== 0) {
  console.error(
    `Unable to inspect the standalone APK: ${archiveListing.error?.message || archiveListing.stderr || "jar failed"}`,
  );
  process.exit(1);
}

if (!archiveListing.stdout.split(/\r?\n/).includes("assets/index.android.bundle")) {
  console.error("Standalone APK validation failed: assets/index.android.bundle is missing.");
  process.exit(1);
}

fs.mkdirSync(standaloneDirectory, { recursive: true });
fs.copyFileSync(debugApk, standaloneApk);

console.log(`Standalone APK verified: ${standaloneApk}`);
console.log("Bundled JavaScript verified: assets/index.android.bundle");
