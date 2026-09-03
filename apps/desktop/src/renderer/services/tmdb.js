/**
 * Desktop TMDB Bridge
 *
 * Bridges the legacy desktop `tmdb.js` API to the new platform-agnostic
 * `@orion/shared` API clients and source registry.
 */

import {
  initTmdbClient,
  initAnilistClient,
  tmdbFetch as sharedTmdbFetch,
  fetchEpisodeGroup as sharedFetchEpisodeGroup,
} from "@orion/shared";

// ── Platform Storage Adapter ──────────────────────────────────────────────────
const localStorageAdapter = {
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
};

// Initialize AniList (no auth required)
initAnilistClient(localStorageAdapter);

// ── Environment config ────────────────────────────────────────────────────────
export const BUNDLED_TMDB_TOKEN = (
  import.meta.env.VITE_TMDB_READ_TOKEN ||
  import.meta.env.VITE_TMDB_TOKEN ||
  ""
).trim();

export function getTmdbTokenSource(userToken) {
  if (userToken) return "user";
  if (BUNDLED_TMDB_TOKEN) return "bundled";
  return "missing";
}

// ── TMDB Init Bridge (Dynamic Auth) ───────────────────────────────────────────
// The legacy desktop codebase passes `apiKey` to `tmdbFetch` on every call.
// The new shared client uses a persistent config. This bridge keeps them in sync.
let currentToken = null;

function ensureTmdbInit(token) {
  if (token && token !== currentToken) {
    currentToken = token;
    initTmdbClient({ apiToken: token, storage: localStorageAdapter });
  }
}

export const tmdbFetch = async (path, apiKey, options = {}) => {
  ensureTmdbInit(apiKey);
  return sharedTmdbFetch(path, options);
};

export const fetchEpisodeGroup = async (groupId, apiKey) => {
  ensureTmdbInit(apiKey);
  return sharedFetchEpisodeGroup(groupId);
};

// ── Re-exports ────────────────────────────────────────────────────────────────
// Export everything else directly from the shared package so existing desktop
// imports (like `imgUrl`, `fetchAnilistData`, source registry constants) keep working.
export * from "@orion/shared/api";
export * from "@orion/shared/sources";

// Reachability must never be satisfied by the shared content response cache.
// The connection owner supplies cancellation and the bounded validation deadline.
export async function validateTmdbService(apiKey, { signal } = {}) {
  const response = await fetch("https://api.themoviedb.org/3/configuration", {
    cache: "no-store",
    signal,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  Promise.resolve(response.body?.cancel?.()).catch(() => {});
  if (!response.ok) {
    const error = new Error("Metadata service unavailable");
    error.status = response.status;
    throw error;
  }
}
