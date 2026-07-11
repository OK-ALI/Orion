# Architecture overview

Orion has four runtime layers:

1. `src/main` owns Electron lifecycle, sessions, native windows, filesystem access, secure storage, downloader processes, privileged network context, battery monitoring, adaptive performance coordination and Windows media sessions.
2. `src/preload` exposes a constrained compatibility API through `window.electron`.
3. `src/renderer` contains React features, UI state, renderer services, shared UI, and CSS.
4. `src/shared` contains contracts and constants that are safe to reference across boundaries.

The root `index.js` and `preload.js` are deliberately tiny stable shims. The Vite entry is `src/renderer/main.jsx`.

Renderer features own their page, components, and hooks. Movie and TV controllers share low-level utilities but remain separate because their catalog, progress, and episode semantics differ.

Main-process ownership is similarly explicit: `app/tray.js` owns tray state and taskbar download progress, `battery/` owns power status and alerts, `performance/` owns adaptive policy, `player/mediaControls.js` owns Windows media-session integration, and `player/popoutWindow.js` owns the PiP window lifecycle. The AllManga integration separates HTTP transport, title resolution, payload decoding, local serving, and IPC registration.

Orion X Music Planet v2.0.0 is the current stable architecture. Cinema’s v1.0.7–v1.1 work remains intact while Music Planet adds a separate first-party audio boundary:

- `renderer/services/search.js` owns normalized, paginated TMDB multi-search and dedicated person lookup used by Constellation.
- `renderer/features/people/PersonPage.jsx` owns person details, partial/error states, Known For and normalized filmography.
- `renderer/shared/utils/credits.js` owns person, role and job normalization without depending on a page.
- `renderer/shared/hooks/useTitleCredits.js` supplies Movie and TV controllers with cast and key-crew view models.
- `renderer/components/media/PersonCard.jsx` and `CreditsSection.jsx` provide shared keyboard-accessible presentation.
- `renderer/features/people/constellation/` owns the Constellation page, filters, editorial presentation, regional manifests, two-request credit mapper and bounded 24-hour renderer cache.
- `renderer/services/networkStatus.js` measures a small, uncached HTTP round trip to Orion's existing TMDB metadata service; `shared/hooks/useNetworkStatus.js` owns the single 15-second lifecycle and reports a rolling median rather than a noisy one-off value.
- `renderer/services/errors.js` classifies renderer failures and redacts diagnostics before they reach recovery UI.

The custom navigation stack now accepts `person` and `constellation` targets. Constellation preferences are ordinary renderer settings and are included in backup; generated pools remain disposable cache data and are excluded. No new main-process capability, preload method, credential or provider is introduced by v1.1.0.

## Music Planet v2.0 boundary

Music Planet lives under `main/music`, `renderer/features/music`, and `shared/musicConstants.cjs`. It is deliberately separated from Cinema's player and downloader. It owns SQLite library indexing, opaque range streaming, first-party provider contracts, queue/playlists/favorites storage, the audio-reactive renderer and one-owner playback coordination. See [Music Planet architecture](music.md).

Nuclear and Echo are clean-room architecture references only; no third-party source, runtime plugin code or Flutter architecture is included.

The complete remaining implementation sequence is maintained in the [Music Planet Roadmap](../Music-Planet-Roadmap.md).
