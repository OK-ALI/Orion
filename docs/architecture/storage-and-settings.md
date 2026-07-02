# Storage and settings

Renderer preferences use the unchanged `orion_` local-storage prefix and keys defined by the settings store. User provider keys and optional TMDB overrides use Electron `safeStorage` through IPC.

Settings UI is divided into controls, top-bar navigation, domain sections, and rendered groups. Save timing and event names remain compatible with existing profiles. v1.0.9 added motion, ambient, playback-continuity, discovery-region and additive progress-detail keys. v1.0.10 adds interaction appearance, battery, adaptive-performance and Windows media-session preferences; these settings apply live and are included in backup/restore where they are not sensitive.

Backups continue to serialize renderer-owned settings and library state. Downloads remain in the main-process user-data directory. Upgrade tests must use a copy of real data; tests must never mutate a user's active Orion profile.
