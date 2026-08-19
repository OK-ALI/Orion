import { normalizePortableProfileV3 } from "@orion/shared/types";

function errorWithCode(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export class DesktopPortableProfileCloudStore {
  constructor(profileId) {
    const normalized = String(profileId || "").trim();
    if (!normalized) throw new Error("Portable profile id is required.");
    this.profileId = normalized;
  }

  async read(profileKey) {
    if (!window.electron?.readPortableProfile) {
      throw errorWithCode("Portable profile storage is unavailable.", "GOOGLE_DRIVE_PROFILE_STORE_UNAVAILABLE");
    }
    const result = await window.electron.readPortableProfile(profileKey);
    if (!result?.ok) throw errorWithCode(result?.error || "Portable profile read failed.", result?.code || "GOOGLE_DRIVE_PROFILE_IO_FAILED");
    if (result.state === "missing") return { state: "missing", revisionTag: null };
    let parsed;
    try {
      parsed = JSON.parse(result.profileJson);
    } catch {
      throw errorWithCode("The Orion cloud profile contains invalid JSON.", "GOOGLE_DRIVE_PROFILE_INVALID");
    }
    const profile = normalizePortableProfileV3(parsed);
    if (!profile) throw errorWithCode("The Orion cloud profile failed PortableProfileV3 validation.", "GOOGLE_DRIVE_PROFILE_INVALID");
    if (profile.profileId !== this.profileId) {
      throw errorWithCode("The Orion cloud profile belongs to a different Google identity.", "GOOGLE_DRIVE_PROFILE_IDENTITY_MISMATCH");
    }
    return {
      state: "found",
      profile,
      revisionTag: result.revisionTag,
      remoteModifiedAt: Number.isFinite(result.remoteModifiedAt) ? result.remoteModifiedAt : null,
    };
  }

  async write(profileKey, request) {
    if (!window.electron?.writePortableProfile) {
      throw errorWithCode("Portable profile writes are unavailable.", "GOOGLE_DRIVE_PROFILE_STORE_UNAVAILABLE");
    }
    const profile = normalizePortableProfileV3(request?.profile);
    if (!profile || profile.profileId !== this.profileId) {
      throw errorWithCode("Refusing to write an invalid or mismatched PortableProfileV3 document.", "GOOGLE_DRIVE_PROFILE_INVALID");
    }
    const result = await window.electron.writePortableProfile(
      profileKey,
      JSON.stringify(profile),
      request.expectedRevisionTag ?? null,
    );
    if (!result?.ok) throw errorWithCode(result?.error || "Portable profile write failed.", result?.code || "GOOGLE_DRIVE_PROFILE_IO_FAILED");
    if (result.state === "conflict") return { state: "conflict", revisionTag: result.revisionTag ?? null };
    return {
      state: "written",
      revisionTag: result.revisionTag,
      remoteModifiedAt: Number.isFinite(result.remoteModifiedAt) ? result.remoteModifiedAt : null,
    };
  }
}
