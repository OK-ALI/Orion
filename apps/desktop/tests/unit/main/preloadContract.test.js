const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const Module = require("node:module");
const fixture = require("../../fixtures/ipc-contract.json");

test("composed preload exposes the complete v1.0.7 flat API", () => {
  let exposed;
  const originalLoad = Module._load;
  Module._load = function mockElectron(request, parent, isMain) {
    if (request === "electron") {
      return {
        contextBridge: { exposeInMainWorld: (_, value) => { exposed = value; } },
        ipcRenderer: { invoke() {}, send() {}, on() {}, removeListener() {} },
        webFrame: { setZoomFactor() {} },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const preload = path.join(__dirname, "../../../src/preload/index.js");
    delete require.cache[require.resolve(preload)];
    require(preload);
  } finally {
    Module._load = originalLoad;
  }
  assert.deepEqual(Object.keys(exposed).sort(), [...fixture.preloadApi].sort());
});
