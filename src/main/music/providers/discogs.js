const USER_AGENT = "OrionMusic/2.0 +https://github.com/OK-ALI/orion";

async function request(params, signal) {
  const query = new URLSearchParams(params);
  const response = await fetch(`https://api.discogs.com/database/search?${query}`, { signal, headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
  if (response.status === 429) throw new Error("Discogs rate limited Orion; try again shortly.");
  if (!response.ok) throw new Error(`Discogs returned ${response.status}.`);
  return response.json();
}

async function detail(pathname, signal) {
  const response = await fetch(`https://api.discogs.com/${pathname}`, { signal, headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Discogs returned ${response.status}.`); return response.json();
}

function source(id) { return { provider: "discogs-metadata", id: String(id) }; }

function createDiscogsProvider() {
  return {
    id: "discogs-metadata", kind: "metadata", name: "Discogs",
    capabilities: ["artists", "albums", "releaseYears", "genres", "artwork", "artistDetails", "albumDetails"],
    async search(query, { signal } = {}) {
      const [artists, releases] = await Promise.all([
        request({ q: query, type: "artist", per_page: "10" }, signal),
        request({ q: query, type: "master", per_page: "16" }, signal),
      ]);
      return {
        artists: (artists.results || []).map((item) => ({ id: `discogs:${item.id}`, name: item.title,
          profileImageUrl: item.cover_image || null, source: source(item.id) })),
        albums: (releases.results || []).map((item) => {
          const [artistName, ...titleParts] = String(item.title || "").split(" - ");
          return { id: `discogs:${item.id}`, title: titleParts.join(" - ") || item.title,
            artistName: titleParts.length ? artistName : "Unknown artist", year: item.year || null,
            genres: item.genre || [], artworkUrl: item.cover_image || null, source: source(item.id) };
        }), tracks: [], playlists: [],
      };
    },
    async getArtist(item, { signal } = {}) {
      const id = String(item.source?.id || item.id || "").replace(/^discogs:/, ""); const artist = await detail(`artists/${encodeURIComponent(id)}`, signal);
      return { artist: { ...item, id: `discogs:${artist.id}`, name: artist.name, profileImageUrl: artist.images?.[0]?.uri || null, source: source(artist.id) }, biography: artist.profile || null, albums: [] };
    },
    async getAlbum(item, { signal } = {}) {
      const id = String(item.source?.id || item.id || "").replace(/^discogs:/, ""); const master = await detail(`masters/${encodeURIComponent(id)}`, signal);
      const parseDuration = (value) => { const match = String(value || "").match(/^(\d+):(\d+)$/); return match ? (Number(match[1]) * 60 + Number(match[2])) * 1000 : null; };
      return { album: { ...item, id: `discogs:${master.id}`, title: master.title, artistName: master.artists?.[0]?.name || item.artistName,
        year: master.year || null, genres: master.genres || [], artworkUrl: master.images?.[0]?.uri || item.artworkUrl, source: source(master.id) },
        tracks: (master.tracklist || []).filter((track) => track.type_ === "track").map((track, index) => ({ id: `discogs:${master.id}:${index}`, provider: "discogs", title: track.title,
          artistName: master.artists?.[0]?.name || item.artistName || "Unknown artist", albumTitle: master.title, durationMs: parseDuration(track.duration), source: source(`${master.id}:${index}`) })) };
    },
  };
}

module.exports = { createDiscogsProvider };
