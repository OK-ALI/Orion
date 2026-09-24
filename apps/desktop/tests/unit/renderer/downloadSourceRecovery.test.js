import { beforeEach, describe, expect, it, vi } from "vitest";

const sources = [
  { id: "vixsrc", media: { movie: true, tv: true }, supportsDownloads: true, routingMode: "automatic" },
  { id: "vidlink", media: { movie: true, tv: true }, supportsDownloads: true, routingMode: "manual-only" },
  { id: "vidsrc", media: { movie: true, tv: true }, supportsDownloads: true, routingMode: "manual-only" },
  { id: "disabled", media: { movie: true, tv: true }, supportsDownloads: false, routingMode: "manual-only" },
];
vi.mock("../../../src/renderer/features/player/sources/registry", () => ({
  getEffectivePlayerSources: () => sources,
  getCinemaSourceRuntimeHealth: (id) => id === "disabled" ? { cooldownUntil: Date.now() + 60_000 } : null,
}));

import { advanceDownloadSourceRecovery, resolveDownloadRecoveryConsent, MAX_DOWNLOAD_SOURCE_ATTEMPTS, DOWNLOAD_SOURCE_ATTEMPT_MS } from "../../../src/renderer/features/player/services/downloadSourceRecovery";

const state = () => ({ attempted: new Set(["vixsrc"]), refreshed: false, manualApproved: false, reload: false });

describe("download-only source recovery", () => {
  beforeEach(() => { window.confirm = vi.fn(() => true); });
  it("bounds attempts to selected source plus two eligible alternatives", () => {
    const recovery = state();
    expect(MAX_DOWNLOAD_SOURCE_ATTEMPTS).toBe(3);
    expect(DOWNLOAD_SOURCE_ATTEMPT_MS).toBe(30_000);
    expect(advanceDownloadSourceRecovery("movie", "vixsrc", { code: "empty_media" }, recovery)).toEqual({ action: "consent", kind: "manual", sourceId: "vidlink" });
    resolveDownloadRecoveryConsent(recovery, "manual", true);
    expect(advanceDownloadSourceRecovery("movie", "vixsrc", { code: "empty_media" }, recovery)).toEqual({ action: "switch", sourceId: "vidlink" });
    expect(advanceDownloadSourceRecovery("movie", "vidlink", { code: "http_500" }, recovery)).toEqual({ action: "consent", kind: "vidsrc", sourceId: "vidsrc" });
    resolveDownloadRecoveryConsent(recovery, "vidsrc", true);
    expect(advanceDownloadSourceRecovery("movie", "vidlink", { code: "http_500" }, recovery)).toEqual({ action: "switch", sourceId: "vidsrc" });
    expect(advanceDownloadSourceRecovery("movie", "vidsrc", { code: "not_media", error: "No bytes" }, recovery)).toEqual({ action: "fail", error: "No bytes" });
    expect([...recovery.attempted]).toEqual(["vixsrc", "vidlink", "vidsrc"]);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("allows one expiry recapture, then switches source rather than retrying again", () => {
    const recovery = state();
    expect(advanceDownloadSourceRecovery("tv", "vixsrc", { code: "http_403" }, recovery)).toEqual({ action: "refresh" });
    expect(recovery.refreshed).toBe(true);
    expect(advanceDownloadSourceRecovery("tv", "vixsrc", { code: "http_403" }, recovery)).toEqual({ action: "consent", kind: "manual", sourceId: "vidlink" });
  });

  it("asks once and never opens a manual-only source after consent is denied", () => {
    const recovery = state();
    expect(advanceDownloadSourceRecovery("movie", "vixsrc", { code: "no_candidate" }, recovery)).toEqual({ action: "consent", kind: "manual", sourceId: "vidlink" });
    resolveDownloadRecoveryConsent(recovery, "manual", false);
    expect(advanceDownloadSourceRecovery("movie", "vixsrc", { code: "no_candidate" }, recovery).action).toBe("fail");
    expect(window.confirm).not.toHaveBeenCalled();
  });
});
