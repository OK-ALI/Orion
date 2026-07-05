const { parseLyrics } = require("../library/lyrics");

async function requestLyrics(track, signal) {
  const params = new URLSearchParams({
    track_name: String(track.title || ""),
    artist_name: String(track.artistName || ""),
  });
  if (track.albumTitle) params.set("album_name", String(track.albumTitle));
  if (Number(track.durationMs) > 0) params.set("duration", String(Math.round(track.durationMs / 1000)));
  const response = await fetch(`https://lrclib.net/api/get?${params}`, {
    signal, headers: { Accept: "application/json", "User-Agent": "OrionMusic/2.0" },
  });
  if (response.status === 404) return null;
  if (response.status === 429) throw new Error("LRCLib rate limited Orion; try again shortly.");
  if (!response.ok) throw new Error(`LRCLib returned ${response.status}.`);
  return response.json();
}

function createLrcLibProvider() {
  return { id: "lrclib-lyrics", kind: "lyrics", name: "LRCLib", capabilities: ["plain", "synchronized", "durationMatch"],
    async getLyrics(track, { signal } = {}) {
      const data = await requestLyrics(track, signal);
      const parsed = parseLyrics(data?.syncedLyrics || data?.plainLyrics || "");
      return parsed ? { ...parsed, source: "lrclib" } : null;
    } };
}

module.exports = { createLrcLibProvider, requestLyrics };
