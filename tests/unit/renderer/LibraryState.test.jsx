import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLibraryState } from "../../../src/renderer/app/hooks/useLibraryState";
import { storage, STORAGE_KEYS } from "../../../src/renderer/services/settingsStore";

describe("library privacy behavior", () => {
  it("does not save progress while watch history is disabled", () => {
    storage.set(STORAGE_KEYS.HISTORY_ENABLED, 0);
    const { result } = renderHook(() =>
      useLibraryState({ librarySort: "manual", setToast: vi.fn() }),
    );

    act(() => result.current.saveProgress("movie_42", 50));

    expect(storage.get(STORAGE_KEYS.WATCH_PROGRESS)).toBeNull();
    expect(result.current.progress).toEqual({});
  });

  it("hides and restores saved history when the preference changes", () => {
    storage.set(STORAGE_KEYS.HISTORY, [{ id: 42, media_type: "movie" }]);
    storage.set(STORAGE_KEYS.WATCH_PROGRESS, { movie_42: 50 });
    const { result } = renderHook(() =>
      useLibraryState({ librarySort: "manual", setToast: vi.fn() }),
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("orion:history-enabled-changed", { detail: false }),
      );
    });
    expect(result.current.history).toEqual([]);
    expect(result.current.progress).toEqual({});

    act(() => {
      window.dispatchEvent(
        new CustomEvent("orion:history-enabled-changed", { detail: true }),
      );
    });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.progress.movie_42).toBe(50);
  });
});
