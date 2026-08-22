const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectDirectory = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(projectDirectory, "..", "..");
const androidDirectory = path.join(projectDirectory, "android");
const androidAppBuildGradle = path.join(androidDirectory, "app", "build.gradle");
const standaloneScript = path.join(__dirname, "build-android-standalone.cjs");
const releaseApk = path.join(
  androidDirectory,
  "app",
  "build",
  "outputs",
  "apk",
  "release",
  "app-release.apk",
);
const distributionDirectory = path.join(
  androidDirectory,
  "app",
  "build",
  "outputs",
  "apk",
  "distribution",
);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectDirectory, "package.json"), "utf8"),
);
const distributionApk = path.join(
  distributionDirectory,
  `orion-mobile-v${packageJson.version}.apk`,
);
const expectedCertificateSha256 =
  "4422EC4BC16B1C83C914A0AD1B688BE8F7C158FF7F99BCD223A909966AC7A1BD";
const releaseKeystore = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".orion",
  "signing",
  "orion-mobile-release.jks",
);
const defaultWindowsSdk = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk")
  : "";
const androidSdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  (defaultWindowsSdk && fs.existsSync(defaultWindowsSdk) ? defaultWindowsSdk : "");

function patchReleaseGradleText(input) {
  let contents = input;

  if (!contents.includes("// ORION_RELEASE_SIGNING_FOUNDATION")) {
    const projectRootLine =
      "def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()";
    if (!contents.includes(projectRootLine)) {
      throw new Error("Unable to locate Android projectRoot declaration for release signing.");
    }
    const foundation = [
      "// ORION_RELEASE_SIGNING_FOUNDATION",
      "def orionEmbeddedReleaseBundle = (findProperty('orion.useEmbeddedReleaseBundle') ?: 'false').toBoolean()",
      "def orionReleaseKeystore = new File(System.getProperty('user.home'), '.orion/signing/orion-mobile-release.jks')",
      "def orionReleaseStorePassword = System.getenv('ORION_ANDROID_RELEASE_STORE_PASSWORD')",
      "def orionReleaseKeyPassword = System.getenv('ORION_ANDROID_RELEASE_KEY_PASSWORD')",
      "def orionReleaseRequested = gradle.startParameter.taskNames.any { taskName ->",
      "    taskName.toLowerCase().contains('release')",
      "}",
      "def orionReleaseSigningReady = orionReleaseKeystore.isFile() &&",
      "    orionReleaseStorePassword && orionReleaseKeyPassword",
      "",
      "if (orionReleaseRequested && !orionEmbeddedReleaseBundle) {",
      "    throw new GradleException('Orion release builds must use the verified embedded-bundle pipeline: npm run build:android:release')",
      "}",
      "",
      "if (orionReleaseRequested && !orionReleaseSigningReady) {",
      "    def missing = []",
      '    if (!orionReleaseKeystore.isFile()) missing << "keystore ${orionReleaseKeystore}"',
      "    if (!orionReleaseStorePassword) missing << 'ORION_ANDROID_RELEASE_STORE_PASSWORD'",
      "    if (!orionReleaseKeyPassword) missing << 'ORION_ANDROID_RELEASE_KEY_PASSWORD'",
      '    throw new GradleException("Orion release signing is incomplete: ${missing.join(\', \')}")',
      "}",
    ].join("\n");
    contents = contents.replace(projectRootLine, `${projectRootLine}\n${foundation}`);
  }

  if (!contents.includes("// ORION_RELEASE_EMBEDDED_BUNDLE")) {
    const bundleLine =
      "    enableBundleCompression = (findProperty('android.enableBundleCompression') ?: false).toBoolean()";
    if (!contents.includes(bundleLine)) {
      throw new Error("Unable to locate React Native bundle configuration.");
    }
    const block = [
      "    // ORION_RELEASE_EMBEDDED_BUNDLE",
      "    if (orionEmbeddedReleaseBundle) {",
      "        // Orion prepares the production Expo bundle explicitly before assembleRelease.",
      "        // This skips duplicate RN bundling only; Android's release build remains non-debuggable.",
      '        debuggableVariants = ["debug", "release"]',
      "    }",
    ].join("\n");
    contents = contents.replace(bundleLine, `${bundleLine}\n${block}`);
  }

  if (!contents.includes("// ORION_RELEASE_SIGNING_CONFIG")) {
    const signingStart = contents.indexOf("    signingConfigs {");
    const buildTypesStart = contents.indexOf("    buildTypes {", signingStart);
    if (signingStart < 0 || buildTypesStart < 0) {
      throw new Error("Unable to locate Android signingConfigs/buildTypes blocks.");
    }
    const signingClose = contents.lastIndexOf("    }", buildTypesStart);
    if (signingClose < signingStart) {
      throw new Error("Unable to locate Android signingConfigs closing brace.");
    }
    const releaseSigning = [
      "        // ORION_RELEASE_SIGNING_CONFIG",
      "        release {",
      "            if (orionReleaseSigningReady) {",
      "                storeFile orionReleaseKeystore",
      "                storePassword orionReleaseStorePassword",
      "                keyAlias 'orion-mobile'",
      "                keyPassword orionReleaseKeyPassword",
      "            }",
      "        }",
      "",
    ].join("\n");
    contents = `${contents.slice(0, signingClose)}${releaseSigning}${contents.slice(signingClose)}`;
  }

  const buildTypesStart = contents.indexOf("    buildTypes {");
  const packagingStart = contents.indexOf("    packagingOptions {", buildTypesStart);
  if (buildTypesStart < 0 || packagingStart < 0) {
    throw new Error("Unable to isolate Android buildTypes block.");
  }
  const before = contents.slice(0, buildTypesStart);
  let buildTypes = contents.slice(buildTypesStart, packagingStart);
  const after = contents.slice(packagingStart);
  const releaseMatch = buildTypes.match(/(\n\s*release\s*\{)([\s\S]*?)(\n\s*\})/);
  if (!releaseMatch) {
    throw new Error("Unable to locate Android release build type.");
  }
  let releaseBody = releaseMatch[2];
  releaseBody = releaseBody.replace(/\n\s*\/\/ Caution![^\n]*/g, "");
  releaseBody = releaseBody.replace(/\n\s*\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\./g, "");
  if (/signingConfig\s+signingConfigs\.debug/.test(releaseBody)) {
    releaseBody = releaseBody.replace(
      /signingConfig\s+signingConfigs\.debug/,
      "signingConfig signingConfigs.release",
    );
  } else if (!/signingConfig\s+signingConfigs\.release/.test(releaseBody)) {
    releaseBody = `\n            signingConfig signingConfigs.release${releaseBody}`;
  }
  buildTypes = buildTypes.replace(
    releaseMatch[0],
    `${releaseMatch[1]}${releaseBody}${releaseMatch[3]}`,
  );
  contents = `${before}${buildTypes}${after}`;

  const required = [
    "// ORION_RELEASE_SIGNING_FOUNDATION",
    "// ORION_RELEASE_EMBEDDED_BUNDLE",
    "// ORION_RELEASE_SIGNING_CONFIG",
    "signingConfig signingConfigs.release",
    "keyAlias 'orion-mobile'",
  ];
  for (const marker of required) {
    if (!contents.includes(marker)) {
      throw new Error(`Android release Gradle patch verification failed: ${marker}`);
    }
  }
  const releaseBlock = contents
    .slice(contents.indexOf("    buildTypes {"), contents.indexOf("    packagingOptions {"));
  if (/release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/.test(releaseBlock)) {
    throw new Error("Android release build still references the debug signing identity.");
  }
  return contents;
}

