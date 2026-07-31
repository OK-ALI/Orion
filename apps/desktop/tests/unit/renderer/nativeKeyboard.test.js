import { describe, expect, it, vi } from "vitest";
import { handleNativePlayerKey } from "../../../src/renderer/features/player/services/nativeKeyboard";

function keyEvent(key, extra = {}) {
  return { key, preventDefault: vi.fn(), target: document.body, defaultPrevented: false, ctrlKey: false, metaKey: false, altKey: false, ...extra };
}

describe("native player keyboard controls", () => {
  it("supports YouTube-style seek and percentage shortcuts", () => {
    const video = { currentTime: 50, duration: 100, volume: 1, paused: false };
    handleNativePlayerKey(keyEvent("j"), video);
    expect(video.currentTime).toBe(40);
    handleNativePlayerKey(keyEvent("8"), video);
    expect(video.currentTime).toBe(80);
  });

  it("routes mini-player and episode shortcuts", () => {
    const onMini = vi.fn();
    const onNext = vi.fn();
    const video = { currentTime: 0, duration: 100, volume: 1, paused: false };
    handleNativePlayerKey(keyEvent("i"), video, { onMini });
    handleNativePlayerKey(keyEvent("N", { shiftKey: true }), video, { onNext });
    expect(onMini).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });
});
