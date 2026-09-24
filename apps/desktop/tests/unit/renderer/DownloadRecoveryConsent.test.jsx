import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DownloadRecoveryConsent from "../../../src/renderer/features/player/components/DownloadRecoveryConsent";

describe("Orion download source consent", () => {
  it("uses an in-app dialog for manual-only sources", () => {
    const onAnswer = vi.fn();
    render(<DownloadRecoveryConsent consent={{ kind: "manual" }} onAnswer={onAnswer} />);
    expect(screen.getByRole("alertdialog", { name: "Try another playback source?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Allow for this download" }));
    expect(onAnswer).toHaveBeenCalledWith(true);
  });

  it("keeps the provider-specific advertising warning", () => {
    const onAnswer = vi.fn();
    render(<DownloadRecoveryConsent consent={{ kind: "vidsrc" }} onAnswer={onAnswer} />);
    expect(screen.getByText(/may open advertising outside Orion/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(onAnswer).toHaveBeenCalledWith(false);
  });
});
