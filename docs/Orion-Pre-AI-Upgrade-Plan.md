# Orion pre-AI roadmap

**Baseline:** v1.0.8
**Current milestone:** v1.0.9 — Cosmic Polish and Playback Continuity
**Next milestone:** v1.1.0 — Search + Cast Metadata
**Audit date:** June 2026

## Product direction

Orion should be a reliable, distinctive desktop media application before AI features become part of its identity. Downloader recovery and the behavior-preserving architecture refactor are complete. The current work improves continuity, local playback, discovery, accessibility, and visual consistency without adding AI or DRM circumvention.

## Completed foundations

### v1.0.7 — downloader recovery

- Managed Windows installation of pinned `yt-dlp` and ffmpeg tools.
- HLS capture with private browser headers/cookies and a restricted loopback proxy fallback.
- Queue persistence, retry, pause/resume, process-tree cleanup, subtitles, and tray progress.
- Movie/series output organization and resumable partial files.

### v1.0.8 — behavior-preserving refactor

- Main, preload, and renderer boundaries organized by domain.
- Settings, App shell, downloader, Movie, TV, AllManga, and subtitle responsibilities split into focused modules.
- Existing `window.electron` aliases, storage keys, secure credentials, profiles, and download records retained.
- Binding, IPC, secret, cycle, size, unit, renderer, Electron, and build checks established.

## v1.0.9 — Cosmic Polish and Playback Continuity

Status in this working tree:

- Scoped stream capture sessions tied to title, episode, source, and player contents.
- HLS, DASH, direct-video, MIME-based extensionless response classification.
- Live download-dialog detection updates, polling, elapsed detection time, and refresh guidance.
- Download Record v3 metrics: bytes, ETA, elapsed time, fragments, retries, strategy, host, and update time.
- All/Active/Completed/Failed download views, filters, sorting, expandable diagnostics, and bulk controls.
- Restricted `orion-media://` local playback with opaque grants, range requests, resume, watched state, and sidecar subtitles.
- Explicit embedded → mini → pop-out state snapshots, one active owner, resume time, volume, mute, and pause restoration.
- Automatic mini-player on navigation with Auto, Ask, and Manual settings.
- Mini-player seek, scrub, volume, resize, snap, retry, expand, and pop-out controls.
- Main-process ambient sampler that sends derived color palettes only, pauses while inactive, and lowers its sampling rate on battery power.
- Offline Inter and Space Grotesk fonts, Midnight Premiere/Projector Silver cinema tokens, Orbit/Nebula/Minimal backgrounds, consistent focus rings, and motion presets.
- Dynamic regional provider hubs that automatically include every offer type and regional provider variant, plus checked-in Marvel, DC, Star Wars, and Pixar manifests.
- Latest-entry-per-series Continue cards, progress details, visible Library search/sort, Downloads tab, and local playback.

Release validation still requires clean-machine Windows installer/ZIP smoke tests, live protected-host download tests, and the visual/Electron matrix described in `docs/releases/v1.0.9.md`.

## v1.1.0 — Search + Cast Metadata

This remains the next feature release. It must not absorb AI work.

- Preserve media search while retaining TMDB person results.
- Add person result cards, cast/crew rails, and a focused Person page.
- Show known-for titles and filmography with movie/TV normalization and deduplication.
- Add accessible keyboard navigation, loading states, empty states, and cached metadata.
- Keep person metadata separate from playback and downloader concerns.

## Later pre-AI milestones

### v1.2.0 — Local library and offline catalog

- Reconnect local-folder scanning through the existing restricted filesystem boundary.
- Match local files to TMDB identities without exposing arbitrary paths to React.
- Add missing/moved-file repair, offline catalog state, and explicit rescan controls.

### v1.3.0 — Collections and home curation

- Manual collections with reorder, artwork, privacy-safe export, and backup support.
- Improved Home rail personalization using deterministic local rules.
- Additional editorial rails without impersonating provider branding.

### v1.4.0 — Advanced playback

- Audio/subtitle track selection where sources expose it.
- More local formats, playback diagnostics, and source-health history.
- Performance/battery modes and improved multi-monitor/fullscreen behavior.

### v1.5.0 — Privacy, notifications, and resilience

- Granular notification policy and quiet hours.
- Clear storage/credential visibility, retention controls, and export diagnostics redaction.
- Backup migration testing, recovery tooling, and updater rollback guidance.

### v1.6.0 — AI readiness (no AI features yet)

- Stable metadata, library, playback, collection, and search contracts.
- Consent and privacy boundaries for any future indexing.
- Explicit local/cloud processing policy and deletion lifecycle.
- Performance budgets and opt-in migration design.

## AI boundary

AI features remain deferred until the pre-AI milestones pass acceptance. Future work may include semantic search, mood discovery, local indexing, personalized recommendations, or AI collections, but none should be enabled by silently uploading watch data or provider credentials.

## Non-negotiable engineering rules

- DRM circumvention is out of scope.
- Cookies, captured headers, provider keys, tool paths, arbitrary filesystem paths, and spawn arguments remain outside React.
- Profile and record migrations are additive and reversible where possible.
- Existing flat preload aliases remain available through v1.0.9.
- Feature modules do not import sibling feature internals.
- New source files stay below 800 lines and should normally stay below 500.
- A release is not complete until the full check suite, Electron flows, clean-machine packages, upgrade profile, and live smoke tests pass.
