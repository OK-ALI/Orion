"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const mobileRoot = path.resolve(__dirname, "..");

function loadTypeScriptModule(relativePath) {
  const absolutePath =
    path.join(mobileRoot, relativePath);

  const source =
    fs.readFileSync(absolutePath, "utf8");

  const transpiled =
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        strict: true,
      },
      fileName: absolutePath,
      reportDiagnostics: true,
    });

  const errors =
    (transpiled.diagnostics || []).filter(
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
    "src/context/networkStatePolicy.ts",
  );

const {
  deriveNetworkProductState,
  isRemoteReady,
  isTransportAvailable,
  shouldEmitRecovery,
} = policy;

test("transport truth does not confuse provider failure with global offline", () => {
  assert.equal(
    isTransportAvailable(true, true),
    true,
  );

  assert.equal(
    isTransportAvailable(true, null),
    true,
  );

  assert.equal(
    isTransportAvailable(true, false),
    false,
  );

  assert.equal(
    isTransportAvailable(false, null),
    false,
  );
});

test("cold disconnected state resolves to offline", () => {
  assert.equal(
    deriveNetworkProductState({
      nativeOnline: false,
      internetReachable: null,
      serviceReachable: null,
      previousState: "checking",
    }),
    "offline",
  );

  assert.equal(
    deriveNetworkProductState({
      nativeOnline: true,
      internetReachable: false,
      serviceReachable: null,
      previousState: "checking",
    }),
    "offline",
  );
});

test("cold connected startup stays checking until remote capability is known", () => {
  assert.equal(
    deriveNetworkProductState({
      nativeOnline: true,
      internetReachable: true,
      serviceReachable: null,
      previousState: "checking",
    }),
    "checking",
  );
});

test("transport restoration from offline becomes reconnecting before provider validation", () => {
  assert.equal(
    deriveNetworkProductState({
      nativeOnline: true,
      internetReachable: true,
      serviceReachable: null,
      previousState: "offline",
    }),
    "reconnecting",
  );

  assert.equal(
    deriveNetworkProductState({
      nativeOnline: true,
      internetReachable: null,
      serviceReachable: null,
      previousState: "reconnecting",
    }),
    "reconnecting",
  );
});

test("remote provider failure with usable transport resolves to degraded", () => {
  assert.equal(
    deriveNetworkProductState({
      nativeOnline: true,
      internetReachable: true,
      serviceReachable: false,
      previousState: "checking",
    }),
    "degraded",
  );

  assert.equal(
    isTransportAvailable(true, true),
    true,
  );

  assert.equal(
    isRemoteReady("degraded"),
    false,
  );
});

test("validated remote capability resolves to online", () => {
  assert.equal(
    deriveNetworkProductState({
      nativeOnline: true,
      internetReachable: true,
      serviceReachable: true,
      previousState: "checking",
    }),
    "online",
  );

  assert.equal(
    isRemoteReady("online"),
    true,
  );
});

test("recovery signal is emitted only for meaningful restoration", () => {
  assert.equal(
    shouldEmitRecovery(
      "offline",
      "online",
    ),
    true,
  );

  assert.equal(
    shouldEmitRecovery(
      "reconnecting",
      "online",
    ),
    true,
  );

  assert.equal(
    shouldEmitRecovery(
      "degraded",
      "online",
    ),
    true,
  );

  assert.equal(
    shouldEmitRecovery(
      "checking",
      "online",
    ),
    false,
  );

  assert.equal(
    shouldEmitRecovery(
      "online",
      "online",
    ),
    false,
  );

  assert.equal(
    shouldEmitRecovery(
      "online",
      "degraded",
    ),
    false,
  );
});

test("NetworkContext exposes the Phase 10A recovery contract without navigation ownership", () => {
  const source =
    fs.readFileSync(
      path.join(
        mobileRoot,
        "src/context/NetworkContext.tsx",
      ),
      "utf8",
    );

  for (const marker of [
    "productState",
    "serviceReachable",
    "remoteReady",
    "recoveryEpoch",
    "restoredAt",
    "probeGenerationRef",
    "PROBE_TIMEOUT_MS",
    "network-probe-timeout",
  ]) {
    assert.match(
      source,
      new RegExp(marker),
    );
  }

  assert.match(
    source,
    /generation !==\s*probeGenerationRef\.current/,
  );

  assert.match(
    source,
    /deriveNetworkProductState/,
  );

  assert.doesNotMatch(
    source,
    /router\.(?:push|replace)/,
  );

  assert.doesNotMatch(
    source,
    /useRouter\s*\(/,
  );
});