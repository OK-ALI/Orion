"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("desktop window stays hidden until its first themed frame is ready", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../../../src/main/bootstrap.js"),
    "utf8",
  );
  assert.match(source, /show:\s*false/);
  assert.match(source, /mainWindow\.once\("ready-to-show"/);
  assert.match(source, /mainWindow\.show\(\)/);
});
