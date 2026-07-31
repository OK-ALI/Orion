// ── Electron Session & Request Manager ──────────────────────────────────────────
// Handles ad-blocking, user-agents, request interception, and CORS injections.

const { URL } = require("url");
const blockStats = require("../ipc/blockStatsIpc");
const { addCandidate } = require("../downloader/streamCandidates");

const BLOCKED_HOSTS = [
  // ── Google analytics / ads ──
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
  // ── Google fonts / APIs (tracking vectors inside player embeds) ──
  "*://fonts.googleapis.com/*",
  "*://fonts.gstatic.com/*",
  "*://googleapis.com/*",
  "*://gstatic.com/*",
  // ── Videasy user-tracking pixels ──
  "*://users.videasy.net/*",
  "*://users.videasy.to/*",
  // ── VixSrc analytics ──
  "*://analytics.vixcloud.co/*",
  // ── Ad networks ──
  "*://cdn.adx1.com/*",
  "*://intelligenceadx.com/*",
  "*://adsco.re/*",
  "*://mc.yandex.com/*",
  "*://mc.yandex.ru/*",
  "*://bvtpk.com/*",
  "*://my.rtmark.net/*",
  "*://b7510.com/*",
  "*://gt.unbrownunflat.com/*",
  "*://im.malocacomals.com/*",
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
  // ── VidSrc / VsEmbed ad domains ──
  "*://qj.asokapygmoid.com/*",
  "*://hfriendsof.net/*",
  "*://howletoperation.com/*",
  // ── Anti-devtools scripts ──
  "*://unpkg.com/disable-devtool*",
  "*://cdn.jsdelivr.net/npm/disable-devtool*",
];

function setupSession(playerSession, trailerSession, getMainWindow) {
  const mediaRequestContexts = new Map();
  const requestOrigins = new Map();
  const requestContextsById = new Map();

  const MEDIA_URLS = [
    "*://*/*.m3u8*",
    "*://*/*.m3u8",
    "*://*/*.vtt*",
    "*://*/*.vtt",
  ];

  const headerValue = (headers, name) => {
    const key = Object.keys(headers || {}).find((entry) => entry.toLowerCase() === name.toLowerCase());
    const value = key ? headers[key] : null;
    return Array.isArray(value) ? value[0] : value || "";
  };

  const stripHeaders = (details, callback, captureMedia = false) => {
    const headers = { ...details.responseHeaders };
    for (const key of Object.keys(headers)) {
      const lower = key.toLowerCase();
      if (
        lower === "x-frame-options" ||
        lower === "content-security-policy"
      ) {
        delete headers[key];
      }
    }
    if (captureMedia) {
      const requestContext = requestContextsById.get(details.id) || {};
      const contentType = String(headerValue(details.responseHeaders, "content-type")).toLowerCase();
      const candidate = addCandidate({
        ...requestContext,
        url: details.url,
        responseHeaders: details.responseHeaders || {},
        webContentsId: details.webContentsId || requestContext.webContentsId,
      });
      const mw = getMainWindow();
      if (candidate && mw && !mw.isDestroyed()) {
        mw.webContents.send("m3u8-found", candidate);
      }
      const isSubtitle = /(?:^|\/)(?:vtt|webvtt)(?:;|$)/i.test(contentType) || /\.vtt(?:$|[?#])/i.test(details.url);
      if (isSubtitle && mw && !mw.isDestroyed()) {
        const { extractSubtitleLang } = require("../subtitles/ipc");
        mw.webContents.send("subtitle-found", {
          url: details.url,
          lang: extractSubtitleLang(details.url),
          contentType,
          webContentsId: details.webContentsId || requestContext.webContentsId || null,
        });
      }
    }
    requestContextsById.delete(details.id);
    callback({ responseHeaders: headers });
  };

  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  playerSession.setUserAgent(UA);
  trailerSession.setUserAgent(UA);

  playerSession.webRequest.onHeadersReceived(
    { urls: ["*://*/*"] },
    (details, callback) => stripHeaders(details, callback, true),
  );
  trailerSession.webRequest.onHeadersReceived(
    { urls: ["*://*/*"] },
    (details, callback) => stripHeaders(details, callback, false),
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

    requestContextsById.set(details.id, {
      url,
      requestHeaders,
      referrer:
        details.referrer ||
        requestHeaders.Referer ||
        requestHeaders.referer ||
        "",
      resourceType: details.resourceType || "",
      webContentsId: details.webContentsId || null,
      frameId: details.frame?.routingId ?? null,
    });
    if (requestContextsById.size > 250) {
      const oldest = requestContextsById.keys().next().value;
      requestContextsById.delete(oldest);
    }

    const isMedia = url.includes(".m3u8") || url.includes(".mpd") || url.includes(".vtt");
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
    { urls: ["*://*/*"] },
    handleBeforeSendHeaders,
  );

  const TWO_EMBED_URLS = [
    "*://*.2embed.cc/*",
    "*://*.2embed.skin/*",
    "*://*.2embed.org/*",
  ];

  playerSession.webRequest.onBeforeRequest(
    { urls: [...BLOCKED_HOSTS, ...MEDIA_URLS, ...TWO_EMBED_URLS] },
    (details, callback) => {
      const { url } = details;

      // Fix 2Embed redirect &amp; bug
      if (url.includes("2embed") && url.includes("&amp;")) {
        callback({ redirectURL: url.replace(/&amp;/g, "&") });
        return;
      }
      if (url.includes("2embed")) {
        callback({});
        return;
      }
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
        if (url.includes(".vtt")) {
          const { extractSubtitleLang } = require("../subtitles/ipc");
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
