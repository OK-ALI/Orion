const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

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
const cinemaNativeFiles = [
  "OrionCinemaWebViewClient.kt",
  "OrionCinemaWebChromeClient.kt",
  "OrionCinemaWebViewManager.kt",
  "OrionCinemaWebViewPackage.kt",
  "OrionPlayerSystemUiModule.kt",
];

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

function syncCinemaNativeSources() {
  fs.mkdirSync(cinemaNativeTargetDirectory, { recursive: true });
  for (const fileName of cinemaNativeFiles) {
    const source = path.join(cinemaNativeSourceDirectory, fileName);
    const target = path.join(cinemaNativeTargetDirectory, fileName);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing authoritative Cinema native source: ${source}`);
    }
    fs.copyFileSync(source, target);
    if (!fs.readFileSync(source).equals(fs.readFileSync(target))) {
      throw new Error(`Cinema native source did not synchronize: ${fileName}`);
    }
  }
  console.log(`[Android] Synchronized ${cinemaNativeFiles.length} Cinema shield sources.`);
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

try {
  syncCinemaNativeSources();
  syncGoogleIdentityNativeSources();
  syncGoogleDriveAuthorizationNativeSources();
  ensureGoogleIdentityGradleDependencies();
  ensureGoogleDriveAuthorizationGradleDependencies();
  ensureGoogleIdentityPackageRegistration();
  ensureGoogleDriveAuthorizationPackageRegistration();
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
