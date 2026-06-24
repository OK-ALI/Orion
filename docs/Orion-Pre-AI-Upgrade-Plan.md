# Orion Pre-AI Upgrade Plan

**Project:** Orion  
**Tagline:** A Multiverse of Stories  
**Current Shipped Version:** `v1.0.3`  
**Plan Scope:** Everything Orion should complete before AI integration  
**AI Integration Starts:** `v2.0.0`  
**Torrent / libtorrent:** Not included in this plan  
**Last Audit:** June 2026 (against v1.0.3 codebase)

---

## Status Legend

```text
✅ DONE      Fully implemented in current codebase
🟡 PARTIAL   Some elements exist, needs extension
🔴 NEW       Not present, must be built from scratch
```

---

## 1. Purpose

Orion should first become a polished, stable, premium desktop streaming app before adding AI Search, AI Scan, LanceDB, Semantic Search, Mood Search, Scene Search, Personalized Recommendations, and AI Collections.

The core direction:

```text
Before AI:
Orion feels like a premium desktop streaming app.

After AI:
Orion feels like a premium desktop streaming app that understands your taste.
```

This plan focuses on strengthening Orion's foundations first:

```text
Search
Cast metadata
Downloader stability
HLS stream compatibility
Local library
Offline mode
Home experience
Manual collections
Playback polish
Settings
Privacy
Notifications
Architecture cleanup
AI readiness
```

---

## 2. Current Orion Capability Audit

Orion already has a strong foundation. The goal of this plan is to upgrade, organize, and extend what already exists, not rebuild everything.

### Already Present in Orion ✅

```text
Electron + React + Vite desktop app
Custom titlebar (WindowTitlebar.jsx)
TMDB metadata (api.js — tmdbFetch with caching, rate limiting)
Movie detail pages (MoviePage.jsx — 71KB)
TV detail pages (TVPage.jsx — 119KB)
Anime support (AllManga source, AniList integration, AniSkip)
Multiple player sources (Videasy, VidSrc, Vidking, AllManga)
Source switching + failover
Search modal (SearchModal.jsx — TMDB multi-search)
Saved titles / watchlist (localStorage via storage.js)
Watch history + watch progress
Watched / unwatched state
Download modal (DownloadModal.jsx)
Downloads page (DownloadsPage.jsx)
yt-dlp / ffmpeg downloader setup (downloads.js — 52KB monolith)
HLS / m3u8 detection (player.js)
Subtitle URL detection (player.js)
Subtitle downloader (SubtitleDownloaderModal.jsx — SubDL + Wyzie)
Trailer modal (TrailerModal.jsx — Invidious proxy)
Mini-player / PiP (MiniPlayer.jsx)
Settings page (SettingsPage.jsx — 151KB, 10 sections)
Appearance settings (tokens.css + appearance.js — themes, accents, custom vars)
Backup / restore + scheduled backups (backup.js)
Update system (updates.js + UpdateModal.jsx)
Age rating restrictions (ageRating.js)
Ad / tracker blocking (blockStats.js)
New episode checking + OS notifications
Keyboard playback controls
Injected skip controls (-15s / +15s)
Voice Boost
Bundled TMDB API token (.env — VITE_TMDB_READ_TOKEN)
Home page rows (Continue Watching, Trending, My List, Recommended, K-Dramas, Top Rated)
Home row reordering (homeLayout.js)
Discover page with genre filtering (DiscoverPage.jsx)
Light + dark theme support (tokens.css)
```

### Current Architecture Snapshot

```text
src/
  App.jsx                    52KB — main orchestrator, holds ALL state
  components/
    common/                  Icons.jsx, ErrorBoundary.jsx, ConfirmModal.jsx
    layout/                  Sidebar.jsx, Toast.jsx, WindowTitlebar.jsx
    media/                   HeroBanner.jsx, MediaCard.jsx, MediaCarousel.jsx
    modals/                  SearchModal.jsx
    setup/                   SetupScreen.jsx
    (+ root-level modals)    DownloadModal, SubtitleDownloaderModal, TrailerModal, etc.
  pages/                     8 pages (3 are monolith files >50KB)
  ipc/                       8 files (downloads.js is 52KB monolith)
  utils/                     13 files
  styles/                    tokens.css, global.css, components.css, fonts.css
```

### Important Repo-Aware Notes

Orion already has many playback features:

```text
✅ -15s / +15s injected skip buttons
✅ Space play / pause
✅ Arrow seek
✅ Arrow volume
✅ F fullscreen
✅ M mute
✅ Double-click fullscreen
✅ Progress tracking
✅ Resume state
✅ Voice Boost
✅ Source failover prompt
✅ m3u8 detection
✅ Subtitle URL detection
✅ Mini-player / PiP hooks
✅ Downloaded / downloading button states
```

So playback work in this plan should focus on polish, cleanup, and missing improvements only.

### Key Architectural Issues to Address

```text
App.jsx (52KB) holds ALL application state — needs decomposition
MoviePage.jsx (71KB) — player logic, UI, metadata all in one file
TVPage.jsx (119KB) — same issue, even larger
SettingsPage.jsx (151KB) — monolith with all sections inline
downloads.js (52KB) — queue, engines, diagnostics all in one file
No src/services/ layer exists — logic lives in pages and utils
SearchModal.jsx filters OUT person results (line 85)
```

---

## 3. Versioning and Hotfix Strategy

Orion should use semantic versioning:

```text
MAJOR.MINOR.PATCH
```

