const { binaryPath, run } = require("./ytdlp");

const YTMUSIC_KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
const YTMUSIC_BASE = "https://music.youtube.com/youtubei/v1";
const YTMUSIC_ORIGIN = "https://music.youtube.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0";

let visitorId = "";
const streamUrlCache = new Map();

function context() {
  return {
    context: {
      client: {
        clientName: "WEB_REMIX",
        clientVersion: "1.20240724.00.00",
        hl: "en",
        gl: "US",
      },
      user: {},
    },
  };
}

function headers() {
  const value = {
    accept: "application/json",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/json",
    origin: YTMUSIC_ORIGIN,
    referer: `${YTMUSIC_ORIGIN}/`,
    "user-agent": USER_AGENT,
  };
  if (visitorId) value["x-goog-visitor-id"] = visitorId;
  return value;
}

function nav(value, path) {
  return path.reduce((current, key) => current?.[key], value);
}

function textFromRuns(value) {
  const runs = Array.isArray(value?.runs) ? value.runs : [];
  return runs.map((run) => run.text || "").join("").trim();
}

function bestThumb(thumbnails = []) {
  const list = Array.isArray(thumbnails) ? thumbnails : [];
  const url = list.at(-1)?.url || list[0]?.url || null;
  return url ? String(url).replace(/w\d+-h\d+/i, "w544-h544") : null;
}

function parseDuration(value) {
  const parts = String(value || "").split(":").map((part) => Number(part));
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return null;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return seconds > 0 ? seconds * 1000 : null;
}

