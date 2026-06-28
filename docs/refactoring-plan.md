# Orion v1.0.8 refactoring plan

## Objective

v1.0.8 is a behavior-preserving architecture release. It keeps the v1.0.7 UI, IPC channels, storage keys, downloader records, secure credentials, navigation, streaming, and tray behavior while reducing the cost and risk of future changes.

## Invariants

- JavaScript and JSDoc only; no TypeScript migration.
- No feature or visual redesign work in this release.
- Every hand-written JS, JSX, CJS, and CSS file must remain at or below 800 lines; 500 lines is the preferred ceiling.
- `window.electron` remains a flat, backward-compatible API through v1.0.8.
- Renderer code never receives cookies, captured request headers, provider keys, executable paths, or arbitrary process arguments.
- Existing `orion_*` local-storage data and v1.0.7 `downloads.json` arrays load without conversion by the user.

## Completed boundaries

1. Safety checks: IPC snapshot, secret scan, source-size gate, cycle detection, node tests, renderer tests, Electron startup smoke test, and Windows workflows.
2. Renderer shell: app navigation, library state, downloads, routes, and overlays are separate hooks/components.
3. Settings: controls, top bar, content groups, and domain sections are isolated without changing markup or storage timing.
4. Main/preload: root entry files are stable shims; preload APIs and main-process handlers are composed by domain.
5. Downloader: paths, browser request context, preflight, HLS proxy, tools, store, subtitle assets, progress/process tracking, and IPC have separate ownership.
6. Movie/TV: thin pages delegate to controller hooks and focused details, player, episode, and overlay components. Movie and TV remain distinct controllers.
7. Secondary modules: AllManga decoder/player server and update changelog rendering are separated.

## Remaining release validation

- Exercise streaming and download providers against live hosts.
- Upgrade a copied v1.0.7 user-data profile and verify secure keys, settings, history, completed downloads, and partial jobs.
- Run installer and ZIP smoke tests on a clean Windows account.
- Capture the six visual baselines listed in `testing.md`.
- Publish only after the release checklist passes; this document does not authorize publishing.

## Final ownership rules

- Feature folders may import shared components, services, shared utilities, and their own internals.
- A feature must not import another feature's internal components or hooks.
- Pages do not import pages.
- Electron-only modules stay below `src/main` or `src/preload`.
- Renderer services must not import Electron directly; they use the preload contract.
- Structural moves, formatting changes, and behavior changes belong in separate commits.

## Final source layout

```text
src/
├── main/
│   ├── app/                    # tray and native notifications
│   ├── downloader/             # capture, proxy, tools, records, processes, IPC
│   ├── ipc/                    # storage, filesystem, diagnostics, block stats
│   ├── player/
│   │   ├── allmanga/           # client, resolver, decoder, server, IPC
│   │   ├── ipc.js
│   │   ├── popoutWindow.js
│   │   └── sessionManager.js
│   ├── subtitles/              # service, archive extraction, IPC
│   └── bootstrap.js
├── preload/
│   ├── api/                    # flat compatibility API composed by domain
│   └── index.js
├── renderer/
│   ├── app/                    # shell, routes, overlays, application hooks
│   ├── components/             # shared common/layout/media/modal UI
│   ├── features/               # discover, downloads, home, library, movie, TV, settings
│   ├── services/               # TMDB, settings/secure storage, backup
│   ├── shared/                 # cross-feature hooks and utilities
│   ├── styles/                 # tokens, global rules, ordered component parts
│   └── main.jsx
└── shared/                     # IPC/runtime constants and JSDoc contracts
```

Root `index.js` and `preload.js` remain compatibility shims. Downloader research projects live under `references/downloader` and are excluded from production packaging.