### Current Stable

```text
v1.0.3
Current shipped version
```

### Version Rules

```text
Feature release:
v1.1.0, v1.2.0, v1.3.0

Hotfix release:
v1.1.1, v1.1.2, v1.2.1

Major release:
v2.0.0
```

### Meaning

```text
MAJOR
Used when Orion's product identity changes.
Example: v2.0.0 starts AI integration.

MINOR
Used for planned feature releases.
Example: v1.1.0 Search + Cast Metadata Foundation.

PATCH
Used for bug fixes, hotfixes, crash fixes, regressions, and small safe improvements.
Example: v1.1.1 fixes actor search bugs after testing.
```

### Release Flow

```text
Plan feature
↓
Build on dev branch
↓
Internal test
↓
Release beta build if needed
↓
Fix bugs
↓
Ship stable version
↓
Patch with hotfix if needed
```

Example:

```text
v1.1.0-beta.1
v1.1.0-beta.2
v1.1.0
v1.1.1 hotfix
v1.1.2 hotfix
v1.2.0 next feature
```

### Practical Rule

Do not rush from one feature version to the next.

```text
v1.1.0 → test → v1.1.1 if needed → v1.2.0
```

Final version principle:

```text
Minor versions add planned features.
Patch versions fix what testing reveals.
Major versions change Orion's product identity.
```

---

## 4. Roadmap Overview

```text
v1.0.3  Current shipped stable version

v1.1.0  Search + Cast Metadata Foundation          ~10% done  | HIGH effort   | VERY HIGH impact
v1.2.0  Downloader Engine Cleanup                   ~40% done  | MEDIUM effort | MEDIUM impact
v1.3.0  Downloader Diagnostics + HLS Preflight      ~30% done  | MEDIUM effort | MEDIUM impact
v1.4.0  Local Library + Offline Mode                ~10% done  | HIGH effort   | HIGH impact
v1.5.0  Home, Watchlist, Manual Collections         ~50% done  | MEDIUM effort | HIGH impact
v1.6.0  Playback Polish + Refactor                  ~60% done  | MEDIUM effort | MEDIUM impact
v1.7.0  Settings, Privacy, Notifications            ~60% done  | MEDIUM effort | MEDIUM impact
v1.8.0  UI / UX Polish                              ~30% done  | MEDIUM effort | HIGH impact
v1.9.0  Architecture Cleanup + AI Readiness         ~10% done  | HIGH effort   | CRITICAL
v2.0.0  AI Integration Starts
```

### Version Order Change from Original Plan

```text
ORIGINAL:
v1.2.0  Downloader Diagnostics + HLS Preflight
v1.3.0  Downloader Engine Cleanup

UPDATED:
v1.2.0  Downloader Engine Cleanup
v1.3.0  Downloader Diagnostics + HLS Preflight

REASON:
Building diagnostics against the current monolithic downloads.js (52KB)
and then immediately refactoring it in the next version would break
the diagnostics. Clean up the engine first, then add diagnostics
to the clean modules.
```

---

# v1.1.0: Search + Cast Metadata Foundation

## Goal

Make Orion's search system strong before AI integration.

Search should become Orion's discovery spine.

It should support:

```text
TMDB discovery
Actor discovery
Library search
Downloads search
Watch history search
Local media search
Offline search
Future AI Search
```

---

## What Already Exists

```text
✅ SearchModal.jsx — single-input TMDB multi-search with debounce
✅ Search history — stores recent text queries in localStorage
✅ Search result cards — poster, title, year, rating, type badge
✅ Keyboard support — ESC to close, Enter to search
✅ Clear history button
🟡 Multi-search API — uses /search/multi but filters OUT person results
```

---

## v1.1.0 Features

### 1. Search Tabs 🔴 NEW

Add clear search categories:

```text
All
Movies
Series
Actors
Library
Downloads
Local
```

Later, AI can add:

```text
Scenes
Moods
Collections
```

---

### 2. Actor / Cast Search 🔴 NEW

Users should be able to search:

```text
Tom Cruise
Cillian Murphy
movies with Ryan Gosling
series with Pedro Pascal
Shah Rukh Khan movies
Lee Min Ho dramas
Song Kang Ho films
```

The current search system explicitly filters out `person` results (SearchModal.jsx line 85). This filter must be removed and person results must be surfaced as a new result type.

---

### 3. Cast Metadata Cache 🔴 NEW

Add a cast cache so Orion does not repeatedly fetch credits for the same title.

No credits or cast data is fetched anywhere in the current codebase.

Recommended cache keys:

```text
credits_movie_123
credits_tv_456
person_2037
```

Recommended data shape:

```js
{
  mediaId: 123,
  mediaType: "movie",
  cast: [],
  crew: [],
  fetchedAt: 1710000000000
}
```

Cache duration:

```text
7 days minimum
30 days preferred
```

---

### 4. Cast on Media Cards 🔴 NEW

MediaCard.jsx currently shows: title, year, rating, progress, watched state. No cast info.

Media cards should show top cast lightly.

Example:

```text
Interstellar
2014 · Movie
Matthew McConaughey · Anne Hathaway
```

For series:

```text
Pachinko
2022 · Series
Lee Min-ho · Kim Min-ha
```

Keep it minimal:

```text
Show only top 2 actors on the card.
```

Do not fetch cast inside every card.

Bad:

```text
MediaCard → fetch cast directly
```

Good:

