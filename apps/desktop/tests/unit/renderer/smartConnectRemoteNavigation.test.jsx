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

  it("routes send_text to the correct search area based on active page context", async () => {
    const constellationListener = vi.fn();
    const settingsListener = vi.fn();
    const musicListener = vi.fn();
    window.addEventListener("orion:constellation-search", constellationListener);
    window.addEventListener("orion:settings-search", settingsListener);
    window.addEventListener("orion:music-search", musicListener);

    try {
      // Test Constellation context
      const { receive: receiveConstellation } = setup({ pageRef: { current: "constellation" } });
      await act(async () => receiveConstellation({ id: "type-1", action: "send_text", value: "Nolan" }));
      expect(constellationListener).toHaveBeenCalledWith(expect.objectContaining({ detail: "Nolan" }));

      // Test Settings context
      const { receive: receiveSettings } = setup({ pageRef: { current: "settings" } });
      await act(async () => receiveSettings({ id: "type-2", action: "send_text", value: "Subtitles" }));
      expect(settingsListener).toHaveBeenCalledWith(expect.objectContaining({ detail: "Subtitles" }));

      // Test Music Planet context
      const musicNavigate = vi.fn(async () => {});
      const { receive: receiveMusic } = setup({ pageRef: { current: "music-home" }, baseNavigate: musicNavigate });
      await act(async () => receiveMusic({ id: "type-3", action: "send_text", value: "Hans Zimmer" }));
      expect(musicListener).toHaveBeenCalledWith(expect.objectContaining({ detail: "Hans Zimmer" }));
      expect(musicNavigate).toHaveBeenCalledWith("music-search", { query: "Hans Zimmer" });

      // Test Cinema default
      const cinemaNavigate = vi.fn(async () => {});
      const setShowSearch = vi.fn();
      const { receive: receiveCinema } = setup({ pageRef: { current: "home" }, baseNavigate: cinemaNavigate, setShowSearch });
      await act(async () => receiveCinema({ id: "type-4", action: "send_text", value: "Inception" }));
      expect(setShowSearch).toHaveBeenCalledWith(true);
      expect(cinemaNavigate).toHaveBeenCalledWith("search", "Inception");
    } finally {
      window.removeEventListener("orion:constellation-search", constellationListener);
      window.removeEventListener("orion:settings-search", settingsListener);
      window.removeEventListener("orion:music-search", musicListener);
    }
  });

  it("supports deltaX horizontal scrolling in remote scroll handler", async () => {
    const { receive } = setup();
    const scrollContainer = document.createElement("div");
    scrollContainer.className = "app-content";
    scrollContainer.scrollBy = vi.fn();
    document.body.appendChild(scrollContainer);

    try {
      await act(async () => receive({ id: "scroll-1", action: "scroll", value: { deltaX: 45, deltaY: 0 } }));
      expect(scrollContainer.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 45 }));
    } finally {
      scrollContainer.remove();
    }
  });

  it("updates active input live without pressing Enter unless submit is true", async () => {
    const { receive } = setup();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const inputEvents = [];
    const keydownEvents = [];
    input.addEventListener("input", () => inputEvents.push(input.value));
    input.addEventListener("keydown", (e) => keydownEvents.push(e.key));

    try {
      // Live typing: submit false
      await act(async () => receive({ id: "type-live-1", action: "send_text", value: { text: "Dune", submit: false } }));
      expect(input.value).toBe("Dune");
      expect(inputEvents).toContain("Dune");
      expect(keydownEvents).toHaveLength(0); // No Enter dispatched

      // Explicit submission: submit true
      await act(async () => receive({ id: "type-submit-1", action: "send_text", value: { text: "Dune Part Two", submit: true } }));
      expect(input.value).toBe("Dune Part Two");
      expect(keydownEvents).toContain("Enter"); // Enter dispatched
    } finally {
      input.remove();
    }
  });

  it("updates search input directly when already on search route instead of pushing history", async () => {
    const baseNavigate = vi.fn(async () => {});
    const { receive } = setup({ pageRef: { current: "search" }, baseNavigate });

    const searchBar = document.createElement("input");
    searchBar.className = "search-input-full";
    document.body.appendChild(searchBar);

    try {
      await act(async () => receive({ id: "type-live-2", action: "send_text", value: { text: "Interstellar", submit: false } }));
      expect(searchBar.value).toBe("Interstellar");
      expect(baseNavigate).not.toHaveBeenCalled(); // Preserves navStack!
    } finally {
      searchBar.remove();
    }
  });

  it("advances MediaCarousel when remote horizontal scroll deltaX is received", async () => {
    const { receive } = setup();

    const carousel = document.createElement("div");
    carousel.className = "media-carousel-section";
    carousel.getBoundingClientRect = () => ({
      top: 200,
      bottom: 500,
      left: 0,
      right: 1200,
      width: 1200,
      height: 300,
    });

    const wrapper = document.createElement("div");
    wrapper.className = "media-carousel-wrapper";

    const nextBtn = document.createElement("button");
    nextBtn.className = "media-carousel-btn right";
    const nextClick = vi.fn();
    nextBtn.addEventListener("click", nextClick);

    const prevBtn = document.createElement("button");
    prevBtn.className = "media-carousel-btn left";
    const prevClick = vi.fn();
    prevBtn.addEventListener("click", prevClick);

    wrapper.appendChild(prevBtn);
    wrapper.appendChild(nextBtn);
    carousel.appendChild(wrapper);
    document.body.appendChild(carousel);

    try {
      // Swiping to scroll right / show next item (deltaX >= 28)
      await act(async () => receive({ id: "scroll-fwd", action: "scroll", value: { deltaX: 45, deltaY: 0 } }));
      expect(nextClick).toHaveBeenCalledOnce();

      // Swiping to scroll left / show previous item (deltaX <= -28)
      await act(async () => receive({ id: "scroll-bwd", action: "scroll", value: { deltaX: -45, deltaY: 0 } }));
      expect(prevClick).toHaveBeenCalledOnce();
    } finally {
      carousel.remove();
    }
  });
});

