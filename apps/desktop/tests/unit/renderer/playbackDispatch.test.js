import { afterEach, expect, it, vi } from "vitest";
import { dispatchPlaybackCommand } from "../../../src/main/smartConnect/playbackDispatch";

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
it.each([[undefined, 1800], [1, 6000]])("uses the negotiated Play deadline (%s)", async (version, timeout) => {
  vi.useFakeTimers();
  const pending = new Map();
  const notify = vi.fn();
  const command = { id: "play", action: "play", playbackProtocolVersion: version, sequence: 1 };
  const result = dispatchPlaybackCommand(command, {}, pending, notify, 1800);
  expect(command.deadlineAt).toBe(Date.now() + timeout);
  await vi.advanceTimersByTimeAsync(timeout - 1);
  expect(pending.size).toBe(1);
  await vi.advanceTimersByTimeAsync(1);
  expect((await result).ok).toBe(false);
  expect(pending.size).toBe(0);
  expect(notify).toHaveBeenLastCalledWith("orion:remote-command", { action: "cancel_playback_operation", id: "play" });
});
