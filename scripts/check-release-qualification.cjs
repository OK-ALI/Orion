const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const map = JSON.parse(fs.readFileSync(path.join(root, "config", "orion-release-map-v1.json"), "utf8"));
const qualification = JSON.parse(fs.readFileSync(
  path.join(root, "config", `release-qualification-${map.productVersion}.json`),
  "utf8",
));
const phase = process.argv.includes("--phase")
  ? process.argv[process.argv.indexOf("--phase") + 1]
  : "stable";

const previewRequired = [
  "acceptedMobileApkVerified",
  "exactArtifacts",
  "signedManifestCompatibility",
  "windowsCleanInstall",
  "windowsProviderPlaybackMatrix",
  "windowsProviderSwitchSubtitleResume",
  "windowsTrailerMatrix",
  "windowsPopupAndNavigationSafety",
  "providerStatusSignatureAndPolicy",
  "adBlockRegression",
  "musicRegression",
  "tmdbRegression",
  "anilistRegression",
  "cloudSyncRegression",
  "accountRegression",
  "historyRegression",
  "downloadsRegression",
  "existingUpdaterRegression",
];

const stableRequired = [
  ...previewRequired,
  map.productVersion === "3.2.1" ? "windowsUpgradeFrom3_2_0" : "windowsUpgradeFrom3_1_0",
  "windowsInterruptedDownloadRecovery",
  "windowsUpdateRejectionMatrix",
  "windowsInstallerLaunchAndRestartConfirmation",
  "futureReleaseBridgeSelection",
  "androidCleanInstall",
  map.productVersion === "3.2.1" ? "androidUpgradeFromVersionCode58" : "androidUpgradeFromVersionCode57",
  "androidSignerContinuity",
  "androidInterruptedDownloadAndLifecycleRecovery",
  "androidPermissionReturnWithoutRedownload",
  "androidUpdateRejectionMatrix",
  "androidDuplicateAndInstallSessionProtection",
  "androidRestartConfirmation",
  "androidProviderPlaybackMatrix",
  "androidProviderSwitchSubtitleResume",
  "androidPopupAndNavigationSafety",
];

if (!new Set(["preview", "stable"]).has(phase)) {
  throw new Error("Qualification phase must be preview or stable.");
}
const required = phase === "preview" ? previewRequired : stableRequired;
const missing = required.filter((key) => qualification[key] !== true);
const evidenceKeys = [
  "mobileApkSha256",
  "desktopInstallerSha256",
  "desktopArchiveSha256",
  "mobileSignerSha256",
  "windowsSignerSha256",
  "desktopTestMachine",
  "desktopTester",
  "validatedAt",
];
const missingEvidence = evidenceKeys.filter((key) => !String(qualification.evidence?.[key] || "").trim());
if (qualification.version !== map.productVersion || missing.length || missingEvidence.length) {
  const details = [
    ...missing,
    ...missingEvidence.map((key) => `evidence.${key}`),
  ];
  console.error(`Release qualification is incomplete: ${details.join(", ") || "version mismatch"}`);
  process.exit(1);
}
console.log(`Orion ${map.productVersion} ${phase} qualification is complete.`);
