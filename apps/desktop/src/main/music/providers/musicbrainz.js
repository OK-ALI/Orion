const USER_AGENT = "Orion/2.0 (https://github.com/OK-ALI/orion)";
const MIN_REQUEST_INTERVAL_MS = 1100;
let requestTail = Promise.resolve();
let lastRequestAt = 0;

function wait(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error("MusicBrainz request was cancelled.")); return; }
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("MusicBrainz request was cancelled.")); }, { once: true });
  });
}

function schedule(task, signal) {
  const run = async () => {
    const delay = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (delay) await wait(delay, signal);
    lastRequestAt = Date.now();
    return task();
  };
  const result = requestTail.then(run, run);
  requestTail = result.catch(() => {});
  return result;
}

async function request(pathname, signal) {
  return schedule(async () => {
    const response = await fetch(`https://musicbrainz.org/ws/2/${pathname}`, {
      signal, headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (response.status === 429) throw new Error(`MusicBrainz rate limited Orion${response.headers.get("retry-after") ? `; retry after ${response.headers.get("retry-after")} seconds` : ""}.`);
    if (!response.ok) throw new Error(`MusicBrainz returned ${response.status}.`);
    return response.json();
  });
}

function source(id) { return { provider: "musicbrainz-metadata", id }; }

async function wikipediaSummary(relations = [], signal) {
  let relation = relations.find((item) => item.type === "wikipedia" && item.url?.resource);
  try {
    if (!relation) {
      const wikidata = relations.find((item) => item.type === "wikidata" && item.url?.resource);
      const entityId = wikidata?.url?.resource?.match(/\/wiki\/(Q\d+)$/)?.[1];
      if (!entityId) return null;
      const entityResponse = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${entityId}.json`, { signal, headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
      if (!entityResponse.ok) return null;
      const entity = await entityResponse.json(); const title = entity.entities?.[entityId]?.sitelinks?.enwiki?.title;
      if (!title) return null;
      relation = { url: { resource: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}` } };
    }
    const url = new URL(relation.url.resource); const title = url.pathname.split("/").filter(Boolean).pop();
    if (!title || !url.hostname.endsWith("wikipedia.org")) return null;
    const response = await fetch(`https://${url.hostname}/api/rest_v1/page/summary/${encodeURIComponent(decodeURIComponent(title))}`, { signal, headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
    if (!response.ok) return null; const body = await response.json(); return body.extract || null;
  } catch { return null; }
}

function createMusicBrainzProvider() {
  return {
    id: "musicbrainz-metadata", kind: "metadata", name: "MusicBrainz",
    capabilities: ["unified", "artists", "albums", "tracks", "artistBio", "artistAlbums", "albumDetails"],
    async search(query, { signal } = {}) {
      const q = encodeURIComponent(String(query || "").trim());
      if (!q) return { artists: [], albums: [], tracks: [], playlists: [] };
      const [artists, releases, recordings] = await Promise.all([
        request(`artist/?query=${q}&fmt=json&limit=12`, signal),
        request(`release-group/?query=${q}&fmt=json&limit=12`, signal),
        request(`recording/?query=${q}&fmt=json&limit=20`, signal),
      ]);
      return {
        artists: (artists.artists || []).map((item) => ({ id: item.id, name: item.name,
          disambiguation: item.disambiguation || "", country: item.country || null, source: source(item.id) })),
        albums: (releases["release-groups"] || []).map((item) => ({ id: item.id, title: item.title,
          artistName: item["artist-credit"]?.[0]?.name || "Unknown artist", releaseDate: item["first-release-date"] || null,
          artworkUrl: `https://coverartarchive.org/release-group/${item.id}/front-500`, source: source(item.id) })),
        tracks: (recordings.recordings || []).map((item) => { const releaseGroupId = item.releases?.[0]?.["release-group"]?.id; return ({ id: `musicbrainz:${item.id}`, providerTrackId: item.id,
          title: item.title, artistName: item["artist-credit"]?.[0]?.name || "Unknown artist",
          durationMs: item.length || null, albumTitle: item.releases?.[0]?.title || null, source: source(item.id),
          artworkUrl: releaseGroupId ? `https://coverartarchive.org/release-group/${releaseGroupId}/front-500` : null,
          providerRefs: [source(item.id)] }); }),
        playlists: [],
      };
    },
    async getArtist(item, { signal } = {}) {
      const id = item.source?.id || item.id;
      if (!/^[a-f0-9-]{36}$/i.test(String(id || ""))) throw new Error("Invalid MusicBrainz artist.");
      const artist = await request(`artist/${id}?inc=url-rels+release-groups&fmt=json`, signal);
      return { artist: { ...item, id: `musicbrainz:${artist.id}`, name: artist.name, disambiguation: artist.disambiguation || "", country: artist.country || null,
        lifeSpan: artist["life-span"] || null, genres: (artist.genres || []).map((genre) => genre.name), source: source(artist.id) },
        biography: await wikipediaSummary(artist.relations, signal),
        albums: (artist["release-groups"] || []).filter((release) => ["Album", "EP", "Single"].includes(release["primary-type"])).map((release) => ({ id: `musicbrainz:${release.id}`, title: release.title, artistName: artist.name,
          releaseDate: release["first-release-date"] || null, primaryType: release["primary-type"], artworkUrl: `https://coverartarchive.org/release-group/${release.id}/front-500`, source: source(release.id) })) };
    },
    async getAlbum(item, { signal } = {}) {
      const id = item.source?.id || String(item.id || "").replace(/^musicbrainz:/, "");
      if (!/^[a-f0-9-]{36}$/i.test(String(id || ""))) throw new Error("Invalid MusicBrainz release group.");
      const group = await request(`release-group/${id}?inc=artist-credits+releases&fmt=json`, signal);
      const releaseId = group.releases?.[0]?.id; let release = null;
      if (releaseId) release = await request(`release/${releaseId}?inc=recordings+artist-credits&fmt=json`, signal);
      const artworkUrl = `https://coverartarchive.org/release-group/${group.id}/front-500`;
      const tracks = (release?.media || []).flatMap((medium) => (medium.tracks || []).map((entry) => ({ id: `musicbrainz:${entry.recording?.id || entry.id}`,
        providerTrackId: entry.recording?.id || entry.id, provider: "musicbrainz", title: entry.title,
        artistName: entry["artist-credit"]?.[0]?.name || item.artistName || "Unknown artist", albumTitle: group.title,
        durationMs: entry.length || null, artworkUrl, source: source(entry.recording?.id || entry.id) })));
      return { album: { ...item, id: `musicbrainz:${group.id}`, title: group.title, artistName: group["artist-credit"]?.[0]?.name || item.artistName,
        releaseDate: group["first-release-date"] || null, primaryType: group["primary-type"], artworkUrl, source: source(group.id) }, tracks };
    },
  };
}

module.exports = { createMusicBrainzProvider };
