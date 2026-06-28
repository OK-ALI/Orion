import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DownloaderToolsSection } from "../../../src/renderer/features/settings/sections/SystemSettings";

describe("DownloaderToolsSection", () => {
  it("surfaces managed-tool installation failures", async () => {
    window.electron = {
      getDownloaderStatus: vi.fn().mockResolvedValue({ exists: false }),
      installDownloaderTools: vi
        .fn()
        .mockResolvedValue({ ok: false, error: "Network unavailable" }),
      onDownloaderToolsProgress: vi.fn().mockReturnValue(() => {}),
      offDownloaderToolsProgress: vi.fn(),
    };

    render(<DownloaderToolsSection />);
    const installButton = await screen.findByRole("button", {
      name: "Install tools",
    });
    fireEvent.click(installButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network unavailable");
    });
    expect(window.electron.installDownloaderTools).toHaveBeenCalledOnce();
  });
});
