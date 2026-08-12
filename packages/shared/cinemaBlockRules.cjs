"use strict";

/** Authoritative, redacted Cinema host rules shared by Electron and Android. */
const CINEMA_BLOCK_RULE_CATALOG_V1 = Object.freeze([
  ["google-analytics", "google-analytics.com", true, "tracker"],
  ["analytics-google", "analytics.google.com", true, "tracker"],
  ["google-tag-manager", "googletagmanager.com", true, "tracker"],
  ["google-tag-services", "googletagservices.com", true, "advertisement"],
  ["doubleclick", "doubleclick.net", true, "advertisement"],
  ["google-adservice", "adservice.google.com", true, "advertisement"],
  ["google-adservice-de", "adservice.google.de", true, "advertisement"],
  ["google-syndication", "googlesyndication.com", true, "advertisement"],
  ["videasy-users-net", "users.videasy.net", true, "tracker"],
  ["videasy-users-to", "users.videasy.to", true, "tracker"],
  ["vixcloud-analytics", "analytics.vixcloud.co", true, "tracker"],
  ["adx1", "cdn.adx1.com", true, "advertisement"],
  ["intelligence-adx", "intelligenceadx.com", true, "advertisement"],
  ["adsco", "adsco.re", true, "advertisement"],
  ["yandex-com", "mc.yandex.com", true, "tracker"],
  ["yandex-ru", "mc.yandex.ru", true, "tracker"],
  ["bvtpk", "bvtpk.com", true, "advertisement"],
  ["rtmark", "my.rtmark.net", true, "tracker"],
  ["b7510", "b7510.com", true, "advertisement"],
  ["unbrownunflat", "gt.unbrownunflat.com", true, "advertisement"],
  ["malocacomals", "im.malocacomals.com", true, "advertisement"],
  ["sixmossin", "nf.sixmossin.com", true, "advertisement"],
  ["newestfangs", "realizationnewestfangs.com", true, "advertisement"],
  ["acscdn", "acscdn.com", true, "advertisement"],
  ["taloseempest", "lt.taloseempest.com", true, "advertisement"],
  ["profitable-rate", "profitableratecpm.com", true, "advertisement"],
  ["preference-nail", "preferencenail.com", true, "advertisement"],
  ["traffic-inspector", "protrafficinspector.com", true, "tracker"],
  ["histats", "histats.com", true, "tracker"],
  ["weirdopt", "weirdopt.com", true, "advertisement"],
  ["cloudflare-insights", "static.cloudflareinsights.com", true, "tracker"],
  ["kettle-drooping", "kettledroopingcontinuation.com", true, "advertisement"],
  ["wayfarer-orthodox", "wayfarerorthodox.com", true, "advertisement"],
  ["woxaglasuy", "woxaglasuy.net", true, "advertisement"],
  ["adept-spiritual", "adeptspiritual.com", true, "advertisement"],
  ["calculating-laugh", "calculating-laugh.com", true, "advertisement"],
  ["amavhxd", "amavhxdlofklxjg.xyz", true, "advertisement"],
  ["u3qleuf", "7jtjubf8p5kq7x3z2.u3qleufcm6vure326ktfpbj.cfd", true, "advertisement"],
  ["get64", "5mq.get64t9vqg8pnbex1y463o.rest", true, "advertisement"],
  ["usrpubtrk", "usrpubtrk.com", true, "tracker"],
  ["adexchange-clear", "adexchangeclear.com", true, "advertisement"],
  ["rzjzjnav", "rzjzjnavztycv.online", true, "advertisement"],
  ["cloudnestra", "tmstr4.cloudnestra.com", true, "advertisement"],
  ["neon-horizon", "tmstr4.neonhorizonworkshops.com", true, "advertisement"],
  ["asokapygmoid", "qj.asokapygmoid.com", true, "advertisement"],
  ["hfriendsof", "hfriendsof.net", true, "advertisement"],
  ["howlet-operation", "howletoperation.com", true, "advertisement"],
  ["gsbdom-click", "gsbdom.click", true, "advertisement"],
  ["adsterra", "adsterra.com", true, "advertisement"],
  ["popcash", "popcash.net", true, "popup"],
  ["exoclick", "exoclick.com", true, "advertisement"],
].map(([id, host, includeSubdomains, classification]) => Object.freeze({ id, host, includeSubdomains, classification })));

function toElectronBlockedPatterns(catalog = CINEMA_BLOCK_RULE_CATALOG_V1) {
  return catalog.flatMap((rule) => rule.includeSubdomains
    ? [`*://${rule.host}/*`, `*://*.${rule.host}/*`]
    : [`*://${rule.host}/*`]);
}

module.exports = { CINEMA_BLOCK_RULE_CATALOG_V1, toElectronBlockedPatterns };
