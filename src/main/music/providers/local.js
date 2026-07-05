const database = require("../database");
const { parseLyrics } = require("../library/lyrics");

function createLocalProviders() {
  return [
    {
      id: "orion-local-metadata", kind: "metadata", name: "Local Library",
      capabilities: ["unified", "artists", "albums", "tracks", "albumDetails"],
      async search(query) {
        const tracks = database.listTracks({ query, limit: 100 });
        const artists = [...new Map(tracks.map((track) => [track.artistName.toLowerCase(), {
          id: `local-artist:${track.artistName.toLowerCase()}`, name: track.artistName,
          source: { provider: "orion-local-metadata", id: track.artistName },
        }])).values()];
        const albums = [...new Map(tracks.map((track) => [`${track.artistName}\0${track.albumTitle}`, {
          id: `local-album:${track.artistName}:${track.albumTitle}`, title: track.albumTitle,
          artistName: track.artistName, source: { provider: "orion-local-metadata", id: track.albumTitle },
        }])).values()];
        return { tracks, artists, albums, playlists: [] };
      },
    },
    {
      id: "orion-local-streaming", kind: "streaming", name: "Local Library",
      capabilities: ["candidateSearch", "justInTimeResolution", "range", "localFiles"],
      supportsLocalFiles: true,
      async searchForTrack(track) {
        const row = database.getPrivateTrack(track.id);
        return row?.file_path ? [{ id: row.id, providerId: "orion-local-streaming", title: row.title,
          artistName: row.artist_name, durationMs: row.duration_ms, local: true }] : [];
      },
      async resolveCandidate(candidate) {
        const row = database.getPrivateTrack(candidate.id);
        if (!row?.file_path || row.missing) throw new Error("The local music file is missing.");
        return { kind: "local", filePath: row.file_path, mimeType: row.mime_type, expiresAt: Date.now() + 21_600_000 };
      },
    },
    {
      id: "orion-embedded-lyrics", kind: "lyrics", name: "Embedded and Sidecar Lyrics",
      capabilities: ["embedded", "plain", "lrc"],
      async getLyrics(track) {
        const row = database.getPrivateTrack(track.id);
        return parseLyrics(row?.lyrics_text);
      },
    },
  ];
}

module.exports = { createLocalProviders };
