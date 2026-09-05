const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const {
  classifyGraphicsCapability,
  summarizeGraphicsCapability,
  createHardwareCapabilityProbe,
} = require("../../../src/main/performance/hardwareCapability");

const HARDWARE_FEATURES = {
  gpu_compositing: "enabled",
  rasterization: "enabled_on",
  webgl: "enabled",
  webgl2: "enabled",
  video_decode: "enabled",
};

test("classifies Chromium graphics from feature status instead of adapter brand", () => {
  assert.equal(classifyGraphicsCapability({
    hardwareAccelerationEnabled: true,
    featureStatus: HARDWARE_FEATURES,
    gpuInfo: { auxAttributes: { softwareRendering: false } },
  }), "hardware");

  assert.equal(classifyGraphicsCapability({
    hardwareAccelerationEnabled: true,
    featureStatus: { ...HARDWARE_FEATURES, gpu_compositing: "enabled_readback" },
  }), "limited");

  assert.equal(classifyGraphicsCapability({
    hardwareAccelerationEnabled: true,
    featureStatus: { ...HARDWARE_FEATURES, webgl: "unavailable_software", webgl2: "disabled_software" },
  }), "limited");

  assert.equal(classifyGraphicsCapability({
    hardwareAccelerationEnabled: false,
    featureStatus: HARDWARE_FEATURES,
  }), "software");

  assert.equal(classifyGraphicsCapability({
    hardwareAccelerationEnabled: true,
    gpuInfo: { auxAttributes: { softwareRendering: true } },
  }), "software");

  assert.equal(classifyGraphicsCapability({ hardwareAccelerationEnabled: true }), "unknown");
});

test("captures adapter identity only as diagnostics and does not infer performance from vendor", () => {
  const summary = summarizeGraphicsCapability({
    hardwareAccelerationEnabled: true,
    featureStatus: HARDWARE_FEATURES,
    gpuInfo: {
      auxAttributes: { optimus: true, softwareRendering: false },
      gpuDevice: [
        { active: false, vendorId: 32902, deviceId: 1234 },
        { active: true, vendorId: 4318, deviceId: 5678 },
      ],
    },
  });

  assert.equal(summary.graphicsCapability, "hardware");
  assert.equal(summary.gpuAdapterCount, 2);
  assert.equal(summary.activeGpuVendorId, 4318);
  assert.equal(summary.activeGpuDeviceId, 5678);
  assert.equal(summary.switchableGraphics, true);
  assert.equal(summary.gpuCompositing, "enabled");
  assert.equal(summary.webgl2, "enabled");
});


test("GPU probe follows Electron gpu-info-update and keeps collection asynchronous", async () => {
  const fakeApp = new EventEmitter();
  fakeApp.isHardwareAccelerationEnabled = () => true;
  fakeApp.getGPUFeatureStatus = () => HARDWARE_FEATURES;
  fakeApp.getGPUInfo = async () => ({
    auxAttributes: { softwareRendering: false },
    gpuDevice: [{ active: true, vendorId: 123, deviceId: 456 }],
  });

  let update = null;
  const probe = createHardwareCapabilityProbe({ app: fakeApp, onUpdate: (value) => { update = value; } });
  probe.start();
  fakeApp.emit("gpu-info-update");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(update.graphicsCapability, "hardware");
  assert.equal(probe.getSnapshot().activeGpuDeviceId, 456);
  probe.destroy();
  assert.equal(fakeApp.listenerCount("gpu-info-update"), 0);
});
