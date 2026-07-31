export function getLibraryMediaType(item = {}) {
  return item.media_type || (item.first_air_date || item.name ? "tv" : "movie");
}

export function getLibraryYear(item = {}) {
  return String(item.release_date || item.first_air_date || item.year || "").slice(0, 4);
}

export function getLibraryTitle(item = {}) {
  return item.title || item.name || "Untitled";
}

export function toLibraryRecord(item = {}, mediaType = getLibraryMediaType(item)) {
  const releaseDate = item.release_date || "";
  const firstAirDate = item.first_air_date || "";
  const title = mediaType === "tv" ? item.name || item.title || "Untitled" : getLibraryTitle(item);
  return {
    ...item,
    id: item.id,
    media_type: mediaType,
    title,
    poster_path: item.poster_path || null,
    backdrop_path: item.backdrop_path || null,
    release_date: releaseDate,
    first_air_date: firstAirDate,
    vote_average: Number.isFinite(Number(item.vote_average)) ? Number(item.vote_average) : null,
    year: getLibraryYear({ ...item, release_date: releaseDate, first_air_date: firstAirDate }),
  };
}

export function mergeLibraryOrder(saved = {}, savedOrder = null) {
  const available = Object.keys(saved);
  if (!Array.isArray(savedOrder)) return available;
  const seen = new Set();
  return [...savedOrder, ...available].filter((key) => {
    if (!saved[key] || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sortLibraryItems(items = [], sort = "manual") {
  const list = [...items];
  if (sort === "title") return list.sort((a, b) => getLibraryTitle(a).localeCompare(getLibraryTitle(b), undefined, { sensitivity: "base" }));
  if (sort === "rating") return list.sort((a, b) => (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0) || getLibraryTitle(a).localeCompare(getLibraryTitle(b)));
  if (sort === "year") return list.sort((a, b) => getLibraryYear(b).localeCompare(getLibraryYear(a)) || getLibraryTitle(a).localeCompare(getLibraryTitle(b)));
  return list;
}

export function needsLibraryMetadata(item = {}) {
  if (item.id == null) return false;
  return !item.poster_path
    || !item.vote_average
    || !(item.release_date || item.first_air_date)
    || !item.backdrop_path;
}
