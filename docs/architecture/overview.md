# Architecture overview

Orion has four runtime layers:

1. `src/main` owns Electron lifecycle, sessions, native windows, filesystem access, secure storage, downloader processes, privileged network context, battery monitoring, adaptive performance coordination and Windows media sessions.
2. `src/preload` exposes a constrained compatibility API through `window.electron`.
3. `src/renderer` contains React features, UI state, renderer services, shared UI, and CSS.
4. `src/shared` contains contracts and constants that are safe to reference across boundaries.

The root `index.js` and `preload.js` are deliberately tiny stable shims. The Vite entry is `src/renderer/main.jsx`.

Renderer features own their page, components, and hooks. Movie and TV controllers share low-level utilities but remain separate because their catalog, progress, and episode semantics differ.

Main-process ownership is similarly explicit: `app/tray.js` owns tray state and taskbar download progress, `battery/` owns power status and alerts, `performance/` owns adaptive policy, `player/mediaControls.js` owns Windows media-session integration, and `player/popoutWindow.js` owns the PiP window lifecycle. The AllManga integration separates HTTP transport, title resolution, payload decoding, local serving, and IPC registration.

The latest stable architecture baseline is v1.0.10. The v1.1.0 implementation extends renderer metadata and navigation while preserving these Electron and downloader boundaries:

- `renderer/services/search.js` owns normalized, paginated TMDB multi-search.
- `renderer/features/people/PersonPage.jsx` owns person details, partial/error states, Known For and normalized filmography.
- `renderer/shared/utils/credits.js` owns person, role and job normalization without depending on a page.
- `renderer/shared/hooks/useTitleCredits.js` supplies Movie and TV controllers with cast and key-crew view models.
- `renderer/components/media/PersonCard.jsx` and `CreditsSection.jsx` provide shared keyboard-accessible presentation.
- `renderer/features/people/constellation/` owns the Constellation page, filters, editorial presentation, regional manifests, two-request credit mapper and bounded 24-hour renderer cache.

The custom navigation stack now accepts `person` and `constellation` targets. Constellation preferences are ordinary renderer settings and are included in backup; generated pools remain disposable cache data and are excluded. No new main-process capability, preload method, credential or provider is introduced by v1.1.0.
