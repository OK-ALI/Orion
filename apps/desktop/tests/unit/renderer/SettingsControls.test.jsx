import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CleanRow, Toggle } from "../../../src/renderer/features/settings/components/SettingsControls";

describe("Settings controls", () => {
  it("renders a supplied live control instead of an empty action button", () => {
    render(<CleanRow title="When navigating away" description="Playback continuity" right={<span>Auto</span>} />);
    expect(screen.getByText("Auto")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("exposes toggle state with switch semantics", () => {
    render(<Toggle value={true} onChange={() => {}} title="Auto sync My List" />);
    const toggle = screen.getByRole("switch", { name: "Auto sync My List" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});
