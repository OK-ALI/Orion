const dns = require("node:dns/promises");
const net = require("node:net");

function publicIp(address) {
  const value = String(address || "").toLowerCase();
  if (value.startsWith("::ffff:")) return publicIp(value.slice(7));
  if (net.isIP(value) === 4) {
    const [a, b, c] = value.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && c === 0))) ||
      (a === 198 && (b === 18 || b === 19)));
  }
  if (net.isIP(value) === 6) {
    return !(value === "::" || value === "::1" || value.startsWith("fe80:") ||
      value.startsWith("fc") || value.startsWith("fd") || value.startsWith("ff"));
  }
  return false;
}

async function assertPublicMediaUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Media destination is not authorized");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("Media destination is not public");
  }
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addresses.length || !addresses.every(({ address }) => publicIp(address))) {
    throw new Error("Media destination is not public");
  }
  return url.href;
}

module.exports = { assertPublicMediaUrl, publicIp };
