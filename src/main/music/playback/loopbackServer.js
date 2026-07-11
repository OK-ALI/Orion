const crypto = require("crypto");
const http = require("http");
const { Readable } = require("stream");
const mediaProtocol = require("./mediaProtocol");

let server = null;
let origin = "";
let secret = "";
const sockets = new Set();

function writeResponse(nodeResponse, response, headOnly, requestOrigin) {
  const headers = Object.fromEntries(response.headers.entries());
  if (requestOrigin) headers["access-control-allow-origin"] = requestOrigin;
  nodeResponse.writeHead(response.status, headers);
  if (headOnly || !response.body) {
    response.body?.cancel?.().catch?.(() => {});
    nodeResponse.end();
    return;
  }
  Readable.fromWeb(response.body).on("error", () => nodeResponse.destroy()).pipe(nodeResponse);
}

async function handle(request, response) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method || "GET")) {
    response.writeHead(405); response.end(); return;
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "access-control-allow-headers": "Range", "cross-origin-resource-policy": "cross-origin" });
    response.end(); return;
  }
  const url = new URL(request.url, origin);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== secret) { response.writeHead(404); response.end(); return; }
  const headers = new Headers();
  if (request.headers.range) headers.set("range", request.headers.range);
  const grantResponse = await mediaProtocol.serve(new Request(`orion-music://media/${parts[1]}`, {
    method: request.method, headers,
  }));
  writeResponse(response, grantResponse, request.method === "HEAD", request.headers.origin);
}

async function start() {
  if (server && origin) return origin;
  secret = crypto.randomBytes(24).toString("base64url");
  server = http.createServer((request, response) => handle(request, response).catch(() => {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  }));
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
  return origin;
}

function createUrl(token) {
  return origin && secret ? `${origin}/${secret}/${token}` : "";
}

async function stop() {
  const current = server;
  server = null; origin = ""; secret = "";
  if (current) {
    const closed = new Promise((resolve) => current.close(resolve));
    current.closeIdleConnections?.();
    current.closeAllConnections?.();
    sockets.forEach((socket) => socket.destroy());
    sockets.clear();
    await closed;
  }
}

module.exports = { start, stop, createUrl };
