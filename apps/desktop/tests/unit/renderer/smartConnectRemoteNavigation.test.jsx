import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSmartConnectRemoteCommands } from "../../../src/renderer/app/hooks/useSmartConnectRemoteCommands";

function setup(overrides = {}) {
  let receive;
  window.electron = {
    onRemoteCommand: vi.fn((handler) => { receive = handler; return () => {}; }),
    acknowledgeSmartConnectCommand: vi.fn(async () => ({ ok: true })),
  };
  const handlers = { baseNavigate: vi.fn(async () => {}), baseNavigateBack: vi.fn(async () => {}),
    createMiniHandoff: vi.fn(), handleSystemMediaCommand: vi.fn(), pageRef: { current: "movie" }, setShowSearch: vi.fn(), ...overrides };
  renderHook(() => useSmartConnectRemoteCommands(handlers));
  return { receive, handlers };
}

describe("remote navigation handoff acknowledgement", () => {
  it.each(["home", "back"])("awaits the normal %s handoff handler before success", async (action) => {
    let finish;
    const navigate = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const { receive } = setup(action === "home" ? { baseNavigate: navigate } : { baseNavigateBack: navigate });
    let pending;
    act(() => { pending = receive({ id: "navigation-1", sequence: 1, action }); });
    expect(navigate).toHaveBeenCalledOnce();
    expect(window.electron.acknowledgeSmartConnectCommand).not.toHaveBeenCalled();
    await act(async () => { finish(); await pending; });
    expect(window.electron.acknowledgeSmartConnectCommand).toHaveBeenCalledWith(expect.objectContaining({ id: "navigation-1", ok: true }));
  });

  it("acknowledges a failed navigation rather than leaving the phone loading", async () => {
    const { receive } = setup({ baseNavigate: vi.fn(async () => { throw new Error("handoff failed"); }) });
    await act(async () => receive({ id: "navigation-2", sequence: 2, action: "home" }));
    expect(window.electron.acknowledgeSmartConnectCommand).toHaveBeenCalledWith(expect.objectContaining({ id: "navigation-2", ok: false }));
  });
});