function metadataParts(value) {
  return String(value || "")
    .split(/\s*[\u2022\u00B7]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function albumFromMetadata(parts) {
  const content = parts.filter((part) => !/^\d{1,2}:\d{2}(?::\d{2})?$/.test(part));
  return content.length > 1 ? content.at(-1) : null;
}

function extractVideoId(renderer) {
  return nav(renderer, ["overlay", "musicItemThumbnailOverlayRenderer", "content", "musicPlayButtonRenderer", "playNavigationEndpoint", "watchEndpoint", "videoId"])
    || nav(renderer, ["playlistItemData", "videoId"])
    || nav(renderer, ["flexColumns", 0, "musicResponsiveListItemFlexColumnRenderer", "text", "runs", 0, "navigationEndpoint", "watchEndpoint", "videoId"]);
}

function extractBrowseId(renderer) {
  const rootBrowseId = nav(renderer, ["navigationEndpoint", "browseEndpoint", "browseId"]);
  if (rootBrowseId) return rootBrowseId;
  for (const column of renderer.flexColumns || []) {
    const runs = nav(column, ["musicResponsiveListItemFlexColumnRenderer", "text", "runs"]) || [];
    for (const run of runs) {
      const id = nav(run, ["navigationEndpoint", "browseEndpoint", "browseId"]);
      if (id) return id;
    }
  }
  return nav(renderer, ["navigationEndpoint", "browseEndpoint", "browseId"]);
}

function titleBrowse(renderer) {
  const runs = nav(renderer, ["flexColumns", 0, "musicResponsiveListItemFlexColumnRenderer", "text", "runs"]) || [];
  const endpoint = runs.find((run) => run?.navigationEndpoint?.browseEndpoint)?.navigationEndpoint || null;
  return { id: endpoint?.browseEndpoint?.browseId || null, endpoint };
}

function endpointFor(renderer) {
  return renderer?.navigationEndpoint
    || renderer?.title?.runs?.find((run) => run.navigationEndpoint)?.navigationEndpoint
    || renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint
    || null;
}

function pageType(endpoint) {
  return nav(endpoint, ["browseEndpoint", "browseEndpointContextSupportedConfigs", "browseEndpointContextMusicConfig", "pageType"])
    || "";
}

function thumbnailList(renderer) {
  return nav(renderer, ["thumbnail", "musicThumbnailRenderer", "thumbnail", "thumbnails"])
    || nav(renderer, ["thumbnailRenderer", "musicThumbnailRenderer", "thumbnail", "thumbnails"])
    || nav(renderer, ["thumbnail", "thumbnails"])
    || [];
}

function metadataRuns(renderer) {
  return nav(renderer, ["subtitle", "runs"])
    || nav(renderer, ["subtitle", "text", "runs"])
    || nav(renderer, ["flexColumns", 1, "musicResponsiveListItemFlexColumnRenderer", "text", "runs"])
    || [];
}

function titleFor(renderer) {
  return textFromRuns(renderer?.title)
    || textFromRuns(nav(renderer, ["flexColumns", 0, "musicResponsiveListItemFlexColumnRenderer", "text"]))
    || "";
}

function artistFromRuns(runs) {
  const linked = runs.find((run) => {
    const endpoint = run?.navigationEndpoint?.browseEndpoint;
    return endpoint && pageType(run.navigationEndpoint) === "MUSIC_PAGE_TYPE_ARTIST";
  });
  return linked?.text
    || metadataParts(runs.map((run) => run.text || "").join(""))[0]
    || "Unknown artist";
}

function normalizeEndpointItem(renderer) {
  const title = titleFor(renderer);
  if (!title) return null;
  const endpoint = endpointFor(renderer);
  const watch = endpoint?.watchEndpoint;
  const browse = endpoint?.browseEndpoint;
  const browseId = browse?.browseId || extractBrowseId(renderer);
  const type = pageType(endpoint);
  const runs = metadataRuns(renderer);
  const subtitle = runs.map((run) => run.text || "").join("").trim();
  const metadata = metadataParts(subtitle);
  const artworkUrl = bestThumb(thumbnailList(renderer));
  const durationText = runs.find((run) => /^\d{1,2}:\d{2}(?::\d{2})?$/.test(run.text || ""))?.text;
  const videoId = watch?.videoId || extractVideoId(renderer);

  if (videoId) return {
    id: `ytmusic:${videoId}`, providerTrackId: videoId, provider: "ytmusic", title,
    artistName: artistFromRuns(runs), albumTitle: albumFromMetadata(metadata),
    durationMs: parseDuration(durationText), artworkUrl,
    source: { provider: "ytmusic-metadata", id: videoId }, providerRefs: [{ provider: "ytmusic-metadata", id: videoId }],
  };
  if (!browseId) return null;
  const source = { provider: "ytmusic-metadata", id: browseId };
  if (type === "MUSIC_PAGE_TYPE_ARTIST" || browseId.startsWith("UC")) return {
    id: `ytmusic-artist:${browseId}`, name: title, profileImageUrl: artworkUrl, artworkUrl, source,
  };
  if (type === "MUSIC_PAGE_TYPE_PLAYLIST" || browseId.startsWith("VL")) return {
    id: `ytmusic-playlist:${browseId}`, title, artworkUrl, source,
  };
  return {
    id: `ytmusic-album:${browseId}`, title, artistName: artistFromRuns(runs), artworkUrl, source,
  };
}

function normalizeListItem(item) {
  const renderer = item?.musicResponsiveListItemRenderer;
  if (!renderer) return null;
  const title = textFromRuns(nav(renderer, ["flexColumns", 0, "musicResponsiveListItemFlexColumnRenderer", "text"]));
  const subtitleRuns = nav(renderer, ["flexColumns", 1, "musicResponsiveListItemFlexColumnRenderer", "text", "runs"]) || [];
  const subtitle = subtitleRuns.map((run) => run.text || "").join("").trim();
  const metadata = metadataParts(subtitle);
  const videoId = extractVideoId(renderer);
  const titleEndpoint = titleBrowse(renderer);
  const browseId = titleEndpoint.id || extractBrowseId(renderer);
  const browsePageType = pageType(titleEndpoint.endpoint || renderer.navigationEndpoint);
  const thumbnails = nav(renderer, ["thumbnail", "musicThumbnailRenderer", "thumbnail", "thumbnails"]) || [];
  const durationText = subtitleRuns.find((run) => /^\d+:\d+/.test(run.text || ""))?.text;
  const artistName = subtitleRuns.find((run) => nav(run, ["navigationEndpoint", "browseEndpoint", "browseId"])?.startsWith("UC"))?.text
    || metadata[0]
    || "Unknown artist";

  if (!title) return null;
  if (videoId) {
    return {
      id: `ytmusic:${videoId}`,
      providerTrackId: videoId,
      provider: "ytmusic",
      title,
      artistName,
      albumTitle: albumFromMetadata(metadata),
      durationMs: parseDuration(durationText),
      artworkUrl: bestThumb(thumbnails),
      source: { provider: "ytmusic-metadata", id: videoId },
      providerRefs: [{ provider: "ytmusic-metadata", id: videoId }],
    };
  }
  if (browsePageType === "MUSIC_PAGE_TYPE_ARTIST" || (titleEndpoint.id && browseId?.startsWith("UC"))) {
    return {
      id: `ytmusic-artist:${browseId}`,
      name: title,
      profileImageUrl: bestThumb(thumbnails),
      source: { provider: "ytmusic-metadata", id: browseId },
    };
  }
  if (browseId) {
    return {
      id: `ytmusic-album:${browseId}`,
      title,
      artistName,
      artworkUrl: bestThumb(thumbnails),
      source: { provider: "ytmusic-metadata", id: browseId },
    };
  }
  return null;
}

function normalizeMusicItem(item) {
  if (item?.musicResponsiveListItemRenderer) return normalizeListItem(item);
  const renderer = item?.musicTwoRowItemRenderer || item?.musicMultiRowListItemRenderer;
  if (renderer) return normalizeEndpointItem(renderer);
  const panel = item?.playlistPanelVideoRenderer;
  if (!panel) return null;
  const title = textFromRuns(panel.title);
  const bylineRuns = panel.longBylineText?.runs || panel.shortBylineText?.runs || [];
  const videoId = panel.navigationEndpoint?.watchEndpoint?.videoId || panel.videoId;
  if (!title || !videoId) return null;
  return {
    id: `ytmusic:${videoId}`, providerTrackId: videoId, provider: "ytmusic", title,
    artistName: artistFromRuns(bylineRuns),
    durationMs: parseDuration(panel.lengthText?.simpleText || textFromRuns(panel.lengthText)),
    artworkUrl: bestThumb(panel.thumbnail?.thumbnails || []),
    source: { provider: "ytmusic-metadata", id: videoId }, providerRefs: [{ provider: "ytmusic-metadata", id: videoId }],
  };
}

function collectMusicItems(payload) {
  const items = [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.musicResponsiveListItemRenderer || value.musicTwoRowItemRenderer || value.musicMultiRowListItemRenderer || value.playlistPanelVideoRenderer) {
      const item = normalizeMusicItem(value);
      if (item) items.push(item);
      return;
    }
    if (Array.isArray(value)) value.forEach(visit);
    else Object.values(value).forEach(visit);
  };
  visit(payload);
  return items;
}

function shelfTitle(renderer, fallback) {
  const header = renderer?.header?.musicCarouselShelfBasicHeaderRenderer
    || renderer?.header?.musicShelfRenderer?.header
    || renderer?.header
    || renderer;
  return textFromRuns(header?.title) || textFromRuns(header?.strapline) || fallback;
}

/**
 * Keeps YouTube Music's shelf/grid editorial grouping instead of flattening an
 * entire browse response into one unlabelled result set.
 * @param {object} payload
 * @returns {Array<{id: string, title: string, type: "tracks" | "albums" | "artists", items: object[]}>}
 */
function collectCatalogSections(payload) {
  const sections = [];
  const seen = new Set();
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    const renderer = value.musicCarouselShelfRenderer || value.musicShelfRenderer || value.gridRenderer;
    if (renderer) {
      const sourceItems = renderer.contents || renderer.items || [];
      const groups = splitResults(collectMusicItems(sourceItems));
      const candidates = ["tracks", "albums", "artists"]
        .map((type) => ({ type, items: groups[type] || [] }))
        .filter((group) => group.items.length);
      const strongest = candidates.sort((left, right) => right.items.length - left.items.length)[0];
      if (strongest) {
        const title = shelfTitle(renderer, `YouTube Music ${strongest.type}`);
        const identity = `${title.toLowerCase()}\0${strongest.type}`;
        if (!seen.has(identity)) {
          seen.add(identity);
          sections.push({
            id: `ytmusic-shelf-${sections.length + 1}`,
            title,
            type: strongest.type,
            items: strongest.items.slice(0, 24),
          });
        }
      }
    }
    if (Array.isArray(value)) value.forEach(visit);
    else Object.values(value).forEach(visit);
  };
  visit(payload);
  return sections;
}

