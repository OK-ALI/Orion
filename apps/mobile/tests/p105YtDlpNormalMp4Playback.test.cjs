const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(...parts) {
  return fs.readFileSync(path.join(root, ...parts), "utf8");
}

test("P10.5 normal MP4 Orion Library assets are first-class offline player sources with side-loaded subtitles", () => {
  const transfer = read("plugins", "orion-cinema-webview-native", "OrionDownloadTransferRuntime.kt");
  const artifacts = read("plugins", "orion-cinema-webview-native", "OrionDownloadArtifactManager.kt");
  const sourceFactory = read("plugins", "orion-cinema-webview-native", "OrionOfflineMediaSourceFactory.kt");

  assert.match(transfer, /OrionDownloadSubtitleRuntime\.prepare\(/);
  assert.match(transfer, /subtitle-finalization-incomplete/);
  assert.match(transfer, /directManagedArtifacts\(/);
  assert.match(transfer, /locatorValue = "\$jobId\.mp4"/);
  assert.match(transfer, /locatorValue =\s*"\$jobId\.sidecars\/\$relative"/);
  assert.match(transfer, /\.put\(\s*"_trackId",\s*trackId/);
  assert.match(transfer, /\.put\("tracks", subtitleResult\.tracks\)/);
  assert.match(transfer, /\.put\("playInOrion", true\)/);

  assert.match(artifacts, /val mediaFile: File\? = null/);
  assert.match(artifacts, /if \(bundleDir\.isFile\)/);
  assert.match(artifacts, /asset\.optString\("container"\) != "mp4"/);
  assert.match(artifacts, /artifact\.optString\("_trackId"\)/);
  assert.match(artifacts, /sourceKind = "file"/);
  assert.match(artifacts, /mediaFile = bundleDir/);
  assert.match(artifacts, /target\.length\(\) != expectedSize/);

  assert.match(sourceFactory, /val mediaFile = asset\.mediaFile/);
  assert.match(sourceFactory, /Uri\.fromFile\(mediaFile\)/);
  assert.match(sourceFactory, /setSubtitleConfigurations\(subtitleConfigurations\)/);
  assert.match(sourceFactory, /DefaultMediaSourceFactory\([\s\S]{0,120}DefaultDataSource\.Factory\(context\)/);

  assert.doesNotMatch(sourceFactory, /mediaFile[\s\S]{0,240}OrionOfflineFragmentDataSourceFactory/);
});
