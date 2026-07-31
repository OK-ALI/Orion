import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WhatsNewModal from "../../../src/renderer/app/components/WhatsNewModal";

describe("Orion X welcome modal", () => {
  it("presents both worlds and routes through explicit actions", () => {
    const enterMusic = vi.fn();
    const continueCinema = vi.fn();
    render(<WhatsNewModal version="2.0.0" onEnterMusic={enterMusic} onContinueCinema={continueCinema} />);
    expect(screen.getByRole("heading", { name: "Two worlds. One Orion." })).toBeInTheDocument();
    expect(screen.getByText("Music Planet")).toBeInTheDocument();
    expect(screen.getByText("Cinema evolved")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Enter Music Planet/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Cinema" }));
    expect(enterMusic).toHaveBeenCalledOnce();
    expect(continueCinema).toHaveBeenCalledOnce();
  });
});
