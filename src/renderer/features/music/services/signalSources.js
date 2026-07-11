const SOURCE_DEFINITIONS = [
  {
    id: "youtube-music",
    label: "YouTube Music",
    role: "catalog",
    status: "ready",
    providerIds: ["ytmusic-metadata", "ytmusic-dashboard"],
    description: "Catalog search, artist and album discovery, home sections and radio-style recommendations.",
  },
  {
    id: "youtube-audio",
    label: "YouTube Audio",
    role: "playback",
    status: "ready",
    providerIds: ["ytmusic-streaming"],
    description: "Just-in-time playable audio resolution through Orion's protected music pipeline.",
  },
  {
    id: "lrclib",
    label: "LRCLib",
    role: "lyrics",
    status: "ready",
    providerIds: ["lrclib-lyrics"],
    description: "Plain and synchronized lyrics matched from track title, artist, album and duration.",
  },
  {
    id: "spotify-import",
    label: "Spotify Charts / Import",
    role: "import",
    status: "ready",
    providerIds: ["spotify-charts-dashboard"],
    description: "Public charts are metadata-only. Playlist/album import is pending; Spotify is never a playback source.",
  },
  {
    id: "local-library",
    label: "Local Library",
    role: "local",
    status: "ready",
    providerIds: ["orion-local-metadata", "orion-local-streaming", "orion-embedded-lyrics"],
    description: "User-owned audio folders, local playback, embedded lyrics and sidecar LRC files.",
  },
];

const ROLE_LABELS = {
  catalog: "Catalog",
  playback: "Playback",
  lyrics: "Lyrics",
  import: "Charts / Import",
  local: "Local",
};

/**
 * @typedef {"catalog" | "playback" | "lyrics" | "import" | "local"} MusicSourceRole
 *
 * @typedef {Object} MusicSignalSourceSummary
 * @property {string} id
 * @property {string} label
 * @property {MusicSourceRole} role
 * @property {string} roleLabel
 * @property {"ready" | "adapter pending" | "experimental" | "disabled" | string} setupState
 * @property {{ status?: string, lastError?: string, latencyMs?: number | null }} health
 * @property {number} providerCount
 * @property {boolean} active
 * @property {string} lastError
 * @property {string[]} capabilities
 */

function rankHealth(status) {
  return ({ healthy: 5, unknown: 4, slow: 3, rate_limited: 2, authentication_required: 1, unavailable: 0 })[status] ?? 4;
}

function aggregateHealth(matches) {
  if (!matches.length) return { status: "adapter-pending", lastError: "", latencyMs: null };
  return matches.map((item) => item.health || { status: "unknown" })
    .sort((left, right) => rankHealth(right.status) - rankHealth(left.status))[0];
}

/**
 * Builds the user-facing Echo-aligned source list from registered provider descriptors.
 * @param {Array<{ id: string, active?: boolean, health?: object, capabilities?: string[] }>} providers
 * @returns {MusicSignalSourceSummary[]}
 */
export function buildSignalSources(providers = []) {
  return SOURCE_DEFINITIONS.map((definition) => {
    const matches = providers.filter((provider) => definition.providerIds.includes(provider.id));
    const health = aggregateHealth(matches);
    const ready = matches.length > 0 && definition.status === "ready";
    return {
      ...definition,
      roleLabel: ROLE_LABELS[definition.role] || definition.role,
      providerCount: matches.length,
      active: matches.some((provider) => provider.active),
      health,
      setupState: ready ? "ready" : definition.status === "adapter-pending" ? "adapter pending" : definition.status,
      lastError: health.lastError || "",
      capabilities: matches.flatMap((provider) => provider.capabilities || []),
    };
  });
}

export { ROLE_LABELS, SOURCE_DEFINITIONS };
