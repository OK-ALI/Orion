"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const mobileRoot =
  path.resolve(__dirname, "..");

function loadTypeScriptModule(
  relativePath,
) {
  const absolutePath =
    path.join(
      mobileRoot,
      relativePath,
    );

  const source =
    fs.readFileSync(
      absolutePath,
      "utf8",
    );

  const transpiled =
    ts.transpileModule(
      source,
      {
        compilerOptions: {
          module:
            ts.ModuleKind.CommonJS,
          target:
            ts.ScriptTarget.ES2020,
          strict: true,
        },
        fileName:
          absolutePath,
        reportDiagnostics: true,
      },
    );

  const errors =
    (
      transpiled.diagnostics || []
    ).filter(
      (diagnostic) =>
        diagnostic.category ===
        ts.DiagnosticCategory.Error,
    );

  assert.equal(
    errors.length,
    0,
    `TypeScript policy transpile errors: ${errors
      .map((entry) =>
        ts.flattenDiagnosticMessageText(
          entry.messageText,
          "\n",
        ),
      )
      .join("\n")}`,
  );

  const moduleObject = {
    exports: {},
  };

  const execute =
    new Function(
      "exports",
      "module",
      "require",
      transpiled.outputText,
    );

  execute(
    moduleObject.exports,
    moduleObject,
    require,
  );

  return moduleObject.exports;
}

const policy =
  loadTypeScriptModule(
    "src/context/remoteRecoveryPolicy.ts",
  );

const {
  decideRemoteRecovery,
  normalizeRecoveryEpoch,
} = policy;

test("recovery epochs normalize to monotonic non-negative integers", () => {
  assert.equal(
    normalizeRecoveryEpoch(-1),
    0,
  );

  assert.equal(
    normalizeRecoveryEpoch(
      Number.NaN,
    ),
    0,
  );

  assert.equal(
    normalizeRecoveryEpoch(
      Number.POSITIVE_INFINITY,
    ),
    0,
  );

  assert.equal(
    normalizeRecoveryEpoch(1.9),
    1,
  );

  assert.equal(
    normalizeRecoveryEpoch(4),
    4,
  );
});

test("historical or repeated recovery epochs are ignored", () => {
  assert.deepEqual(
    decideRemoteRecovery({
      recoveryEpoch: 2,
      lastConsumedEpoch: 2,
      remoteReady: true,
      enabled: true,
    }),
    {
      action: "ignore",
      nextConsumedEpoch: 2,
    },
  );

  assert.deepEqual(
    decideRemoteRecovery({
      recoveryEpoch: 1,
      lastConsumedEpoch: 3,
      remoteReady: true,
      enabled: true,
    }),
    {
      action: "ignore",
      nextConsumedEpoch: 3,
    },
  );
});

test("a new recovery waits until remote capability is actually ready", () => {
  assert.deepEqual(
    decideRemoteRecovery({
      recoveryEpoch: 3,
      lastConsumedEpoch: 2,
      remoteReady: false,
      enabled: true,
    }),
    {
      action: "wait",
      nextConsumedEpoch: 2,
    },
  );
});

test("disabled consumers acknowledge an epoch without replaying it later", () => {
  assert.deepEqual(
    decideRemoteRecovery({
      recoveryEpoch: 4,
      lastConsumedEpoch: 3,
      remoteReady: true,
      enabled: false,
    }),
    {
      action: "acknowledge",
      nextConsumedEpoch: 4,
    },
  );

  assert.deepEqual(
    decideRemoteRecovery({
      recoveryEpoch: 4,
      lastConsumedEpoch: 4,
      remoteReady: true,
      enabled: true,
    }),
    {
      action: "ignore",
      nextConsumedEpoch: 4,
    },
  );
});

test("an enabled remote owner consumes each new ready recovery epoch once", () => {
  assert.deepEqual(
    decideRemoteRecovery({
      recoveryEpoch: 5,
      lastConsumedEpoch: 4,
      remoteReady: true,
      enabled: true,
    }),
    {
      action: "consume",
      nextConsumedEpoch: 5,
    },
  );

  assert.deepEqual(
    decideRemoteRecovery({
      recoveryEpoch: 5,
      lastConsumedEpoch: 5,
      remoteReady: true,
      enabled: true,
    }),
    {
      action: "ignore",
      nextConsumedEpoch: 5,
    },
  );

  assert.deepEqual(
    decideRemoteRecovery({
      recoveryEpoch: 6,
      lastConsumedEpoch: 5,
      remoteReady: true,
      enabled: true,
    }),
    {
      action: "consume",
      nextConsumedEpoch: 6,
    },
  );
});

test("the recovery hook consumes current NetworkContext truth without navigation or transport ownership", () => {
  const hook =
    fs.readFileSync(
      path.join(
        mobileRoot,
        "src/context/useRemoteRecoveryEffect.ts",
      ),
      "utf8",
    );

  for (const marker of [
    "useNetworkStatus",
    "remoteReady",
    "recoveryEpoch",
    "useRef(recoveryEpoch)",
    "decideRemoteRecovery",
    "lastConsumedEpochRef.current",
    'decision.action === "ignore"',
    'decision.action === "wait"',
    'decision.action !== "consume"',
    "callbackRef.current",
    "Promise.resolve(result)",
  ]) {
    assert.ok(
      hook.includes(marker),
      `Missing recovery hook marker: ${marker}`,
    );
  }

  assert.doesNotMatch(
    hook,
    /useRouter\s*\(/,
  );

  assert.doesNotMatch(
    hook,
    /router\.(?:push|replace)/,
  );

  assert.doesNotMatch(
    hook,
    /tmdbFetch/,
  );

  assert.doesNotMatch(
    hook,
    /fetch\s*\(/,
  );

  assert.doesNotMatch(
    hook,
    /setInterval\s*\(/,
  );

  assert.doesNotMatch(
    hook,
    /setTimeout\s*\(/,
  );
});

test("P10A.1-B does not wire Home or Discover before the Mobile offline product slice", () => {
  const home =
    fs.readFileSync(
      path.join(
        mobileRoot,
        "app/(tabs)/index.tsx",
      ),
      "utf8",
    );

  const discover =
    fs.readFileSync(
      path.join(
        mobileRoot,
        "src/features/discover/DiscoverScreen.tsx",
      ),
      "utf8",
    );

  assert.doesNotMatch(
    home,
    /useRemoteRecoveryEffect/,
  );

  assert.doesNotMatch(
    discover,
    /useRemoteRecoveryEffect/,
  );
});