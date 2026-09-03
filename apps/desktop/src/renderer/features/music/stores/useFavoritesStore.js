import { useState, useEffect, useCallback } from 'react';
import { favoriteIdentity } from "../utils/favorites";
import { showToast } from "../../../components/layout/Toast";

const pendingFavorites = new Map();

const listeners = new Set();
let globalFavorites = { tracks: [], albums: [], artists: [], loaded: false };

const notify = () => {
  listeners.forEach(listener => listener(globalFavorites));
};

export const favoritesStore = {
  get state() {
    return globalFavorites;
  },

  async loadFromDisk() {
    if (!window.electron?.musicListFavorites) return;
    try {
      const items = await window.electron.musicListFavorites() || [];
      const tracks = items.filter(i => i.kind === 'track');
      const albums = items.filter(i => i.kind === 'album');
      const artists = items.filter(i => i.kind === 'artist');
      globalFavorites = { tracks, albums, artists, loaded: true };
      notify();
    } catch (e) {
      console.error("Failed to load favorites:", e);
    }
  },

  async toggleFavorite(kind, ref, payload) {
    const identity = favoriteIdentity(ref);
    const key = `${kind}:${identity}`;
    if (pendingFavorites.has(key)) return pendingFavorites.get(key);
    const request = (async () => {
      try {
        const result = await window.electron?.musicToggleFavorite?.(kind, identity, payload || ref);
        if (typeof result?.favorite !== "boolean") throw new Error("Favorite update failed");
        await this.loadFromDisk();
        const title = payload?.title || payload?.name || ref?.title || ref?.name || (kind === "track" ? "Track" : kind === "album" ? "Album" : "Artist");
        const action = kind === "artist" ? (result.favorite ? "followed" : "unfollowed")
          : result.favorite ? "added to favorites" : "removed from favorites";
        showToast(`${title} ${action}.`, "success");
        return result.favorite;
      } catch {
        showToast("Favorites could not be updated. Please try again.", "error");
        return undefined;
      } finally {
        pendingFavorites.delete(key);
      }
    })();
    pendingFavorites.set(key, request);
    return request;
  },

  async addTrack(track) {
    await this.toggleFavorite('track', track, track);
  },

  async removeTrack(source) {
    await this.toggleFavorite('track', source);
  },

  isTrackFavorite(source) {
    const identity = favoriteIdentity(source);
    return Boolean(identity) && globalFavorites.tracks.some((item) => item.identity === identity);
  },

  async addAlbum(album) {
    await this.toggleFavorite('album', album, album);
  },

  async removeAlbum(source) {
    await this.toggleFavorite('album', source);
  },

  isAlbumFavorite(source) {
    const identity = favoriteIdentity(source);
    return Boolean(identity) && globalFavorites.albums.some((item) => item.identity === identity);
  },

  async addArtist(artist) {
    await this.toggleFavorite('artist', artist, artist);
  },

  async removeArtist(source) {
    await this.toggleFavorite('artist', source);
  },

  isArtistFavorite(source) {
    const identity = favoriteIdentity(source);
    return Boolean(identity) && globalFavorites.artists.some((item) => item.identity === identity);
  }
};

// Initialize the store
favoritesStore.loadFromDisk();

export function useFavoritesStore() {
  const [state, setState] = useState(globalFavorites);

  useEffect(() => {
    listeners.add(setState);
    if (!globalFavorites.loaded) {
      favoritesStore.loadFromDisk();
    }
    const refreshAfterBackup = () => favoritesStore.loadFromDisk();
    window.addEventListener('orion:music-backup-restored', refreshAfterBackup);
    return () => {
      listeners.delete(setState);
      window.removeEventListener('orion:music-backup-restored', refreshAfterBackup);
    };
  }, []);

  return {
    ...state,
    toggleFavorite: useCallback((kind, ref, payload) => favoritesStore.toggleFavorite(kind, ref, payload), []),
    addTrack: useCallback((track) => favoritesStore.addTrack(track), []),
    removeTrack: useCallback((source) => favoritesStore.removeTrack(source), []),
    isTrackFavorite: useCallback((source) => favoritesStore.isTrackFavorite(source), []),
    addAlbum: useCallback((album) => favoritesStore.addAlbum(album), []),
    removeAlbum: useCallback((source) => favoritesStore.removeAlbum(source), []),
    isAlbumFavorite: useCallback((source) => favoritesStore.isAlbumFavorite(source), []),
    addArtist: useCallback((artist) => favoritesStore.addArtist(artist), []),
    removeArtist: useCallback((source) => favoritesStore.removeArtist(source), []),
    isArtistFavorite: useCallback((source) => favoritesStore.isArtistFavorite(source), []),
    loadFromDisk: useCallback(() => favoritesStore.loadFromDisk(), [])
  };
}