```text
Page/Search service fetches cast
↓
Adds topCast to item
↓
MediaCard only renders item.topCast
```

---

### 5. Cast Hover Preview 🔴 NEW

On hover, show a small preview:

```text
Top Cast
Cillian Murphy
Emily Blunt
Robert Downey Jr.
```

This keeps the card clean while still adding useful context.

---

### 6. Cast Row on Detail Pages 🔴 NEW

MoviePage.jsx and TVPage.jsx currently have no credits/cast fetch or display.

Movie and TV pages should show:

```text
Top Cast
[Actor Photo] Actor Name
[Actor Photo] Actor Name
[Actor Photo] Actor Name
```

Click behavior for v1.1.0:

```text
Click actor → actor-filtered search
```

Later:

```text
Click actor → PersonPage.jsx
```

---

### 7. Asian Actor Search Support 🔴 NEW

Asian actor search should work through the same actor-search system, but Orion needs alias and romanization support.

Support examples:

```text
Lee Min-ho
Lee Min Ho
Lee Minho
이민호

Shah Rukh Khan
Shahrukh Khan
SRK

Song Kang-ho
Song Kang Ho
송강호

Donnie Yen
甄子丹
```

---

### 8. Name Normalization 🔴 NEW

Add normalization for:

```text
hyphens
case differences
extra spaces
romanization variations
stage names
aliases
original-script names
```

Example:

```text
Lee Min-ho
Lee Min Ho
Lee Minho
```

All should match the same actor.

---

### 9. Actor Metadata Shape 🔴 NEW

```js
{
  id: 123,
  name: "Lee Min-ho",
  aliases: ["Lee Min Ho", "Lee Minho", "이민호"],
  knownForDepartment: "Acting",
  profilePath: "...",
  popularity: 45.2
}
```

---

### 10. Local Search 🟡 PARTIAL

Currently: search history stores recent text queries only.

Missing: searching across saved titles, watch history, downloads, watched/unwatched, in-progress items.

Search should include:

```text
Saved titles
Watch history
Downloads
Local library
Watched titles
Unwatched titles
In-progress titles
```

---

### 11. Fuzzy Search 🔴 NEW

No client-side fuzzy matching exists. TMDB API handles some typos but no local fuzzy search.

Handle typos:

```text
intersteller → Interstellar
oppenhimer → Oppenheimer
spderman → Spider-Man
```

---

### 12. Recent Opened Results 🟡 PARTIAL

Currently: recent text queries are stored and shown.

Missing: recently opened movies, series, actors, downloads are not tracked in search history.

Recent searches should not only store text queries.

Also store:

```text
Recently opened movies
Recently opened series
Recently opened actors
Recently opened downloads
```

---

## v1.1.0 Recommended Structure

```text
src/components/search/
  SearchModal.jsx          (extend existing from src/components/modals/)
  SearchTabs.jsx
  SearchResultCard.jsx
  SearchSuggestions.jsx
  SearchEmptyState.jsx
  SearchSection.jsx

src/services/search/
  tmdbSearch.js
  actorSearch.js
  localSearch.js
  downloadSearch.js
  historySearch.js
  searchParser.js
  fuzzySearch.js
  nameNormalizer.js

src/services/metadata/
  creditsService.js
  peopleService.js
  castCache.js

src/components/cast/
  CastPreview.jsx
  CastChips.jsx
  CastRow.jsx
  ActorCard.jsx
```

---

## Possible v1.1 Hotfixes

```text
v1.1.1 Fix actor search bugs
v1.1.2 Fix cast cache or card layout issues
v1.1.3 Fix search result grouping / tab bugs
v1.1.4 Fix Asian actor alias matching
```

---

# v1.2.0: Downloader Engine Cleanup

*Moved from original v1.3.0 position. Engine cleanup should happen before diagnostics.*

## Goal

Split downloader logic into cleaner modules and stabilize engines.

No libtorrent.

---

## What Already Exists

```text
✅ downloads.js — 52KB monolith with queue management, IPC, all engines mixed together
✅ downloader-helper.js — binary path detection for yt-dlp / ffmpeg
✅ Direct download support — exists but tightly coupled in downloads.js
✅ yt-dlp integration — exists in downloads.js but not separated
✅ FFmpeg HLS handling — exists in downloads.js, no proxy engine
✅ Subtitle download flow — subtitles.js (19KB), SubDL + Wyzie
🟡 Download queue — persists across restarts, no smart recovery
🔴 Download Resolver — everything in one file, no routing logic
🔴 HLS Proxy Engine — no local proxy fallback
🔴 Local Import Engine — no local file import
```

---

## v1.2.0 Supported Engines

```text
Direct File Engine
yt-dlp Engine
FFmpeg HLS Direct Engine
FFmpeg HLS Proxy Engine
Subtitle Engine
Local Import Engine
```

---

## v1.2.0 Features

```text
🔴 Download Resolver
🟡 Direct File Engine (extract from downloads.js)
🟡 yt-dlp Engine cleanup (extract from downloads.js)
🟡 FFmpeg HLS Direct (extract from downloads.js)
🔴 FFmpeg HLS Proxy
✅ Subtitle download flow (already separate in subtitles.js)
🟡 Download queue recovery
🟡 Better temp cleanup
🟡 Better retry handling
```

---

## HLS Flow

```text
Player detects .m3u8
↓
Save StreamContext
↓
User clicks Check Download
↓
Preflight checks playlist and sample fragments
↓
If direct works: FFmpeg Direct
↓
If direct fails but proxy works: FFmpeg Proxy
↓
If both fail: Streaming Only
```

