import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../../../src/renderer/features/music/visual/MusicPlanetSceneEngine", () => ({ default: () => null }));
import { useMusicDashboard } from "../../../src/renderer/features/music/MusicPlanet";
beforeEach(() => { window.electron = { musicGetDashboard: vi.fn().mockResolvedValue({ ok: true, dashboard: { sections: [] } }) }; });
it("refreshes remote discovery once for each changed recovery epoch", async () => {
  const view = renderHook(({ localOnly, epoch }) => useMusicDashboard(localOnly, epoch), { initialProps: { localOnly: true, epoch: 0 } });
  expect(window.electron.musicGetDashboard).not.toHaveBeenCalled();
  view.rerender({ localOnly: false, epoch: 1 });
  await waitFor(() => expect(view.result.current.status).toBe("ready"));
  expect(window.electron.musicGetDashboard).toHaveBeenCalledTimes(1);
  view.rerender({ localOnly: false, epoch: 1 });
  expect(window.electron.musicGetDashboard).toHaveBeenCalledTimes(1);
  view.rerender({ localOnly: false, epoch: 2 });
  await waitFor(() => expect(window.electron.musicGetDashboard).toHaveBeenCalledTimes(2));
});
it("a dashboard response from before offline cannot publish remote capability", async () => {
  let finish;
  window.electron.musicGetDashboard.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const view = renderHook(({ localOnly }) => useMusicDashboard(localOnly), { initialProps: { localOnly: false } });
  view.rerender({ localOnly: true });
  await act(async () => finish({ ok: true, dashboard: { sections: [] } }));
  expect(view.result.current.status).toBe("error");
  expect(view.result.current.value).toBeNull();
});
