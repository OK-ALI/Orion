function mediaKey(type, id, season, episode) {
  if (!["movie", "tv"].includes(type) || id == null || !String(id).trim()) return null;
  if (type === "movie") return "movie_" + id;
  if (season == null || season === "" || episode == null || episode === "") return null;
  if (!Number.isInteger(Number(season)) || Number(season) < 0 ||
      !Number.isInteger(Number(episode)) || Number(episode) < 1) return null;
  return "tv_" + id + "_s" + Number(season) + "e" + Number(episode);
}

/**
 * Derive a local candidate from the current useDownloads records, which prune
 * known missing files at load. A completed status without a local path is not
 * enough. This is not a file-existence guarantee: openLocalMedia still validates
 * the file at playback time. No additional availability store or filesystem probe.
 */
export function findLocalDownloadForItem(item, downloads = []) {
  const key = mediaKey(item?.media_type, item?.id, item?.season, item?.episode);
  if (!key) return null;
  return downloads.find((download) => (
    download?.id != null && String(download.id).trim() &&
    download.status === "completed" &&
    typeof download.filePath === "string" && download.filePath.trim() &&
    mediaKey(download.mediaType, download.tmdbId || download.mediaId, download.season, download.episode) === key
  )) || null;
}