---

## Recommended IPC Structure

```text
src/ipc/downloads.js              (refactor to queue manager and IPC coordinator only)
src/ipc/downloadResolver.js       🔴 NEW
src/ipc/directDownloader.js       🔴 NEW (extract from downloads.js)
src/ipc/hlsDownloader.js          🔴 NEW (extract from downloads.js)
src/ipc/hlsProxy.js               🔴 NEW
src/ipc/localImport.js            🔴 NEW
```

---

## Responsibility Split

```text
downloads.js
Queue manager and IPC coordinator only.

downloadResolver.js
Chooses correct engine.

directDownloader.js
Handles direct files.

hlsDownloader.js
Runs FFmpeg direct/proxy downloads.

hlsProxy.js
Handles local HLS proxy fallback.

localImport.js
Imports user-owned local files/folders.
```

---

## Possible v1.2 Hotfixes

```text
v1.2.1 Fix direct download resume
v1.2.2 Fix HLS proxy edge cases
v1.2.3 Fix subtitle download errors
v1.2.4 Fix queue recovery bugs
```

---

# v1.3.0: Downloader Diagnostics + HLS Preflight

*Moved from original v1.2.0 position. Diagnostics are built on top of the clean engine modules from v1.2.0.*

## Goal

Make downloader failures understandable now that the engine is modular.

The goal is not:

```text
Download everything
```

The goal is:

```text
Download what is legally allowed, non-DRM, and technically accessible.
Mark blocked/protected sources as Streaming Only.
```

---

## What Already Exists

```text
✅ diagnostics.js — basic system checks (yt-dlp, ffmpeg, TMDB token, download path)
✅ SystemCheckSection — settings UI showing yt-dlp/ffmpeg/token/path status
🟡 Error messages — downloads have error handling but messages are generic
🟡 m3u8 detection — player.js detects streams but no structured StreamContext
🟡 Download button states — Download, Downloaded, Downloading exist; no Proxy Required / Streaming Only / Expired
🔴 HLS Preflight — no pre-download compatibility testing
🔴 StreamContext object — no structured capture of stream headers, cookies, session
🔴 Dedicated diagnostics UI panel — no expanded diagnostics beyond basic status
```

---

## v1.3.0 Features

### 1. Downloader Diagnostics Screen 🟡 PARTIAL

Current: SystemCheckSection shows basic status (yt-dlp ✓, ffmpeg ✓, path ✓).
Needed: Expanded diagnostics panel.

Location:

```text
Settings → Downloads → Diagnostics
```

Show:

```text
✅ yt-dlp status (already checked)
✅ ffmpeg status (already checked)
✅ download folder permission (already checked)
🔴 available disk space
🔴 last failed reason
🔴 copy logs button
🔴 clear temp files
🔴 test direct download
🔴 test HLS download
```

---

### 2. Better Failure Categories 🟡 PARTIAL

Current: Generic "Download failed" messages.
Needed: Categorized failure reasons.

Instead of:

```text
Download failed
```

Show:

```text
🔴 Stream expired
🔴 Source blocked fragments
🔴 Missing cookies
🔴 Invalid referer / origin
🟡 FFmpeg missing (detected but not surfaced well)
🟡 Folder permission denied (detected but not surfaced well)
🔴 Not enough disk space
🔴 DRM / protected stream
🔴 Streaming only
```

---

### 3. StreamContext 🟡 PARTIAL

Current: player.js detects .m3u8 URLs and subtitle URLs, but no structured context object.

When Orion detects an `.m3u8`, save the full stream context.

```js
{
  id,
  url,
  mediaType: "hls",
  title,
  tmdbId,
  season,
  episode,
  sourceHost,
  capturedAt,
  headers: {
    userAgent,
    referer,
    origin,
    accept,
    acceptLanguage
  },
  cookiesAvailable,
  subtitleUrls,
  playerSession: "persist:player"
}
```

---

### 4. HLS Preflight 🔴 NEW

Before starting a stream download, test whether it is actually downloadable.

Check:

```text
Can fetch master playlist?
Can parse quality playlists?
Can fetch first segment?
Can fetch middle segment?
Are fragments returning 403?
Is stream expired?
Is encryption present?
Is DRM suspected?
Do cookies/session headers work?
Does proxy fallback work?
```

---

### 5. Compatibility Result 🔴 NEW

```js
{
  status: "ready" | "proxy_required" | "streaming_only" | "expired" | "blocked" | "drm",
  engine: "ffmpeg-direct" | "ffmpeg-proxy" | null,
  qualities: [],
  reason: "",
  canDownload: true
}
```

---

### 6. Download Button States 🟡 PARTIAL

Current states: Download, Downloaded, Downloading.

Full states needed:

```text
✅ Download
🔴 Check Download
🔴 Download Ready
🔴 Proxy Required
🔴 Streaming Only
🔴 Stream Expired
✅ Downloaded
```

---

## v1.3.0 Recommended Structure

```text
src/ipc/downloadDiagnostics.js    (extend existing diagnostics.js)
src/ipc/streamCapture.js          🔴 NEW
src/ipc/hlsPreflight.js           🔴 NEW

src/utils/streamContext.js        🔴 NEW
src/utils/downloadErrors.js       🔴 NEW
src/utils/downloadTypes.js        🔴 NEW

src/components/downloads/
  DownloadDiagnosticsPanel.jsx    🔴 NEW
  DownloadCompatibilityBadge.jsx  🔴 NEW
  DownloadErrorMessage.jsx        🔴 NEW
```

