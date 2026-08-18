import { describe, expect, it } from "vitest";
import {
  candidateReadinessTitle,
  preferredDownloadCandidate,
} from "../../../src/renderer/features/downloads/services/downloadCandidatePreference";

describe("download candidate preference", () => {
  it("prefers HLS over DASH and DIRECT even when DIRECT was captured later", () => {
    const selected = preferredDownloadCandidate([
      { id: "direct", kind: "direct", score: 90, capturedAt: 30 },
      { id: "dash", kind: "dash", score: 50, capturedAt: 20 },
      { id: "hls", kind: "hls", score: 60, capturedAt: 10 },
    ]);
    expect(selected.id).toBe("hls");
  });

  it("falls back to DASH before DIRECT when HLS is unavailable", () => {
    const selected = preferredDownloadCandidate([
      { id: "direct", kind: "direct", score: 90 },
      { id: "dash", kind: "dash", score: 10 },
    ]);
    expect(selected.id).toBe("dash");
  });

  it("keeps DIRECT available but does not describe it as equally verified", () => {
    expect(candidateReadinessTitle({ id: "direct", kind: "direct" }, "hls"))
      .toBe("DIRECT source available");
    expect(candidateReadinessTitle({ id: "hls", kind: "hls" }, "hls"))
      .toBe("HLS source ready · Recommended");
  });
});
