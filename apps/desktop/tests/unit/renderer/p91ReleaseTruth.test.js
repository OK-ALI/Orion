import { describe, expect, it } from "vitest";
import {
  compareOrionVersionsV1,
  resolveOrionReleaseTruthV1,
} from "@orion/shared/types";

function release(tag, { prerelease = false, assets = [] } = {}) {
  return {
    tag_name: tag,
    name: tag,
    published_at: "2026-08-22T00:00:00Z",
    prerelease,
    draft: false,
    html_url: `https://github.com/OK-ALI/Orion/releases/tag/${tag}`,
    body: `${tag} notes`,
    assets: assets.map((name) => ({
      name,
      browser_download_url: `https://github.com/OK-ALI/Orion/releases/download/${tag}/${name}`,
      size: 1024,
      content_type: "application/octet-stream",
    })),
  };
}

describe("P9.1 Orion release truth", () => {
  it("lets Preview widen eligibility without downgrading below a newer Stable release", () => {
    const truth = resolveOrionReleaseTruthV1([
      release("v2.0.1", { assets: ["Orion.Setup.2.0.1.exe"] }),
      release("v1.0.1", { prerelease: true, assets: ["Orion.Setup.1.0.1.exe"] }),
    ], "preview");

    expect(truth.desktop.release?.version).toBe("2.0.1");
    expect(truth.mobile.release).toBeNull();
    expect(truth.mobile.installerAvailable).toBe(false);
  });

  it("selects a newer Preview build and discovers its Android APK", () => {
    const truth = resolveOrionReleaseTruthV1([
      release("v2.0.1", { assets: ["Orion.Setup.2.0.1.exe"] }),
      release("v2.1.0-preview.1", {
        prerelease: true,
        assets: ["Orion.Setup.2.1.0-preview.1.exe", "orion-mobile-2.1.0-preview.1.apk"],
      }),
    ], "preview");

    expect(truth.desktop.release?.version).toBe("2.1.0-preview.1");
    expect(truth.mobile.release?.version).toBe("2.1.0-preview.1");
    expect(truth.mobile.apk?.kind).toBe("android-apk");
  });

  it("keeps Stable isolated from prerelease-only APKs", () => {
    const truth = resolveOrionReleaseTruthV1([
      release("v2.0.1", { assets: ["Orion.Setup.2.0.1.exe"] }),
      release("v2.1.0-preview.1", { prerelease: true, assets: ["orion-mobile.apk"] }),
    ], "stable");

    expect(truth.desktop.release?.version).toBe("2.0.1");
    expect(truth.mobile.release).toBeNull();
    expect(compareOrionVersionsV1("2.0.1", "1.0.1")).toBeGreaterThan(0);
  });
});
