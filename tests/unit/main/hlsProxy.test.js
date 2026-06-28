const assert = require("node:assert/strict");
const test = require("node:test");
const Module = require("node:module");

test("HLS playlist rewriting keeps descendants inside the scoped proxy", () => {
  const originalLoad = Module._load;
  Module._load = function mockElectron(request, parent, isMain) {
    if (request === "electron") return { session: {}, net: {} };
    return originalLoad.call(this, request, parent, isMain);
  };
  let rewritePlaylist;
  try {
    ({ rewritePlaylist } = require("../../../src/main/downloader/hlsProxy"));
  } finally {
    Module._load = originalLoad;
  }
  const descendants = [];
  const result = rewritePlaylist("#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI=\"key.bin\"\nseg-1.ts", "https://cdn.example/path/master.m3u8", "http://127.0.0.1/job", (url) => descendants.push(url));
  assert.match(result, /127\.0\.0\.1\/job\/proxy/);
  assert.deepEqual(descendants, ["https://cdn.example/path/key.bin", "https://cdn.example/path/seg-1.ts"]);
});
