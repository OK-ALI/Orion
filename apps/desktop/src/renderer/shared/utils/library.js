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


export const DESKTOP_SERIES_WATCHED_PRESENTATION = Symbol.for("orion.desktop.series-watched-presentation");

export function attachDesktopSeriesWatchedPresentation(watched = {}, summaries = {}) {
  const presentation = { ...(watched || {}) };
  Object.defineProperty(presentation, DESKTOP_SERIES_WATCHED_PRESENTATION, {
    value: summaries || {},
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return presentation;
}

export function getWatchedPresentationKey(item = {}) {
  if (item.id == null) return null;
  const mediaType = getLibraryMediaType(item);
  if (mediaType === "movie") return `movie_${item.id}`;
  if (item.season == null || item.episode == null) return null;
  const season = Number(item.season);
  const episode = Number(item.episode);
  if (!Number.isInteger(season) || season < 0 || !Number.isInteger(episode) || episode < 1) return null;
  return `tv_${item.id}_s${season}e${episode}`;
}

function getKnownSeriesEpisodeKeys(item = {}) {
  if (getLibraryMediaType(item) !== "tv" || item.id == null) return [];
  if (item.season != null && item.episode != null) return [];
  if (!Array.isArray(item.seasons)) return [];

  const keys = [];
  for (const season of item.seasons) {
    const seasonNumber = Number(season?.season_number);
    const episodeCount = Number(season?.episode_count);
    if (!Number.isInteger(seasonNumber) || seasonNumber < 1) continue;
    if (!Number.isInteger(episodeCount) || episodeCount < 1) continue;
    for (let episode = 1; episode <= episodeCount; episode += 1) {
      keys.push(`tv_${item.id}_s${seasonNumber}e${episode}`);
    }
  }
  return keys;
}

export function isMediaItemWatched(item = {}, watched = {}) {
  const exactKey = getWatchedPresentationKey(item);
  if (exactKey) return !!watched?.[exactKey];

  if (getLibraryMediaType(item) === "tv" && item.id != null) {
    const summary = watched?.[DESKTOP_SERIES_WATCHED_PRESENTATION]?.[`tv_${item.id}`];
    if (summary?.complete === true) return true;
  }

  const seriesKeys = getKnownSeriesEpisodeKeys(item);
  return seriesKeys.length > 0 && seriesKeys.every((key) => !!watched?.[key]);
}
