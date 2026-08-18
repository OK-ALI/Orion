import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "../../../src/renderer/components/layout/Sidebar";
import { readSidebarMode, SIDEBAR_MODES } from "../../../src/renderer/components/layout/sidebarState";

describe("Sidebar rail behavior", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("rests on the collapsed rail and reveals full navigation on hover without pinning", () => {
    const { container } = render(<Sidebar activePage="home" onNavigate={() => {}} />);
    const rail = screen.getByRole("button", { name: "Reveal Orion Cinema sidebar" });
    expect(rail).toBeInTheDocument();
    expect(container.querySelector(".sidebar-body")).toHaveAttribute("aria-hidden", "true");

    fireEvent.mouseEnter(rail);
    expect(container.querySelector(".sidebar")).toHaveClass("mode-auto", "revealed", "peeking");
    expect(container.querySelector(".sidebar")).not.toHaveClass("expanded");
    expect(screen.getByText("Discover")).toBeInTheDocument();

    fireEvent.mouseLeave(container.querySelector(".sidebar"));
    expect(container.querySelector(".sidebar-body")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Reveal Orion Cinema sidebar" })).toBeInTheDocument();
  });

  it("lets the reveal panel be kept open and returned to auto rail", () => {
    const { container } = render(<Sidebar activePage="home" onNavigate={() => {}} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Reveal Orion Cinema sidebar" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep sidebar open" }));

    expect(container.querySelector(".sidebar")).toHaveClass("mode-pinned", "expanded", "pinned-open");
    expect(window.localStorage.getItem("orion.sidebar.cinema.mode")).toBe("pinned");

    fireEvent.click(screen.getByRole("button", { name: "Use auto-hide sidebar rail" }));
    expect(container.querySelector(".sidebar")).toHaveClass("mode-auto");
    expect(screen.getByRole("button", { name: "Reveal Orion Cinema sidebar" })).toBeInTheDocument();
  });

  it("restores independent Cinema and Music rail preferences", () => {
    window.localStorage.setItem("orion.sidebar.cinema.mode", "auto");
    window.localStorage.setItem("orion.sidebar.music.mode", "pinned");
    const { container, rerender } = render(<Sidebar activePage="home" onNavigate={() => {}} />);
    expect(container.querySelector(".sidebar")).toHaveClass("mode-auto");

    rerender(<Sidebar activePage="music-home" onNavigate={() => {}} />);
    expect(container.querySelector(".sidebar")).toHaveClass("mode-pinned", "expanded");
    expect(screen.getByText("Now Playing")).toBeInTheDocument();

    rerender(<Sidebar activePage="home" onNavigate={() => {}} />);
    expect(container.querySelector(".sidebar")).toHaveClass("mode-auto");
  });

  it("migrates every retired three-width mode to the new auto rail", () => {
    for (const legacy of ["expanded", "compact", "collapsed"]) {
      window.localStorage.setItem("orion.sidebar.cinema.mode", legacy);
      expect(readSidebarMode("cinema")).toBe(SIDEBAR_MODES.AUTO);
      expect(window.localStorage.getItem("orion.sidebar.cinema.mode")).toBe("auto");
    }
  });

  it("uses distinct semantic icons for Connect and Music destinations", () => {
    const onNavigate = vi.fn();
    const { container, rerender } = render(<Sidebar activePage="home" onNavigate={onNavigate} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Reveal Orion Cinema sidebar" }));
    const cinemaSvgs = [...container.querySelectorAll(".sidebar-item-icon svg")];
    expect(cinemaSvgs.length).toBeGreaterThan(5);
    fireEvent.click(screen.getByText("Orion Connect"));
    expect(onNavigate).toHaveBeenCalledWith("connect");

    rerender(<Sidebar activePage="music-home" onNavigate={onNavigate} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Reveal Music Planet sidebar" }));
    expect(screen.getByText("Albums")).toBeInTheDocument();
    expect(screen.getByText("Artists")).toBeInTheDocument();
    expect(screen.getByText("Signal Sources")).toBeInTheDocument();
    expect(screen.getByText("Playlists")).toBeInTheDocument();
    expect(screen.getByText("Favorites")).toBeInTheDocument();
    const worldSwitch = screen.getByRole("button", { name: "Return to Cinema" });
    expect(worldSwitch.querySelector("svg")).toBeTruthy();
    expect(worldSwitch.querySelector("circle")).toBeNull();
  });
});
