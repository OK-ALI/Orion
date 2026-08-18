module.exports = ({ ipcRenderer }) => ({
  readPortableProfile: (profileKey) => ipcRenderer.invoke("portable-profile:read", profileKey),
});
