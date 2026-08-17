import type { PortableMyListPreviewV1 } from '@orion/shared/types';

export interface LocalMyListSnapshotV1 {
  saved: Record<string, any>;
  savedOrder: string[];
}

function portableFields(item: PortableMyListPreviewV1['records'][string]) {
  return {
    id: item.mediaId,
    media_type: item.mediaType,
    title: item.title,
    ...(item.mediaType === 'tv' ? { name: item.title } : {}),
    poster_path: item.posterPath,
    backdrop_path: item.backdropPath,
    year: item.year ?? '',
  };
}

/**
 * Rehydrates only the constrained fields carried by PortableMyListItemV1.
 * Existing local-only metadata is preserved for items that remain present;
 * portable fields are overwritten so the resulting local preview exactly
 * matches the verified cloud semantics. New cross-device items get a minimal
 * local record without invented overview/rating/date data.
 */
export function buildLocalMyListSnapshotV1(
  preview: PortableMyListPreviewV1,
  existingSaved: Record<string, any> = {},
): LocalMyListSnapshotV1 {
  if (preview.rejectedKeys.length > 0) {
    throw new Error('Cannot restore a rejected portable My List preview.');
  }

  const saved: Record<string, any> = {};
  for (const key of preview.orderedKeys) {
    const item = preview.records[key];
    if (!item) throw new Error('Portable My List restore preview is inconsistent.');
    const existing = existingSaved[key];
    saved[key] = existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...existing, ...portableFields(item) }
      : {
          ...portableFields(item),
          release_date: '',
          first_air_date: '',
          vote_average: null,
        };
  }
  return { saved, savedOrder: [...preview.orderedKeys] };
}
