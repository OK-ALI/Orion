# Orion v1.0.7 — Downloader Recovery Release

## Release contract

v1.0.7 restores Orion's managed downloader as a supported feature. The release is Windows-first and must work on a clean machine without Python, system `yt-dlp`, or system `ffmpeg`.

The Settings wiring audit is recorded in [settings-audit-v1.0.7.md](settings-audit-v1.0.7.md).

Configuration rules:

- TMDB is bundled into official builds through `VITE_TMDB_READ_TOKEN`; users are not required to configure it.
- SubDL and Wyzie credentials are always per-user and stored with Electron `safeStorage`.
- `.env` and every provider credential remain excluded from source control and release resources.

## Included

- Stream candidate capture, ranking, expiry, and preflight.
- Managed `yt-dlp` and `ffmpeg` installation, health checks, repair, and update controls.
- Direct captured-context downloads and Electron-session HLS proxy fallback.
- Movie and episodic folder organization with collision-safe names.
- Quality presets, fragment concurrency, retries, continuation, and Windows process-tree cleanup.
- Persistent active, completed, failed, paused, and interrupted records.
- Functional Downloads page with progress, diagnostics, retry, pause, resume, cancel, reveal, playback, and removal.
- SubDL/Wyzie subtitle search with sidecar subtitle files and completed-download subtitle management.
- Background downloads through the Windows system tray, including hover progress, right-click progress, per-job pause, pause-all, and taskbar progress.
- Settings repairs for close-behavior persistence, compact grids, reduced animation, subtitle onboarding, and downloader controls.

## Acceptance checklist

- [ ] Fresh Windows VM with no Python, `yt-dlp`, or `ffmpeg` installed.
- [ ] NSIS install and ZIP launch both start successfully.
- [ ] Bundled TMDB token reaches Home, Movie, and TV pages without setup.
- [ ] Managed tools install, verify, repair, and recover from an interrupted installation.
- [ ] Movie and TV episode downloads produce playable MP4 files at the selected quality.
- [ ] A long 1080p download with 1,000+ fragments survives transient timeouts and resumes after interruption.
- [ ] Both previously failing protected providers complete through direct or Electron-session proxy strategy.
- [ ] Closing the main window keeps active downloads running in the tray.
- [ ] Tray tooltip/menu and Windows taskbar show accurate progress; tray pause preserves resumable partial files.
- [ ] SubDL and Wyzie each work with a user-provided key and save correctly named sidecar subtitles.
- [ ] No cookies, stream tokens, TMDB token, or subtitle API keys appear in logs, diagnostics, source control, or release resources.
- [ ] Settings jump navigation reaches every top-level group and all saved appearance/behavior options survive relaunch.
- [ ] `npm test` and `npm run build` pass.

## GitHub release structure

Follow the established release naming:

- Tag: `v1.0.7`
- Release title: `Orion v1.0.7`
- Assets: `Orion.Setup.1.0.7.exe` and `Orion-1.0.7-win.zip`

Do not publish the release until the clean-machine checklist is complete.