---

## Possible v1.3 Hotfixes

```text
v1.3.1 Fix diagnostics detection
v1.3.2 Fix HLS preflight false failures
v1.3.3 Fix stream expired / blocked messages
v1.3.4 Fix folder permission detection
```

---

# v1.4.0: Local Library + Offline Mode

## Goal

Make Orion useful even without internet.

---

## What Already Exists

```text
✅ Downloaded files can play locally
✅ Watch progress saved to localStorage (works offline)
✅ Saved titles list persisted (works offline)
✅ Watch history persisted (works offline)
🟡 Offline detection — HomePage shows "No Internet Connection" placeholder
🔴 Folder scanning / local file import — not implemented
🔴 Filename parsing — not implemented
🔴 Local subtitle matching — subtitle system only works with streaming
🔴 TMDB metadata matching for local files — not implemented
🔴 Local library page — not implemented
🔴 Graceful offline mode — current offline just shows error placeholder
```

---

## v1.4.0 Features

```text
🔴 Scan folder
🔴 Import movie file
🔴 Import series folder
🔴 Parse season / episode
🔴 Attach subtitles
🔴 Match TMDB metadata
🔴 Manual metadata edit
🔴 Detect duplicates
🟡 Downloaded badge (download state exists)
🔴 Local file badge
🟡 Play offline (downloaded files work, imported files don't)
🔴 Open file location
🔴 Search local media
🟡 Offline continue watching (progress persists, no offline UI)
```

---

## Offline Mode Should Support

```text
🔴 Local library
✅ Downloaded titles
✅ Watch history
✅ Progress
✅ Saved titles
🔴 Downloaded subtitles (local matching)
🔴 Local search
🟡 Continue watching (data persists, UI needs offline mode)
```

Better offline message:

```text
No internet. Showing your local Orion library.
```

---

## Local Library Structure

```text
src/ipc/localLibrary.js           🔴 NEW

src/services/library/
  libraryScanner.js               🔴 NEW
  fileNameParser.js               🔴 NEW
  metadataMatcher.js              🔴 NEW
  duplicateDetector.js            🔴 NEW
  subtitleMatcher.js              🔴 NEW
  localPlaybackService.js         🔴 NEW

src/components/library/
  LocalMediaCard.jsx              🔴 NEW
  ImportFolderModal.jsx           🔴 NEW
  MetadataMatchModal.jsx          🔴 NEW
  DuplicateReviewModal.jsx        🔴 NEW

src/pages/
  LocalLibraryPage.jsx            🔴 NEW
```

---

## Folder Structure

```text
Orion Library/
  Movies/
    Interstellar (2014)/
      Interstellar (2014).mp4
      Interstellar (2014).en.srt

  Series/
    Breaking Bad (2008)/
      Season 01/
        Breaking Bad S01E01.mp4
        Breaking Bad S01E01.en.srt
```

---

## Possible v1.4 Hotfixes

```text
v1.4.1 Fix folder scan bugs
v1.4.2 Fix metadata matching
v1.4.3 Fix local playback path issues
v1.4.4 Fix duplicate detection issues
```

---

# v1.5.0: Home, Watchlist, Manual Collections

## Goal

Make Orion's home and saved media feel curated before AI Collections.

---

## What Already Exists

```text
✅ Continue Watching row (HomePage.jsx — renderContinueSection)
✅ Trending Movies row (MediaCarousel — trendingMovies)
✅ Trending Series row (MediaCarousel — trendingTV)
✅ Your Watchlist / My List (saved items shown inline or as carousel)
✅ Recommended for You (history-based TMDB recommendations)
✅ Top Rated row (top_rated movies + TV interleaved)
✅ K-Dramas row (Korean drama discovery)
✅ Home row reordering + visibility toggles (homeLayout.js + HomeLayoutSection)
✅ Hero banner with spotlight (HeroBanner.jsx — top 5 trending)
🔴 Downloaded & Ready row — no home row for downloads
🔴 Local Library row — depends on v1.4.0
🟡 New Episodes row — checking exists, no home row
🔴 Manual Collections — only a flat watchlist
🔴 Recently Added row
🔴 Because You Saved (rule-based)
```

---

## v1.5.0 Home Rows

```text
✅ Continue Watching
✅ Trending Movies
✅ Trending Series
✅ Your Watchlist
🔴 Downloaded & Ready
🔴 Local Library
🟡 New Episodes (notification exists, no home row)
🔴 Manual Collections
🔴 Recently Added
🔴 Because You Saved, rule-based only
```

No AI yet.

---

## Manual Collections 🔴 NEW

Examples:

```text
Watch Later
Weekend Movies
Family Watch
Dark Sci-Fi
Anime Queue
Completed Series
```

---

## Collection Features

```text
🔴 Create collection
🔴 Rename collection
🔴 Delete collection
🔴 Add / remove titles
🔴 Manual ordering
🔴 Pinned collections
🔴 Collection cover
🔴 Filter collection by movie / series / anime
```

---

## Recommended Structure

