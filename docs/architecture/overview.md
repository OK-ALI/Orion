# Architecture overview

Orion has four runtime layers:

1. `src/main` owns Electron lifecycle, sessions, native windows, filesystem access, secure storage, downloader processes, and privileged network context.
2. `src/preload` exposes a constrained compatibility API through `window.electron`.
3. `src/renderer` contains React features, UI state, renderer services, shared UI, and CSS.
4. `src/shared` contains contracts and constants that are safe to reference across boundaries.

The root `index.js` and `preload.js` are deliberately tiny stable shims. The Vite entry is `src/renderer/main.jsx`.

Renderer features own their page, components, and hooks. Movie and TV controllers share low-level utilities but remain separate because their catalog, progress, and episode semantics differ.

Main-process ownership is similarly explicit: `app/tray.js` owns tray state and taskbar download progress, `app/notifications.js` owns native notifications, and `player/popoutWindow.js` owns the PiP window lifecycle. The AllManga integration separates HTTP transport, title resolution, payload decoding, local serving, and IPC registration.
