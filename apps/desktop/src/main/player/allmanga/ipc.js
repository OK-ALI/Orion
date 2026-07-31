// ── IPC: AllManga (allmanga.to) episode resolver + local player server ─────────
// api.allanime.day blocks GET requests with Cloudflare JS challenge.
// Fix (from ani-cli PR #1632): use POST with JSON body instead of GET.
// Clock/source endpoints are fetched with plain HTTPS (no CF protection).

const { ipcMain } = require("electron");
const https = require("https");
const playerServer = require("./playerServer");
const { decodeAllanimeUrl, parseEpisodeSourceUrls } = require("./decoder");
const {
  allanimeGQL,
  followRedirects,
  httpsGet,
  resolveWithYtdlp,
} = require("./client");
const { anilistSeasonTitle, sanitizeTitle } = require("./resolver");

const HARDCODED_SHOW_IDS = {
  "jojo's bizarre adventure": [
    "MeX4czvkwKGo3zdDp",
    "zyqDjR8te4z6taKyk",
    "GTAQH8Z9K6WbAdXsS",
    "JS9PzKiPanesGRvs5",
    "b6xFsr7MDSMcJArB9",
    "pwduJkjBLytqiWCvM",
  ],
};

const SPLIT_SEASONS = {
  "spy x family": {
    1: [
      { from: 1, showId: null, offset: 0 },
      { from: 13, showId: "H8Aey6QXE7HSqwvW3", offset: 12 },
    ],
  },
};

const SEARCH_GQL = `query($search:SearchInput $limit:Int $page:Int $translationType:VaildTranslationTypeEnumType $countryOrigin:VaildCountryOriginEnumType){shows(search:$search limit:$limit page:$page translationType:$translationType countryOrigin:$countryOrigin){edges{_id name availableEpisodes __typename}}}`;
const EPISODE_GQL = `query($showId:String! $translationType:VaildTranslationTypeEnumType! $episodeString:String!){episode(showId:$showId translationType:$translationType episodeString:$episodeString){episodeString sourceUrls}}`;

const EPISODE_GQL_HASH =
  "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec";

async function allanimeGQLEpisode(variables) {
  try {
    const encodedVars = encodeURIComponent(JSON.stringify(variables));
    const extensions = JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: EPISODE_GQL_HASH },
    });
    const encodedExt = encodeURIComponent(extensions);
    const getUrl = `https://api.allanime.day/api?variables=${encodedVars}&extensions=${encodedExt}`;

    const getRes = await new Promise((resolve, reject) => {
      const u = new URL(getUrl);
      const req = https.request(
        {
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
            Referer: "https://allmanga.to",
            Origin: "https://youtu-chan.com",
            Accept: "*/*",
          },
        },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => resolve({ status: res.statusCode, body: data }));
        },
      );
      req.on("error", reject);
      req.setTimeout(12000, () => {
        req.destroy();
        reject(new Error("timeout"));
      });
      req.end();
    });

    if (getRes.body && getRes.body.includes("tobeparsed")) return getRes;
  } catch {}

  return allanimeGQL(variables, EPISODE_GQL);
}
const PROVIDER_PRIORITY = ["S-mp4", "Luf-Mp4", "Yt-mp4", "Default", "Sl-Hls"];

async function resolveEpisodeFromId(showId, epStr, dubSub) {
  const candidates = [epStr];
  if (!epStr.includes(".")) candidates.push(epStr + ".0");

  let sourceUrls = null;
  for (const attempt of candidates) {
    const epRes = await allanimeGQLEpisode({
      showId,
      translationType: dubSub,
      episodeString: attempt,
    });
    if (!epRes.body) continue;
    const urls = parseEpisodeSourceUrls(epRes.body);
    if (urls?.length) {
      sourceUrls = urls;
      break;
    }
  }
  if (!sourceUrls) return null;

  return trySourceUrls(sourceUrls);
}

