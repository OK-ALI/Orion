# Orion Completion Tracker

Source of truth: `docs/implementation_plan-updated`

Version roadmap: `docs/version_implementations.md`

Last updated: 2026-06-23

## Current Snapshot

Orion has the Electron/Vite/React foundation, the Streambert-style IPC modules, Orion shell navigation, Home/Discover/Search/Movie/TV pages, and ported Library/Downloads/Settings pages. The app builds successfully and Windows packaging has already smoked successfully in this workspace.

The remaining work is mostly runtime confidence and download polish: manual Electron launch verification, download capture recognition, download pipeline verification, final UI screenshots, and final packaging/icon checks. Runtime smoke-test evidence takes priority over optimistic status labels in older docs.

## Progress

| Area | Status | Notes |
|---|---|---|
| Electron foundation | Done | Main process, preload bridge, Vite build, custom titlebar, session setup. |
| Streambert backend parity | Mostly done | AllManga, downloads, subtitles, storage, player, block stats, PiP, updates are present. |
| App orchestration | Mostly done | `App.jsx` wires routes, watchlist/history/progress/downloads, updates, close confirm, quick search, shortcuts. |
| Home / Discover / Search | Mostly done | Hero, smaller carousels, compact My List shelf for small lists, K-drama row, bounded Discover cards, quick search, full search page. Needs runtime UI verification after CSS fixes. |
| Movie / TV playback | Mostly done | Detail page cinema-mode styling, source selection, webview playback, progress, PiP, TV episode flow, Movie/TV resume prompts & failover. Needs runtime verification for card/details layout and downloads. |
| Library | Mostly done | My Library naming, All/Continue/My List/History tabs, compact bounded grids. Needs manual regression pass. |
| Downloads | In progress | Queue, local scans, subtitle management, open/delete actions, and direct yt-dlp/ffmpeg backend are present. Needs runtime install/capture/download verification. |
| Settings | Mostly done | Appearance, playback, downloads, subtitles, privacy/library, API keys, updates, backup/restore, storage/data. |
| Backend diagnostics | Done | System Check IPC and Settings panel report app/runtime, tools, queue, cache, and path readiness. |
| Smoke-test regressions | In progress | Fixed blocked-stats IPC alias, ffmpeg diagnostics check, missing Home/Discover/Search styles, and detail-level download button visibility. Needs manual re-test. |
| Polish overlays | In progress | Loading HUD, TV/Movie failover HUDs, and TV/Movie resume prompts exist. Needs runtime verification and next-episode/new-episode polish. |
| Packaging | Mostly done | `npm run dist:win` completed once. Needs final smoke after runtime parity. |

## Completed During This Pass

- Added missing `.media-card` styles and BEM child classes to `components.css`.
- Fixed the detail views layout (Cinema Mode) by appending detailed CSS classes (`.detail-hero`, `.detail-bg`, `.detail-gradient`, `.detail-content`, `.detail-poster`, `.detail-info`, `.detail-type`, `.detail-title`, `.detail-meta`, `.detail-rating`, `.detail-overview`, `.detail-actions`, `.genres`, `.genre-tag`, `.season-selector`, `.season-btn`, `.episodes-grid`, `.episode-card`, `.episode-thumb`) to `components.css`.
- Fixed rating and year concatenation bug in details metadata by applying flex styling, margins, and bullet separations (`•`) to `.detail-meta span` elements.
- Implemented Home page carousel slide keyframe transitions (`mediaCarouselSlideInFwd` and `mediaCarouselSlideInBwd`) inside `components.css`.
- Modified `MediaCarousel.jsx` to bind mouse enter/leave listeners to pause auto-cycling during hover.
- Added screen-level loading state and spinner check to `MoviePage.jsx` when loading details from TMDB to keep parity with `TVPage.jsx` and display a clean loading indicator.
- Documented "Needed Polishing" items in `docs/version_implementations.md`.
- Implemented webview keyboard hotkeys injection for ALL sources in both `MoviePage.jsx` and `TVPage.jsx` (`Space` play/pause, `ArrowLeft`/`ArrowRight` seek, `ArrowUp`/`ArrowDown` volume, `F`/`double-click` fullscreen, `M` mute).
- Updated `docs/version_implementations.md` and `docs/implementation_plan.md` to reflect these premium UI revisions.
- Reworked `docs/version_implementations.md` into Orion's own version roadmap, with Streambert as functional reference and Orion UI as independent product direction.
- Restored detail-level Download actions: Movie details show Download before playback; TV details show Download Episode when a concrete episode is selected.
- Polished media card and download modal presentation:
  - Reduced badge overlap on media cards and added type-specific badge colors.
  - Standardized detail action button sizing.
  - Added missing modal shell/instruction/ready/error styles for `DownloadModal`.
  - Migrated the download backend away from Streambert's trusted helper-binary flow toward direct PATH/app-managed `yt-dlp + ffmpeg`.
