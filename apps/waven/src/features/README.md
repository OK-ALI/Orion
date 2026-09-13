# WAVEN feature boundaries

- `account/`: shared Orion identity presentation and account lifecycle.
- `cloud/`: WAVEN domain synchronization over the shared Orion Cloud profile contract.
- `discovery/`: home, recommendations, charts, and provider-backed browsing.
- `library/`: local-first favorites, albums, artists, playlists, and listening history.
- `playback/`: queue, player state, background audio, Android MediaSession, and recovery.
- `search/`: normalized query, result, pagination, and failure states.

Feature implementations must depend on domain contracts instead of importing Electron IPC, DOM audio, Node filesystem, or Cinema-only native modules.
