export const MUSIC_COLLECTIONS_CHANGED_EVENT = "orion:music-collections-changed";

export function notifyMusicCollectionsChanged(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MUSIC_COLLECTIONS_CHANGED_EVENT, { detail }));
}