```text
src/components/home/
  HomeHero.jsx               (extend existing HeroBanner.jsx)
  HomeRow.jsx                🔴 NEW
  ContinueWatchingRow.jsx    (extract from HomePage.jsx)
  DownloadedRow.jsx          🔴 NEW
  LocalLibraryRow.jsx        🔴 NEW
  NewEpisodesRow.jsx         🔴 NEW

src/services/home/
  homeRowsService.js         🔴 NEW
  homePersonalRows.js        🔴 NEW

src/components/collections/
  CollectionCard.jsx         🔴 NEW
  CreateCollectionModal.jsx  🔴 NEW
  AddToCollectionMenu.jsx    🔴 NEW

src/services/collections/
  collectionStore.js         🔴 NEW

src/pages/
  CollectionsPage.jsx        🔴 NEW
```

---

## Possible v1.5 Hotfixes

```text
v1.5.1 Fix collection ordering
v1.5.2 Fix home row visibility
v1.5.3 Fix saved titles collection sync
v1.5.4 Fix manual collection cover bugs
```

---

# v1.6.0: Playback Polish + Refactor

## Goal

Improve existing playback without duplicating what Orion already has.

---

## Already Present ✅

```text
✅ Injected skip controls
✅ -15s / +15s buttons
✅ Keyboard play / pause
✅ Keyboard seeking
✅ Keyboard volume
✅ Fullscreen shortcut
✅ Mute shortcut
✅ Double-click fullscreen
✅ Progress tracking
✅ Resume support state
✅ Voice Boost
✅ Source switching
✅ Source failover
✅ Mini-player / PiP hooks
✅ M3U8 detection
✅ Subtitle URL detection
✅ Downloaded / downloading button states
```

---

## v1.6.0 Improvements

```text
🔴 Centralize injected player scripts (currently scattered in MoviePage 71KB + TVPage 119KB)
🔴 Create reusable player injection service
🟡 Improve resume prompt UI
🔴 Add Replay Last 30 Seconds option
🔴 Subtitle delay setting
🟡 Subtitle style editor (basic subtitle styling exists, full editor needed)
🔴 Audio track selector, if available
🔴 Playback speed selector, if available
🟡 Better player error states (source failover prompt exists, needs improvement)
🟡 Better source compatibility labels (sources have labels/tags, no compatibility status)
🔴 Better player diagnostics
```

---

## Recommended Structure

```text
src/services/player/
  playerInjectionService.js   🔴 NEW (extract from MoviePage + TVPage)
  progressService.js          🔴 NEW (extract from App.jsx)
  resumeService.js            🔴 NEW (extract from App.jsx)
  sourceFailoverService.js    🔴 NEW (extract from page files)
  subtitleStyleService.js     🔴 NEW
  voiceBoostService.js        🔴 NEW (extract from page files)

src/components/player/
  ResumePrompt.jsx            🔴 NEW
  PlayerErrorState.jsx        🔴 NEW
  SourceStatusBadge.jsx       🔴 NEW
  SubtitleSettingsModal.jsx   🔴 NEW
  PlaybackDiagnosticsPanel.jsx 🔴 NEW
```

---

## Main Refactor Rule

```text
Move injected scripts and player logic out of huge page files where possible.
MoviePage.jsx (71KB) and TVPage.jsx (119KB) must become smaller.
```

---

## Possible v1.6 Hotfixes

```text
v1.6.1 Fix resume prompt issue
v1.6.2 Fix subtitle style bugs
v1.6.3 Fix source label / failover bugs
v1.6.4 Fix playback speed or audio track issues
```

---

# v1.7.0: Settings, Privacy, Notifications

## Goal

Make Orion easier to control, safer to use, and cleaner to maintain.

---

## What Already Exists

```text
✅ Settings page with 10 sections: Updates & API, Age Rating, Playback, Subtitles,
   Downloads, Notifications, Interface, Library, Backup, Storage & Data
✅ Jump-to-section navigation with search (SECTION_NAV with keywords)
✅ Appearance settings — themes, accent colors, custom CSS vars
✅ Backup & Restore — export/import JSON, scheduled backups
✅ Clear watch history, search history, metadata cache
✅ OS desktop notifications (new episodes)
✅ Settings search with keyword matching
🟡 Library & Privacy section — basic (clear history). No private session.
🟡 Download history — can remove individual items, no bulk clear
🔴 Private Session (incognito mode)
🔴 Section-specific reset (only full factory reset exists)
🔴 In-app notification center / history
```

---

## Settings Sections

Current (SettingsPage.jsx SECTION_NAV):

```text
✅ Updates & API        (version, TMDB token, metadata language, system check)
✅ Age Rating           (country, restriction level)
✅ Playback             (Invidious, watched threshold, AniSkip)
✅ Subtitles            (language, SubDL/Wyzie keys)
✅ Downloads            (folder path)
✅ Notifications        (new episode alerts)
✅ Interface            (home layout, start page, appearance, themes)
✅ Library              (library & privacy, sort)
✅ Backup               (backup & restore, scheduled backups)
✅ Storage & Data       (cache, reset, data management)
```

Plan's target (additions needed):

```text
🔴 Search section       (search preferences, default tab)
🔴 Privacy section       (private session, granular clears)
🔴 Player section        (separate from current playback — subtitle style, speed, etc.)
```

---

## Privacy Features

```text
🔴 Private Session
🔴 Disable watch history
✅ Clear watch history
✅ Clear search history
🟡 Clear download history (individual only, no bulk)
✅ Clear metadata cache
✅ Export user data (backup)
✅ Import user data (restore)
🟡 Reset specific sections (only full factory reset exists)
```

---

## Recommended Settings Structure

