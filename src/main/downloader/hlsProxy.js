const { session, net } = require("electron");
const http = require("http");
const crypto = require("crypto");

function getPlayerUserAgent() {
  try {
    return session.fromPartition("persist:player").getUserAgent();
  } catch {
    return null;
  }
}

function getHeaderValue(headers, wanted) {
  if (!headers) return null;
  const lowerWanted = wanted.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lowerWanted) continue;
    if (Array.isArray(value)) return value.join("; ");
    return value == null ? null : String(value);
  }
  return null;
}

function buildDownloadHeaders(m3u8Context, userAgent) {
  const requestHeaders = m3u8Context?.requestHeaders || {};
  const headers = new Map();
  const add = (name, value) => {
    if (!value) return;
    headers.set(name, String(value));
  };

  add("User-Agent", getHeaderValue(requestHeaders, "User-Agent") || userAgent);
  const referer = getHeaderValue(requestHeaders, "Referer") || m3u8Context?.referrer;
  let origin = getHeaderValue(requestHeaders, "Origin");
  if (!origin && referer) {
    try { origin = new URL(referer).origin; } catch {}
  }
  add("Referer", referer);
  add("Origin", origin);
  add("Accept", getHeaderValue(requestHeaders, "Accept") || "*/*");
  add("Accept-Language", getHeaderValue(requestHeaders, "Accept-Language"));
  add("Cookie", getHeaderValue(requestHeaders, "Cookie"));
  add("Sec-Fetch-Dest", getHeaderValue(requestHeaders, "Sec-Fetch-Dest"));
  add("Sec-Fetch-Mode", getHeaderValue(requestHeaders, "Sec-Fetch-Mode"));
  add("Sec-Fetch-Site", getHeaderValue(requestHeaders, "Sec-Fetch-Site"));
  add("Sec-CH-UA", getHeaderValue(requestHeaders, "Sec-CH-UA"));
  add("Sec-CH-UA-Mobile", getHeaderValue(requestHeaders, "Sec-CH-UA-Mobile"));
  add("Sec-CH-UA-Platform", getHeaderValue(requestHeaders, "Sec-CH-UA-Platform"));

  return [...headers.entries()];
}

function headerValue(headers, key) {
  const value = headers?.[key] ?? headers?.[key.toLowerCase()];
  return Array.isArray(value) ? value.join(", ") : value;
}

function fetchViaPlayerSession(url, m3u8Context, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const playerSession = session.fromPartition("persist:player");
      const request = net.request({
        url,
        session: playerSession,
        redirect: "follow",
      });
      const upstreamHeaders = buildDownloadHeaders(m3u8Context, getPlayerUserAgent());
      for (const [name, value] of upstreamHeaders) {
        const lower = name.toLowerCase();
        if (
          lower === "host" ||
          lower === "content-length" ||
          lower === "accept-encoding" ||
          lower === "cookie"
        ) {
          continue;
        }
        try {
          request.setHeader(name, value);
        } catch {}
      }
      if (options.referer && !getHeaderValue(Object.fromEntries(upstreamHeaders), "referer")) {
        try {
          request.setHeader("Referer", options.referer);
        } catch {}
      }
      if (options.range) {
        try {
          request.setHeader("Range", options.range);
        } catch {}
      }
      request.on("response", (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode || 200,
            headers: response.headers || {},
            body: Buffer.concat(chunks),
          });
        });
      });
      request.on("error", reject);
      request.end();
    } catch (error) {
      reject(error);
    }
  });
}

function rewritePlaylist(text, playlistUrl, proxyBase, registerUrl = () => {}) {
  const toProxyUrl = (raw) => {
    if (!raw || raw.startsWith("data:")) return raw;
    try {
      const absolute = new URL(raw, playlistUrl).href;
      registerUrl(absolute);
      return `${proxyBase}/proxy?url=${encodeURIComponent(absolute)}&parent=${encodeURIComponent(playlistUrl)}`;
    } catch {
      return raw;
    }
  };

  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${toProxyUrl(uri)}"`);
      }
      return toProxyUrl(trimmed);
    })
    .join("\n");
}

