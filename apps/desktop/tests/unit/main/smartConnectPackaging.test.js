"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../../../..");
const desktopRoot = path.join(repoRoot, "apps", "desktop");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function collectRuntimeSources(directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectRuntimeSources(fullPath));
      continue;
    }

    if (/\.(?:js|cjs|mjs)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

test("Desktop Smart Connect uses an exported shared-package runtime subpath", () => {
  const sharedPackage = JSON.parse(
    read("packages/shared/package.json"),
  );

  assert.equal(
    sharedPackage.exports["./smart-connect-protocol"],
    "./src/smartConnectProtocol.cjs",
  );

  const ipc = read(
    "apps/desktop/src/main/ipc/smartConnectIpc.js",
  );

  assert.match(
    ipc,
    /require\("@orion\/shared\/smart-connect-protocol"\)/,
  );

  assert.doesNotMatch(
    ipc,
    /packages\/shared\/src\/smartConnectProtocol\.cjs/,
  );

  const protocol = require(
    "@orion/shared/smart-connect-protocol",
  );

  assert.equal(
    typeof protocol.SMART_CONNECT_PROTOCOL_VERSION,
    "number",
  );

  assert.equal(
    typeof protocol.normalizeSmartConnectCommand,
    "function",
  );

  assert.equal(
    typeof protocol.normalizePlaybackTelemetry,
    "function",
  );
});

test("Desktop main-process runtime code never reaches into packages/shared by filesystem-relative path", () => {
  const mainRoot = path.join(desktopRoot, "src", "main");

  const offenders = collectRuntimeSources(mainRoot)
    .map((file) => ({
      file,
      contents: fs.readFileSync(file, "utf8"),
    }))
    .filter(({ contents }) =>
      /packages[\\/]shared/.test(contents),
    )
    .map(({ file }) =>
      path.relative(repoRoot, file).replace(/\\/g, "/"),
    );

  assert.deepEqual(
    offenders,
    [],
    `Packaged Desktop main-process code must consume @orion/shared through exported package subpaths. Offenders: ${offenders.join(", ")}`,
  );
});