```text
src/components/settings/
  GeneralSettings.jsx       🔴 NEW (extract from SettingsPage.jsx)
  AppearanceSettings.jsx    🔴 NEW (extract from SettingsPage.jsx)
  PlayerSettings.jsx        🔴 NEW (extract from SettingsPage.jsx)
  SubtitleSettings.jsx      🔴 NEW (extract from SettingsPage.jsx)
  DownloadSettings.jsx      🔴 NEW (extract from SettingsPage.jsx)
  LibrarySettings.jsx       🔴 NEW (extract from SettingsPage.jsx)
  SearchSettings.jsx        🔴 NEW
  PrivacySettings.jsx       🔴 NEW
  BackupSettings.jsx        🔴 NEW (extract from SettingsPage.jsx)
  AdvancedSettings.jsx      🔴 NEW (extract from SettingsPage.jsx)
```

Note: SettingsPage.jsx is currently 151KB with all sections inline. This decomposition is critical.

---

## Notification Center 🔴 NEW

Expand current notification behavior into an in-app notification center.

Current: OS notifications for new episodes only.

Notification types:

```text
✅ New episode available (OS notification exists)
🔴 Download complete
🔴 Download failed
🔴 Subtitle downloaded
🔴 Library scan complete
🔴 Backup complete
🔴 Update available
🔴 Source failed
🔴 Stream expired
```

Recommended structure:

```text
src/services/notifications/
  notificationStore.js       🔴 NEW
  notificationTypes.js       🔴 NEW

src/components/notifications/
  NotificationCenter.jsx     🔴 NEW
  NotificationToast.jsx      🔴 NEW (extend existing Toast.jsx)
  NotificationItem.jsx       🔴 NEW
```

---

## Possible v1.7 Hotfixes

```text
v1.7.1 Fix private session behavior
v1.7.2 Fix notification center state
v1.7.3 Fix backup / restore issues
v1.7.4 Fix settings migration bugs
```

---

# v1.8.0: UI / UX Polish

## Goal

Make Orion feel more premium, smooth, and consistent.

---

## What Already Exists

```text
✅ Consistent MediaCard component reused across all pages
✅ Card hover effects with scale + shadow
✅ Modal system with enter/exit animations
✅ Theme system with dark/light + custom accents
✅ Smooth page transitions (fade-in class)
🟡 Loading states — spinners exist, no skeleton screens
🟡 Empty states — some exist (search "No results", offline placeholder), most lack actions
🟡 Error states — basic error boundary, source failover prompt
🟡 Focus states — basic styles, not comprehensive
🔴 Loading skeletons
🔴 Hover info previews on cards
🔴 Full keyboard tab/arrow navigation
🔴 Reduced motion support (prefers-reduced-motion)
```

---

## v1.8.0 Improvements

```text
🔴 Better loading skeletons
🟡 Better empty states (some exist, need actionable buttons)
🟡 Better error states
✅ Consistent cards (MediaCard already reusable)
🟡 Consistent badges (some badge styles, not unified)
🔴 Better hover previews
🟡 Better modal spacing
🟡 Better focus states
🟡 Keyboard navigation (works in player, not in UI)
🔴 Reduced motion support
🟡 More polished offline states (basic placeholder exists)
🟡 Better source status labels
🟡 Better download status labels
```

---

## Empty States

```text
No saved titles yet
No downloads yet
No local media found
No subtitles available
No internet connection        ✅ exists (HomePage offline placeholder)
No search results             ✅ exists (SearchModal)
No new episodes
```

Each state should include an action:

```text
Browse trending
Scan folder
Retry                         ✅ exists (offline retry button)
Open settings
Clear filters
```

---

## Possible v1.8 Hotfixes

```text
v1.8.1 Fix layout regressions
v1.8.2 Fix reduced motion bugs
v1.8.3 Fix empty / error state issues
v1.8.4 Fix card spacing or modal issues
```

---

# v1.9.0: Architecture Cleanup + AI Readiness

## Goal

Make Orion easier to debug, extend, and prepare for AI integration.

---

## What Already Exists

```text
✅ IPC layer separation (src/ipc/ for main process operations)
✅ Utils for pure helpers (src/utils/)
✅ Component organization (common, layout, media, modals, setup)
🟡 Pages — work but are monolith files:
   - MoviePage.jsx  71KB (player + UI + metadata + subtitles all mixed)
   - TVPage.jsx     119KB (same issue, even larger)
   - SettingsPage.jsx 151KB (all settings sections inline)
🟡 App.jsx 52KB — holds ALL application state
🔴 Services layer — no src/services/ directory exists
🔴 Data normalization for AI consumption
🔴 AI placeholder hooks
```

---

## Architecture Rule

```text
Pages compose UI.
Components render UI.
Services hold app logic.
IPC handles native / OS operations.
Utils hold pure helpers.
```

---

## Target Structure

