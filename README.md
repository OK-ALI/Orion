# Orion — A Multiverse of Stories

Orion is a Windows-first Electron application for discovering, streaming, downloading, and tracking movies, TV series, and anime.

The v1.0.9 working tree is the Cosmic Polish and Playback Continuity release candidate, built on the completed v1.0.8 behavior-preserving refactor. It is not ready to publish until the v1.0.9 release checklist passes.

## Features

- Movie, TV, and anime discovery powered by TMDB metadata.
- Embedded, mini, pop-out, and restricted local playback with state handoffs, progress, resume, fullscreen, subtitles, and ambient glow.
- Managed `yt-dlp` and ffmpeg downloads with HLS capture, browser-session proxy fallback, pause/resume/retry, tray progress, and organized Movie/Series folders.
- Sidecar subtitle search and download through user-configured SubDL or Wyzie credentials.
- Watchlist, history, watched state, backups, appearance preferences, and update checks.
- OS-protected storage for user provider keys and optional TMDB overrides.

DRM circumvention is not supported. Download only media you are authorized to access.

## Requirements

- Windows 10 or later for the fully supported desktop and managed-tool workflow.
- Node.js 22 or later for local development.
- npm 10 or later.

macOS and Linux retain PATH-based compatibility, but managed-tool installer parity is not part of v1.0.9.

## Run locally

```powershell
git clone https://github.com/OK-ALI/orion.git
cd orion
npm.cmd ci
npm.cmd start
```

Use `npm.cmd` in PowerShell if script execution policy blocks `npm.ps1`.

Orion uses its bundled TMDB read token when available. SubDL and Wyzie keys belong to each user and are configured in Settings. Local `.env` files are private and excluded from Git.

## Verify the refactor

```powershell
npm.cmd run check
npm.cmd run test:electron
```

The check suite enforces the additive v1.0.9 IPC surface and retained aliases, rejects unresolved JavaScript/JSX bindings and dependency cycles, scans for committed credentials, fails source files above 800 lines, runs node/renderer tests, and creates a production renderer build.

## Package Windows builds

```powershell
npm.cmd run dist:win
```

Artifacts are written to `release/`. Packaging does not publish a GitHub release.

## Architecture

- `src/main`: Electron lifecycle, windows, native IPC, sessions, downloader, player, and subtitles.
- `src/preload`: domain-based APIs composed into the compatible flat `window.electron` bridge.
- `src/renderer`: app shell, features, components, services, shared utilities, and styles.
- `src/shared`: cross-boundary contracts and runtime constants.
- `tests`: unit, integration, Electron, fixtures, and future visual baselines.

See [architecture overview](docs/architecture/overview.md), [refactoring plan](docs/refactoring-plan.md), and [testing guide](docs/testing.md).

## Security

Do not commit `.env`, user data, logs, managed tools, `dist/`, `release/`, or `node_modules/`. Provider keys, cookies, captured headers, executable paths, and spawn arguments must remain main-process-only.

## License

GPL-3.0.
