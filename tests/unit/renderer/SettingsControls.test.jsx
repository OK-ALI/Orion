import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CleanRow } from "../../../src/renderer/features/settings/components/SettingsControls";

describe("CleanRow", () => {
  it("renders a supplied live control instead of an empty action button", () => {
    render(<CleanRow title="When navigating away" description="Playback continuity" right={<span>Auto</span>} />);
    expect(screen.getByText("Auto")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