```text
src/
  components/
    common/           ✅ exists (Icons, ErrorBoundary, ConfirmModal)
    layout/           ✅ exists (Sidebar, Toast, WindowTitlebar)
    search/           🔴 NEW (from v1.1.0)
    player/           🔴 NEW (from v1.6.0)
    downloads/        🔴 NEW (from v1.3.0)
    library/          🔴 NEW (from v1.4.0)
    cast/             🔴 NEW (from v1.1.0)
    collections/      🔴 NEW (from v1.5.0)
    notifications/    🔴 NEW (from v1.7.0)
    settings/         🔴 NEW (from v1.7.0 — extract from monolith)

  pages/
    HomePage.jsx           ✅ exists (12KB — reasonable)
    DiscoverPage.jsx       ✅ exists (10KB — reasonable)
    MoviePage.jsx          ✅ exists (71KB — needs decomposition)
    TVPage.jsx             ✅ exists (119KB — needs decomposition)
    LibraryPage.jsx        ✅ exists (19KB — reasonable)
    DownloadsPage.jsx      ✅ exists (3KB — reasonable)
    SettingsPage.jsx       ✅ exists (151KB — needs decomposition)
    CollectionsPage.jsx    🔴 NEW (from v1.5.0)
    LocalLibraryPage.jsx   🔴 NEW (from v1.4.0)
    PersonPage.jsx         🔴 NEW (future, after v1.1.0)

  services/               🔴 ENTIRE DIRECTORY IS NEW
    api/
    search/
    metadata/
    downloads/
    library/
    player/
    collections/
    notifications/
    offline/
    settings/

  ipc/
    downloads.js           ✅ exists (needs refactor — queue coordinator only)
    downloadResolver.js    🔴 NEW
    downloadDiagnostics.js ✅ exists (diagnostics.js — needs extension)
    directDownloader.js    🔴 NEW (extract from downloads.js)
    streamCapture.js       🔴 NEW
    hlsPreflight.js        🔴 NEW
    hlsDownloader.js       🔴 NEW (extract from downloads.js)
    hlsProxy.js            🔴 NEW
    localImport.js         🔴 NEW
    localLibrary.js        🔴 NEW
    storage.js             ✅ exists
    subtitles.js           ✅ exists
    player.js              ✅ exists

  utils/
    storage.js             ✅ exists
    downloadErrors.js      🔴 NEW
    downloadTypes.js       🔴 NEW
    streamContext.js       🔴 NEW
    fileNameParser.js      🔴 NEW
```

---

## Data to Normalize Before AI

```text
✅ Watch history (exists in localStorage)
✅ Completion percentage (progress tracking works)
✅ Search history (text queries stored)
✅ Saved titles (watchlist in localStorage)
🔴 Not interested
🔴 Hidden titles
✅ Downloads (persisted download records)
🔴 Local files
🔴 Cast metadata
🔴 Actor aliases
🟡 Genre metadata (available from TMDB, not cached separately)
🔴 Subtitle paths (local)
🔴 Scene timestamps, later
```

---

## Future AI Hooks

Add placeholders only:

```text
AI Search enabled, later
AI Scan animation, later
LanceDB index status, later
User taste profile, later
Scene index, later
```

Mark them:

```text
Coming later
```

---

## Possible v1.9 Hotfixes

```text
v1.9.1 Fix refactor regressions
v1.9.2 Fix IPC module issues
v1.9.3 Fix storage / data migration bugs
v1.9.4 Fix AI readiness metadata issues
```

---

# v2.0.0: AI Integration Starts

## Goal

Start Orion's local intelligence layer.

This is a major version because AI changes Orion's product identity.

---

## v2.0.0 Features

```text
AI Search toggle
AI Scan animation
LanceDB layer
Semantic search
Mood search
Personalized recommendations
Scene search
AI collections
```

---

## Important Rule

Orion AI does not use an LLM.

The future AI plan is based on:

```text
Local LanceDB intelligence layer
Embeddings
Metadata
Cast data
Watch history
Search history
Subtitle indexing
Mood tags
Ranking logic
Local personalization
```

---

## Possible v2.0 Hotfixes

```text
v2.0.1 Fix AI Search toggle bugs
v2.0.2 Fix LanceDB indexing bugs
v2.0.3 Fix AI Scan / semantic result issues
v2.0.4 Fix personalized ranking issues
```

---

# Final Implementation Priority

```text
 1. Search tabs and actor/person search                    🔴 NEW
 2. Cast metadata cache                                    🔴 NEW
 3. Cast on cards and detail pages                         🔴 NEW
 4. Asian actor alias/name normalization                   🔴 NEW
 5. Local/library/download/history search                  🟡 PARTIAL
 6. Downloader engine cleanup (decompose downloads.js)     🟡 PARTIAL
 7. Downloader diagnostics                                 🟡 PARTIAL
 8. HLS StreamContext and preflight                        🔴 NEW
 9. Local library and offline mode                         🔴 NEW
10. Manual collections and home upgrades                   🟡 PARTIAL (home ~50% done)
11. Playback polish/refactor                               🟡 PARTIAL (core ~60% done)
12. Settings/privacy/notifications                         🟡 PARTIAL (settings ~60% done)
13. UI polish                                              🟡 PARTIAL
14. Architecture cleanup                                   🔴 NEW (services layer)
15. AI readiness hooks                                     🔴 NEW
16. AI integration                                         🔴 NEW
```

---

# Final Principle

```text
Build the best non-AI Orion first.
Then AI becomes an evolution, not a repair patch.
```

---

# Next AI Feature Plan

The next AI roadmap is already saved from this session as:

```text
AI-Features plan for Orion.md
```

That saved plan covers the future AI side of Orion, including:

```text
AI Search
AI Scan activation
Local LanceDB Intelligence Layer
Semantic Search
AI Mood Search
Personalized Recommendations
Time / day-based recommendations
Smart Continue Watching
Scene Search
Auto Library Organizer
AI Collections
No-LLM AI architecture
```

This Pre-AI Upgrade Plan should be completed first.

After Orion reaches `v1.9.x` stability, continue with the saved AI Feature Plan and begin `v2.0.0`.
