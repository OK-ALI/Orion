import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const rendererRoot = path.resolve(here, "../../../src/renderer");
const general = fs.readFileSync(path.join(rendererRoot, "features/settings/sections/GeneralSettings.jsx"), "utf8");
const myList = fs.readFileSync(path.join(rendererRoot, "features/settings/components/MyListSyncCard.jsx"), "utf8");
const watched = fs.readFileSync(path.join(rendererRoot, "features/settings/components/WatchedSyncCard.jsx"), "utf8");

describe("Orion Account and sync productization", () => {
  it("keeps normal Account UI product-facing while preserving Google identity actions", () => {
    expect(general).toMatch(/settings-section-title">Account</);
    expect(general).toMatch(/Connected with Google/);
    expect(general).toMatch(/Disconnect Google/);
    expect(general).toMatch(/Continue with Google/);
    expect(general).toMatch(/Orion Cloud keeps your data in sync across devices/);
    expect(general).not.toMatch(/settings-section-title">Google Authentication/);
    expect(general).not.toMatch(/PortableProfileProbeCard/);
    expect(general).not.toMatch(/Google Cloud Console/);
  });

  it("presents My List and Watched as equal Orion Cloud domains", () => {
    expect(general).toMatch(/<MyListSyncCard/);
    expect(general).toMatch(/<WatchedSyncCard/);
    expect(myList).toMatch(/>My List<\/div>/);
    expect(watched).toMatch(/>Watched<\/div>/);
    for (const source of [myList, watched]) {
      expect(source).toMatch(/"Synced"/);
      expect(source).toMatch(/"Needs review"/);
      expect(source).toMatch(/"Check now"/);
      expect(source).toMatch(/Auto sync/);
      expect(source).toMatch(/Confirm/);
      expect(source).not.toMatch(/PortableProfileV3|revision token|Phase 8/);
    }
    expect(myList).toMatch(/Keep My List in sync across Orion devices/);
    expect(myList).toMatch(/Combine both/);
    expect(myList).toMatch(/Keep Desktop My List/);
    expect(myList).toMatch(/Keep Orion Cloud My List/);
    expect(myList).not.toMatch(/>Use (?:Desktop|Orion Cloud)/);
    expect(watched).toMatch(/Keep watched movies and episodes in sync across Orion devices/);
  });

  it("keeps the legacy Desktop Google Drive workspace backup visibly separate from Orion Cloud", () => {
    expect(general).toMatch(/Desktop backup & media/);
    expect(general).toMatch(/Separate from Orion Cloud/);
    expect(general).toMatch(/Google Drive backup and Media Locker/);
    expect(general).toMatch(/Google Drive workspace sync/);
    expect(general).toMatch(/Last Google Drive sync/);
    expect(general).toMatch(/collectLegacyCloudSyncData/);
    expect(general).toMatch(/restoreLegacyCloudSyncData/);
    expect(general).toMatch(/window\.electron\.uploadSync/);
    expect(general).toMatch(/window\.electron\.downloadSync/);
  });
});
