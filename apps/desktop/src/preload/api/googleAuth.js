module.exports = ({ ipcRenderer }) => ({
  getClientConfig: () => ipcRenderer.invoke("google-auth:get-client-config"),
  setClientConfig: ({ clientId, clientSecret }) =>
    ipcRenderer.invoke("google-auth:set-client-config", { clientId, clientSecret }),
  getProfile: () => ipcRenderer.invoke("google-auth:get-profile"),
  login: () => ipcRenderer.invoke("google-auth:login"),
  logout: () => ipcRenderer.invoke("google-auth:logout"),
  cancelLogin: () => ipcRenderer.invoke("google-auth:cancel-login"),
  uploadSync: (data) => ipcRenderer.invoke("google-auth:upload-sync", data),
  downloadSync: () => ipcRenderer.invoke("google-auth:download-sync"),
  getStorageQuota: () => ipcRenderer.invoke("google-auth:get-storage-quota"),
  uploadMediaFile: (filePath, name, metadata) => ipcRenderer.invoke("google-auth:upload-media-file", { filePath, name, metadata }),
  deleteMediaFile: (fileId) => ipcRenderer.invoke("google-auth:delete-media-file", fileId),
});
