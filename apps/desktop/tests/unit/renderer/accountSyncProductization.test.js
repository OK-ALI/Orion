import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const rendererRoot = path.resolve(here, "../../../src/renderer");
const read = (relative) => fs.readFileSync(path.join(rendererRoot, relative), "utf8");

const general = read("features/settings/sections/GeneralSettings.jsx");
const content = read("features/settings/SettingsContent.jsx");
const constants = read("features/settings/settingsConstants.js");
const controls = read("features/settings/components/SettingsControls.jsx");
const row = read("features/settings/components/AccountSyncDomainRow.jsx");
const myList = read("features/settings/components/MyListSyncCard.jsx");
const watched = read("features/settings/components/WatchedSyncCard.jsx");
const viewing = read("features/settings/components/ViewingActivitySyncCard.jsx");

const domainSources = [myList, watched, viewing];

describe("Orion Account and sync productization", () => {
  it("uses the compact Account and Orion Cloud hierarchy without changing Google identity actions", () => {
    expect(general).toMatch(/settings-section-title">Account</);
    expect(general).toMatch(/Your Orion identity and account connection/);
    expect(general).toMatch(/Google connected/);
    expect(general).toMatch(/>Orion Cloud</);
    expect(general).toMatch(/Keep your Orion library in sync across devices/);
    expect(general).toMatch(/>\s*Connected\s*</);
    expect(general).toMatch(/Disconnect Google/);
    expect(general).toMatch(/Continue with Google/);
    expect(general).toMatch(/<MyListSyncCard/);
    expect(general).toMatch(/<WatchedSyncCard/);
    expect(general).toMatch(/<ViewingActivitySyncCard/);
    expect(general).not.toMatch(/settings-section-title">Google Authentication/);
    expect(general).not.toMatch(/PortableProfileProbeCard/);
  });

  it("presents all Orion Cloud domains through one normalized row contract", () => {
    expect(row).toMatch(/AccountSyncDomainRow/);
    for (const status of ["Set up", "Synced", "Syncing", "Paused", "Offline", "Needs review"]) {
      expect(row + domainSources.join("\n")).toContain(status);
    }
    for (const source of domainSources) {
      expect(source).toMatch(/<AccountSyncDomainRow/);
      expect(source).toMatch(/Sync now/);
      expect(source).not.toMatch(/"Check now"/);
      expect(source).not.toMatch(/"Manual"/);
      expect(source).not.toMatch(/"Automatic"/);
    }
    expect(myList).toMatch(/summary=\{`\$\{localCount\} title/);
    expect(watched).toMatch(/watched .*movies & episodes/);
    expect(viewing).toMatch(/history .*playback .*positions/);
    expect(viewing).not.toMatch(/v1 checkpoint|playback Progress portable|portable History and Progress/);
  });

  it("preserves the distinct My List conflict choices", () => {
    expect(myList).toMatch(/Combine both/);
    expect(myList).toMatch(/Keep Desktop My List/);
    expect(myList).toMatch(/Keep Orion Cloud My List/);
    expect(myList).toMatch(/steadyReviewAvailable/);
    expect(myList).toMatch(/Both copies changed\. Choose which My List Orion should keep/);
  });

  it("keeps Desktop backup and media separate from Orion Cloud while using normal Orion toggles", () => {
    expect(general).toMatch(/Desktop backup & media/);
    expect(general).toMatch(/Separate from Orion Cloud/);
    expect(general).toMatch(/Desktop workspace backup/);
    expect(general).toMatch(/Media Locker backup/);
    expect(general).toMatch(/<Toggle[\s\S]*value=\{syncEnabled\}/);
    expect(general).toMatch(/<Toggle[\s\S]*value=\{autoBackupMedia\}/);
    expect(general).toMatch(/collectLegacyCloudSyncData/);
    expect(general).toMatch(/restoreLegacyCloudSyncData/);
    expect(general).toMatch(/window\.electron\.uploadSync/);
    expect(general).toMatch(/window\.electron\.downloadSync/);
  });

  it("uses product-facing Settings navigation and accessible switch semantics", () => {
    expect(constants).toMatch(/id: "google",\s*label: "Account"/);
    expect(content).toMatch(/Customize Orion on this Desktop\./);
    expect(controls).toMatch(/role="switch"/);
    expect(controls).toMatch(/aria-checked=\{!!value\}/);
    expect(controls).toMatch(/disabled=\{disabled\}/);
  });
  it("keeps backend-shaped sync vocabulary out of user-facing Account status copy", () => {
    const steadySources = [
      read("features/account/MyListSteadyStateSync.jsx"),
      read("features/account/WatchedSteadyStateSync.jsx"),
      read("features/account/ViewingActivitySteadyStateSync.jsx"),
      watched,
    ].join("\n");

    expect(steadySources).not.toMatch(/previously verified portable profile/i);
    expect(steadySources).not.toMatch(/no checkpoint was created/i);
    expect(steadySources).not.toMatch(/verified Watched checkpoint/i);
    expect(steadySources).not.toMatch(/saved My List checkpoint/i);
    expect(steadySources).not.toMatch(/Reconciling verified History and Progress/i);
    expect(steadySources).not.toMatch(/cannot reconcile safely/i);
    expect(steadySources).not.toMatch(/Local History and Progress/i);
  });

});
