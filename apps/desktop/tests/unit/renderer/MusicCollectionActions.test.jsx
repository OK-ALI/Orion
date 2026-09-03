import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("../../../src/renderer/features/music/context/MusicProvider", () => ({ useMusic: () => ({ playTrack: vi.fn() }) }));
vi.mock("../../../src/renderer/features/music/components/MusicTrackList", () => ({ default: () => null }));
vi.mock("../../../src/renderer/features/music/components/PlaylistArtwork", () => ({ default: () => null }));
import PlaylistsPage from "../../../src/renderer/features/music/pages/PlaylistsPage";
import AddToPlaylistDialog from "../../../src/renderer/features/music/components/AddToPlaylistDialog";
import ToastContainer from "../../../src/renderer/components/layout/Toast";
import { favoritesStore } from "../../../src/renderer/features/music/stores/useFavoritesStore";

let playlists;
let folders;
beforeEach(() => {
  playlists = [{ id: "kept", name: "Everyday Taste", items: [{ id: "song", title: "Song", provider: "test" }], folderId: "folder" }];
  folders = [{ id: "folder", name: "Everyday" }];
  window.electron = {
    musicListPlaylists: vi.fn(async () => playlists),
    musicListPlaylistFolders: vi.fn(async () => folders),
    musicSavePlaylist: vi.fn(async (p) => { const saved = { ...p, id: p.id || "new" }; playlists = [...playlists.filter((x) => x.id !== saved.id), saved]; return saved; }),
    musicDeletePlaylist: vi.fn(async (id) => { playlists = playlists.filter((p) => p.id !== id); return { ok: true }; }),
    musicDeletePlaylistFolder: vi.fn(async () => { folders = []; playlists = playlists.map((p) => ({ ...p, folderId: null })); return { ok: true }; }),
    musicSavePlaylistFolder: vi.fn(async (f) => ({ ok: true, folder: { ...f, id: "new-folder" } })),
    musicListFavorites: vi.fn(async () => []),
    musicToggleFavorite: vi.fn(async () => ({ favorite: true })),
  };
});
const show = () => render(<><PlaylistsPage /><ToastContainer /></>);

test("visible Delete playlist requires in-app confirmation; Cancel preserves the playlist and focus", async () => {
  show();
  const remove = await screen.findByRole("button", { name: "Delete playlist", exact: true });
  remove.focus(); fireEvent.click(remove);
  const dialog = screen.getByRole("dialog", { name: "Delete playlist?" });
  expect(within(dialog).getByText(/music files.*not.*deleted/i)).toBeInTheDocument();
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(window.electron.musicDeletePlaylist).not.toHaveBeenCalled();
  expect(remove).toHaveFocus();
  fireEvent.click(remove);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete playlist", exact: true }));
  await waitFor(() => expect(window.electron.musicDeletePlaylist).toHaveBeenCalledWith("kept"));
  await screen.findByText("Everyday Taste deleted.");
  expect(playlists).toHaveLength(0);
});

