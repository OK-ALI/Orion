module.exports = ({ ipcRenderer }) => ({
  readPortableProfile: (profileKey) => ipcRenderer.invoke("portable-profile:read", profileKey),
  writePortableProfile: (profileKey, profileJson, expectedRevisionTag) => ipcRenderer.invoke("portable-profile:write", {
    profileKey,
    profileJson,
    expectedRevisionTag,
  }),
});
