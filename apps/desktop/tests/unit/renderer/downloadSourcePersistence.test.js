import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  beginDownloadSourceScope,
  restoreDownloadSource,
  shouldPersistPlayerSource,
} from "../../../src/renderer/features/player/services/downloadSourceScope";

const controller = (kind) => fs.readFileSync(path.resolve(
  process.cwd(), `src/renderer/features/${kind}/hooks/use${kind === "movies" ? "Movie" : "TV"}Controller.js`,
), "utf8");

describe.each(["movies", "tv"])("%s download source persistence", (kind) => {
  it("keeps temporary preparation local while ordinary source selection persists", () => {
    const original = beginDownloadSourceScope("vixsrc", null, false);
    expect(original.originalSource).toBe("vixsrc");
    const retry = beginDownloadSourceScope("vidlink", original, true);
    expect(retry.originalSource).toBe("vixsrc");
    expect(restoreDownloadSource(retry, "vidlink")).toBe("vixsrc");
    expect(shouldPersistPlayerSource({ key: "download" })).toBe(false);
    expect(shouldPersistPlayerSource("failed download awaiting manual source choice")).toBe(false);
    expect(shouldPersistPlayerSource(null)).toBe(true);

    const code = controller(kind);
    expect(code).not.toContain("beginDownloadSourceScope(");
    expect(code).not.toContain("restoreDownloadSource(");
    expect(code).not.toContain("useDownloadSourceRecovery");
    expect(code).toContain("if (shouldPersistPlayerSource(downloadTarget || downloadResolutionError) && storage.get(STORAGE_KEYS.PLAYER_SOURCE) !== normalized)");
    expect(code).not.toContain("viewModel.selectDownloadSource = selectDownloadSource");
    expect(code).not.toMatch(/setPlayerSource\(next\.sourceId\);\s*storage\.set\(STORAGE_KEYS\.PLAYER_SOURCE/);
    expect(code).toMatch(/if \(downloadResolutionActive\) return false;[\s\S]*storage\.set\(STORAGE_KEYS\.PLAYER_SOURCE, next\)/);
  });
});