function collectContinuationTokens(payload, limit = 2) {
  const tokens = [];
  const seen = new Set();
  const visit = (value) => {
    if (!value || typeof value !== "object" || tokens.length >= limit) return;
    const token = nav(value, ["continuationItemRenderer", "continuationEndpoint", "continuationCommand", "token"])
      || nav(value, ["nextContinuationData", "continuation"])
      || nav(value, ["continuationEndpoint", "continuationCommand", "token"]);
    if (token && !seen.has(token)) {
      seen.add(token);
      tokens.push(token);
    }
    if (Array.isArray(value)) value.forEach(visit);
    else Object.values(value).forEach(visit);
  };
  visit(payload);
  return tokens;
}

function detailHeader(payload, kind, fallback) {
  const header = payload?.header?.musicImmersiveHeaderRenderer
    || payload?.header?.musicDetailHeaderRenderer
    || payload?.header?.musicEditablePlaylistDetailHeaderRenderer
    || null;
  if (!header) return fallback;
  const title = textFromRuns(header.title) || fallback.title || fallback.name;
  const artworkUrl = bestThumb(thumbnailList(header)) || fallback.artworkUrl || fallback.profileImageUrl;
  if (kind === "artist") return { ...fallback, name: title || fallback.name, profileImageUrl: artworkUrl, artworkUrl };
  return { ...fallback, title: title || fallback.title, artworkUrl };
}

