const SPOTIFY_CHARTS_URL = "https://charts-spotify-com-service.spotify.com/public/v0/charts";

function artworkUrl(value) {
  const raw = String(value || "");
  const spotifyImage = raw.match(/^spotify:image:([A-Za-z0-9]+)$/);
  if (spotifyImage) return `https://i.scdn.co/image/${spotifyImage[1]}`;
  return /^https?:\/\//i.test(raw) ? raw : "";
}

function normalizeEntry(entry, index) {
  const metadata = entry?.trackMetadata || {};
  const artist = metadata.artists?.[0]?.name || "";
  const title = metadata.trackName || "";
  if (!title) return null;
  return {
    id: `spotify-chart:${metadata.trackUri || `${title}:${artist}:${index}`}`,
    title,
    artistName: artist,
    artworkUrl: artworkUrl(metadata.displayImageUri),
    popularity: Math.max(0, 100 - index),
    source: { provider: "spotify-charts-dashboard", id: metadata.trackUri || title },
    providerRefs: [{ provider: "spotify-charts-dashboard", id: metadata.trackUri || title }],
  };
}

async function fetchSpotifyTop50({ signal } = {}) {
  const response = await fetch(SPOTIFY_CHARTS_URL, { signal, headers: { accept: "application/json" } });
  if (response.status === 429) throw new Error("Spotify charts rate limited Orion.");
  if (!response.ok) throw new Error(`Spotify charts returned ${response.status}.`);
  const data = await response.json();
  return (data?.chartEntryViewResponses?.[0]?.entries || [])
    .map(normalizeEntry)
    .filter(Boolean);
}

function createSpotifyChartsProvider() {
  return {
    id: "spotify-charts-dashboard",
    kind: "dashboard",
    name: "Spotify Charts",
    capabilities: ["top50", "metadataOnly", "importPending"],
    async getDashboard({ signal } = {}) {
      const tracks = await fetchSpotifyTop50({ signal });
      return { sections: [{ id: "spotify-top-50-global", title: "Spotify Top 50 Global", type: "tracks", items: tracks }] };
    },
  };
}

module.exports = { createSpotifyChartsProvider, fetchSpotifyTop50 };
