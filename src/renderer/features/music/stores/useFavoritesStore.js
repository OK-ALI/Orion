import { useState, useEffect, useCallback } from 'react';

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
    if (!window.electron?.musicToggleFavorite) return;
    try {
      const identity = ref.identity || `${ref.provider || ref.source?.provider || 'unknown'}:${ref.id}`;
      const result = await window.electron.musicToggleFavorite(kind, identity, payload || ref);
      
      // Reload favorites after toggling
      await this.loadFromDisk();
      return result?.favorite;
    } catch (e) {
      console.error(`Failed to toggle favorite ${kind}:`, e);
    }
  },

  async addTrack(track) {
    await this.toggleFavorite('track', track, track);
  },

  async removeTrack(source) {
    await this.toggleFavorite('track', source);
  },

  isTrackFavorite(source) {
    const identity = `${source.provider}:${source.id}`;
    return globalFavorites.tracks.some(t => t.identity === identity);
  },

  async addAlbum(album) {
    await this.toggleFavorite('album', album, album);
  },

  async removeAlbum(source) {
    await this.toggleFavorite('album', source);
  },

  isAlbumFavorite(source) {
    const identity = `${source.provider}:${source.id}`;
    return globalFavorites.albums.some(a => a.identity === identity);
  },

  async addArtist(artist) {
    await this.toggleFavorite('artist', artist, artist);
  },

  async removeArtist(source) {
    await this.toggleFavorite('artist', source);
  },

  isArtistFavorite(source) {
    const identity = `${source.provider}:${source.id}`;
    return globalFavorites.artists.some(art => art.identity === identity);
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
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return {
    ...state,
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
