import { storage } from "./settingsStore";
import { buildDesktopPortableWatchedPreviewV1 } from "../features/library/viewingStatePortableAdapter";
import { buildLocalDesktopWatchedSnapshotV1 } from "../features/library/watchedSyncAdapter";

export const WATCHED_SYNC_APPLIED_EVENT = "orion:watched-sync-applied";

export function readDesktopPortableWatchedPreviewV1() {
  return buildDesktopPortableWatchedPreviewV1({
    watched: storage.get("watched") || {},
    history: storage.get("history") || [],
  });
}

export function applyDesktopPortableWatchedPreviewV1(preview) {
  const snapshot = buildLocalDesktopWatchedSnapshotV1(preview);
  storage.set("watched", snapshot);
  window.dispatchEvent(new CustomEvent(WATCHED_SYNC_APPLIED_EVENT, { detail: { watched: snapshot } }));
}
