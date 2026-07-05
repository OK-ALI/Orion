const crypto = require("crypto");

const grants = new Map();

function createGrant(resource, ttl = 21_600_000) {
  const token = crypto.randomBytes(24).toString("base64url");
  grants.set(token, { ...resource, expiresAt: Date.now() + ttl });
  return { token, url: `orion-music://media/${token}`, expiresAt: Date.now() + ttl };
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

module.exports = { createGrant, resolveGrant, revokeAll };
