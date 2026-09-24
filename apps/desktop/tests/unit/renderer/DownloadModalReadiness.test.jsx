import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DownloadModal from "../../../src/renderer/components/DownloadModal";
import { storage, STORAGE_KEYS } from "../../../src/renderer/services/settingsStore";

vi.mock("../../../src/renderer/features/player/sources/registry", () => ({
  getEffectivePlayerSources: () => [{ id: "vixsrc", label: "VixSrc" }],
}));

const candidate = {
  id: "candidate-1", sessionId: "session-1", sourceId: "vixsrc",
  kind: "hls", host: "vixsrc.to", rankReason: "Likely master playlist", score: 100,
};

function setup(preflightStream) {
  const runDownload = vi.fn(async () => ({ ok: true, id: "download-1" }));
  window.electron = {
    listStreamCandidates: vi.fn(async () => [candidate]),
    getDownloaderStatus: vi.fn(async () => ({ exists: true })),
    preflightStream,
    runDownload,
  };
  storage.set(STORAGE_KEYS.DOWNLOAD_PATH, "C:\\OrionMedia");
  render(<DownloadModal onClose={vi.fn()} captureSessionId="session-1"
    mediaName="See You on Venus (2023)" mediaId={1} mediaType="movie" />);
  return runDownload;
}

describe("Desktop Download readiness", () => {
  it("never paints a captured candidate green or starts a task when the first media byte fails", async () => {
    const runDownload = setup(vi.fn(async () => ({
      ok: false, code: "empty_media", error: "The source returned no media bytes.",
    })));
    await screen.findByText("Captured source could not be verified");
    expect(screen.queryByText(/HLS source ready/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start download" })).toBeDisabled();
    expect(runDownload).not.toHaveBeenCalled();
  });

  it("opens the same transfer action only after verified media bytes", async () => {
    const preflightStream = vi.fn(async () => ({ ok: true, verified: true, strategy: "hls-proxy" }));
    const runDownload = setup(preflightStream);
    await screen.findByText(/HLS source ready/);
    expect(screen.getByRole("button", { name: "Start download" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Start download" }));
    await waitFor(() => expect(runDownload).toHaveBeenCalledOnce());
    expect(preflightStream).toHaveBeenCalledTimes(2);
  });

  it("removes green readiness if the final recheck expires before task creation", async () => {
    const preflightStream = vi.fn()
      .mockResolvedValueOnce({ ok: true, verified: true, strategy: "hls-proxy" })
      .mockResolvedValueOnce({ ok: false, code: "expired", error: "This stream expired." });
    const runDownload = setup(preflightStream);
    await screen.findByText(/HLS source ready/);
    fireEvent.click(screen.getByRole("button", { name: "Start download" }));
    await screen.findByText("Captured source could not be verified");
    expect(screen.queryByText(/HLS source ready/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start download" })).toBeDisabled();
    expect(runDownload).not.toHaveBeenCalled();
  });
});
