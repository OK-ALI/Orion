# Orion X Music Planet

**A universe made to be felt.**

Orion X Music Planet is a Windows-first Electron application with two connected worlds: Cinema for discovering, streaming and downloading movies, series and anime; and Music Planet for finding, playing and organizing music.

## v2.0.1 release

v2.0.1 is a stability and maintenance update for Orion Cinema. It migrates primary VidSrc and Videasy endpoints to updated provider mirrors (`vsembed.su` and `player.videasy.to`), expands ad-blocking across webview sessions with over 15 new tracking domain filters and DOM overlay cleaners, and repairs experimental sources (VsEmbed and 111Movies).

Music Planet adds an audio-reactive Orb, YouTube Music catalog and discovery, YouTube Audio playback, Local Library, lyrics, playlists, favorites, queue and radio. Cinema retains protected-stream playback, local playback, subtitles, managed downloads, tray behavior, battery-aware behavior and Windows media controls.

Google sign-in is bundled for every user through a central Desktop OAuth client using PKCE. Users sign in with their own Google account; they never need to create or paste Cloud Console credentials. Google Drive backup covers Cinema and Music preferences, playlists, favorites, queue and history, but excludes credentials, caches, signed URLs and machine-specific paths.

See [Music Planet architecture](docs/architecture/music.md) and the [living-world implementation record](docs/Music-Planet-Living-World-Audit-2026-07-10.md).
The v2.0.1 release scope is recorded in the [v2.0.1 release notes](docs/releases/v2.0.1.md) (and [v2.0.0 notes](docs/releases/v2.0.0.md)).

## v2.0.1 highlights

- VidSrc primary endpoint migrated to official updated mirror `vsembed.su` for reliable, ad-free streaming.
- Videasy primary endpoint updated to `player.videasy.to` and tracking host removed from allowed origin manifest.
- Over 15 tracking, font-vector, and ad-redirect domains added to Electron `sessionManager.js` ad-blocking system.
- Webview preload DOM cleaner enhanced to strip `z-index` click-hijack overlays, full-screen popunders, and ad-detector frames.
- VsEmbed and 111Movies experimental sources repaired and VidSrc CC quarantined.

## What's new in v1.0.10

- Invisible Quality, Balanced, and Efficiency adaptation prioritizes streaming under CPU, memory, battery, or buffering pressure.
- Battery status appears in Orion's title bar and tray, with low/critical alerts and resumable critical-battery download pausing.
- Windows media-session support adds Bluetooth headset, speaker, and media-key playback controls plus media-flyout metadata.
- Windows owns Bluetooth/output volume so Volume Up, Volume Down, and Mute work without double volume changes.
- Settings includes redacted local diagnostics for performance, playback pressure, battery state, and downloads.
- The mini-player is now a true 16:9 floating surface with a pop-out-inspired auto-hiding toolbar and theme-aware resize affordance.
- Home rails preserve poster hover lift and glow without clipping.
- Appearance adds live hover intensity, hover-color and glow controls with a themed preview and Reduced Motion-safe feedback.
- Player chrome, overlays, Downloads, local playback and shortcut surfaces share semantic colors across all six themes.
- v1.0.9 playback continuity, ambient safeguards, downloader reliability, and local playback remain intact.

See the complete [v1.0.10 release notes](docs/releases/v1.0.10.md).

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

macOS and Linux retain PATH-based compatibility, but managed-tool installer and Windows media-control parity are not part of v2.0.0.

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

The check suite enforces the compatible IPC surface and retained aliases, rejects unresolved JavaScript/JSX bindings and dependency cycles, scans for committed credentials and new theme-color leaks, fails source files above 800 lines, runs node/renderer tests, and creates a production renderer build.

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
