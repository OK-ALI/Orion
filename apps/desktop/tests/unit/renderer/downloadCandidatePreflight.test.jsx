import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDownloadCandidatePreflight } from "../../../src/renderer/features/player/hooks/useDownloadCandidatePreflight";

function harness(candidates, preflightStream) {
  const preflightRef = { current: new Set() };
  const recoveryRef = { current: { handledSession: null, lastFailure: null } };
  const onVerified = vi.fn();
  const setActive = vi.fn();
  const setPlaying = vi.fn();
  const setShowDownload = vi.fn();
  window.electron = {
    listStreamCandidates: vi.fn(async () => candidates),
    preflightStream,
  };
  renderHook(() => useDownloadCandidatePreflight({
    active: true, target: { sourceId: "vixsrc" }, playing: true,
    captureSessionId: "bound-session", preflightRef, recoveryRef,
    onVerified, setActive, setPlaying, setShowDownload,
  }));
  return { onVerified, setActive, setPlaying, setShowDownload, recoveryRef };
}

describe("same-session Download candidate preparation", () => {
  it("tries another captured candidate before abandoning a source", async () => {
    const candidates = [
      { id: "unplayable-master", sessionId: "bound-session", sourceId: "vixsrc" },
      { id: "playable-child", sessionId: "bound-session", sourceId: "vixsrc" },
      { id: "other-source", sessionId: "bound-session", sourceId: "vidlink" },
    ];
    const preflightStream = vi.fn(async (id) => id === "playable-child"
      ? { ok: true, verified: true }
      : { ok: false, code: "empty_media", error: "No media bytes" });
    const state = harness(candidates, preflightStream);
    await waitFor(() => expect(state.onVerified).toHaveBeenCalledWith("playable-child"));
    expect(preflightStream.mock.calls.map(([id]) => id)).toEqual(["unplayable-master", "playable-child"]);
    expect(state.setActive).toHaveBeenCalledWith(false);
    expect(state.setPlaying).toHaveBeenCalledWith(false);
    expect(state.setShowDownload).toHaveBeenCalledWith(true);
  });

  it("keeps playback bounded by the controller deadline after all candidates fail", async () => {
    const state = harness(
      [{ id: "bad", sessionId: "bound-session", sourceId: "vixsrc" }],
      vi.fn(async () => ({ ok: false, code: "http_403", error: "Rejected" })),
    );
    await waitFor(() => expect(state.recoveryRef.current.lastFailure?.code).toBe("http_403"));
    expect(state.setShowDownload).not.toHaveBeenCalled();
    expect(state.setPlaying).not.toHaveBeenCalled();
  });

  it("rechecks a failed candidate only when the same session observes new request context", async () => {
    const candidate = { id: "active-master", sessionId: "bound-session", sourceId: "vixsrc", contextRevision: 1 };
    const preflightStream = vi.fn()
      .mockResolvedValueOnce({ ok: false, code: "http_403", error: "Child request rejected" })
      .mockResolvedValueOnce({ ok: true, verified: true });
    const state = harness([candidate], preflightStream);
    await waitFor(() => expect(preflightStream).toHaveBeenCalledTimes(1));
    candidate.contextRevision = 2;
    await waitFor(() => expect(state.onVerified).toHaveBeenCalledWith("active-master"), { timeout: 2500 });
    expect(preflightStream).toHaveBeenCalledTimes(2);
    expect(state.setShowDownload).toHaveBeenCalledWith(true);
  });
});
