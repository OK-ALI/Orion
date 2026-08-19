function normalizedRecord(preview, key, label) {
  const record = preview?.records?.[key];
  if (!record) throw new Error(`${label} My List preview is inconsistent.`);
  return record;
}

function mergeSharedRecord(local, cloud, order) {
  if (
    local.mediaType !== cloud.mediaType
    || local.mediaId !== cloud.mediaId
    || local.schemaVersion !== cloud.schemaVersion
  ) {
    throw new Error("Shared My List identity is inconsistent.");
  }

  return {
    ...local,
    posterPath: local.posterPath ?? cloud.posterPath ?? null,
    backdropPath: local.backdropPath ?? cloud.backdropPath ?? null,
    year: local.year ?? cloud.year ?? null,
    order,
  };
}

export function combinePortableMyListPreviewsV1(desktopPreview, cloudPreview) {
  if (desktopPreview?.rejectedKeys?.length || cloudPreview?.rejectedKeys?.length) {
    throw new Error("Cannot combine rejected My List previews.");
  }

  const records = {};
  const orderedKeys = [];
  let sharedCount = 0;

  for (const key of desktopPreview?.orderedKeys || []) {
    const desktop = normalizedRecord(desktopPreview, key, "Desktop");
    const cloud = cloudPreview?.records?.[key];
    const order = orderedKeys.length;
    records[key] = cloud
      ? mergeSharedRecord(desktop, cloud, order)
      : { ...desktop, order };
    if (cloud) sharedCount += 1;
    orderedKeys.push(key);
  }

  for (const key of cloudPreview?.orderedKeys || []) {
    if (Object.prototype.hasOwnProperty.call(records, key)) continue;
    const cloud = normalizedRecord(cloudPreview, key, "Orion Cloud");
    records[key] = { ...cloud, order: orderedKeys.length };
    orderedKeys.push(key);
  }

  const desktopCount = desktopPreview?.orderedKeys?.length || 0;
  const cloudCount = cloudPreview?.orderedKeys?.length || 0;

  return {
    preview: {
      records,
      orderedKeys,
      rejectedKeys: [],
    },
    summary: {
      desktopCount,
      cloudCount,
      sharedCount,
      desktopOnlyCount: desktopCount - sharedCount,
      cloudOnlyCount: cloudCount - sharedCount,
      combinedCount: orderedKeys.length,
    },
  };
}
