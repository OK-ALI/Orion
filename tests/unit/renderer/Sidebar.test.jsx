import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Sidebar from "../../../src/renderer/components/layout/Sidebar";

describe("Sidebar pin control", () => {
  it("pins and unpins from the edge control", () => {
    const { container } = render(<Sidebar activePage="home" onNavigate={() => {}} />);
    const rail = container.querySelector(".sidebar-edge-rail");
    fireEvent.click(rail);
    expect(rail).toHaveAttribute("aria-label", "Unpin and collapse sidebar");
    expect(rail).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(rail);
    expect(rail).toHaveAttribute("aria-label", "Pin sidebar open");
    expect(rail).toHaveAttribute("aria-pressed", "false");
  });

  it("places Constellation after Discover in Browse navigation", () => {
    const onNavigate = vi.fn();
    const { container } = render(<Sidebar activePage="home" onNavigate={onNavigate} />);
    const labels = [...container.querySelectorAll(".sidebar-group:first-child .sidebar-item-title")].map((node) => node.textContent);
    expect(labels).toEqual(["Home", "Search", "Discover", "Constellation"]);
    fireEvent.click(screen.getByText("Constellation"));
    expect(onNavigate).toHaveBeenCalledWith("constellation");
  });
});
