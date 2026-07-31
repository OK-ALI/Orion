import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "../../../src/renderer/components/layout/Sidebar";
import { readSidebarMode } from "../../../src/renderer/components/layout/sidebarState";

describe("Sidebar modes", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("cycles expanded, compact and collapsed while retaining the body during closing", () => {
    vi.useFakeTimers();
    const { container } = render(<Sidebar activePage="home" onNavigate={() => {}} />);
    expect(container.querySelector(".sidebar")).toHaveClass("sidebar-expanded");
    expect(screen.getByText("Discover")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sidebar mode: expanded/i }));
    expect(container.querySelector(".sidebar")).toHaveClass("sidebar-compact");
    expect(container.querySelector(".sidebar-body")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sidebar mode: compact/i }));
    expect(container.querySelector(".sidebar")).toHaveClass("closing");
    expect(container.querySelector(".sidebar-body")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(240));
    expect(container.querySelector(".sidebar")).toHaveClass("sidebar-collapsed");
    expect(container.querySelector(".sidebar-body")).not.toBeInTheDocument();
    expect(screen.getByText("ORION CINEMA")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand Orion Cinema sidebar" }));
    expect(container.querySelector(".sidebar")).toHaveClass("sidebar-compact");
    vi.useRealTimers();
  });

  it("expands the rail using Enter or Space", () => {
    window.localStorage.setItem("orion.sidebar.cinema.mode", "collapsed");
    window.localStorage.setItem("orion.sidebar.cinema.openMode", "expanded");
    const { container } = render(<Sidebar activePage="home" onNavigate={() => {}} />);
    const rail = screen.getByRole("button", { name: "Expand Orion Cinema sidebar" });
    fireEvent.keyDown(rail, { key: "Enter" });
    expect(container.querySelector(".sidebar")).toHaveClass("sidebar-expanded");
  });

  it("restores independent Cinema and Music modes", () => {
    window.localStorage.setItem("orion.sidebar.cinema.mode", "compact");
    window.localStorage.setItem("orion.sidebar.music.mode", "collapsed");
    const { container, rerender } = render(<Sidebar activePage="home" onNavigate={() => {}} />);
    expect(container.querySelector(".sidebar")).toHaveClass("sidebar-compact");
    rerender(<Sidebar activePage="music-home" onNavigate={() => {}} />);
    expect(container.querySelector(".sidebar")).toHaveClass("sidebar-collapsed");
    expect(screen.getByText("MUSIC PLANET")).toBeInTheDocument();
    rerender(<Sidebar activePage="home" onNavigate={() => {}} />);
    expect(container.querySelector(".sidebar")).toHaveClass("sidebar-compact");
  });

  it("migrates legacy pinning without opting users into the rail", () => {
    window.localStorage.setItem("orion_sidebarPinned", "true");
    expect(readSidebarMode("cinema")).toBe("expanded");
    window.localStorage.removeItem("orion.sidebar.music.mode");
    window.localStorage.setItem("orion_sidebarPinned", "false");
    expect(readSidebarMode("music")).toBe("compact");
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
