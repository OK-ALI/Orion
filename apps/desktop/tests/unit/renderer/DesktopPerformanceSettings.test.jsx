import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PerformanceSettingsGroup from "../../../src/renderer/features/settings/groups/PerformanceSettingsGroup";

function snapshot(overrides = {}) {
  return {
    selection: "automatic",
    automaticTier: "quality",
    requestedTier: "quality",
    pressureTier: "quality",
    tier: "quality",
    totalMemoryMb: 16384,
    cpuCount: 12,
    graphicsCapability: "hardware",
    gpuAdapterCount: 2,
    ...overrides,
  };
}

describe("Desktop performance profile settings", () => {
  beforeEach(() => {
    localStorage.clear();
    window.electron = {
      getPerformanceSnapshot: vi.fn().mockResolvedValue(snapshot()),
      onPerformanceSnapshot: vi.fn().mockReturnValue(null),
      offPerformanceSnapshot: vi.fn(),
    };
  });

  afterEach(() => {
    delete window.electron;
    localStorage.clear();
  });

  it("defaults to Automatic and exposes its resolved Desktop hardware profile", async () => {
    render(<PerformanceSettingsGroup model={{ secPerformance: { current: null } }} />);
    expect(screen.getByRole("radio", { name: "Automatic (Recommended) performance profile" })).toHaveAttribute("aria-checked", "true");
    expect(await screen.findByText("Automatic baseline: Quality · Active now: Quality")).toBeVisible();
    expect(screen.getByText("16 GB RAM · 12 logical processors · Graphics: hardware accelerated · 2 adapters")).toBeVisible();
  });

  it("surfaces a software graphics fallback without pretending Quality hardware is available", async () => {
    window.electron.getPerformanceSnapshot.mockResolvedValue(snapshot({
      automaticTier: "balanced",
      requestedTier: "balanced",
      pressureTier: "balanced",
      tier: "balanced",
      graphicsCapability: "software",
      gpuAdapterCount: 0,
    }));
    render(<PerformanceSettingsGroup model={{ secPerformance: { current: null } }} />);
    expect(await screen.findByText("Automatic baseline: Balanced · Active now: Balanced")).toBeVisible();
    expect(screen.getByText(/Graphics: software rendering fallback/)).toBeVisible();
  });

  it("persists a manual profile and broadcasts the canonical profile-change event", () => {
    const listener = vi.fn();
    window.addEventListener("orion:performance-profile-changed", listener);
    render(<PerformanceSettingsGroup model={{ secPerformance: { current: null } }} />);

    fireEvent.click(screen.getByRole("radio", { name: "Efficiency performance profile" }));

    expect(screen.getByRole("radio", { name: "Efficiency performance profile" })).toHaveAttribute("aria-checked", "true");
    expect(JSON.parse(localStorage.getItem("orion_performanceProfile"))).toBe("efficiency");
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: "efficiency" }));
    window.removeEventListener("orion:performance-profile-changed", listener);
  });
});
