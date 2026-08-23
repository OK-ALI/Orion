import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkForUpdates,
  subscribeToDesktopUpdateChecks,
} from "../../../src/renderer/shared/utils/updates";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(testDir, "../../..");

function release(version = "2.1.0") {
  const tag = `v${version}`;

  return {
    tag_name: tag,
    name: `Orion ${version} Preview`,
    published_at: "2026-08-23T00:00:00Z",
    prerelease: true,
    draft: false,
    html_url: `https://github.com/OK-ALI/Orion/releases/tag/${tag}`,
    body: "## Update notes",
    assets: [
      {
        name: `Orion.Setup.${version}.exe`,
        browser_download_url: `https://example.test/Orion.Setup.${version}.exe`,
        size: 100,
        content_type: "application/octet-stream",
      },
      {
        name: "orion-release-integrity-v1.json",
        browser_download_url: "https://example.test/orion-release-integrity-v1.json",
        size: 10,
        content_type: "application/json",
      },
    ],
  };
}

function integrityManifest(version = "2.1.0") {
  return {
    schemaVersion: 1,
    tag: `v${version}`,
    version,
    artifacts: [
      {
        name: `Orion.Setup.${version}.exe`,
        size: 100,
        sha256: "aa".repeat(32),
        signerSha256: "bb".repeat(32),
      },
    ],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("P9-F2 Desktop update announcement synchronization", () => {
  it("publishes checking and completed results from the canonical release check", async () => {
    vi.stubGlobal("window", {
      electron: {
        getAppVersion: vi.fn().mockResolvedValue("2.0.1"),
      },
    });

    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (String(url).includes("/releases?")) {
        return {
          ok: true,
          json: async () => [release()],
        };
      }

      return {
        ok: true,
        json: async () => integrityManifest(),
      };
    }));

    const events = [];
    const unsubscribe = subscribeToDesktopUpdateChecks((event) => {
      events.push(event);
    });

    const result = await checkForUpdates("preview");

    expect(result.hasUpdate).toBe(true);
    expect(result.channel).toBe("preview");
    expect(events.at(-2)).toMatchObject({
      phase: "checking",
      channel: "preview",
      result: null,
    });
    expect(events.at(-1)).toMatchObject({
      phase: "complete",
      channel: "preview",
      result,
    });

    unsubscribe();
  });

  it("keeps startup, Settings, channel changes, dismissal, and modal presentation on one announcement path", () => {
    const appSource = fs.readFileSync(
      path.join(desktopRoot, "src/renderer/app/App.jsx"),
      "utf8",
    );
    const announcementHookSource = fs.readFileSync(
      path.join(
        desktopRoot,
        "src/renderer/app/hooks/useDesktopUpdateAnnouncement.js",
      ),
      "utf8",
    );
    const settingsSource = fs.readFileSync(
      path.join(
        desktopRoot,
        "src/renderer/features/settings/sections/GeneralSettings.jsx",
      ),
      "utf8",
    );
    const overlaysSource = fs.readFileSync(
      path.join(desktopRoot, "src/renderer/app/AppOverlays.jsx"),
      "utf8",
    );

    expect(appSource).toContain("useDesktopUpdateAnnouncement");
    expect(appSource).toContain(
      "useDesktopUpdateAnnouncement({ setUpdateBanner, setShowUpdateModal });",
    );
    expect(appSource).not.toContain("subscribeToDesktopUpdateChecks");

    expect(announcementHookSource).toContain("subscribeToDesktopUpdateChecks");
    expect(announcementHookSource).toContain("event.phase === \"checking\"");
    expect(announcementHookSource).toContain("event.phase !== \"complete\"");
    expect(announcementHookSource).toContain("setUpdateBanner(event.result)");
    expect(announcementHookSource).toContain("setUpdateBanner(null)");
    expect(announcementHookSource).toContain("setShowUpdateModal(false)");

    expect(settingsSource).toContain(
      "const r = await checkForUpdates(selectedChannel);",
    );
    expect(settingsSource).toContain("runCheck(channel);");
    expect(settingsSource).toContain(
      "storage.set(STORAGE_KEYS.UPDATE_CHANNEL, normalized);",
    );

    expect(overlaysSource).toContain("View Update");
    expect(overlaysSource).toContain(
      "onClick={() => setUpdateBanner(null)}",
    );
    expect(overlaysSource).toContain(
      "{showUpdateModal && updateBanner && (",
    );
  });
});
