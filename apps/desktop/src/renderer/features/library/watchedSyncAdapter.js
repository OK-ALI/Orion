import { portableViewingKey } from "@orion/shared/types";

function desktopLocalWatchedKey(value) {
  const { media } = value;
  if (value.kind === "movie") return `movie_${media.id}`;
  return `tv_${media.id}_s${media.season}e${media.episode}`;
}

/**
 * Pure Desktop apply adapter. Desktop stores Watched as boolean native keys,
 * while the cloud contract remains canonical (`tv_<id>_s<season>_e<episode>`).
 */
export function buildLocalDesktopWatchedSnapshotV1(preview) {
  if (!preview || !Array.isArray(preview.rejectedKeys) || preview.rejectedKeys.length > 0) {
    throw new Error("Cannot apply a rejected portable Watched preview.");
  }

  const watched = {};
  for (const key of Object.keys(preview.records || {}).sort()) {
    const value = preview.records[key];
    if (!value) throw new Error("Portable Watched preview is inconsistent.");
    const canonicalKey = portableViewingKey(
      value.media.mediaType,
      value.media.id,
      value.media.season,
      value.media.episode,
    );
    if (canonicalKey !== key) throw new Error("Portable Watched preview key is inconsistent.");
    watched[desktopLocalWatchedKey(value)] = true;
  }
  return watched;
}
