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
    render(<WindowTitlebar />);
    expect(screen.getByLabelText("Online, 47 milliseconds latency")).toHaveTextContent("Online47 ms");
    expect(await screen.findByLabelText("72 percent battery")).toBeInTheDocument();
  });
});