async function refreshVisitorId(signal) {
  const response = await fetch(YTMUSIC_ORIGIN, { headers: headers(), signal });
  if (!response.ok) return;
  const html = await response.text();
  const match = html.match(/ytcfg\.set\s*\(\s*({.+?})\s*\)\s*;/);
  if (!match) return;
  try {
    visitorId = JSON.parse(match[1])?.VISITOR_DATA || visitorId;
  } catch {}
}

async function ytmRequest(endpoint, body, { signal } = {}) {
  if (!visitorId) await refreshVisitorId(signal).catch(() => {});
  const response = await fetch(`${YTMUSIC_BASE}/${endpoint}?alt=json&key=${YTMUSIC_KEY}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ ...context(), ...body }),
    signal,
  });
  if (response.status === 429) throw new Error("YouTube Music rate limited Orion.");
  if (response.status === 401 || response.status === 403) throw new Error("YouTube Music rejected this session.");
  if (!response.ok) throw new Error(`YouTube Music returned ${response.status}.`);
  return response.json();
}

function splitResults(items) {
  const tracks = [];
  const artists = [];
  const albums = [];
  const playlists = [];
  for (const item of items) {
    if (item.providerTrackId) tracks.push(item);
    else if (item.name) artists.push(item);
    else if (String(item.id || "").startsWith("ytmusic-playlist:")) playlists.push(item);
    else if (item.title) albums.push(item);
  }
  return { tracks, artists, albums, playlists };
}

function collectSearchSuggestions(payload) {
  const values = [];
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    const runs = value.searchSuggestionRenderer?.suggestion?.runs;
    if (Array.isArray(runs)) {
      const label = runs.map((run) => run.text || "").join("").trim();
      if (label && !values.includes(label)) values.push(label);
    }
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child === "object") walk(child);
    }
  };
  walk(payload);
  return values.slice(0, 10);
}

async function resolveVideo(videoId) {
  const cached = streamUrlCache.get(videoId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.resource;
  const binary = await binaryPath();
  const output = await run(binary, [
    `https://music.youtube.com/watch?v=${videoId}`,
    "--dump-single-json",
    "--skip-download",
    "--format",
    "bestaudio[ext=m4a]/bestaudio/best",
    "--no-playlist",
    "--no-warnings",
  ], 35_000);
  const payload = JSON.parse(output);
  const selected = payload.requested_downloads?.[0] || payload;
  if (!selected?.url || !/^https?:\/\//i.test(selected.url)) {
    throw new Error("YouTube Music did not return a playable audio stream.");
  }
  const resource = {
    kind: "remote",
    url: selected.url,
    headers: selected.http_headers || payload.http_headers || {},
    expiresAt: Date.now() + 90 * 60 * 1000,
  };
  streamUrlCache.set(videoId, { resource, expiresAt: resource.expiresAt });
  return resource;
}

