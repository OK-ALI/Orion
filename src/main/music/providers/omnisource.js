const WEIGHTS = { "orion-local-metadata": 1.2, "musicbrainz-metadata": 1.05, "bandcamp-metadata": 1,
  "soundcloud-metadata": .98, "discogs-metadata": .92 };

function text(item) { return `${item.name || item.title || ""} ${item.artistName || ""}`.trim().toLowerCase(); }
function score(item, query, providerId) {
  const candidate = text(item); const term = String(query || "").trim().toLowerCase();
  let relevance = candidate === term ? 4 : candidate.startsWith(term) ? 3 : candidate.includes(term) ? 2 : 1;
  if (String(item.title || item.name || "").toLowerCase() === term) relevance += 2;
  return relevance * (WEIGHTS[providerId] || .9) + Math.min(1, Number(item.popularity || item.listenCount || 0) / 1_000_000);
}

function mergeKind(results, kind, query) {
  const merged = new Map();
  for (const result of results) for (const item of result.value?.[kind] || []) {
    const key = `${String(item.name || item.title || "").toLowerCase()}\0${String(item.artistName || "").toLowerCase()}`;
    const reference = item.source || { provider: result.providerId, id: item.id };
    const current = merged.get(key);
    const scored = { ...item, artworkUrl: item.artworkUrl || current?.artworkUrl || null,
      profileImageUrl: item.profileImageUrl || current?.profileImageUrl || null,
      providerRefs: [...(current?.providerRefs || []), ...(item.providerRefs || []), reference].filter((ref, index, all) => ref && all.findIndex((entry) => entry.provider === ref.provider && entry.id === ref.id) === index),
      matchScore: Math.max(current?.matchScore || 0, score(item, query, result.providerId)) };
    merged.set(key, current && current.matchScore > scored.matchScore ? { ...current,
      artworkUrl: current.artworkUrl || scored.artworkUrl, profileImageUrl: current.profileImageUrl || scored.profileImageUrl,
      providerRefs: scored.providerRefs } : scored);
  }
  return [...merged.values()].sort((a, b) => b.matchScore - a.matchScore);
}

function aggregateSearch(results, query) {
  return { providerId: "orion-omnisource", providerName: "OmniSource", value: {
    artists: mergeKind(results, "artists", query), albums: mergeKind(results, "albums", query),
    tracks: mergeKind(results, "tracks", query), playlists: mergeKind(results, "playlists", query),
  } };
}

module.exports = { aggregateSearch, mergeKind, score };
