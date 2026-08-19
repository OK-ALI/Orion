const { ipcMain } = require("electron");
const {
  MAX_PROFILE_BYTES,
  createPortableProfileReader,
  createPortableProfileWriter,
  parsePortableProfileJsonV3,
} = require("./portableProfileStore");

function fail(error, fallback) {
  return {
    ok: false,
    code: typeof error?.code === "string" ? error.code : "GOOGLE_DRIVE_PROFILE_IO_FAILED",
    error: fallback,
  };
}

function register({ driveRequest, getGoogleProfile } = {}) {
  const readPortableProfile = createPortableProfileReader({ driveRequest });
  const writePortableProfile = createPortableProfileWriter({ driveRequest });

  ipcMain.handle("portable-profile:read", async (_, profileKey) => {
    try {
      const result = await readPortableProfile(profileKey);
      return { ok: true, ...result };
    } catch (error) {
      return fail(error, "Orion could not read the cross-device profile. No cloud data was changed.");
    }
  });

  ipcMain.handle("portable-profile:write", async (_, request) => {
    try {
      const profileJson = String(request?.profileJson || "");
      if (Buffer.byteLength(profileJson, "utf8") > MAX_PROFILE_BYTES) {
        const error = new Error("Portable profile exceeds the supported size.");
        error.code = "GOOGLE_DRIVE_PROFILE_TOO_LARGE";
        throw error;
      }
      const { parsed: profile } = parsePortableProfileJsonV3(profileJson);
      const googleProfile = typeof getGoogleProfile === "function" ? getGoogleProfile() : null;
      const subject = typeof googleProfile?.sub === "string" ? googleProfile.sub.trim() : "";
      const profileId = typeof profile?.profileId === "string" ? profile.profileId.trim() : "";
      if (!subject || !profileId || subject !== profileId) {
        const error = new Error("Portable profile identity does not match the signed-in Google account.");
        error.code = "GOOGLE_DRIVE_PROFILE_IDENTITY_MISMATCH";
        throw error;
      }
      const result = await writePortableProfile(
        request?.profileKey,
        profileJson,
        request?.expectedRevisionTag ?? null,
      );
      return { ok: true, ...result };
    } catch (error) {
      return fail(error, "Orion refused to write the cross-device profile because it could not prove a safe conditional update.");
    }
  });
}

module.exports = { register };
