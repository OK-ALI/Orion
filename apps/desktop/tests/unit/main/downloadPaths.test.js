const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { buildTargetDirectory, qualityFormat, safeFileName } = require("../../../src/main/downloader/paths");

test("download paths retain the v1.0.7 Movies and Series layout", () => {
  assert.equal(buildTargetDirectory("D:/Media", "movie", "Arrival (2016)"), path.join("D:/Media", "Movies", "Arrival (2016)"));
  assert.equal(buildTargetDirectory("D:/Media", "tv", "Severance (2022) S01 E02", 1), path.join("D:/Media", "Series", "Severance (2022)", "Season 01"));
});

test("quality and filename compatibility remain stable", () => {
  assert.match(qualityFormat("1080"), /height<=1080/);
  assert.equal(safeFileName('A: Title?'), "A Title");
});
