module.exports = ({ ipcRenderer }) => ({
  getSmartConnectInfo: () => ipcRenderer.invoke("smart-connect:get-info"),
  setSmartConnectPin: (pin) => ipcRenderer.invoke("smart-connect:set-pin", pin),
  updateSmartConnectPlayback: (data) => ipcRenderer.invoke("smart-connect:update-playback", data),
  updateSmartConnectTelemetry: (data) => ipcRenderer.invoke("smart-connect:update-telemetry", data),
  disconnectSmartConnect: () => ipcRenderer.invoke("smart-connect:disconnect"),
  revokeSmartConnectDevice: (deviceId) => ipcRenderer.invoke("smart-connect:revoke-device", deviceId),
  renameSmartConnectDevice: (deviceId, deviceName) => ipcRenderer.invoke("smart-connect:rename-device", deviceId, deviceName),
  confirmSmartConnectPairing: () => ipcRenderer.invoke("smart-connect:confirm-pairing"),
  rejectSmartConnectPairing: () => ipcRenderer.invoke("smart-connect:reject-pairing"),
  allowSmartConnectPublicNetwork: () => ipcRenderer.invoke("smart-connect:allow-public-network"),
  acknowledgeSmartConnectCommand: (ack) => ipcRenderer.invoke("smart-connect:ack-command", ack),
  onSmartConnectStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("orion:smart-connect-status", handler);
    return () => ipcRenderer.removeListener("orion:smart-connect-status", handler);
  },
  onRemoteCommand: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("orion:remote-command", handler);
    return () => ipcRenderer.removeListener("orion:remote-command", handler);
  },
});
