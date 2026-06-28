# Orion Roadmap After v1.0.7

## v1.0.8 — Downloader hardening

- Split the remaining downloader monolith into queue/store, engine, proxy, tool manager, progress parser, and IPC modules.
- Add deterministic tests for progress parsing, proxy manifest rewriting, retry classification, queue migration, duplicate tasks, and process-tree termination.
- Add provider-neutral protected-HLS fixtures and automated restart/resume tests.
- Add disk-space and write-permission preflight with clearer recovery actions.

## v1.1.0 — App and Settings architecture

- Split `SettingsPage.jsx` into independently tested section components.
- Split `App.jsx` into app shell, navigation, notifications, update service, download state, and player state hooks.
- Replace broad localStorage access with typed settings schemas and migrations.
- Add active-section tracking and fine-grained jump targets inside large Settings groups.

## v1.2.0 — Offline library

- Reconnect directory scanning and local-file import.
- Match downloaded/local files to TMDB metadata and sidecar subtitles.
- Add downloaded/offline Home rows, storage summaries, bulk actions, and missing-file repair.

## v1.3.0 — Playback polish

- Refactor shared Movie/TV player behavior into common hooks.
- Reintroduce ambient glow only after a low-overhead, cross-origin-safe implementation passes stability testing.
- Improve mini-player, subtitle selection, keyboard navigation, focus management, and reduced-motion coverage.

## v1.4.0 — Discovery and library depth

- Add person/cast search and filmography navigation.
- Add collections, custom lists, richer filters, and better recommendations.
- Add remaining Home rows and collection-aware title relationships.

## Continuous release work

- Keep README/version/build-output claims synchronized with `package.json`.
- Maintain Windows clean-machine smoke tests for installer and ZIP artifacts.
- Add release checks that reject secrets, stale hashed chunks, mojibake, and missing managed-tool metadata.
- Treat macOS/Linux installer parity as a separate milestone; retain PATH-based compatibility meanwhile.
