import React from "react";
import { act, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MusicProvider, useMusic } from "../../../src/renderer/features/music/context/MusicProvider";
import { getRemoteMusicSession } from "../../../src/renderer/features/music/services/remoteMusicSession";

vi.mock("../../../src/renderer/features/music/player/AudioEngine", () => ({ default: () => null }));
vi.mock("../../../src/renderer/features/music/stores/musicStores", () => ({
  useFavoritesStore: () => ({}), usePluginStore: () => ({}), useProvidersStore: () => ({}),
}));

it("a delayed track resolution cannot revive Music after Stop", async () => {
  let resolveTrack;
  window.electron = { musicResolveTrack: vi.fn(() => new Promise((resolve) => { resolveTrack = resolve; })) };
  let music;
  function Probe() { music = useMusic(); return null; }
  const view = render(<MusicProvider><Probe /></MusicProvider>);
  await act(async () => { music.playTrack({ id: "pending", provider: "local", title: "Pending" }); });
  expect(music.playbackStatus).toBe("loading");
  music.engineRef.current = { stop: () => true };
  act(() => { music.stop(); });
  await act(async () => { resolveTrack({ ok: true, url: "file:///late-track" }); });
  expect(music.playbackStatus).toBe("idle");
  expect(music.playing).toBe(false);
  expect(music.stream).toBeNull();
  expect(getRemoteMusicSession()).toBeNull();
  view.unmount();
});
