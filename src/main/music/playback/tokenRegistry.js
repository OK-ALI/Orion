const crypto = require("crypto");

const grants = new Map();
let audioUrlFactory = null;

function createGrant(resource, ttl = 21_600_000) {
  const token = crypto.randomBytes(24).toString("base64url");
  grants.set(token, { ...resource, expiresAt: Date.now() + ttl });
  const protectedUrl = resource.kind !== "artwork" ? audioUrlFactory?.(token) : "";
  return { token, url: protectedUrl || `orion-music://media/${token}`, expiresAt: Date.now() + ttl };
}

function resolveGrant(token) {
  const grant = grants.get(token);
  if (!grant || grant.expiresAt < Date.now()) {
    grants.delete(token);
    return null;
  }
  return grant;
}

function revokeAll() { grants.clear(); }
function setAudioUrlFactory(factory) { audioUrlFactory = typeof factory === "function" ? factory : null; }

module.exports = { createGrant, resolveGrant, revokeAll, setAudioUrlFactory };
