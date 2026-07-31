import { describe, expect, it } from "vitest";
import { normalizeQueueRecovery, previousQueueTarget, shuffledIndices } from "../../../src/renderer/features/music/utils/queueNavigation";

describe("Music queue navigation", () => {
  it("creates a non-repeating shuffle cycle excluding the active track", () => {
    const values = shuffledIndices(5, 2, () => 0.25);
    expect(values).toHaveLength(4);
    expect(new Set(values).size).toBe(4);
    expect(values).not.toContain(2);
  });

  it("restarts after five seconds and otherwise follows listening history", () => {
    expect(previousQueueTarget({ currentTime: 8, currentIndex: 3, history: [1] })).toEqual({ restart: true, index: 3 });
    expect(previousQueueTarget({ currentTime: 2, currentIndex: 3, history: [1] })).toEqual({ restart: false, index: 1 });
    expect(previousQueueTarget({ currentTime: 2, currentIndex: 3, history: [] })).toEqual({ restart: false, index: 2 });
  });
});

describe("Music queue recovery", () => {
  it("preserves the pending shuffle order and drops invalid positions", () => {
    expect(normalizeQueueRecovery({ items: [{ id: "a" }, { id: "b" }, { id: "c" }], index: 1,
      repeat: "all", shuffle: true, history: [0, 8, 2], shuffleBag: [2, -1, 0, 7] })).toEqual({
      items: [{ id: "a" }, { id: "b" }, { id: "c" }], index: 1, repeat: "all", shuffle: true,
      history: [0, 2], shuffleBag: [2, 0],
    });
  });
});
