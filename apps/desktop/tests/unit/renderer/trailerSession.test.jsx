import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTrailerSession } from "../../../src/renderer/features/trailers/hooks/useTrailerSession";

const candidates = [
  { id: "youtube:first", site: "YouTube", providerKey: "first" },
  { id: "vimeo:42", site: "Vimeo", providerKey: "42" },
];

describe("Desktop trailer session", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("falls back from wrapper to direct once, then rotates candidates", () => {
    const { result } = renderHook(() => useTrailerSession(true, candidates));
    expect(result.current.transport).toBe("wrapper");
    expect(result.current.activeCandidate.id).toBe("youtube:first");

    act(() => result.current.handleMessage({ candidateId: "youtube:first", type: "timeout" }));
    expect(result.current.transport).toBe("direct");
    expect(result.current.state).toBe("preparing");

    act(() => result.current.handleMessage({
      candidateId: "youtube:first",
      type: "provider-error",
      detail: { code: 150 },
    }));
    expect(result.current.state).toBe("embed-disabled");

    act(() => vi.advanceTimersByTime(900));
    expect(result.current.activeCandidate.id).toBe("vimeo:42");
    expect(result.current.transport).toBe("wrapper");
  });

  it("ignores stale candidate events and accepts the bounded direct-loaded signal", () => {
    const { result } = renderHook(() => useTrailerSession(true, candidates));

    act(() => result.current.handleMessage({ candidateId: "vimeo:42", type: "playing" }));
    expect(result.current.state).toBe("preparing");

    act(() => result.current.handleMessage({ candidateId: "youtube:first", type: "timeout" }));
    act(() => result.current.handleMessage({ candidateId: "youtube:first", type: "direct-loaded" }));
    expect(result.current.transport).toBe("direct");
    expect(result.current.state).toBe("ready");
  });

  it("returns to wrapper transport on explicit retry", () => {
    const { result } = renderHook(() => useTrailerSession(true, candidates));
    act(() => result.current.handleMessage({ candidateId: "youtube:first", type: "network-error" }));
    expect(result.current.transport).toBe("direct");
    act(() => result.current.retry());
    expect(result.current.transport).toBe("wrapper");
    expect(result.current.state).toBe("preparing");
  });
});
