import {
  buildPortableMyListPreviewV1,
} from "@orion/shared/types";
import { storage } from "./settingsStore";

export const MY_LIST_SYNC_APPLIED_EVENT = "orion:my-list-sync-applied";

function normalizedOrder(saved, savedOrder) {
  return Array.isArray(savedOrder) ? savedOrder : Object.keys(saved || {});
}

export function readDesktopPortableMyListPreviewV1() {
  const saved = storage.get("saved") || {};
  const savedOrder = normalizedOrder(saved, storage.get("savedOrder"));
  return buildPortableMyListPreviewV1(saved, savedOrder);
}

function portableFields(item) {
  return {
    id: item.mediaId,
    media_type: item.mediaType,
    title: item.title,
    ...(item.mediaType === "tv" ? { name: item.title } : {}),
    poster_path: item.posterPath,
    backdrop_path: item.backdropPath,
    year: item.year ?? "",
  };
}

export function buildDesktopMyListSnapshotV1(preview, existingSaved = {}) {
  if (preview.rejectedKeys.length > 0) {
    throw new Error("Cannot restore a rejected portable My List preview.");
  }

  const saved = {};
  for (const key of preview.orderedKeys) {
    const item = preview.records[key];
    if (!item) throw new Error("Portable My List restore preview is inconsistent.");
    const existing = existingSaved[key];
    saved[key] = existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing, ...portableFields(item) }
      : {
          ...portableFields(item),
          release_date: "",
          first_air_date: "",
          vote_average: null,
        };
  }
  return { saved, savedOrder: [...preview.orderedKeys] };
}

export function applyDesktopPortableMyListPreviewV1(preview) {
  const existingSaved = storage.get("saved") || {};
  const snapshot = buildDesktopMyListSnapshotV1(preview, existingSaved);
  storage.set("saved", snapshot.saved);
  storage.set("savedOrder", snapshot.savedOrder);
  window.dispatchEvent(new CustomEvent(MY_LIST_SYNC_APPLIED_EVENT, { detail: snapshot }));
  return snapshot;
}
