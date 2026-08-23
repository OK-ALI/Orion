import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import GetOrionMobilePage from "../../../src/renderer/features/updates/GetOrionMobilePage";
import { fetchOrionMobileDistributionStatus } from "../../../src/renderer/shared/utils/updates";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn() },
}));

vi.mock("../../../src/renderer/shared/utils/updates", () => ({
  fetchOrionMobileDistributionStatus: vi.fn(),
}));

function distribution({ channel = "stable", version = null, apk = null, installerReady = Boolean(apk), notes = null } = {}) {
  const release = version ? {
    version,
    publishedAt: "2026-08-22T00:00:00Z",
    notes: notes ?? `${version} release notes`,
    url: `https://github.com/OK-ALI/Orion/releases/tag/v${version}`,
  } : null;
  const artifact = apk ? {
    name: apk,
    url: `https://github.com/OK-ALI/Orion/releases/download/v${version}/${apk}`,
  } : null;
  return {
    releaseTruth: {
      channel,
      mobile: {
        release,
        apk: artifact,
        installerAvailable: Boolean(apk),
      },
    },
    release,
    apk: artifact,
    notes: release?.notes || "",
    installerReady,
    integrity: {
      ok: installerReady,
      status: installerReady ? "ready" : "missing",
      reason: installerReady ? null : "Release verification metadata is unavailable.",
    },
  };
}

describe("Get Orion Mobile distribution page", () => {
  beforeEach(() => {
    window.localStorage.clear();
    fetchOrionMobileDistributionStatus.mockReset();
    QRCode.toDataURL.mockReset();
    Object.defineProperty(window, "electron", {
      configurable: true,
      value: { openExternal: vi.fn() },
    });
  });

  it("renders an intentional unpublished state without inventing a QR or APK action", async () => {
    fetchOrionMobileDistributionStatus.mockResolvedValue(distribution());

    const { container } = render(<GetOrionMobilePage />);

    expect(await screen.findByText("Awaiting first Mobile release")).toBeInTheDocument();
    expect(container.querySelector(".gom-orbit")).not.toBeInTheDocument();
    expect(container.querySelector(".gom-card")).not.toBeInTheDocument();
    expect(screen.getAllByText("Not published")).toHaveLength(2);
    expect(screen.getByText("QR activates after release verification.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download APK/i })).not.toBeInTheDocument();
    expect(QRCode.toDataURL).not.toHaveBeenCalled();
  });

  it("persists Preview locally and refreshes release truth for that channel", async () => {
    fetchOrionMobileDistributionStatus.mockImplementation(async (channel) => distribution({ channel }));

    render(<GetOrionMobilePage />);
    await screen.findByText("Awaiting first Mobile release");

    fireEvent.click(screen.getByRole("radio", { name: /Preview/i }));

    await waitFor(() => expect(fetchOrionMobileDistributionStatus).toHaveBeenCalledWith("preview"));
    expect(window.localStorage.getItem("orion_updateChannel")).toBe('"preview"');
  });

  it("enables the real download and installation QR only for a verified published APK", async () => {
    const apk = "orion-mobile-2.1.0-preview.1.apk";
    fetchOrionMobileDistributionStatus.mockResolvedValue(distribution({ channel: "preview", version: "2.1.0-preview.1", apk }));
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
  it("fails closed when an APK is published without complete release verification metadata", async () => {
    const apk = "orion-mobile-2.1.0-preview.1.apk";
    fetchOrionMobileDistributionStatus.mockResolvedValue(distribution({
      channel: "preview",
      version: "2.1.0-preview.1",
      apk,
      installerReady: false,
    }));
    window.localStorage.setItem("orion_updateChannel", '"preview"');

    render(<GetOrionMobilePage />);

    expect(await screen.findByText("Installer verification unavailable")).toBeInTheDocument();
    expect(screen.getByText("Installer verification is not ready.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download APK/i })).not.toBeInTheDocument();
    expect(screen.queryByAltText("Orion Mobile Android installation QR code")).not.toBeInTheDocument();
    expect(QRCode.toDataURL).not.toHaveBeenCalled();
  });


  it("renders GitHub Markdown as structured Orion release notes without raw syntax leakage", async () => {
    fetchOrionMobileDistributionStatus.mockResolvedValue(distribution({
      channel: "preview",
      version: "2.1.1",
      apk: "orion-mobile-v2.1.1.apk",
      notes: [
        "## Highlights",
        "- Unified update state",
        "### Details",
        "1. Cleaner release notes",
      ].join("\n"),
    }));
    QRCode.toDataURL.mockResolvedValue("data:image/png;base64,ORION");
    window.localStorage.setItem("orion_updateChannel", '"preview"');

    render(<GetOrionMobilePage />);

    expect(await screen.findByText("Highlights")).toBeInTheDocument();
    expect(screen.getByText("Unified update state")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Cleaner release notes")).toBeInTheDocument();
    expect(screen.queryByText("## Highlights")).not.toBeInTheDocument();
    expect(screen.queryByText("### Details")).not.toBeInTheDocument();
  });

});
