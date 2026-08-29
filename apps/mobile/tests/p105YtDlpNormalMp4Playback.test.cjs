const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(...parts) {
  return fs.readFileSync(path.join(root, ...parts), "utf8");
}

test("P10.5 finalized MP4 assets use descriptor-backed native playback while legacy fragments retain Media3 compatibility", () => {
  const transfer = read("plugins", "orion-cinema-webview-native", "OrionDownloadTransferRuntime.kt");
  const artifacts = read("plugins", "orion-cinema-webview-native", "OrionDownloadArtifactManager.kt");
  const screen = read("src", "features", "playback", "PlayerScreen.tsx");

  assert.match(transfer, /OrionDownloadSubtitleRuntime\.prepare\(/);
  assert.match(transfer, /subtitle-finalization-incomplete/);
  assert.match(transfer, /directManagedArtifacts\(/);
  assert.match(transfer, /locatorValue = proof\.relativeLocator/);
  assert.match(transfer, /locatorValue =\s*"\$jobId\.sidecars\/\$relative"/);
  assert.match(transfer, /\.put\(\s*"_trackId",\s*trackId/);
  assert.match(transfer, /\.put\("tracks", subtitleResult\.tracks\)/);
  assert.match(transfer, /\.put\("playInOrion", true\)/);

  assert.match(artifacts, /val mediaFile: File\? = null/);
  assert.match(artifacts, /if \(bundleDir\.isFile\)/);
  assert.match(artifacts, /asset\.optString\("container"\) != "mp4"/);
  assert.match(artifacts, /artifact\.optString\("_trackId"\)/);
  assert.match(artifacts, /sourceKind = "file"/);
  assert.match(artifacts, /OrionFinalizedArtifactOwner\.authorize\(context, bundleDir, expectedSize\)/);
  assert.match(artifacts, /target\.length\(\) != expectedSize/);
  assert.match(screen, /offlineSource\.sourceKind === 'file' \? \([\s\S]*<OrionFinalizedPlayerActivitySurface/);
  assert.match(screen, /\) : \(\s*<OrionOfflinePlayerSurface/);
  assert.doesNotMatch(screen, /OrionFinalizedPlayerSurface/);
});
