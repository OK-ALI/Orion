const assert = require("node:assert/strict");
const test = require("node:test");
const Module = require("node:module");
const { EventEmitter } = require("node:events");
const { Readable } = require("node:stream");
const http = require("node:http");

function loadProxy(requests, body, contentType = "video/mp2t") {
  const playerSession = {
    getUserAgent: () => "Orion test",
    cookies: { get: async () => [{ name: "destination-cookie" }] },
  };
  const originalLoad = Module._load;
  Module._load = function mockDependencies(request, parent, isMain) {
    if (request === "electron") return {
      session: { fromPartition: () => playerSession },
      net: { request: (options) => {
        const upstream = new EventEmitter();
        upstream.headers = {};
        upstream.setHeader = (name, value) => { upstream.headers[name.toLowerCase()] = value; };
        upstream.abort = () => { upstream.aborted = true; };
        upstream.end = () => {
          requests.push({ options, headers: upstream.headers });
          process.nextTick(() => {
            const response = Readable.from([Buffer.from(body)]);
            response.statusCode = 200;
            response.headers = { "content-type": contentType };
            upstream.emit("response", response);
          });
        };
        return upstream;
      } },
    };
    if (request === "./publicMediaUrl" && parent?.filename?.endsWith("hlsProxy.js")) {
      return { assertPublicMediaUrl: async () => {} };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const path = require.resolve("../../../src/main/downloader/hlsProxy");
    delete require.cache[path];
    return require(path);
  } finally {
    Module._load = originalLoad;
  }
}

test("cross-origin media preflight uses destination-scoped session cookies without forwarding root secrets", async () => {
  const requests = [];
  const { fetchViaPlayerSession } = loadProxy(requests, "real-media-bytes");
  const candidate = {
    url: "https://root.example/master.m3u8",
    requestHeaders: { Authorization: "Bearer root-secret", Cookie: "root-cookie" },
  };
  const response = await fetchViaPlayerSession("https://child.example/segment.ts", candidate, { maxBytes: 16 });
  assert.equal(response.body.toString(), "real-media-bytes");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.useSessionCookies, true);
  assert.equal(requests[0].options.redirect, "error");
  assert.equal(requests[0].headers.authorization, undefined);
  assert.equal(requests[0].headers.cookie, undefined);
});

test("HLS transfer proxy also uses destination-scoped player cookies", async () => {
  const requests = [];
  const { createHlsProxy } = loadProxy(requests, "#EXTM3U\n#EXTINF:10,\nsegment.ts", "application/vnd.apple.mpegurl");
  const proxy = await createHlsProxy("https://root.example/master.m3u8", {
    url: "https://root.example/master.m3u8",
    requestHeaders: { Cookie: "root-cookie" },
  });
  try {
    const text = await new Promise((resolve, reject) => {
      http.get(proxy.url, (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks).toString()));
        response.on("error", reject);
      }).on("error", reject);
    });
    assert.match(text, /#EXTM3U/);
    assert.equal(requests[0].options.useSessionCookies, true);
    assert.equal(requests[0].headers.cookie, undefined);
  } finally {
    proxy.close();
  }
});
