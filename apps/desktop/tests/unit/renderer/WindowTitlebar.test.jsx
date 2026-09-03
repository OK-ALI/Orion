import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/renderer/shared/hooks/useNetworkStatus", () => ({
  default: () => ({ status: "online", latencyMs: 47, tier: "fast", checkedAt: 1 }),
}));

import WindowTitlebar from "../../../src/renderer/components/layout/WindowTitlebar";

describe("Window titlebar system status", () => {
  beforeEach(() => {
    window.electron = {
      isMaximized: vi.fn().mockResolvedValue(false),
      onMaximizedChange: vi.fn().mockReturnValue(() => {}),
      offMaximizedChange: vi.fn(),
      getBatteryStatus: vi.fn().mockResolvedValue({ available: true, visible: true, level: 0.72, charging: false }),
      onBatteryStatus: vi.fn().mockReturnValue(() => {}),
      offBatteryStatus: vi.fn(),
    };
  });

  it("shows measured connectivity beside battery status", async () => {
    render(<WindowTitlebar network={{ status: "online", latencyMs: 47, tier: "fast" }} />);
    expect(screen.getByLabelText("Online, 47 milliseconds latency")).toHaveTextContent("Online47 ms");
    expect(await screen.findByLabelText("72 percent battery")).toBeInTheDocument();
  });
});

it("represents all five product states, including reconnecting over the legacy checking alias", async () => {
  window.electron = { isMaximized: vi.fn().mockResolvedValue(false), onMaximizedChange: vi.fn(), offMaximizedChange: vi.fn() };
  const view = render(<WindowTitlebar network={{ status: "checking", productState: "reconnecting", tier: "unknown" }} />);
  expect(screen.getByRole("status")).toHaveTextContent("Reconnecting");
  expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  for (const state of ["checking", "online", "degraded", "offline"]) {
    view.rerender(<WindowTitlebar network={{ status: state, productState: state, tier: "unknown" }} />);
    expect(screen.getByRole("status")).toHaveTextContent(new RegExp(state, "i"));
  }
});