function ensureReleaseGradleConfiguration() {
  if (!fs.existsSync(androidAppBuildGradle)) {
    throw new Error(`Android app build.gradle not found: ${androidAppBuildGradle}`);
  }
  const before = fs.readFileSync(androidAppBuildGradle, "utf8");
  const after = patchReleaseGradleText(before);
  if (after !== before) {
    fs.writeFileSync(androidAppBuildGradle, after, "utf8");
    console.log("[Android] Applied generated Gradle release-signing configuration.");
  } else {
    console.log("[Android] Generated Gradle release-signing configuration already current.");
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: options.encoding || undefined,
    shell: options.shell || false,
    stdio: options.stdio || "inherit",
    cwd: options.cwd,
    env: options.env,
  });
  if (result.error) throw new Error(`Unable to start ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} exited with code ${result.status}.`);
  return result;
}

function findLatestBuildTools(sdkRoot) {
  const root = path.join(sdkRoot, "build-tools");
  if (!fs.existsSync(root)) return "";
  const versions = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+(?:\.\d+)+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => {
      const av = a.split(".").map(Number);
      const bv = b.split(".").map(Number);
      for (let index = 0; index < Math.max(av.length, bv.length); index += 1) {
        const diff = (bv[index] || 0) - (av[index] || 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });
  return versions[0] ? path.join(root, versions[0]) : "";
}

function createShortWindowsRoot() {
  if (process.platform !== "win32") return { androidDirectory, cleanup() {} };

  // Keep the release build on the same Windows drive as the real workspace.
  // React Native codegen resolves some hoisted node_modules paths to their real
  // C:\ location, so a SUBST drive (for example Z:) creates mixed filesystem
  // roots and Kotlin's relativeTo() fails before native compilation begins.
  // A short NTFS junction gives CMake a shorter project path without changing
  // the drive root seen by React Native codegen.
  const userHome = process.env.USERPROFILE || process.env.HOME;
  if (!userHome) {
    throw new Error("Unable to resolve the user home directory for the release-build junction.");
  }

  const junctionParent = path.join(userHome, ".orion");
  const junctionRoot = path.join(junctionParent, `r-${process.pid}`);
  fs.mkdirSync(junctionParent, { recursive: true });

  if (fs.existsSync(junctionRoot)) {
    throw new Error(`Temporary Orion release junction already exists: ${junctionRoot}`);
  }

  try {
    fs.symlinkSync(repositoryRoot, junctionRoot, "junction");
  } catch (error) {
    throw new Error(
      `Unable to create same-drive Orion release junction ${junctionRoot}: ${error.message}`,
    );
  }

  const shortAndroidDirectory = path.join(junctionRoot, "apps", "mobile", "android");
  if (!fs.existsSync(path.join(shortAndroidDirectory, "gradlew.bat"))) {
    try {
      fs.unlinkSync(junctionRoot);
    } catch {}
    throw new Error(`Release junction does not expose the Android Gradle root: ${shortAndroidDirectory}`);
  }

  return {
    androidDirectory: shortAndroidDirectory,
    cleanup() {
      try {
        fs.unlinkSync(junctionRoot);
      } catch (error) {
        console.warn(`[Android] Unable to remove temporary release junction ${junctionRoot}: ${error.message}`);
      }
    },
  };
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function verifyEmbeddedBundle(apkPath) {
  const javaHomeJar = process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "jar.exe" : "jar")
    : "";
  const jarCommand = javaHomeJar && fs.existsSync(javaHomeJar) ? javaHomeJar : "jar";
  const listing = spawnSync(jarCommand, ["tf", apkPath], {
    encoding: "utf8",
    shell: process.platform === "win32" && jarCommand === "jar",
  });
  if (listing.error || listing.status !== 0) {
    throw new Error(`Unable to inspect release APK contents: ${listing.error?.message || listing.stderr || "jar failed"}`);
  }
  if (!listing.stdout.split(/\r?\n/).includes("assets/index.android.bundle")) {
    throw new Error("Release APK validation failed: assets/index.android.bundle is missing.");
  }
}

function verifySigning(apkPath) {
  if (!androidSdk) throw new Error("Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT.");
  const buildTools = findLatestBuildTools(androidSdk);
  if (!buildTools) throw new Error(`Android build-tools not found under ${androidSdk}.`);

  // Invoke apksigner's JAR directly instead of apksigner.bat through a shell.
  // The shell form can split Orion's workspace path at spaces / the literal " - ",
  // causing apksigner to report "Unexpected parameter(s) after APK (-)" even when
  // Gradle produced and signed the release APK correctly.
  const apksignerJar = path.join(buildTools, "lib", "apksigner.jar");
  if (!fs.existsSync(apksignerJar)) {
    throw new Error(`apksigner.jar not found: ${apksignerJar}`);
  }
  const javaFromHome = process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java")
    : "";
  const javaCommand = javaFromHome && fs.existsSync(javaFromHome) ? javaFromHome : "java";

  const result = spawnSync(
    javaCommand,
    ["-jar", apksignerJar, "verify", "--verbose", "--print-certs", apkPath],
    {
      encoding: "utf8",
      shell: false,
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error(`APK signature verification failed: ${result.error?.message || result.stderr || "apksigner failed"}`);
  }
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const match = output.match(/certificate SHA-256 digest:\s*([0-9a-f:]+)/i);
  if (!match) throw new Error("Unable to read APK signing certificate SHA-256 digest.");
  const actual = match[1].replace(/:/g, "").toUpperCase();
  if (actual !== expectedCertificateSha256) {
    throw new Error(`Release APK is signed by wrong certificate. Expected ${expectedCertificateSha256}, got ${actual}.`);
  }
  console.log(`[Android] Signing certificate SHA-256 verified: ${actual}`);
  for (const line of output.split(/\r?\n/)) {
    if (/Verified using v[234] scheme/i.test(line) || /Signer #1 certificate DN:/i.test(line)) {
      console.log(line.trim());
    }
  }
}

function main() {
  if (!fs.existsSync(releaseKeystore)) {
    throw new Error(`Permanent Orion release keystore not found: ${releaseKeystore}`);
  }
  if (!process.env.ORION_ANDROID_RELEASE_STORE_PASSWORD) {
    throw new Error("ORION_ANDROID_RELEASE_STORE_PASSWORD is not set for this process.");
  }
  if (!process.env.ORION_ANDROID_RELEASE_KEY_PASSWORD) {
    throw new Error("ORION_ANDROID_RELEASE_KEY_PASSWORD is not set for this process.");
  }

  console.log("[Android] Preparing Orion production bundle and native release prerequisites...");
  run(process.execPath, [standaloneScript, "--prepare-only"], {
    cwd: projectDirectory,
    env: {
      ...process.env,
      NODE_ENV: "production",
      ...(androidSdk ? { ANDROID_HOME: androidSdk, ANDROID_SDK_ROOT: androidSdk } : {}),
    },
  });
  ensureReleaseGradleConfiguration();

  const shortRoot = createShortWindowsRoot();
  try {
    console.log(`[Android] Release Gradle root: ${shortRoot.androidDirectory}`);
    run(process.platform === "win32" ? "gradlew.bat" : "./gradlew", [
      "assembleRelease",
      "--no-daemon",
      "--no-parallel",
      "--console=plain",
      "-PreactNativeArchitectures=arm64-v8a",
      "-Porion.useEmbeddedReleaseBundle=true",
    ], {
      cwd: shortRoot.androidDirectory,
      shell: process.platform === "win32",
      env: {
        ...process.env,
        NODE_ENV: "production",
        ...(androidSdk ? { ANDROID_HOME: androidSdk, ANDROID_SDK_ROOT: androidSdk } : {}),
      },
    });
  } finally {
    shortRoot.cleanup();
  }

  if (!fs.existsSync(releaseApk)) throw new Error(`Signed release APK was not produced at ${releaseApk}`);
  verifyEmbeddedBundle(releaseApk);
  verifySigning(releaseApk);

  fs.mkdirSync(distributionDirectory, { recursive: true });
  fs.copyFileSync(releaseApk, distributionApk);
  if (!fs.readFileSync(releaseApk).equals(fs.readFileSync(distributionApk))) {
    throw new Error("Distribution APK copy verification failed.");
  }

  console.log(`[Android] Release APK verified: ${distributionApk}`);
  console.log(`[Android] Release APK size: ${(fs.statSync(distributionApk).size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`[Android] Release APK SHA-256: ${sha256(distributionApk)}`);
  console.log("[Android] Bundled JavaScript verified: assets/index.android.bundle");
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  expectedCertificateSha256,
  patchReleaseGradleText,
  verifySigning,
};
