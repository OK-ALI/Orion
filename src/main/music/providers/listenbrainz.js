async function request(pathname, signal) {
  const response = await fetch(`https://api.listenbrainz.org${pathname}`, { signal, headers: { Accept: "application/json", "User-Agent": "OrionMusic/2.0" } });
  if (response.status === 429) throw new Error("ListenBrainz rate limited Orion; try again shortly.");
  if (!response.ok) throw new Error(`ListenBrainz returned ${response.status}.`);
  return response.json();
}

function normalizedRecording(item) {
  const releaseId = item.release_mbid || item.release_group_mbid;
  return { id: `listenbrainz:${item.recording_mbid || `${item.artist_name}:${item.track_name}`}`,
    provider: "listenbrainz", title: item.track_name || item.recording_name || "Unknown track",
    artistName: item.artist_name || "Unknown artist", albumTitle: item.release_name || null,
    artworkUrl: releaseId ? `https://coverartarchive.org/release/${releaseId}/front-500` : null,
    source: { provider: "listenbrainz-dashboard", id: item.recording_mbid || "" } };
}

function createListenBrainzProviders() {
  return [
    { id: "listenbrainz-dashboard", kind: "dashboard", name: "ListenBrainz Dashboard",
      capabilities: ["topTracks", "trendingArtists", "topAlbums"],
      async getDashboard({ signal } = {}) {
        const [recordings, artists, releases] = await Promise.all([
          request("/1/stats/sitewide/recordings?range=this_week&count=25", signal),
          request("/1/stats/sitewide/artists?range=this_week&count=18", signal),
          request("/1/stats/sitewide/releases?range=this_week&count=18", signal),
        ]);
        return { sections: [
          { id: "listenbrainz-tracks", title: "Most Listened This Week", type: "tracks", attribution: "ListenBrainz", items: (recordings.payload?.recordings || []).map(normalizedRecording) },
          { id: "listenbrainz-artists", title: "Artists in Orbit", type: "artists", attribution: "ListenBrainz", items: (artists.payload?.artists || []).map((item) => ({ id: `listenbrainz:${item.artist_mbid || item.artist_name}`, name: item.artist_name, listenCount: item.listen_count })) },
          { id: "listenbrainz-releases", title: "Popular Releases", type: "albums", attribution: "ListenBrainz", items: (releases.payload?.releases || []).map((item) => ({ id: `listenbrainz:${item.release_mbid || item.release_name}`, title: item.release_name, artistName: item.artist_name, listenCount: item.listen_count })) },
        ] };
      } },
  ];
}

module.exports = { createListenBrainzProviders, normalizedRecording };
