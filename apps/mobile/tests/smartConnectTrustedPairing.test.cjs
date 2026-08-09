"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const mobileRoot = path.join(repoRoot, "apps", "mobile");
const readMobile = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");
const readRepo = (relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8");

test("trusted discovery is saved-first, NSD-second, and subnet scanning is explicit", () => {
  const discovery = readMobile("src/services/smartConnectDiscovery.ts");
  const controller = readMobile("src/features/connect/useConnectController.ts");
  const discoverBody = discovery.slice(
    discovery.indexOf("export async function discoverSmartConnectDesktops"),
    discovery.indexOf("export async function scanSmartConnectSubnet"),
  );
  assert.ok(discoverBody.indexOf("'saved'") < discoverBody.indexOf("discoverNativeSmartConnectServices"));
  assert.doesNotMatch(discoverBody, /scanSmartConnectSubnet/);
  assert.match(controller, /runSubnetFallback/);
  assert.match(controller, /scanSmartConnectSubnet/);
});

test("Android NSD is generated from a tracked Expo config plugin", () => {
  const appConfig = JSON.parse(readMobile("app.json"));
  const plugin = readMobile("plugins/withOrionNsd.js");
  const nativeModule = readMobile("plugins/orion-nsd-native/OrionNsdModule.kt");
  assert.ok(appConfig.expo.plugins.includes("./plugins/withOrionNsd"));
  assert.match(plugin, /CHANGE_WIFI_MULTICAST_STATE/);
  assert.match(plugin, /add\(OrionNsdPackage\(\)\)/);
  assert.match(nativeModule, /NsdManager/);
  assert.match(nativeModule, /_orion-connect\._tcp\./);
  assert.match(nativeModule, /postDelayed\(\{ finish\(null\) \}/);
});

test("reconnection waits for authenticated Desktop status and suspends while backgrounded", () => {
  const controller = readMobile("src/features/connect/useConnectController.ts");
  for (const state of [
    "idle", "discovering", "pairing", "connected", "reconnecting", "endpoint-lost",
    "token-rejected", "code-expired", "locked-out", "protocol-mismatch", "failed",
  ]) assert.match(controller, new RegExp(`['\"]${state}['\"]`));
  assert.match(controller, /envelope\.type === 'status'/);
  assert.match(controller, /envelope\.payload\?\.connected/);
  assert.match(controller, /stopNativeSmartConnectDiscovery\(\)/);
  assert.match(controller, /Math\.min\(15_000/);
  assert.match(controller, /AppState\.addEventListener\('change'/);
});

test("pairing sheet uses a real focusable PIN input and keyboard-safe responsive layout", () => {
  const modal = readMobile("src/features/connect/SmartConnectPairingModal.tsx");
  assert.match(modal, /<TextInput/);
  assert.match(modal, /ref=\{hiddenPinInputRef\}/);
  assert.match(modal, /InteractionManager\.runAfterInteractions/);
  assert.match(modal, /KeyboardAvoidingView/);
  assert.match(modal, /Enter code/);
  assert.match(modal, /discoveredDesktops\.map/);
  assert.match(modal, /Find Desktop again/);
  const directIp = modal.slice(modal.indexOf("pairingMethod === 'ip'"), modal.indexOf("pairError &&"));
  assert.match(directIp, /Find Desktop by Address/);
  assert.match(directIp, /prepareDirectIp/);
  assert.doesNotMatch(directIp, /pairPin|pairWithDesktop/);
});

test("Direct IP discovers an endpoint before the single PIN flow", () => {
  const controller = readMobile("src/features/connect/useConnectController.ts");
  const directIp = controller.slice(
    controller.indexOf("const prepareDirectIp"),
    controller.indexOf("const handlePinChange"),
  );
  assert.match(directIp, /inspectSmartConnectEndpoint/);
  assert.match(directIp, /setPairingMethod\('pin'\)/);
  assert.match(directIp, /setPinCode\(''\)/);
  assert.doesNotMatch(directIp, /pairWithDesktop\(/);
});

test("pairing failures expose and persist remaining attempts and lockout", () => {
  const desktop = readRepo("apps/desktop/src/main/ipc/smartConnectIpc.js");
  const controller = readMobile("src/features/connect/useConnectController.ts");
  const guardStore = readMobile("src/features/connect/pairingGuardStore.ts");
  const guardState = readMobile("src/features/connect/usePairingGuardState.ts");
  const modal = readMobile("src/features/connect/SmartConnectPairingModal.tsx");
  assert.match(desktop, /smart-connect-pairing-guard\.json/);
  assert.match(desktop, /attemptsRemaining/);
  assert.match(desktop, /savePairingGuard\(\)/);
  assert.match(guardStore, /orion_smart_connect_pairing_guard_v1/);
  assert.match(guardState, /readPairingGuard/);
  assert.match(controller, /setAttemptsRemaining/);
  assert.match(modal, /pairing attempt/);
  assert.match(modal, /Pairing unlocks automatically in/);
});

test("Desktop advertises only non-sensitive identity and keeps device management on authenticated protocol v3", () => {
  const desktop = readRepo("apps/desktop/src/main/ipc/smartConnectIpc.js");
  const advertisement = desktop.slice(
    desktop.indexOf("advertisedService = bonjour.publish"),
    desktop.indexOf("function stopServiceAdvertisement"),
  );
  assert.match(advertisement, /type: "orion-connect"/);
  assert.match(advertisement, /version: String\(PROTOCOL_VERSION\)/);
  assert.match(advertisement, /instanceId: ensureDesktopInstanceId\(\)/);
  assert.doesNotMatch(advertisement, /\b(?:pin|token|playback|user)\s*:/i);
  assert.match(desktop, /"LOCKED_OUT"/);
  assert.match(desktop, /"CODE_EXPIRED"/);
  assert.match(desktop, /\["\/api\/pair", "\/api\/device", "\/api\/command", "\/api\/unpair"\]\.includes/);
  assert.match(desktop, /envelope\.payload\?\.action === "smart_connect_rename"/);
  assert.match(desktop, /envelope\.payload\?\.action === "smart_connect_unpair"/);
  assert.match(desktop, /secureSession\(deviceId\)/);
});

test("Smart Connect diagnostics stay redacted", () => {
  const diagnostics = readMobile("src/services/mobileDiagnostics.ts");
  assert.match(diagnostics, /smartConnectDiscoveryMethod/);
  assert.match(diagnostics, /smartConnectReconnectAttempt/);
  assert.match(diagnostics, /smartConnectPairingFailure/);
  assert.match(diagnostics, /smartConnectLastDeviceAck/);
  assert.doesNotMatch(diagnostics, /pairToken|pinCode|socketUrl|qrPayload/);
});

test("protocol v3 uses pinned native TLS, Keystore identity, and no bearer URL", () => {
  const nativeModule = readMobile("plugins/orion-nsd-native/OrionSecureConnectModule.kt");
  const secureClient = readMobile("src/features/connect/secureConnectClient.ts");
  const transport = readMobile("src/features/connect/sessionTransport.ts");
  const controller = readMobile("src/features/connect/useConnectController.ts");
  assert.match(nativeModule, /AndroidKeyStore/);
  assert.match(nativeModule, /SHA256withECDSA/);
  assert.match(nativeModule, /certificateFingerprint/);
  assert.match(nativeModule, /X-Orion-Ticket/);
  assert.match(nativeModule, /wss:\/\//);
  assert.doesNotMatch(nativeModule, /[?&]token=/i);
  assert.match(secureClient, /certificateFingerprint/);
  assert.match(secureClient, /pairingId/);
  assert.match(controller, /SMART_CONNECT_PROTOCOL_VERSION/);
  assert.doesNotMatch(transport, /http:\/\/.+api\/command/);
});

test("Desktop enforces protocol-v3 origin, network, replay, and rate policies", () => {
  const desktop = readRepo("apps/desktop/src/main/ipc/smartConnectIpc.js");
  const trust = readRepo("apps/desktop/src/main/smartConnect/secureTrust.js");
  assert.match(desktop, /ALLOWED_REMOTE_ORIGIN/);
  assert.match(desktop, /COMMAND_RATE_LIMITED/);
  assert.match(desktop, /connectedSockets\.size >= policy\.maxConnections/);
  assert.match(desktop, /!policy\.allowed/);
  assert.match(trust, /deviceCommandIds/);
  assert.match(trust, /DUPLICATE_COMMAND/);
  assert.match(trust, /publicNetworkAllowedUntil/);
});