test("failed deletion stays open with actionable feedback and preserves local content", async () => {
  window.electron.musicDeletePlaylist.mockResolvedValue({ ok: false });
  show(); fireEvent.click(await screen.findByRole("button", { name: "Delete playlist", exact: true }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete playlist", exact: true }));
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be deleted");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(playlists).toHaveLength(1);
});

test("new playlist save is single-flight and acknowledges only confirmed persistence", async () => {
  let finish;
  window.electron.musicSavePlaylist.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  show(); fireEvent.click(screen.getByRole("button", { name: "New playlist" }));
  const dialog = screen.getByRole("dialog", { name: "Playlist details" });
  expect(within(dialog).getByLabelText("Name")).toHaveFocus();
  fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Night drive" } });
  const save = within(dialog).getByRole("button", { name: "Save", exact: true });
  fireEvent.click(save); fireEvent.click(save);
  expect(window.electron.musicSavePlaylist).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Night drive created.")).not.toBeInTheDocument();
  await act(async () => finish({ id: "new", name: "Night drive", items: [] }));
  expect(await screen.findByText("Night drive created.")).toBeInTheDocument();
});

test("folder deletion is explicit and keeps its playlists", async () => {
  show(); fireEvent.click(await screen.findByRole("button", { name: /^Everyday\s*1$/ }));
  fireEvent.click(screen.getByRole("button", { name: "Delete folder", exact: true }));
  const dialog = screen.getByRole("dialog", { name: "Delete folder?" });
  expect(within(dialog).getByText(/Unfiled/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete folder", exact: true }));
  await screen.findByText("Everyday deleted.");
  expect(playlists).toHaveLength(1);
  expect(playlists[0].folderId).toBeNull();
});

test("favourite changes acknowledge confirmed add/remove, coalesce repeat clicks, and report failures honestly", async () => {
  render(<ToastContainer />);
  let finish;
  window.electron.musicToggleFavorite.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const track = { id: "song", provider: "test", title: "Song" };
  let first; let second;
  act(() => { first = favoritesStore.toggleFavorite("track", track); second = favoritesStore.toggleFavorite("track", track); });
  expect(window.electron.musicToggleFavorite).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ favorite: true }); await Promise.all([first, second]); });
  expect(screen.getAllByText("Song added to favorites.")).toHaveLength(1);
  expect(screen.getByText("Song added to favorites.").closest('[role="status"]')).toHaveAttribute("aria-live", "polite");
  window.electron.musicToggleFavorite.mockResolvedValueOnce({ favorite: false });
  await act(async () => favoritesStore.toggleFavorite("track", track));
  expect(screen.getByText("Song removed from favorites.")).toBeInTheDocument();
  window.electron.musicToggleFavorite.mockRejectedValueOnce(new Error("private diagnostic"));
  await act(async () => favoritesStore.toggleFavorite("track", track));
  expect(screen.getByText("Favorites could not be updated. Please try again.")).toBeInTheDocument();
  expect(screen.queryByText("private diagnostic")).not.toBeInTheDocument();
});

test("adding an existing playlist track acknowledges already present without duplicating it", async () => {
  const close = vi.fn();
  render(<><AddToPlaylistDialog track={playlists[0].items[0]} close={close} /><ToastContainer /></>);
  fireEvent.click(await screen.findByRole("button", { name: /Everyday Taste/ }));
  expect(window.electron.musicSavePlaylist).not.toHaveBeenCalled();
  expect(await screen.findByText("Song is already in Everyday Taste.")).toBeInTheDocument();
  expect(close).toHaveBeenCalledOnce();
});

test.each(["add", "create"])("%s playlist rejection hides private IPC diagnostics", async (operation) => {
  window.electron = {
    musicListPlaylists: vi.fn(async () => [{ id: "existing", name: "Kept list", items: [] }]),
    musicSavePlaylist: vi.fn().mockRejectedValue(new Error("SQLITE failure at C:/Users/private/music-library.sqlite; token=private-token")),
  };
  const close = vi.fn();
  render(<><AddToPlaylistDialog track={{ id: "track", provider: "local", title: "Song" }} close={close} /><ToastContainer /></>);
  if (operation === "add") {
    fireEvent.click(await screen.findByRole("button", { name: /Kept list/ }));
  } else {
    fireEvent.click(await screen.findByRole("button", { name: "Create new playlist", exact: true }));
    fireEvent.change(screen.getByPlaceholderText("My playlist"), { target: { value: "New list" } });
    fireEvent.click(screen.getByRole("button", { name: "Create & Add", exact: true }));
  }
  const alert = await screen.findByRole("alert");
  expect(alert).not.toHaveTextContent(/SQLITE|Users\/private|private-token/);
  expect(alert).toHaveTextContent(/could not.*try again/i);
  expect(close).not.toHaveBeenCalled();
  expect(document.querySelectorAll(".toast")).toHaveLength(0);
});
