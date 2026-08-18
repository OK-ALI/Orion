const { ipcMain } = require("electron");
const { createPortableProfileReader } = require("./portableProfileStore");

function register({ driveRequest } = {}) {
  const readPortableProfile = createPortableProfileReader({ driveRequest });

  ipcMain.handle("portable-profile:read", async (_, profileKey) => {
    try {
      const result = await readPortableProfile(profileKey);
      return { ok: true, ...result };
    } catch (error) {
      return {
        ok: false,
        code: typeof error?.code === "string" ? error.code : "GOOGLE_DRIVE_PROFILE_IO_FAILED",
        error: "Orion could not read the cross-device profile. No cloud data was changed.",
      };
    }
  });
}

module.exports = { register };
