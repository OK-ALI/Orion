import {
  PORTABLE_PROFILE_PRIMARY_KEY,
  normalizePortableProfileV3,
} from "@orion/shared/types";

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function failure(state, message, extra = {}) {
  return { state, message, ...extra };
}

export function evaluatePortableProfileProbe(googleProfile, readResult) {
  const desktopAccountId = text(googleProfile?.sub);
  if (!desktopAccountId) {
    return failure(
      "identity-unavailable",
      "Desktop Google identity does not expose a stable account ID. Cross-device sync remains blocked.",
    );
  }

  if (!readResult?.ok) {
    return failure(
      "error",
      readResult?.error || "Orion could not read the cross-device profile. No cloud data was changed.",
      { code: text(readResult?.code) },
    );
  }

  if (readResult.state === "missing") {
    return failure(
      "missing",
      "No PortableProfileV3 profile is visible to this Desktop Google connection. Orion created or changed nothing.",
      { desktopAccountId },
    );
  }

  if (readResult.state !== "found" || typeof readResult.profileJson !== "string") {
    return failure("invalid", "Google Drive returned an unreadable cross-device profile. Sync remains blocked.");
  }

  let parsed;
  try {
    parsed = JSON.parse(readResult.profileJson);
  } catch {
    return failure("invalid", "The cross-device profile contains invalid JSON. Sync remains blocked.");
  }

  const profile = normalizePortableProfileV3(parsed);
  if (!profile) {
    return failure("invalid", "The cloud document failed PortableProfileV3 validation. Sync remains blocked.");
  }

  if (profile.profileId !== desktopAccountId) {
    return failure(
      "identity-mismatch",
      "PortableProfileV3 was found, but its Orion profile ID does not match this Desktop Google account. Sync remains blocked.",
      {
        desktopAccountId,
        cloudProfileId: profile.profileId,
        revisionTag: text(readResult.revisionTag),
      },
    );
  }

  return {
    state: "matched",
    message: "PortableProfileV3 is visible and its Orion profile identity matches this Desktop Google account.",
    desktopAccountId,
    cloudProfileId: profile.profileId,
    profileRevision: profile.revision,
    namespaceNames: Object.keys(profile.namespaces).sort(),
    revisionTag: text(readResult.revisionTag),
    remoteModifiedAt: Number.isFinite(Number(readResult.remoteModifiedAt))
      ? Number(readResult.remoteModifiedAt)
      : null,
  };
}

export async function probePortableProfile(googleProfile, readPortableProfile) {
  const reader = readPortableProfile || window.electron?.readPortableProfile;
  if (typeof reader !== "function") {
    return failure("unavailable", "This Orion build does not expose the read-only PortableProfileV3 bridge.");
  }
  try {
    const readResult = await reader(PORTABLE_PROFILE_PRIMARY_KEY);
    return evaluatePortableProfileProbe(googleProfile, readResult);
  } catch {
    return failure("error", "Orion could not read the cross-device profile. No cloud data was changed.");
  }
}