function createYtMusicProviders() {
  const metadata = {
    id: "ytmusic-metadata",
    kind: "metadata",
    name: "YouTube Music",
    pairedStreamingProviderId: "ytmusic-streaming",
    capabilities: ["tracks", "artists", "albums", "dashboard", "suggestions"],
    async search(query, { signal } = {}) {
      const safe = String(query || "").trim();
      if (!safe) return { artists: [], albums: [], tracks: [], playlists: [] };
      const payload = await ytmRequest("search", { query: safe }, { signal });
      return { ...splitResults(collectMusicItems(payload)), continuation: collectContinuationTokens(payload, 1)[0] || null };
    },
    async continueSearch(continuation, { signal } = {}) {
      const token = String(continuation || "");
      if (!token || token.length > 4_000) return { artists: [], albums: [], tracks: [], playlists: [], continuation: null };
      const payload = await ytmRequest("search", { continuation: token }, { signal });
      return { ...splitResults(collectMusicItems(payload)), continuation: collectContinuationTokens(payload, 1)[0] || null };
    },
    async getSuggestions(query, { signal } = {}) {
      const input = String(query || "").trim().slice(0, 120);
      if (input.length < 2) return [];
      const payload = await ytmRequest("music/get_search_suggestions", { input }, { signal });
      return collectSearchSuggestions(payload);
    },
    async getRadio(item, { signal } = {}) {
      let seed = item;
      let videoId = String(seed?.providerTrackId || seed?.source?.videoId || "");
      if (!videoId && seed?.source?.id) {
        const kind = String(seed.id || "").includes("artist") ? "artist" : "album";
        const detail = kind === "artist" ? await this.getArtist(seed, { signal }) : await this.getAlbum(seed, { signal });
        seed = detail?.tracks?.[0];
        videoId = String(seed?.providerTrackId || "");
      }
      if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) return [];
      const payload = await ytmRequest("next", { videoId, isAudioOnly: true }, { signal });
      const tracks = splitResults(collectMusicItems(payload)).tracks;
      return tracks.filter((track, index, all) => track.providerTrackId !== videoId
        && all.findIndex((entry) => entry.providerTrackId === track.providerTrackId) === index).slice(0, 50);
    },
    async getArtist(item, { signal } = {}) {
      const browseId = item.source?.id || String(item.id || "").replace(/^ytmusic-artist:/, "");
      const payload = await ytmRequest("browse", { browseId }, { signal });
      const continuation = collectContinuationTokens(payload, 1)[0];
      const continuationPayload = continuation
        ? await ytmRequest("browse", { continuation }, { signal }).catch(() => null)
        : null;
      const items = [...collectMusicItems(payload), ...collectMusicItems(continuationPayload)];
      const results = splitResults(items);
      return { artist: detailHeader(payload, "artist", item), biography: "", albums: results.albums, tracks: results.tracks };
    },
    async getAlbum(item, { signal } = {}) {
      const browseId = item.source?.id || String(item.id || "").replace(/^ytmusic-album:/, "");
      const payload = await ytmRequest("browse", { browseId }, { signal });
      return { album: detailHeader(payload, "album", item), tracks: splitResults(collectMusicItems(payload)).tracks };
    },
    async getPlaylist(item, { signal } = {}) {
      const browseId = item.source?.id || String(item.id || "").replace(/^ytmusic-playlist:/, "");
      const payload = await ytmRequest("browse", { browseId }, { signal });
      return { playlist: detailHeader(payload, "playlist", item), tracks: splitResults(collectMusicItems(payload)).tracks };
    },
  };

  const streaming = {
    id: "ytmusic-streaming",
    kind: "streaming",
    name: "YouTube Music",
    capabilities: ["candidateSearch", "justInTimeResolution", "streamRefresh", "manualCandidates"],
    async searchForTrack(track, { signal } = {}) {
      if (track.providerTrackId && String(track.source?.provider || "").startsWith("ytmusic")) {
        return [{ ...track, id: track.providerTrackId, providerId: "ytmusic-streaming" }];
      }
      const query = [track.artistName, track.title].filter(Boolean).join(" ");
      const payload = await ytmRequest("search", { query, params: "EgWKAQIIAWoMEA4QChADEAQQCRAF" }, { signal });
      return splitResults(collectMusicItems(payload)).tracks.slice(0, 10).map((item) => ({
        ...item,
        id: item.providerTrackId,
        providerId: "ytmusic-streaming",
      }));
    },
    async resolveCandidate(candidate) {
      const videoId = String(candidate.providerTrackId || candidate.id || "").replace(/^ytmusic:/, "");
      if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) throw new Error("Invalid YouTube Music candidate.");
      return resolveVideo(videoId);
    },
  };

  const dashboard = {
    id: "ytmusic-dashboard",
    kind: "dashboard",
    name: "YouTube Music Home",
    capabilities: ["home", "charts", "radio"],
    async getDashboard({ signal } = {}) {
      const payload = await ytmRequest("browse", { browseId: "FEmusic_home" }, { signal });
      const shelfSections = collectCatalogSections(payload);
      const flatSections = splitResults(collectMusicItems(payload));
      let fallbackSource = flatSections;
      const missingCoreSection = ["tracks", "albums", "artists"].some((type) => !shelfSections.some((section) => section.type === type)
        && !(flatSections[type] || []).length);
      // Anonymous YT Music home occasionally returns a valid but empty browse
      // shell. A normal public search remains available in that state and gives
      // Orion useful, region-aware starter shelves instead of an error card.
      if (missingCoreSection) {
        try {
          const fallbackPayload = await ytmRequest("search", { query: "Top songs" }, { signal });
          fallbackSource = splitResults(collectMusicItems(fallbackPayload));
        } catch {}
      }
      const fallbackSections = [
        { id: "ytmusic-home-tracks", title: "YouTube Music picks", type: "tracks", items: (flatSections.tracks.length ? flatSections.tracks : fallbackSource.tracks).slice(0, 24) },
        { id: "ytmusic-home-albums", title: "Albums and releases", type: "albums", items: (flatSections.albums.length ? flatSections.albums : fallbackSource.albums).slice(0, 18) },
        { id: "ytmusic-home-artists", title: "Artists", type: "artists", items: (flatSections.artists.length ? flatSections.artists : fallbackSource.artists).slice(0, 18) },
      ].filter((section) => section.items.length && !shelfSections.some((shelf) => shelf.type === section.type));
      return {
        sections: [...shelfSections, ...fallbackSections],
      };
    },
  };

  return [metadata, streaming, dashboard];
}

module.exports = {
  collectCatalogSections,
  collectContinuationTokens,
  collectMusicItems,
  collectSearchSuggestions,
  createYtMusicProviders,
  splitResults,
  ytmRequest,
};