async function trySourceUrls(sourceUrls) {
  const decodedSources = sourceUrls
    .filter((s) => s.sourceUrl?.startsWith("--"))
    .map((s) => ({
      sourceName: s.sourceName || "",
      priority: s.priority || 0,
      path: decodeAllanimeUrl(s.sourceUrl).replace("/clock", "/clock.json"),
    }))
    .sort((a, b) => {
      const ai = PROVIDER_PRIORITY.indexOf(a.sourceName);
      const bi = PROVIDER_PRIORITY.indexOf(b.sourceName);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  for (const src of decodedSources) {
    let fetchUrl = src.path;
    if (fetchUrl.startsWith("//")) fetchUrl = "https:" + fetchUrl;
    else if (fetchUrl.startsWith("/"))
      fetchUrl = "https://allanime.day" + fetchUrl;
    else if (!fetchUrl.startsWith("http"))
      fetchUrl = "https://allanime.day/" + fetchUrl;

    try {
      if (fetchUrl.includes("fast4speed.rsvp") || src.sourceName === "Yt-mp4") {
        const finalUrl = await followRedirects(fetchUrl).catch(() => null);
        if (!finalUrl) continue;

        let isGoogleVideoHost = false;
        try {
          const parsedFinalUrl = new URL(finalUrl);
          const host = parsedFinalUrl.hostname.toLowerCase();
          isGoogleVideoHost =
            host === "googlevideo.com" || host.endsWith(".googlevideo.com");
        } catch {
          isGoogleVideoHost = false;
        }
        if (
          /\.(mp4|webm|mkv|m3u8)(\?|$)/i.test(finalUrl) ||
          isGoogleVideoHost ||
          (!finalUrl.includes("youtube.com/watch") &&
            !finalUrl.includes("youtu.be/"))
        ) {
          return {
            ok: true,
            url: finalUrl,
            resolution: "?",
            sourceName: src.sourceName,
            isDirectMp4: !finalUrl.includes(".m3u8"),
            referer: "https://allmanga.to",
          };
        }

        const ytStream = await resolveWithYtdlp(finalUrl).catch(() => null);
        if (ytStream) {
          return {
            ok: true,
            url: ytStream,
            resolution: "?",
            sourceName: src.sourceName,
            isDirectMp4: true,
            referer: "https://www.youtube.com",
          };
        }
        continue;
      }

      const linkRes = await httpsGet(fetchUrl);
      if (linkRes.status !== 200 || !linkRes.body) continue;
      let linkJson;
      try {
        linkJson = JSON.parse(linkRes.body);
      } catch {
        continue;
      }
      const links = linkJson?.links;
      if (!links?.length) continue;
      const allLinks = links.filter((l) => l.link);
      const mp4Links = allLinks.filter(
        (l) => !l.link.includes(".m3u8") && !l.link.includes("master."),
      );
      const best = (mp4Links.length ? mp4Links : allLinks).sort(
        (a, b) =>
          (parseInt(b.resolutionStr) || 0) - (parseInt(a.resolutionStr) || 0),
      )[0];
      if (!best) continue;
      return {
        ok: true,
        url: best.link,
        resolution: best.resolutionStr || "?",
        sourceName: src.sourceName,
        isDirectMp4: !best.link.includes(".m3u8"),
        referer: "https://allmanga.to",
      };
    } catch {
      continue;
    }
  }
  return null;
}










function register() {
  ipcMain.handle("set-player-video", (_, payload) => playerServer.setVideo(payload));

  ipcMain.handle(
    "resolve-allmanga",
    async (
      _,
      { title, seasonNumber, episodeNumber, isMovie, translationType },
    ) => {
      try {
        const season = seasonNumber || 1;
        const dubSub = translationType === "dub" ? "dub" : "sub";

        if (!isMovie) {
          const splitParts = SPLIT_SEASONS[title.toLowerCase()]?.[season];
          if (splitParts) {
            let activePart = splitParts[0];
            for (const part of splitParts) {
              if (episodeNumber >= part.from) activePart = part;
            }
            const partEp = episodeNumber - activePart.offset;
            if (activePart.showId) {
              const result = await resolveEpisodeFromId(
                activePart.showId,
                String(partEp),
                dubSub,
              );
              if (result) return result;
            }
          }
        }

        if (!isMovie) {
          const hardcodedIds = HARDCODED_SHOW_IDS[title.toLowerCase()];
          if (hardcodedIds) {
            const showId =
              hardcodedIds[season - 1] ?? hardcodedIds[hardcodedIds.length - 1];
            const result = await resolveEpisodeFromId(
              showId,
              String(episodeNumber),
              dubSub,
            );
            if (result) return result;
          }
        }

        const anilistResult = isMovie
          ? {
              title,
              romaji: null,
              episodes: null,
              nextTitle: null,
              nextRomaji: null,
            }
          : await anilistSeasonTitle(title, season);

        let searchTitle = anilistResult.title;
        let adjustedEpisodeNumber = episodeNumber;

        if (
          !isMovie &&
          anilistResult.episodes &&
          episodeNumber > anilistResult.episodes &&
          anilistResult.nextTitle
        ) {
          adjustedEpisodeNumber = episodeNumber - anilistResult.episodes;
          searchTitle = anilistResult.nextTitle;
        }

        const epStr = isMovie ? "1" : String(adjustedEpisodeNumber);

        const candidateSet = new Set([
          searchTitle,
          sanitizeTitle(searchTitle),
          ...(anilistResult.romaji && searchTitle === anilistResult.title
            ? [anilistResult.romaji]
            : []),
          ...(anilistResult.nextRomaji &&
          searchTitle === anilistResult.nextTitle
            ? [anilistResult.nextRomaji]
            : []),
          title,
          sanitizeTitle(title),
        ]);
        const candidates = [...candidateSet].filter(Boolean);

        async function searchAllmanga(query) {
          const vars = {
            search: {
              allowAdult: true,
              allowUnknown: false,
              query: query.toLowerCase(),
            },
            limit: 40,
            page: 1,
            translationType: dubSub,
            countryOrigin: "ALL",
          };
          const res = await allanimeGQL(vars, SEARCH_GQL);
          if (!res.body) return null;
          try {
            const edges = JSON.parse(res.body)?.data?.shows?.edges;
            return edges?.length ? edges : null;
          } catch {
            return null;
          }
        }

        let edges = null,
          matchedTitle = searchTitle;
        for (const candidate of candidates) {
          edges = await searchAllmanga(candidate);
          if (edges) {
            matchedTitle = candidate;
            break;
          }
        }
        if (!edges)
          return { ok: false, error: "No results for: " + searchTitle };

        const titleLower = matchedTitle.toLowerCase();
        const anime =
          edges.find((e) => (e.name || "").toLowerCase() === titleLower) ||
          edges[0];

        const epCandidates = [epStr];
        if (!epStr.includes(".")) epCandidates.push(epStr + ".0");

        let sourceUrls = null;
        for (const attempt of epCandidates) {
          const epRes = await allanimeGQLEpisode({
            showId: anime._id,
            translationType: dubSub,
            episodeString: attempt,
          });
          if (!epRes.body) continue;
          const urls = parseEpisodeSourceUrls(epRes.body);
          if (urls?.length) {
            sourceUrls = urls;
            break;
          }
        }
        if (!sourceUrls?.length)
          return { ok: false, error: "No sourceUrls for ep " + epStr };

        const result = await trySourceUrls(sourceUrls);
        if (result) return { ...result, searchTitle };

        return { ok: false, error: "No playable link found" };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
  );

  ipcMain.handle("debug-allmanga", async (_, args) => {
    try {
      if (args.path) {
        const url = args.path.startsWith("http")
          ? args.path
          : "https://allmanga.to" + args.path;
        const r = await httpsGet(url);
        return { status: r.status, body: r.body.slice(0, 3000) };
      }
      if (args.showId) {
        const vars = {
          showId: args.showId,
          translationType: "sub",
          episodeString: String(args.epNum || 1),
        };
        const r = await allanimeGQLEpisode(vars);
        let parsed;
        try {
          parsed = JSON.parse(r.body);
        } catch {}
        const decodedUrls = parseEpisodeSourceUrls(r.body);
        if (decodedUrls?.length) {
          parsed._decoded = decodedUrls
            .filter((s) => s.sourceUrl?.startsWith("--"))
            .map((s) => {
              const p = decodeAllanimeUrl(s.sourceUrl).replace(
                "/clock",
                "/clock.json",
              );
              const fetchUrl = p.startsWith("//")
                ? "https:" + p
                : p.startsWith("/")
                  ? "https://allanime.day" + p
                  : p.startsWith("http")
                    ? p
                    : "https://allanime.day/" + p;
              return { sourceName: s.sourceName, path: p, fetchUrl };
            });
        }
        return { status: r.status, parsed, raw: r.body.slice(0, 2000) };
      }
      const season = args.season || 1;
      const resolvedTitle = await anilistSeasonTitle(args.title || "", season);
      const vars = {
        search: {
          allowAdult: true,
          allowUnknown: false,
          query: resolvedTitle.toLowerCase(),
        },
        limit: 10,
        page: 1,
        translationType: "sub",
        countryOrigin: "ALL",
      };
      const r = await allanimeGQL(vars, SEARCH_GQL);
      return { resolvedTitle, status: r.status, body: r.body.slice(0, 3000) };
    } catch (e) {
      return { error: e.message };
    }
  });
}

module.exports = { register };
