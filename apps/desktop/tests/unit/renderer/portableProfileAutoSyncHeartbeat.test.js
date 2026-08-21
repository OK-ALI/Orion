import { describe, expect, it, vi } from "vitest";
import {
  PORTABLE_PROFILE_AUTO_SYNC_HEARTBEAT_MS,
  startPortableProfileAutoSyncHeartbeat,
} from "../../../src/renderer/services/portableProfileAutoSyncHeartbeat";

describe("Desktop portable-profile auto-sync heartbeat", () => {
  it("stagger-checks an open Desktop for remote changes without replacing local-change triggers", async () => {
    const reconcile = vi.fn(() => Promise.resolve());
    let firstTick = null;
    let intervalTick = null;
    let firstDelay = null;
    let intervalDelay = null;
    const stop = startPortableProfileAutoSyncHeartbeat("myList", reconcile, {
      setTimeoutImpl: (callback, delay) => { firstTick = callback; firstDelay = delay; return 1; },
      clearTimeoutImpl: vi.fn(),
      setIntervalImpl: (callback, delay) => { intervalTick = callback; intervalDelay = delay; return 2; },
      clearIntervalImpl: vi.fn(),
      isVisible: () => true,
    });

    expect(firstDelay).toBe(3000);
    firstTick();
    await Promise.resolve();
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(intervalDelay).toBe(PORTABLE_PROFILE_AUTO_SYNC_HEARTBEAT_MS);
    intervalTick();
    await Promise.resolve();
    expect(reconcile).toHaveBeenCalledTimes(2);
    stop();
  });

  it("stagger-separates the three domains and skips polling while the Desktop is hidden", async () => {
    const delays = {};
    const callbacks = {};
    const makeTimer = (domain) => (callback, delay) => { callbacks[domain] = callback; delays[domain] = delay; return domain; };
    const noop = () => {};
    let visible = false;
    const calls = { myList: 0, watched: 0, viewingActivity: 0 };

    for (const domain of Object.keys(calls)) {
      startPortableProfileAutoSyncHeartbeat(domain, () => { calls[domain] += 1; }, {
        setTimeoutImpl: makeTimer(domain),
        clearTimeoutImpl: noop,
        setIntervalImpl: noop,
        clearIntervalImpl: noop,
        isVisible: () => visible,
      });
    }

    expect(delays).toEqual({ myList: 3000, watched: 9000, viewingActivity: 15000 });
    callbacks.myList(); callbacks.watched(); callbacks.viewingActivity();
    await Promise.resolve();
    expect(calls).toEqual({ myList: 0, watched: 0, viewingActivity: 0 });
    visible = true;
    callbacks.myList(); callbacks.watched(); callbacks.viewingActivity();
    await Promise.resolve();
    expect(calls).toEqual({ myList: 1, watched: 1, viewingActivity: 1 });
  });
});
