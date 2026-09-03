import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DesktopPageHeader from "../../../src/renderer/components/common/DesktopPageHeader";
import DetailOverview from "../../../src/renderer/components/common/DetailOverview";

describe("Desktop UI polish primitives", () => {
  it("renders the shared page title hierarchy with an optional action area", () => {
    render(
      <DesktopPageHeader
        eyebrow="Offline media"
        title="Downloads"
        subtitle="Manage media available on this device."
        actions={<button type="button">Download settings</button>}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Downloads" })).toBeVisible();
    expect(screen.getByText("Offline media")).toBeVisible();
    expect(screen.getByText("Manage media available on this device.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Download settings" })).toBeVisible();
  });

  it("keeps short media overviews compact without a redundant disclosure", () => {
    render(<DetailOverview text="A short overview." />);

    expect(screen.getByText("A short overview.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
  });

  it("expands and collapses long media overviews with accessible disclosure state", () => {
    const overview = "A".repeat(220);
    render(<DetailOverview text={overview} />);

    const button = screen.getByRole("button", { name: "Show more" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.getByRole("button", { name: "Show more" })).toHaveAttribute("aria-expanded", "false");
  });
});
