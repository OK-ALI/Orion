import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../../../src/renderer/features/music/player/AudioEngine", () => ({ default: () => <audio data-testid="engine" /> }));
vi.mock("../../../src/renderer/features/music/stores/musicStores", () => ({
  useFavoritesStore: () => ({}), usePluginStore: () => ({}), useProvidersStore: () => ({}),
}));
import { MusicProvider, MusicConnectionBridge, useMusic } from "../../../src/renderer/features/music/context/MusicProvider";
import MusicTrackList from "../../../src/renderer/features/music/components/MusicTrackList";
import MusicSearch from "../../../src/renderer/features/music/pages/MusicSearch";

const local = { id: "local:1", provider: "local", title: "Local signal", artistName: "Orion" };
const remote = { id: "yt:1", provider: "ytmusic", title: "Remote signal", artistName: "Orion" };
let controller;
function Probe() { controller = useMusic(); return <output>{controller.stream?.error || controller.current?.title || "idle"}</output>; }
function Harness({ connection = "offline", children }) {
  return <MusicProvider><MusicConnectionBridge connectionState={connection} /><Probe />{children}</MusicProvider>;
}

beforeEach(() => {
  window.electron = {
    musicSetConnectionState: vi.fn().mockResolvedValue({ ok: true }),
    musicLoadQueue: vi.fn().mockResolvedValue({ items: [], index: -1 }),
    musicSaveQueue: vi.fn().mockResolvedValue({ ok: true }),
    musicResolveTrack: vi.fn().mockResolvedValue({ ok: true, url: "http://127.0.0.1:1234/opaque" }),
    musicGetArtwork: vi.fn().mockResolvedValue({ ok: false }),
    musicGetLyrics: vi.fn().mockResolvedValue({ ok: true, lyrics: { type: "plain", text: "Local words" } }),
    musicListTracks: vi.fn().mockResolvedValue([local]),
    musicSearch: vi.fn().mockResolvedValue({ results: [], errors: [] }),
  };
});

it("bridges the existing state without remounting the engine or resetting a playing local queue", async () => {
  const view = render(<Harness connection="online" />);
  await act(async () => {});
  act(() => controller.playTrack(local, [local, remote]));
  await waitFor(() => expect(controller.stream?.url).toBeTruthy());
  const engine = screen.getByTestId("engine");
  act(() => controller.setProgress({ currentTime: 42, duration: 100 }));
  view.rerender(<Harness connection="offline" />);
  expect(controller.connectionState).toBe("offline");
  expect(window.electron.musicSetConnectionState).toHaveBeenLastCalledWith("offline");
  expect(screen.getByTestId("engine")).toBe(engine);
  expect(controller.queue).toEqual([local, remote]);
  expect(controller.progress.currentTime).toBe(42);
  expect(window.electron.musicResolveTrack).toHaveBeenCalledTimes(1);
});

it("mixed playlist rows retain order and local play while remote play explains its unavailable state", async () => {
  render(<Harness><MusicTrackList tracks={[local, remote]} /></Harness>);
  await act(async () => {});
  const localPlay = screen.getByRole("button", { name: "Play Local signal by Orion" });
  const remotePlay = screen.getByRole("button", { name: "Play Remote signal by Orion" });
  expect(remotePlay).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByText("Connection required")).toBeInTheDocument();
  localPlay.focus();
  expect(localPlay).toHaveFocus();
  fireEvent.click(localPlay);
  await waitFor(() => expect(controller.stream?.url).toBeTruthy());
  expect(controller.queue).toEqual([local, remote]);
  act(() => controller.playNext());
  await waitFor(() => expect(controller.stream?.error).toMatch(/connection/i));
  expect(controller.queue).toEqual([local, remote]);
  expect(controller.index).toBe(1);
  expect(window.electron.musicResolveTrack).toHaveBeenCalledTimes(1);
});

it("offline Music search remains SQLite-only and announces the remote boundary", async () => {
  render(<Harness><MusicSearch selected={{ query: "Signal" }} onNavigate={vi.fn()} /></Harness>);
  await waitFor(() => expect(window.electron.musicListTracks).toHaveBeenCalled());
  expect(window.electron.musicSearch).not.toHaveBeenCalled();
  expect(await screen.findAllByText("Local signal")).not.toHaveLength(0);
  expect(screen.getByRole("status", { name: "Music availability" })).toHaveTextContent(/connection/i);
  expect(screen.queryByText(/No music matched/)).not.toBeInTheDocument();
});

it("online provider failure is an unavailable state rather than a fake empty or global offline", async () => {
  window.electron.musicSearch.mockResolvedValue({ results: [], errors: ["YouTube unavailable"] });
  render(<Harness connection="degraded"><MusicSearch selected={{ query: "Signal" }} onNavigate={vi.fn()} /></Harness>);
  expect(await screen.findByText(/Some sources did not respond/)).toBeInTheDocument();
  expect(screen.queryByText(/No music matched/)).not.toBeInTheDocument();
  expect(controller.connectionState).toBe("degraded");
});

it("successful remote empty retains the normal empty presentation", async () => {
  render(<Harness connection="online"><MusicSearch selected={{ query: "Absent" }} onNavigate={vi.fn()} /></Harness>);
  expect(await screen.findByText(/No music matched/)).toBeInTheDocument();
  expect(screen.queryByText(/Some sources did not respond/)).not.toBeInTheDocument();
});

it("valid lyrics survive a later provider failure", async () => {
  render(<Harness />);
  await act(async () => {});
  act(() => controller.playTrack(local));
  await act(async () => { await controller.loadLyrics(); });
  window.electron.musicGetLyrics.mockRejectedValue(new Error("Provider unavailable"));
  await act(async () => { await controller.loadLyrics(); });
  expect(controller.lyrics.value?.text).toBe("Local words");
});

it("an offline detail page explains unavailable remote content and radio without a false empty catalog", async () => {
  window.electron.musicGetDetails = vi.fn().mockResolvedValue({ ok: false, error: "Remote Music requires a connection." });
  window.electron.musicListFavorites = vi.fn().mockResolvedValue([]);
  const { default: ArtistPage } = await import("../../../src/renderer/features/music/pages/ArtistPage");
  render(<Harness><ArtistPage selected={{ id: "artist:remote", name: "Remote artist" }} onNavigate={vi.fn()} /></Harness>);
  expect(await screen.findAllByText("Remote Music requires a connection.")).not.toHaveLength(0);
  expect(screen.queryByText("No playable tracks are available from the active sources.")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Radio requires a connection" })).toBeDisabled();
});
