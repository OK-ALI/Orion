const crypto = require("crypto");

const SAAVN_KEY = "38343934"; // ASCII key representation for JioSaavn decryption

function decryptMediaUrl(encryptedUrl) {
  try {
    if (!encryptedUrl) return "";
    const key = Buffer.from(SAAVN_KEY, "utf-8");
    const decipher = crypto.createDecipheriv("des-ecb", key, null);
    decipher.setAutoPadding(true);
    let decrypted = decipher.update(encryptedUrl, "base64", "utf-8");
    decrypted += decipher.final("utf-8");
    return decrypted.replace("_96.mp4", "_320.mp4").replace("_96.aac", "_320.aac").trim();
  } catch (error) {
    console.error("[saavn] Decryption failed:", error);
    return "";
  }
}

function cleanArtwork(url) {
  if (!url) return null;
  return url.replace("150x150", "500x500").replace("50x50", "500x500");
}

function safeText(str) {
  return String(str || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'");
}

function normalizeTrack(item, sourceProvider = "saavn-metadata") {
  const durationSec = Number(item.more_info?.duration || item.duration || 0);
  const title = safeText(item.title || item.name || "Unknown track");
  const artistName = safeText(item.more_info?.primary_artists || item.artistName || item.subtitle || "Unknown artist");
  return {
    id: `saavn:${item.id}`,
    providerTrackId: String(item.id),
    provider: "saavn",
    title,
    artistName,
    albumTitle: safeText(item.more_info?.album || item.albumTitle || null),
    durationMs: durationSec > 0 ? durationSec * 1000 : null,
    artworkUrl: cleanArtwork(item.image || null),
    encryptedMediaUrl: item.more_info?.encrypted_media_url || item.encryptedMediaUrl || null,
    source: { provider: sourceProvider, id: String(item.id) }
  };
}

async function searchCatalog(query, signal) {
  const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=1&q=${encodeURIComponent(String(query || "").trim())}&n=25`;
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Saavn search returned status ${response.status}`);
    const data = await response.json();
    const results = data.results || data.data || [];
    return results.map((item) => normalizeTrack(item, "saavn-metadata"));
  } catch (error) {
    console.error("[saavn] Search failed:", error);
    return [];
  }
}

function createSaavnProviders() {
  return [
    {
      id: "saavn-metadata",
      kind: "metadata",
      name: "Orion Audio Catalog",
      pairedStreamingProviderId: "saavn-streaming",
      capabilities: ["tracks", "artists", "albums", "artwork"],
      async search(query, { signal } = {}) {
        const tracks = await searchCatalog(query, signal);
        return { tracks, artists: [], albums: [], playlists: [] };
      }
    },
    {
      id: "saavn-streaming",
      kind: "streaming",
      name: "Orion Streaming Curation",
      capabilities: ["candidateSearch", "justInTimeResolution"],
      async searchForTrack(track) {
        // Query Saavn for the track title and artist
        const query = [track.artistName, track.title].filter(Boolean).join(" - ");
        const results = await searchCatalog(query);
        return results.slice(0, 8).map((item) => ({
          ...item,
          providerId: "saavn-streaming"
        }));
      },
      async resolveCandidate(candidate) {
        if (!candidate.encryptedMediaUrl) {
          throw new Error("No encrypted media link found on Saavn candidate.");
        }
        const streamUrl = decryptMediaUrl(candidate.encryptedMediaUrl);
        if (!streamUrl || !/^https?:\/\//i.test(streamUrl)) {
          throw new Error("JioSaavn decryption yielded an invalid streaming URL.");
        }
        return {
          kind: "remote",
          url: streamUrl,
          headers: {},
          expiresAt: Date.now() + 4 * 60 * 60 * 1000 // 4 hour expiration window
        };
      }
    }
  ];
}

module.exports = { createSaavnProviders, decryptMediaUrl, normalizeTrack };
