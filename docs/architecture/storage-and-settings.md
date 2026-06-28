# Storage and settings

Renderer preferences use the unchanged `orion_` local-storage prefix and keys defined by the settings store. User provider keys and optional TMDB overrides use Electron `safeStorage` through IPC.

Settings UI is divided into controls, top-bar navigation, domain sections, and rendered groups. Save timing and event names remain compatible with v1.0.8. v1.0.9 adds motion, ambient, playback-continuity, discovery-region, and additive progress-detail keys.

Backups continue to serialize renderer-owned settings and library state. Downloads remain in the main-process user-data directory. Upgrade tests must use a copy of real data; tests must never mutate a user's active Orion profile.
