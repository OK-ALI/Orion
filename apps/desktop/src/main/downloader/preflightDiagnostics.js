const fs = require("fs");
const path = require("path");

const LOG_NAME = "download-preflight.jsonl";
const MAX_LOG_BYTES = 64 * 1024;
const RETAIN_BYTES = 48 * 1024;

function limited(value, pattern, max = 80) {
  return String(value || "").slice(0, max).replace(pattern, "");
}

function safeRecord(candidate, candidateId, result) {
  const diagnostic = result?.diagnostic || {};
  return {
    at: new Date().toISOString(),
    sourceId: limited(candidate?.sourceId, /[^a-z0-9_-]/gi),
    candidateId: limited(candidateId, /[^a-z0-9-]/gi),
    outcome: result?.ok && result?.verified ? "ready" : "failed",
    code: limited(result?.code, /[^a-z0-9_-]/gi),
    stage: limited(diagnostic.stage, /[^a-z0-9_-]/gi),
    host: limited(diagnostic.host, /[^a-z0-9.:-]/gi, 160),
    crossOrigin: Boolean(diagnostic.crossOrigin),
    observedInPlayer: Boolean(diagnostic.observedInPlayer),
    statusCode: Number(diagnostic.statusCode) || null,
    contentType: limited(diagnostic.contentType, /[^a-z0-9.+_/-]/gi),
    contentLength: Number(diagnostic.contentLength) || null,
    bytesRead: Number(diagnostic.bytesRead) || 0,
    requestHeaderNames: (diagnostic.requestHeaderNames || []).slice(0, 32)
      .map((name) => limited(name, /[^a-z0-9-]/gi)).filter(Boolean),
    authorizationPresent: Boolean(diagnostic.authorizationPresent),
    cookiePresent: Boolean(diagnostic.cookiePresent),
  };
}

function appendPreflightDiagnostic(directory, candidate, candidateId, result) {
  if (!directory) return null;
  const target = path.join(directory, LOG_NAME);
  fs.mkdirSync(directory, { recursive: true });
  fs.appendFileSync(target, `${JSON.stringify(safeRecord(candidate, candidateId, result))}\n`, { mode: 0o600 });
  if (fs.statSync(target).size > MAX_LOG_BYTES) {
    const text = fs.readFileSync(target, "utf8");
    const tail = text.slice(-RETAIN_BYTES);
    fs.writeFileSync(target, tail.slice(tail.indexOf("\n") + 1), { mode: 0o600 });
  }
  return target;
}

module.exports = { appendPreflightDiagnostic, safeRecord };
