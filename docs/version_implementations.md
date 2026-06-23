# Orion Version-Based Implementation Plan

Last updated: 2026-06-23

## Product Description

Orion is a premium Electron desktop streaming app for movies, TV, anime, downloaded media, and personal watch tracking. The title, "A Multiverse of Stories", means Orion should feel broader and more curated than a utility player: cinematic discovery, quick resume, flexible sources, reliable downloads, and a personal library.

Streambert is the functional reference. Orion should not copy Streambert's UI identity. Orion should keep its own dark cinematic interface, red accent, modern side navigation, large media artwork, and smoother viewing experience.

## What Streambert Provides

Streambert is a working Electron streaming app with:

- TMDB metadata, search, trending, detail pages, and history.
- Movie and TV webview playback using Videasy, VidSrc, Vidking, and AllManga for anime.
- AllManga resolution through main-process IPC, including sub/dub handling.
- Request interception for ad/tracker blocking and m3u8/vtt capture.
- Download workflow powered by yt-dlp and ffmpeg.
- Subtitles through SubDL/Wyzie and downloaded subtitle management.
- Library, history, watched state, progress, local file scanning, and settings.
- Update, backup/restore, secure storage, PiP/pop-out, close confirmation, and keyboard shortcuts.

## Orion Direction

Orion uses Streambert behavior where it is proven, but improves the product experience:

- UI identity: cinematic, Netflix-inspired, clean, dark, and Orion-branded.
- First screen: usable Home with hero, carousels, continue watching, K-dramas/K-series, and curated sections.
- Details: movie/TV pages should clearly expose Play, Download, Trailer, Save, watched state, source status, progress, and related content.
- Playback: source selector, loading HUD, failover actions, resume/start-over, PiP, subtitles, progress, and keyboard controls should feel native.
- Downloads: visible entry points, clear prerequisite checks, progress, retry/delete/open actions, and subtitle bundling.
- Settings: clear sections, diagnostics, API keys, appearance, player, downloads, subtitles, library/privacy, backup, storage, and updates.

## Current State

### Working / Mostly Working

- Electron/Vite/React shell.
- Main IPC modules for storage, downloads, subtitles, player, block stats, AllManga, and diagnostics.
- Streambert source list is present: Videasy, VidSrc (`vsembed.su`), Vidking, AllManga.
- Home, Discover, Search, Movie, TV, Library, Downloads, and Settings routes exist.
- System Check reports TMDB/download/tool readiness.
- Movie and TV have source selection, progress, PiP, resume prompts, and failover HUDs.
- K-drama/K-series Home row exists.
- Sidebar has Orion branding, grouped expanded navigation, hover peek, click/pin control, My Library naming, and Downloads-only active badge.
- Global card size tokens are in place for compact, standard, and collection media cards so posters stay bounded across Home, My Library, Discover, search, anime, seasons, and movie collections.
- Home My List avoids the oversized carousel when only 1-3 saved titles exist.
- TMDB token fallback plumbing supports a bundled build token while preserving user-token overrides.

### Known Problems To Fix First

- UI still needs hard polish: spacing, cards, detail pages, empty states, modal consistency, responsive behavior.
- Movie card/details presentation has been reported broken in runtime smoke testing.
- Download entry points are visible on details/episodes, but capture recognition still needs backend debugging.
- Downloading still needs a full manual pass: m3u8 capture, yt-dlp start, progress, completion, subtitle bundling, delete/open.
- Download backend now targets direct `yt-dlp + ffmpeg` with PATH/app-managed tool detection. Windows install/repair IPC exists, but the full runtime download path still needs smoke testing.
- Bundled TMDB fallback requires an actual free read token to be provided at package/build time through `VITE_TMDB_READ_TOKEN` or `VITE_TMDB_TOKEN`; Orion intentionally does not commit a secret token in source.
- Some tracker items may overstate completion; current runtime behavior wins over docs.

## Version Roadmap

### v0.9.0 - Runtime Stabilization

Goal: make current Orion usable without raw/broken UI or missing primary actions.

- Fix runtime IPC errors.
- Restore missing class styles for Home, Search, Discover, media cards, detail pages, and modals.
- Ensure Movie and TV detail pages expose Download clearly.
- Verify source list and source URLs against Streambert.
- Verify setup, Home, quick search, Discover, Movie, TV, Library, Downloads, Settings.
- Keep docs honest with verified status only.

### v1.0.0 - Streambert Functional Parity

Goal: all Streambert core behavior works in Orion.

- Movie playback via Videasy, VidSrc, Vidking.
- TV playback via Videasy, VidSrc, Vidking.
- Anime playback via AllManga with sub/dub.
- Progress save/resume and watched state.
- Watchlist, history, continue watching, local files.
- Download manager: save-folder setup, m3u8 capture, direct yt-dlp/ffmpeg, progress, completion, errors, delete/open.
- Subtitle search/download with SubDL/Wyzie.
- Secure storage for API keys.
- Settings, backup/restore, updates, close confirmation, PiP.

### v1.1.0 - Orion UI Identity

Goal: Orion no longer feels like ported Streambert with a skin.

- Refine Home hero, carousels, K-drama row, continue watching, and empty/offline states.
- Continue refining globally bounded media cards with consistent poster/backdrop handling, metadata, progress, badges, and context actions.
- Improve Movie/TV detail pages with better hierarchy and visible actions.
- Polish Discover with genre cards, filters, result grids, loading/empty states.
- Polish Search modal and full Search results page.
- Standardize modal, button, input, select, toggle, tooltip, and card styles.

### v1.2.0 - Playback Experience

Goal: playback feels intentional and resilient.

- Source health/failover status per title.
- Loading HUD with title/artwork context.
- Resume/start-over flows for Movie and TV.
- Next episode countdown for TV.
- Subtitle UX inside download/playback flows.
- Keyboard shortcuts and webview hotkeys.
- Better error messages for source failures and AllManga misses.

### v1.3.0 - Download Experience

Goal: downloads become reliable and easy to understand.

- Stabilize final backend strategy: direct PATH/app-managed `yt-dlp + ffmpeg`.
- Preflight checks for yt-dlp, ffmpeg, folder permissions, and disk space.
- Clear "start video to capture stream" guidance when m3u8 is missing.
- Queue state, retry, delete, open file, show in folder, logs.
- Subtitle bundling and post-download subtitle management.
- Local file scan and offline library integration.

### v1.4.0 - Settings, Data, Packaging

Goal: ready for everyday use.

- Settings cleanup and section polish.
- Diagnostics and support export.
- Backup/restore verification.
- Update flow verification.
- Windows packaging smoke and icon/installer polish.

## Verification Gates

Each version must pass:

- `npm run build`
- Electron launch smoke (`npm start`)
- Manual route check: Home, Search, Discover, Movie, TV, Library, Downloads, Settings
- Playback check: Videasy, VidSrc, Vidking, AllManga
- Download check: folder setup, m3u8 capture, yt-dlp start/progress/completion
- Settings/System Check review

## Immediate Queue

1. Electron smoke sidebar hover peek / pin open / grouped labels and My Library naming.
2. Verify global card sizing on Home, My Library, Discover, Search, Movie collections, TV seasons, and anime results.
3. Verify bundled TMDB token behavior in a packaged/build environment with `VITE_TMDB_READ_TOKEN` set.
4. Manually test a movie playback source and download capture.
5. Debug the m3u8 active-capture issue after UI review.
