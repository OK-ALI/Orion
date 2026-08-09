const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const androidDirectory = path.resolve(__dirname, "..", "android");
const gradleWrapper = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const defaultWindowsSdk = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk")
  : "";
const androidSdk = process.env.ANDROID_HOME
  || process.env.ANDROID_SDK_ROOT
  || (defaultWindowsSdk && fs.existsSync(defaultWindowsSdk) ? defaultWindowsSdk : "");

const result = spawnSync(
  gradleWrapper,
  [
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

process.exit(result.status ?? 1);
