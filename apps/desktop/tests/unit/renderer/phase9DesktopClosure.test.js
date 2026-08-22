import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const desktopRoot = path.resolve(__dirname, "../../..");
const read = (relative) => fs.readFileSync(path.join(desktopRoot, relative), "utf8");

describe("Phase 9 Desktop cross-platform closure", () => {
  it("connects Get Orion Mobile to live release truth and fails closed until APK metadata is verified", () => {
    const page = read("src/renderer/features/updates/GetOrionMobilePage.jsx");
    const updates = read("src/renderer/shared/utils/updates.js");

    expect(page).toMatch(/fetchOrionMobileDistributionStatus/);
    expect(page).toMatch(/distribution\?\.installerReady/);
    expect(page).toMatch(/if \(!installerAvailable \|\| !apk\?\.url\)/);
    expect(page).toMatch(/Installer verification unavailable/);
    expect(updates).toMatch(/findOrionReleaseIntegrityArtifactV1/);
    expect(updates).toMatch(/missing Orion signing-identity metadata/);
  });

  it("keeps rollout directives out of user-facing release notes on Desktop", () => {
    const updates = read("src/renderer/shared/utils/updates.js");

    expect(updates).toMatch(/orion-\(\?:mobile\|desktop\)-rollout/);
    expect(updates).toMatch(/changelog: formatOrionReleaseNotes\(data\.notes\)/);
  });

  it("keeps Desktop automatic installation behind trusted-source and integrity verification", () => {
    const ipc = read("src/main/player/ipc.js");

    expect(ipc).toMatch(/TRUSTED_PATH\s*=\s*"\/ok-ali\/orion\/releases\/download\/"/);
    expect(ipc).toMatch(/verifyDownloadedUpdate\(/);
    expect(ipc).toMatch(/expectedSignerSha256/);
  });

  it("provides product-facing retry UX without exposing raw updater failures", () => {
    const modal = read("src/renderer/components/UpdateModal.jsx");
    const settings = read("src/renderer/features/settings/sections/GeneralSettings.jsx");

    expect(modal).toMatch(/friendlyUpdateError/);
    expect(modal).toMatch(/phase === "error" \? "Try Again" : "Install Update"/);
    expect(settings).toMatch(/Orion could not check for updates\. Check your connection and try again\./);
    expect(settings).toMatch(/result\?\.error \? "Try again" : "Check for updates"/);
  });
});
