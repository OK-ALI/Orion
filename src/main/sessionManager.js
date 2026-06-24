// ── Electron Session & Request Manager ──────────────────────────────────────────
// Handles ad-blocking, user-agents, request interception, and CORS injections.

const { URL } = require("url");
const blockStats = require("../ipc/blockStats");

const BLOCKED_HOSTS = [
  "*://www.google-analytics.com/*",
  "*://analytics.google.com/*",
  "*://googletagmanager.com/*",
  "*://www.googletagmanager.com/*",
  "*://googletagservices.com/*",
  "*://doubleclick.net/*",
  "*://*.doubleclick.net/*",
  "*://adservice.google.com/*",
  "*://adservice.google.de/*",
  "*://pagead2.googlesyndication.com/*",
  "*://stats.g.doubleclick.net/*",
  "*://yt3.ggpht.com/ytc/*",
  "*://fonts.googleapis.com/*",
  "*://fonts.gstatic.com/*",
  "*://googleapis.com/*",
  "*://gstatic.com/*",
  "*://cdn.adx1.com/*",
  "*://intelligenceadx.com/*",
  "*://adsco.re/*",
  "*://mc.yandex.com/*",
  "*://mc.yandex.ru/*",
  "*://bvtpk.com/*",
  "*://my.rtmark.net/*",
  "*://bvtpk.com/*",
  "*://b7510.com/*",
  "*://gt.unbrownunflat.com/*",
  "*://im.malocacomals.com/*",
  "*://users.videasy.net/*",
  "*://nf.sixmossin.com/*",
  "*://realizationnewestfangs.com/*",
  "*://acscdn.com/*",
  "*://lt.taloseempest.com/*",
  "*://pl26708123.profitableratecpm.com/*",
  "*://preferencenail.com/*",
  "*://protrafficinspector.com/*",
  "*://s10.histats.com/*",
  "*://weirdopt.com/*",
  "*://static.cloudflareinsights.com/*",
  "*://kettledroopingcontinuation.com/*",
  "*://wayfarerorthodox.com/*",
  "*://woxaglasuy.net/*",
  "*://adeptspiritual.com/*",
  "*://www.calculating-laugh.com/*",
  "*://amavhxdlofklxjg.xyz/*",
  "*://7jtjubf8p5kq7x3z2.u3qleufcm6vure326ktfpbj.cfd/*",
  "*://5mq.get64t9vqg8pnbex1y463o.rest/*",
  "*://usrpubtrk.com/*",
  "*://adexchangeclear.com/*",
  "*://rzjzjnavztycv.online/*",
  "*://tmstr4.cloudnestra.com/*",
  "*://tmstr4.neonhorizonworkshops.com/*",
];

