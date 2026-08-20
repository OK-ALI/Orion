import { storage } from "./settingsStore";
import {
  buildDesktopPortableViewingActivityPreviewV1,
  buildLocalDesktopViewingActivitySnapshotV1,
} from "../features/library/viewingStatePortableAdapter";

export const VIEWING_ACTIVITY_SYNC_APPLIED_EVENT = "orion:viewing-activity-sync-applied";

function readState() {
  return {
    watched: storage.get("watched") || {},
    history: storage.get("history") || [],
    progress: storage.get("progress") || {},
    progressDetails: storage.get("progressDetails") || {},
  };
}

export function readDesktopPortableViewingActivityPreviewV1() {
  return buildDesktopPortableViewingActivityPreviewV1(readState());
}

function restoreStorageValue(key, previous) {
  if (previous == null) storage.remove(key);
  else storage.set(key, previous);
}

function assertStoredValue(key, expected) {
  if (JSON.stringify(storage.get(key)) !== JSON.stringify(expected)) {
    throw new Error(`Viewing Activity local write verification failed for ${key}.`);
  }
}

export function applyDesktopPortableViewingActivityStateV1(state) {
  const existing = readState();
  const snapshot = buildLocalDesktopViewingActivitySnapshotV1(state, existing);
  const touchedResumeKeys = [...new Set([
    ...Object.keys(snapshot.resumeTimes),
    ...snapshot.resumeRemovedKeys,
  ])];
  const previous = {
    history: storage.get("history"),
    progress: storage.get("progress"),
    progressDetails: storage.get("progressDetails"),
    resume: Object.fromEntries(touchedResumeKeys.map((key) => [key, storage.get(`dlTime_${key}`)])),
  };

  try {
    storage.set("history", snapshot.history);
    storage.set("progress", snapshot.progress);
    storage.set("progressDetails", snapshot.progressDetails);
    for (const [key, value] of Object.entries(snapshot.resumeTimes)) storage.set(`dlTime_${key}`, value);
    for (const key of snapshot.resumeRemovedKeys) storage.remove(`dlTime_${key}`);

    assertStoredValue("history", snapshot.history);
    assertStoredValue("progress", snapshot.progress);
    assertStoredValue("progressDetails", snapshot.progressDetails);
    for (const [key, value] of Object.entries(snapshot.resumeTimes)) assertStoredValue(`dlTime_${key}`, value);
    for (const key of snapshot.resumeRemovedKeys) {
      if (storage.get(`dlTime_${key}`) != null) {
        throw new Error(`Viewing Activity resume removal verification failed for ${key}.`);
      }
    }
  } catch (error) {
    restoreStorageValue("history", previous.history);
    restoreStorageValue("progress", previous.progress);
    restoreStorageValue("progressDetails", previous.progressDetails);
    for (const [key, value] of Object.entries(previous.resume)) restoreStorageValue(`dlTime_${key}`, value);
    throw error;
  }

  window.dispatchEvent(new CustomEvent(VIEWING_ACTIVITY_SYNC_APPLIED_EVENT, {
    detail: {
      history: snapshot.history,
      progress: snapshot.progress,
    },
  }));
  return snapshot;
}