- Clarified video downloads do not require subtitle API keys:
 - Download subtitles are now opt-in in the download modal.
 - SubDL/Wyzie keys are only needed for optional subtitle search/bundling, not for the video download itself.
- Added first pass of no-config downloader UX:
  - Orion detects `yt-dlp` and `ffmpeg` from PATH or its managed tools folder.
  - Windows install/repair IPC downloads app-managed tools.
  - Resume/download actions use direct yt-dlp instead of helper-folder tokens.
- Added playback/download UX improvements:
  - Quick search now uses a stronger command-palette overlay.
  - Movie/TV playback scrolls to the player when started.
  - Movie/TV player overlays fade on cursor idle and restore on interaction.
  - TV episode cards expose Download buttons.
  - TV seasons expose a visible Download Season entry point that starts capture for the first pending episode.
- Completed a UI-first polish pass:
  - Home shows saved titles as a My List row.
  - Library has Continue / My List / History tabs and compact card grids.
  - Sidebar labels the saved destination as My Library and removed the saved count badge.
  - Episode cards have tighter alignment, stronger playing state, and compact actions.
- Adjusted Home movement and sizing:
  - Continue Watching cards now render as a compact grid.
  - Visible carousels loop independently unless hovered, instead of only cycling the single most-visible row.
- Completed sidebar + global card polish:
  - Added Orion sidebar brand block, grouped Browse / Personal / System navigation, visible edge rail, hover peek, and top pin/unpin control.
  - Kept only the active Downloads badge in sidebar navigation.
  - Added compact, standard, and collection card size tokens and a global bounded `.cards-grid`.
  - Bounded media cards across Home, My Library, Discover, Search, Movie collections/related rows, TV seasons/episodes, and anime/generic grids.
  - Home My List uses a compact shelf for 1-3 saved titles with a View all in My Library action.
  - Added bundled TMDB token fallback plumbing through `VITE_TMDB_READ_TOKEN` / `VITE_TMDB_TOKEN`, with user token override retained.
  - Settings/System Check now report TMDB token source as Bundled, User configured, or Missing.
- Verified successful production compilation via `npm run build`.

## Next Implementation Queue

1. Run manual Electron smoke: setup, navigation, search, playback, downloads, settings.
2. Verify media cards and detail pages in runtime screenshots.
3. Verify download flow: save folder setup, downloader install/repair, play to capture m3u8, start yt-dlp, progress, completion.
4. Verify all-source loading confidence.
5. Run final `npm run build` and `npm run dist:win`.

## Verification Log

| Date | Command / Check | Result |
|---|---|---|
| 2026-06-22 | `npm run build` | Pass |
| 2026-06-22 | `npm run dist:win` | Pass; produced Windows unpacked app and NSIS installer |
| 2026-06-22 | `npm run build` after UI styling, carousel hover cycle, & MoviePage loading additions | Pass |
| 2026-06-23 | `npm run build` after card/download modal polish | Pass |
| 2026-06-23 | `npm run build` after no-API subtitle opt-in and Home carousel/card sizing | Pass |
| 2026-06-23 | `npm run build` after quick search overlay, direct downloader backend, and TV download entry points | Pass |
| 2026-06-23 | `npm run build` after UI-first polish: My List row, Library tabs, Sidebar badge, player idle controls, episode card polish | Pass |
| 2026-06-23 | `npm run build` after sidebar dock, My Library naming, bundled TMDB fallback plumbing, and global card bounds | Pass |

## Notes

- `docs/implementation_plan-updated` supersedes `docs/implementation_plan.md`.
- Streambert behavior wins when Orion is incomplete, but Orion styling and navigation should remain the product direction.
- Existing mojibake in comments/docs is cosmetic unless it appears in user-facing UI.
- Known deferred backend issue: downloads can still ask to start streaming first while video is playing because active m3u8 capture recognition needs debugging after UI polish.
- Bundled TMDB fallback is implemented as build-time plumbing; provide the free TMDB read token through `VITE_TMDB_READ_TOKEN` or `VITE_TMDB_TOKEN` for packaged builds.