function setupSession(playerSession, trailerSession, getMainWindow) {
  const mediaRequestContexts = new Map();
  const requestOrigins = new Map();

  const MEDIA_URLS = [
    "*://*/*.m3u8*",
    "*://*/*.m3u8",
    "*://*/*.vtt*",
    "*://*/*.vtt",
  ];

  const stripHeaders = (details, callback) => {
    const headers = { ...details.responseHeaders };
    for (const key of Object.keys(headers)) {
      const lower = key.toLowerCase();
      if (
        lower === "x-frame-options" ||
        lower === "content-security-policy" ||
        lower === "access-control-allow-origin" ||
        lower === "access-control-allow-methods" ||
        lower === "access-control-allow-headers" ||
        lower === "access-control-expose-headers" ||
        lower === "access-control-allow-credentials"
      ) {
        delete headers[key];
      }
    }

    // Retrieve the requesting origin captured in onBeforeSendHeaders
    let origin = requestOrigins.get(details.id);
    requestOrigins.delete(details.id); // Clean up immediately to prevent leaks

    if (!origin && details.referrer) {
      try {
        origin = new URL(details.referrer).origin;
      } catch {}
    }
    if (!origin && details.frame && details.frame.url) {
      try {
        origin = new URL(details.frame.url).origin;
      } catch {}
    }

    if (origin && origin !== "null") {
      headers["Access-Control-Allow-Origin"] = [origin];
      headers["Access-Control-Allow-Credentials"] = ["true"];
    } else {
      headers["Access-Control-Allow-Origin"] = ["*"];
    }

    headers["Access-Control-Allow-Methods"] = ["GET, POST, OPTIONS, HEAD"];
    headers["Access-Control-Allow-Headers"] = ["*"];
    headers["Access-Control-Expose-Headers"] = ["*"];

    callback({ responseHeaders: headers });
  };

  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  playerSession.setUserAgent(UA);
  trailerSession.setUserAgent(UA);

  playerSession.webRequest.onHeadersReceived(
    { urls: ["<all_urls>"] },
    stripHeaders,
  );
  trailerSession.webRequest.onHeadersReceived(
    { urls: ["<all_urls>"] },
    stripHeaders,
  );

  // Trailer: block ads only (no media intercept needed)
  trailerSession.webRequest.onBeforeRequest({ urls: BLOCKED_HOSTS }, (_, cb) =>
    cb({ cancel: true }),
  );

  // Capture request origin for CORS spoofing and cache m3u8/vtt details
  const handleBeforeSendHeaders = (details, callback) => {
    const { url, requestHeaders = {} } = details;
    
    let origin = requestHeaders["Origin"] || requestHeaders["origin"];
    if (!origin) {
      const ref = details.referrer || requestHeaders["Referer"] || requestHeaders["referer"];
      if (ref) {
        try {
          origin = new URL(ref).origin;
        } catch {}
      }
    }
    if (origin) {
      requestOrigins.set(details.id, origin);
    }

    const isMedia = url.includes(".m3u8") || url.includes(".vtt");
    if (isMedia) {
      mediaRequestContexts.set(url, {
        url,
        requestHeaders,
        referrer:
          details.referrer ||
          requestHeaders.Referer ||
          requestHeaders.referer ||
          "",
        resourceType: details.resourceType || "",
        timestamp: Date.now(),
      });
      if (mediaRequestContexts.size > 80) {
        const cutoff = Date.now() - 10 * 60 * 1000;
        for (const [key, value] of mediaRequestContexts) {
          if (value.timestamp < cutoff) mediaRequestContexts.delete(key);
        }
      }
    }
    callback({ requestHeaders });
  };

  playerSession.webRequest.onBeforeSendHeaders(
    { urls: ["<all_urls>"] },
    handleBeforeSendHeaders,
  );
  trailerSession.webRequest.onBeforeSendHeaders(
    { urls: ["<all_urls>"] },
    handleBeforeSendHeaders,
  );

  playerSession.webRequest.onBeforeRequest(
    { urls: [...BLOCKED_HOSTS, ...MEDIA_URLS] },
    (details, callback) => {
      const { url } = details;
      const isMedia = url.includes(".m3u8") || url.includes(".vtt");
      if (!isMedia) {
        blockStats.recordBlockedRequest(url);
        callback({ cancel: true });
        return;
      }
      try {
        const host = new URL(url).hostname;
        const blocked = BLOCKED_HOSTS.some((pat) => {
          const hostPat = pat.replace(/^\*:\/\//, "").split("/")[0];
          return hostPat.startsWith("*.")
            ? host.endsWith(hostPat.slice(1))
            : host === hostPat || host === hostPat.replace(/^\*\./, "");
        });
        if (blocked) {
          blockStats.recordBlockedRequest(url);
          callback({ cancel: true });
          return;
        }
      } catch {}

      const mw = getMainWindow();
      if (mw && !mw.isDestroyed()) {
        if (url.includes(".m3u8")) {
          mw.webContents.send(
            "m3u8-found",
            mediaRequestContexts.get(url) || { url },
          );
        } else if (url.includes(".vtt")) {
          const { extractSubtitleLang } = require("../ipc/subtitles");
          mw.webContents.send("subtitle-found", {
            url,
            lang: extractSubtitleLang(url),
          });
        }
      }
      callback({});
    },
  );

  // YouTube consent cookie
  const ytCookie = {
    url: "https://www.youtube.com",
    name: "SOCS",
    value: "CAI",
    path: "/",
    secure: true,
    httpOnly: false,
    sameSite: "no_restriction",
    expirationDate: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 2,
  };
  for (const domain of [".youtube.com", ".youtube-nocookie.com"]) {
    const cookie = { ...ytCookie, domain };
    trailerSession.cookies.set(cookie).catch(() => {});
    playerSession.cookies.set(cookie).catch(() => {});
  }
}


module.exports = {
  setupSession,
  BLOCKED_HOSTS,
};
