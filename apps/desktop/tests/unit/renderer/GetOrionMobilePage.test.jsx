import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import GetOrionMobilePage from "../../../src/renderer/features/updates/GetOrionMobilePage";
import { fetchOrionReleaseTruth } from "../../../src/renderer/shared/utils/updates";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn() },
}));

vi.mock("../../../src/renderer/shared/utils/updates", () => ({
  fetchOrionReleaseTruth: vi.fn(),
}));

function truth({ channel = "stable", version = null, apk = null } = {}) {
  return {
    channel,
    mobile: {
      release: version ? {
        version,
        publishedAt: "2026-08-22T00:00:00Z",
        notes: `${version} release notes`,
        url: `https://github.com/OK-ALI/Orion/releases/tag/v${version}`,
      } : null,
      apk: apk ? {
        name: apk,
        url: `https://github.com/OK-ALI/Orion/releases/download/v${version}/${apk}`,
      } : null,
      installerAvailable: Boolean(apk),
    },
  };
}

describe("Get Orion Mobile distribution page", () => {
  beforeEach(() => {
    window.localStorage.clear();
    fetchOrionReleaseTruth.mockReset();
    QRCode.toDataURL.mockReset();
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: { openExternal: vi.fn() },
    });
  });

  it("renders an intentional unpublished state without inventing a QR or APK action", async () => {
    fetchOrionReleaseTruth.mockResolvedValue(truth());

    const { container } = render(<GetOrionMobilePage />);

    expect(await screen.findByText("Awaiting first Mobile release")).toBeInTheDocument();
    expect(container.querySelector(".gom-orbit")).not.toBeInTheDocument();
    expect(container.querySelector(".gom-card")).not.toBeInTheDocument();
    expect(screen.getAllByText("Not published")).toHaveLength(2);
    expect(screen.getByText("QR activates with the published APK.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download APK/i })).not.toBeInTheDocument();
    expect(QRCode.toDataURL).not.toHaveBeenCalled();
  });

  it("persists Preview locally and refreshes release truth for that channel", async () => {
    fetchOrionReleaseTruth.mockImplementation(async (channel) => truth({ channel }));

    render(<GetOrionMobilePage />);
    await screen.findByText("Awaiting first Mobile release");

    fireEvent.click(screen.getByRole("radio", { name: /Preview/i }));

    await waitFor(() => expect(fetchOrionReleaseTruth).toHaveBeenCalledWith("preview"));
    expect(window.localStorage.getItem("orion_updateChannel")).toBe('"preview"');
  });

  it("enables the real download and installation QR only for a published APK", async () => {
    const apk = "orion-mobile-2.1.0-preview.1.apk";
    fetchOrionReleaseTruth.mockResolvedValue(truth({ channel: "preview", version: "2.1.0-preview.1", apk }));
    QRCode.toDataURL.mockResolvedValue("data:image/png;base64,ORION");
    window.localStorage.setItem("orion_updateChannel", '"preview"');

    render(<GetOrionMobilePage />);

    const download = await screen.findByRole("button", { name: /Download APK/i });
    await screen.findByAltText("Orion Mobile Android installation QR code");
    fireEvent.click(download);

    expect(QRCode.toDataURL).toHaveBeenCalledTimes(1);
    expect(window.electron.openExternal).toHaveBeenCalledWith(
      "https://github.com/OK-ALI/Orion/releases/download/v2.1.0-preview.1/orion-mobile-2.1.0-preview.1.apk",
    );
  });
});
