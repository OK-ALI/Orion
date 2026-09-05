const HARDWARE_FEATURE_VALUES = new Set([
  "enabled",
  "enabled_on",
  "enabled_force",
  "enabled_force_on",
]);

const LIMITED_FEATURE_VALUES = new Set(["enabled_readback"]);
const SOFTWARE_OR_OFF_FEATURE_VALUES = new Set([
  "disabled_software",
  "disabled_off",
  "disabled_off_ok",
  "unavailable_software",
  "unavailable_off",
  "unavailable_off_ok",
]);

const UNKNOWN_GRAPHICS = Object.freeze({
  hardwareAccelerationEnabled: null,
  graphicsCapability: "unknown",
  gpuAdapterCount: 0,
  activeGpuVendorId: null,
  activeGpuDeviceId: null,
  switchableGraphics: false,
  gpuCompositing: "unknown",
  rasterization: "unknown",
  webgl: "unknown",
  webgl2: "unknown",
  videoDecode: "unknown",
});

function normalizeFeatureStatus(value) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "unknown";
}

function isHardwareFeature(value) {
  return HARDWARE_FEATURE_VALUES.has(normalizeFeatureStatus(value));
}

function isLimitedFeature(value) {
  const normalized = normalizeFeatureStatus(value);
  return LIMITED_FEATURE_VALUES.has(normalized) || SOFTWARE_OR_OFF_FEATURE_VALUES.has(normalized);
}

function normalizeGpuDeviceId(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function summarizeGpuDevices(gpuInfo = null) {
  const devices = Array.isArray(gpuInfo?.gpuDevice) ? gpuInfo.gpuDevice : [];
  const active = devices.find((device) => device?.active) || devices[0] || null;
  const aux = gpuInfo?.auxAttributes || {};
  return {
    gpuAdapterCount: devices.length,
    activeGpuVendorId: normalizeGpuDeviceId(active?.vendorId),
    activeGpuDeviceId: normalizeGpuDeviceId(active?.deviceId),
    switchableGraphics: Boolean(aux.amdSwitchable || aux.optimus),
  };
}

function classifyGraphicsCapability({
  hardwareAccelerationEnabled = null,
  featureStatus = {},
  gpuInfo = null,
} = {}) {
  if (hardwareAccelerationEnabled === false || gpuInfo?.auxAttributes?.softwareRendering === true) {
    return "software";
  }

  const gpuCompositing = normalizeFeatureStatus(featureStatus.gpu_compositing);
  const rasterization = normalizeFeatureStatus(featureStatus.rasterization);
  const webgl = normalizeFeatureStatus(featureStatus.webgl);
  const webgl2 = normalizeFeatureStatus(featureStatus.webgl2);
  const observed = [gpuCompositing, rasterization, webgl, webgl2].filter((value) => value !== "unknown");

  if (!observed.length) return "unknown";
  if (observed.some(isLimitedFeature)) return "limited";

  const compositingHardware = isHardwareFeature(gpuCompositing);
  const rasterHardware = isHardwareFeature(rasterization);
  const webglHardware = isHardwareFeature(webgl) || isHardwareFeature(webgl2);

  if (compositingHardware && rasterHardware && webglHardware) return "hardware";
  return "limited";
}

function summarizeGraphicsCapability({
  hardwareAccelerationEnabled = null,
  featureStatus = {},
  gpuInfo = null,
} = {}) {
  return {
    hardwareAccelerationEnabled:
      typeof hardwareAccelerationEnabled === "boolean" ? hardwareAccelerationEnabled : null,
    graphicsCapability: classifyGraphicsCapability({
      hardwareAccelerationEnabled,
      featureStatus,
      gpuInfo,
    }),
    ...summarizeGpuDevices(gpuInfo),
    gpuCompositing: normalizeFeatureStatus(featureStatus.gpu_compositing),
    rasterization: normalizeFeatureStatus(featureStatus.rasterization),
    webgl: normalizeFeatureStatus(featureStatus.webgl),
    webgl2: normalizeFeatureStatus(featureStatus.webgl2),
    videoDecode: normalizeFeatureStatus(featureStatus.video_decode),
  };
}

function createHardwareCapabilityProbe({ app, onUpdate } = {}) {
  let snapshot = { ...UNKNOWN_GRAPHICS };
  let destroyed = false;
  let refreshGeneration = 0;
  let started = false;

  const notify = () => {
    try {
      onUpdate?.({ ...snapshot });
    } catch {}
  };

  const refresh = async () => {
    if (destroyed || !app) return snapshot;
    const generation = ++refreshGeneration;
    let hardwareAccelerationEnabled = null;
    let featureStatus = {};
    let gpuInfo = null;

    try {
      hardwareAccelerationEnabled = app.isHardwareAccelerationEnabled();
    } catch {}
    try {
      featureStatus = app.getGPUFeatureStatus() || {};
    } catch {}
    try {
      gpuInfo = await app.getGPUInfo("basic");
    } catch {}

    if (destroyed || generation !== refreshGeneration) return snapshot;
    snapshot = summarizeGraphicsCapability({
      hardwareAccelerationEnabled,
      featureStatus,
      gpuInfo,
    });
    notify();
    return snapshot;
  };

  const gpuInfoHandler = () => {
    void refresh();
  };

  const start = () => {
    if (started || destroyed || !app) return;
    started = true;
    app.on?.("gpu-info-update", gpuInfoHandler);
  };

  const destroy = () => {
    destroyed = true;
    refreshGeneration += 1;
    if (started) app?.removeListener?.("gpu-info-update", gpuInfoHandler);
    started = false;
  };

  return {
    start,
    refresh,
    destroy,
    getSnapshot: () => ({ ...snapshot }),
  };
}

module.exports = {
  HARDWARE_FEATURE_VALUES,
  LIMITED_FEATURE_VALUES,
  SOFTWARE_OR_OFF_FEATURE_VALUES,
  classifyGraphicsCapability,
  summarizeGraphicsCapability,
  createHardwareCapabilityProbe,
};
