# Orion Codebase Analysis & Refactoring Plan

This document provides a detailed code quality analysis of Orion's largest source files and outlines a structured modularization strategy to reduce complexity, increase stability, and prevent cross-feature regressions during edits.

---

## 📊 File Size Analysis

A scan of the `src` directory shows a high concentration of logic in a few large files:

| Component / File | Size (KB) | Main Responsibilities & Concerns |
| :--- | :--- | :--- |
| **`SettingsPage.jsx`** | 154 KB | Tab management, global styling inputs, database backup/restore, age restrictions, subtitle configurations, cache metrics, and custom theme presets. |
| **`TVPage.jsx`** | 125 KB | TV metadata fetching, season/episode selection grid, collapsible summaries, custom AudioNode DSP chains, subframe-aware tracking loops, trailer modal controls, and recommendation grids. |
| **`MoviePage.jsx`** | 76 KB | Movie detail layout, player integration, ambient glow, download queues, collection cards, audio boost, and fullscreen interceptions. |
| **`App.jsx`** | 53 KB | Global route management, theme injection, sidebar layouts, window frame decorations, global key listener bindings, and modal state management. |
| **`downloads.js`** | 52 KB | **(Main Process)** segment download orchestration, HLS parsing, concurrent chunk fetching, ffmpeg merging operations, database updates, and download progress reporting. |

---

## 🛠️ Refactoring Proposal per Component

### 1. Settings Component (`SettingsPage.jsx`)
#### Current State:
A monolithic file containing over 3,000 lines of forms, UI state, metrics calculation, styling tables, and modal configs.

#### Proposed Modularization:
Create a dedicated `src/components/settings` directory and split settings panels into standalone components:
- `SettingsTabs.jsx` — Shell sidebar navigation.
- `GeneralSettings.jsx` — Language settings, system tray toggle, and reset options.
- `PlayerSettings.jsx` — Autoplay, subtitle style selectors, failover sources, and voice boost defaults.
- `ThemeSettings.jsx` — Custom CSS editor, color themes, and preset managers.
- `AgeRatingSettings.jsx` — Pin security code configuration, restriction level sliders, and country code selector.
- `DatabaseSettings.jsx` — Backend storage statistics, cache clear utilities, download purge controls, and database export/import widgets.

---

### 2. Player Page Components (`TVPage.jsx` & `MoviePage.jsx`)
#### Current State:
Contains complex hooks and UI sections inside the page components, creating a dense layout that makes modifications risky.

#### Proposed Modularization:
Extract shared playback, audio, and visual logics into custom hooks and UI modules inside a unified player directory:
- **Custom Player Hooks**:
  - `usePlayerAmbientColor(webviewRef, playing)` — Color extraction sniffer.
  - `usePlayerVoiceBoost(webviewRef, active)` — Configures and toggles Web Audio DSP nodes.
  - `usePlayerTracking(webviewRef, key, isTv)` — Handles progress intervals, seek recovery, and local storage saves.
- **Player Sub-Components**:
  - `PlayerFrame.jsx` — Handles the `<webview>` setup, partition configs, security settings, and subframe scripts.
  - `PlayerPauseOverlay.jsx` — Fades in title metadata and large play icon overlays.
  - `PlayerOverlayGroup.jsx` — Player headers, exit handles, pip buttons, audio filters, and subtitles selection dropdowns.
- **Detail View Sub-Components**:
  - `CollectionShelf.jsx` — Collections grid layout.
  - `EpisodeGrid.jsx` — Episode selector cards, collapsible descriptions, and scroll helpers.
  - `MediaDetailHeader.jsx` — Metadata badges, bookmark toggles, age labels, download and trailer launch pads.

---

### 3. Application Layout & Routing Shell (`App.jsx`)
#### Current State:
Acts as both the routing system, system tray listener, theme styling injector, modal display container, and frame titlebar manager.

#### Proposed Modularization:
Clean up `App.jsx` by extracting layout and layout handlers:
- `AppLayout.jsx` — Sidebar navigation shell, Window titlebar, and main view layout.
- `AppRoutes.jsx` — Simple page router mapping states to `HomePage`, `DiscoverPage`, `TVPage`, etc.
- `GlobalModalManager.jsx` — Wrapper that reads global states and renders corresponding modals (`UpdateModal`, `WyzieKeyModal`, `DownloadsDownloadModal`, etc.).
- `useWindowFrame.jsx` — Custom hook for IPC listeners managing window drag, minimize, maximize, and app quits.

---

### 4. Downloader Engine (`downloads.js` - Main Process)
#### Current State:
Implements both HLS stream details parsing, file disk operations, segment download tasks queue, custom rate-limit retries, and SQLite/JSON database reads/writes in one file.

#### Proposed Modularization:
Divide the downloader into clean modular layers inside `src/main/downloader`:
- `downloadQueue.js` — Queue engine for segment downloading tasks.
- `hlsParser.js` — Parses m3u8 playlists and resolves streams.
- `ffmpegMerger.js` — Spawns ffmpeg to merge ts segments, demux subtitles, and join audio channels.
- `downloadDb.js` — Storage engine for recording downloads database records.
- `downloadIpc.js` — Clean IPC handlers routing renderer requests to the downloader.

---

## 📈 Next Steps & Timeline

1. **Phase 1: Stabilization & Play/Pause Verification** (Current task)
   - Ensure subframe tracking and overlay issues are resolved, and tag v1.0.5 is validated.
2. **Phase 2: Main Process & Preload API separation** (Orion v1.1.0)
   - Extract `downloads.js` engine components into clean sub-modules.
3. **Phase 3: Pages Hook Extraction** (Orion v1.1.1)
   - Extract player Hooks (`usePlayerTracking`, `usePlayerVoiceBoost`, `usePlayerAmbientColor`).
4. **Phase 4: Component Separation** (Orion v1.2.0)
   - Separate Settings tab components and Media Detail panels.
