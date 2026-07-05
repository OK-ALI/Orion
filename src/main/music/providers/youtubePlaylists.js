const { binaryPath, run } = require("./ytdlp");

function validateUrl(value) {
  const url = new URL(String(value || ""));
  const allowed = ["youtube.com", "youtu.be"].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  if (url.protocol !== "https:" || !allowed) throw new Error("Enter a public YouTube playlist URL.");
  return url.toString();
}

function createYouTubePlaylistProvider() {
  return { id: "youtube-playlists", kind: "playlists", name: "YouTube Playlists",
    capabilities: ["importByUrl", "ytDlp"],
    async importPlaylist(value) {
      const url = validateUrl(value); const binary = await binaryPath();
      const output = await run(binary, [url, "--dump-single-json", "--flat-playlist", "--skip-download", "--no-warnings"], 45_000);
      const payload = JSON.parse(output);
      const items = (payload.entries || []).filter((entry) => /^[A-Za-z0-9_-]{6,20}$/.test(String(entry.id || ""))).map((entry) => ({
        id: `youtube:${entry.id}`, providerTrackId: entry.id, provider: "youtube", title: entry.title || "Unknown track",
        artistName: entry.channel || entry.uploader || "Unknown artist", durationMs: Number(entry.duration) > 0 ? Math.round(entry.duration * 1000) : null,
        artworkUrl: entry.thumbnail || null, source: { provider: "youtube-playlists", id: entry.id },
      }));
      if (!items.length) throw new Error("The playlist did not contain importable tracks.");
      return { name: payload.title || "Imported YouTube playlist", description: payload.description || "Imported from YouTube", items };
    } };
}

module.exports = { createYouTubePlaylistProvider, validateUrl };
