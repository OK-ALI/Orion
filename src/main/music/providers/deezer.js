async function request(pathname, signal) {
  const response = await fetch(`https://api.deezer.com${pathname}`, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Deezer returned ${response.status}.`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "Deezer request failed.");
  return data;
}

function track(item, sourceProvider = "deezer-dashboard") {
  return { id: `deezer:${item.id}`, providerTrackId: String(item.id), provider: "deezer",
    title: item.title, artistName: item.artist?.name || "Unknown artist", albumTitle: item.album?.title || null,
    durationMs: item.duration ? item.duration * 1000 : null, artworkUrl: item.album?.cover_medium || null,
    source: { provider: sourceProvider, id: String(item.id) } };
}

function album(item) {
  return { id: `deezer:${item.id}`, title: item.title, artistName: item.artist?.name || "Unknown artist",
    artworkUrl: item.cover_medium || item.cover_big || null, releaseDate: item.release_date || null,
    source: { provider: "deezer-metadata", id: String(item.id) } };
}

function createDeezerProviders() {
  return [
    { id: "deezer-metadata", kind: "metadata", name: "Deezer Catalog", pairedStreamingProviderId: "ytdlp-streaming",
      capabilities: ["tracks", "artists", "albums", "artwork"],
      async search(query, { signal } = {}) {
        const data = await request(`/search?q=${encodeURIComponent(String(query || "").trim())}&limit=25`, signal);
        const tracks = (data.data || []).map((item) => track(item, "deezer-metadata"));
        const artists = [...new Map((data.data || []).filter((item) => item.artist).map((item) => [item.artist.id, {
          id: `deezer:${item.artist.id}`, name: item.artist.name, profileImageUrl: item.artist.picture_medium || null,
          source: { provider: "deezer-metadata", id: String(item.artist.id) },
        }])).values()];
        const albums = [...new Map((data.data || []).filter((item) => item.album).map((item) => [item.album.id, album({ ...item.album, artist: item.artist })])).values()];
        return { tracks, artists, albums, playlists: [] };
      } },
    { id: "deezer-dashboard", kind: "dashboard", name: "Deezer Dashboard",
      capabilities: ["charts", "trendingArtists", "editorialPlaylists", "topAlbums"],
      async getDashboard({ signal } = {}) {
        const data = await request("/chart/0?limit=25", signal);
        return { sections: [
          { id: "deezer-tracks", title: "Deezer Top Tracks", type: "tracks", attribution: "Deezer", items: (data.tracks?.data || []).map(track) },
          { id: "deezer-albums", title: "Trending Albums", type: "albums", attribution: "Deezer", items: (data.albums?.data || []).map(album) },
          { id: "deezer-artists", title: "Trending Artists", type: "artists", attribution: "Deezer", items: (data.artists?.data || []).map((item) => ({ id: `deezer:${item.id}`, name: item.name, profileImageUrl: item.picture_medium })) },
          { id: "deezer-playlists", title: "Editorial Playlists", type: "playlists", attribution: "Deezer", items: (data.playlists?.data || []).map((item) => ({ id: `deezer:${item.id}`, name: item.title, artworkUrl: item.picture_medium, trackCount: item.nb_tracks })) },
        ] };
      } },
    { id: "deezer-playlists", kind: "playlists", name: "Deezer", capabilities: ["browse", "editorial"] },
  ];
}

module.exports = { createDeezerProviders };