function createHlsProxy(rootUrl, m3u8Context) {
  return new Promise((resolve, reject) => {
    const secret = crypto.randomBytes(18).toString("hex");
    const allowedUrls = new Set([rootUrl]);
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url, "http://127.0.0.1");
        if (!reqUrl.pathname.startsWith(`/${secret}/`)) {
          res.writeHead(404);
          res.end();
          return;
        }
        const upstreamUrl =
          reqUrl.pathname === `/${secret}/master.m3u8`
            ? rootUrl
            : reqUrl.searchParams.get("url");
        const parentUrl = reqUrl.searchParams.get("parent") || rootUrl;
        if (!upstreamUrl) {
          res.writeHead(400);
          res.end("Missing upstream url");
          return;
        }

        let parsedUpstream;
        try {
          parsedUpstream = new URL(upstreamUrl);
        } catch {
          res.writeHead(400);
          res.end("Invalid upstream url");
          return;
        }
        if (!["http:", "https:"].includes(parsedUpstream.protocol) || !allowedUrls.has(upstreamUrl)) {
          res.writeHead(403);
          res.end("Upstream url is not part of the captured manifest");
          return;
        }

        const playerSession = session.fromPartition("persist:player");
        const upstreamRequest = net.request({ url: upstreamUrl, session: playerSession, redirect: "follow" });
        const capturedHeaders = buildDownloadHeaders(m3u8Context, getPlayerUserAgent());
        for (const [name, value] of capturedHeaders) {
          const lower = name.toLowerCase();
          if (["host", "content-length", "accept-encoding", "cookie"].includes(lower)) continue;
          try { upstreamRequest.setHeader(name, value); } catch {}
        }
        if (!capturedHeaders.some(([name]) => name.toLowerCase() === "referer") && parentUrl) {
          try { upstreamRequest.setHeader("Referer", parentUrl); } catch {}
        }
        if (req.headers.range) {
          try { upstreamRequest.setHeader("Range", req.headers.range); } catch {}
        }
        upstreamRequest.on("response", (upstream) => {
          const contentType = String(headerValue(upstream.headers, "content-type") || "");
          const isPlaylist =
            upstreamUrl.toLowerCase().includes(".m3u8") ||
            contentType.includes("mpegurl") ||
            contentType.includes("application/vnd.apple");
          if ((upstream.statusCode || 200) >= 400) {
            res.writeHead(upstream.statusCode || 502, { "content-type": "text/plain; charset=utf-8" });
            upstream.pipe(res);
            return;
          }
          if (isPlaylist) {
            const chunks = [];
            upstream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
            upstream.on("end", () => {
              const body = rewritePlaylist(
                Buffer.concat(chunks).toString("utf8"),
                upstreamUrl,
                `http://127.0.0.1:${server.address().port}/${secret}`,
                (url) => allowedUrls.add(url),
              );
              res.writeHead(200, {
                "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
                "cache-control": "no-store",
              });
              res.end(body);
            });
            upstream.on("error", (error) => res.destroy(error));
            return;
          }
          res.writeHead(upstream.statusCode || 200, {
            "content-type": contentType || "application/octet-stream",
            ...(headerValue(upstream.headers, "content-length") ? { "content-length": headerValue(upstream.headers, "content-length") } : {}),
            ...(headerValue(upstream.headers, "content-range") ? { "content-range": headerValue(upstream.headers, "content-range") } : {}),
            ...(headerValue(upstream.headers, "accept-ranges") ? { "accept-ranges": headerValue(upstream.headers, "accept-ranges") } : {}),
            "cache-control": "no-store",
          });
          upstream.pipe(res);
        });
        upstreamRequest.on("error", (error) => {
          if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
          res.end(error.message || "Proxy fetch failed");
        });
        upstreamRequest.end();
      } catch (error) {
        res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
        res.end(error.message || "Proxy fetch failed");
      }
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}/${secret}/master.m3u8`,
        close: () => {
          try {
            server.close();
          } catch {}
        },
      });
    });
  });
}
module.exports = { getPlayerUserAgent, getHeaderValue, buildDownloadHeaders, headerValue, fetchViaPlayerSession, rewritePlaylist, createHlsProxy };
