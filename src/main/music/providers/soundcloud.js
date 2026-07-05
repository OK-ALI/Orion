const { binaryPath, run } = require("./ytdlp");

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && (url.hostname === "soundcloud.com" || url.hostname.endsWith(".soundcloud.com"))) return url.toString();
  } catch {}
  return null;
}

function normalize(entry) {
  const webpageUrl = safeUrl(entry.webpage_url || entry.url);
  if (!webpageUrl) return null;
  return { id: `soundcloud:${entry.id}`, providerTrackId: String(entry.id), provider: "soundcloud",
    title: entry.title || "Unknown track", artistName: entry.uploader || entry.channel || "Unknown artist",
    durationMs: Number(entry.duration) > 0 ? Math.round(entry.duration * 1000) : null,
    artworkUrl: entry.thumbnail || null, source: { provider: "soundcloud-metadata", id: String(entry.id) }, webpageUrl };
}

async function search(query) {
  const binary = await binaryPath();
  const payload = JSON.parse(await run(binary, [`scsearch12:${query}`, "--dump-single-json", "--flat-playlist", "--skip-download", "--no-warnings"], 35_000));
  return (payload.entries || []).map(normalize).filter(Boolean);
}

function createSoundCloudProviders() {
  return [
    { id: "soundcloud-metadata", kind: "metadata", name: "SoundCloud", capabilities: ["tracks", "artists", "publicCatalog"], pairedStreamingProviderId: "soundcloud-streaming",
      async search(query) { return { artists: [], albums: [], tracks: await search(query), playlists: [] }; } },
    { id: "soundcloud-streaming", kind: "streaming", name: "SoundCloud", capabilities: ["candidateSearch", "justInTimeResolution"],
      async searchForTrack(track) { const items = track.webpageUrl ? [track] : await search(`${track.artistName || ""} ${track.title || ""}`); return items.slice(0, 8).map((item) => ({ ...item, providerId: "soundcloud-streaming" })); },
      async resolveCandidate(candidate) {
        const url = safeUrl(candidate.webpageUrl); if (!url) throw new Error("Invalid SoundCloud candidate.");
        const binary = await binaryPath(); const payload = JSON.parse(await run(binary, [url, "--dump-single-json", "--skip-download", "--format", "bestaudio/best", "--no-warnings"], 35_000));
        const selected = payload.requested_downloads?.[0] || payload;
        if (!selected.url || !/^https?:\/\//i.test(selected.url)) throw new Error("SoundCloud did not return a playable stream.");
        return { kind: "remote", url: selected.url, headers: selected.http_headers || {}, expiresAt: Date.now() + 60 * 60 * 1000 };
      } },
  ];
}

module.exports = { createSoundCloudProviders, normalize };
