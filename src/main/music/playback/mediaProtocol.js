const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { protocol, session } = require("electron");
const { parseByteRange } = require("../../player/localMediaRange");
const tokens = require("./tokenRegistry");

let registered = false;
const MIME = { ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".flac": "audio/flac",
  ".ogg": "audio/ogg", ".opus": "audio/ogg", ".wav": "audio/wav", ".webm": "audio/webm",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

function registerScheme() {
  protocol.registerSchemesAsPrivileged([{ scheme: "orion-music",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
}

function failure(status, message) {
  return new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

async function serve(request) {
  let token;
  try { token = new URL(request.url).pathname.split("/").filter(Boolean)[0]; } catch {}
  const grant = tokens.resolveGrant(token);
  if (!grant) return failure(404, "Music stream grant expired.");
  if (grant.kind === "remote") {
    const headers = new Headers(grant.headers || {});
    const range = request.headers.get("range");
    if (range) headers.set("range", range);
    try {
      const response = await fetch(grant.url, { headers, redirect: "follow" });
      const output = new Headers();
      ["accept-ranges", "content-range", "content-length", "content-type", "etag", "last-modified"]
        .forEach((name) => { const value = response.headers.get(name); if (value) output.set(name, value); });
      output.set("access-control-allow-origin", "*");
      return new Response(response.body, { status: response.status, headers: output });
    } catch { return failure(502, "The music provider stream could not be reached."); }
  }
  if (grant.kind !== "local" && grant.kind !== "artwork") return failure(501, "Music provider stream is unavailable.");
  let stat;
  try { stat = await fs.promises.stat(grant.filePath); } catch { return failure(404, "Music file not found."); }
  if (!stat.isFile()) return failure(404, "Music file not found.");
  const range = parseByteRange(request.headers.get("range"), stat.size);
  if (!range) return failure(416, "Range not satisfiable.");
  const headers = { "accept-ranges": "bytes", "access-control-allow-origin": "*",
    "content-type": grant.mimeType || MIME[path.extname(grant.filePath).toLowerCase()] || "application/octet-stream",
    "content-length": String(range.end - range.start + 1) };
  if (range.status === 206) headers["content-range"] = `bytes ${range.start}-${range.end}/${stat.size}`;
  return new Response(Readable.toWeb(fs.createReadStream(grant.filePath, { start: range.start, end: range.end })),
    { status: range.status, headers });
}

function register() {
  if (registered) return;
  protocol.handle("orion-music", serve);
  session.fromPartition("persist:player").protocol.handle("orion-music", serve);
  registered = true;
}

module.exports = { register, registerScheme };
