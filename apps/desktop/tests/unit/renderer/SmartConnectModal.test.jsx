import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SmartConnectModal from "../../../src/renderer/components/modals/SmartConnectModal";

describe("SmartConnectModal signal", () => {
  it("uses the animated signal state language for waiting, reconnecting and connected", async () => {
    const renderState = async (info, expectedClass) => {
      window.electron = {
        getSmartConnectInfo: vi.fn().mockResolvedValue({
          devices: [],
          pin: "123456",
          pinExpiresAt: Date.now() + 60_000,
          ...info,
        }),
        onSmartConnectStatus: vi.fn().mockReturnValue(() => {}),
      };
      const view = render(<SmartConnectModal onClose={vi.fn()} />);
      await waitFor(() => {
        expect(view.container.querySelector(`.smart-connect-signal.${expectedClass}`)).toBeInTheDocument();
      });
      expect(view.container.querySelectorAll(".smart-connect-signal-arc")).toHaveLength(3);
      view.unmount();
    };

    await renderState({ paired: false, connected: false }, "is-waiting");
    await renderState({ paired: true, connected: false }, "is-reconnecting");
    await renderState({
      paired: true,
      connected: true,
      devices: [{ deviceId: "mobile-1", deviceName: "Orion Mobile", connected: true }],
    }, "is-connected");
  });
});

it("keeps LAN pairing and QR available while internet is offline, and distinguishes unavailable LAN", async () => {
  const info = { devices: [], pin: "123456", pinExpiresAt: Date.now() + 60_000, ip: "192.168.1.8", availableIps: ["192.168.1.8"], qrDataUrl: "data:image/png;base64,fixture" };
  let receive;
  window.electron = {
    getSmartConnectInfo: vi.fn().mockResolvedValue(info),
    onSmartConnectStatus: vi.fn((callback) => { receive = callback; return () => {}; }),
  };
  const view = render(<SmartConnectModal connectionState="offline" onClose={vi.fn()} />);
  await waitFor(() => expect(view.getByText(/Internet unavailable/)).toBeInTheDocument());
  expect(view.getByText(/devices on your local network/)).toBeInTheDocument();
  expect(view.container.querySelector('img[src="data:image/png;base64,fixture"]')).toBeInTheDocument();
  expect(view.getByText("192.168.1.8:8924")).toBeInTheDocument();
  const { act } = await import("@testing-library/react");
  act(() => receive({ ...info, availableIps: [], ip: "127.0.0.1" }));
  expect(view.getByText(/No local network address/)).toBeInTheDocument();
});
