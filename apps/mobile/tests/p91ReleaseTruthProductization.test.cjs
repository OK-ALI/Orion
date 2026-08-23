"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(mobileRoot, "../..");
const readRepo = (relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8");
const readMobile = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");

test("P9.1 shared release truth keeps Stable and Preview explicit and never invents a Mobile installer", () => {
  const shared = readRepo("packages/shared/src/types/orionReleaseTruth.ts");
  assert.match(shared, /export type OrionReleaseChannelV1 = 'stable' \| 'preview'/);
  assert.match(shared, /ORION_MIN_ANDROID_API_V1 = 24/);
  assert.match(shared, /channel === 'preview' \|\| !release\.prerelease/);
  assert.match(shared, /Preview widens eligibility; it never forces a downgrade/);
  assert.match(shared, /artifact\.kind === 'android-apk'/);
  assert.match(shared, /installerAvailable: !!apk/);
});

test("P9.1 Desktop reuses normalized release truth and keeps installation QR distinct from Connect pairing", () => {
  const updates = readRepo("apps/desktop/src/renderer/shared/utils/updates.js");
  const settings = readRepo("apps/desktop/src/renderer/features/settings/sections/GeneralSettings.jsx");
  const store = readRepo("apps/desktop/src/renderer/services/settingsStore.js");
  const sidebar = readRepo("apps/desktop/src/renderer/components/layout/Sidebar.jsx");
  const routes = readRepo("apps/desktop/src/renderer/app/AppRoutes.jsx");
  const mobilePage = readRepo("apps/desktop/src/renderer/features/updates/GetOrionMobilePage.jsx");
  assert.match(updates, /resolveOrionReleaseTruthV1/);
  assert.match(updates, /per_page=20/);
  assert.match(store, /UPDATE_CHANNEL: "updateChannel"/);
  assert.match(sidebar, /label: "Devices"/);
  assert.match(sidebar, /id: "get-mobile", label: "Get Orion Mobile"/);
  assert.match(routes, /GetOrionMobilePage = lazy\(\(\) => import\("\.\.\/features\/updates\/GetOrionMobilePage"\)\)/);
  assert.match(routes, /page === "get-mobile"/);
  assert.match(routes, /<GetOrionMobilePage \/>/);
  assert.doesNotMatch(settings, /Get Orion Mobile/);
  assert.match(mobilePage, /fetchOrionMobileDistributionStatus/);
  assert.match(updates, /export async function fetchOrionMobileDistributionStatus\(channel = "stable"\)/);
  assert.match(updates, /const releaseTruth = await fetchOrionReleaseTruth\(channel\)/);
  assert.match(mobilePage, /QRCode\.toDataURL\(apk\.url/);
  assert.match(mobilePage, /Installation, not pairing\./);
  assert.match(mobilePage, /Device pairing happens later inside Orion Connect\./);
  assert.match(mobilePage, /No Mobile build is published to/);
});

test("P9.1 Mobile activates Updates with local channel persistence and honest installer availability", () => {
  const architecture = readMobile("src/features/settings/settingsArchitecture.ts");
  const service = readMobile("src/services/mobileReleaseTruth.ts");
  const content = readMobile("src/features/settings/UpdatesSettingsContent.tsx");
  const settings = readMobile("app/(tabs)/settings.tsx");
  assert.match(architecture, /id: 'updates', label: 'Updates', status: 'active'/);
  assert.match(service, /mmkvStorageAdapter/);
  assert.match(service, /resolveOrionReleaseTruthV1/);
  assert.match(service, /Platform\.Version/);
  assert.match(content, /Update channel/);
  assert.match(content, /<MobileUpdateExecutionSection state=\{appUpdateState\} \/>/);
  assert.match(content, /Last checked/);
  assert.match(settings, /<UpdatesSettingsContent \/>/);
});
