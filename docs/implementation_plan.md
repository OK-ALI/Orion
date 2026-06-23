# Implementation Plan - Orion (A Multiverse of Stories)

Build a premium Electron desktop streaming application that has its own unique, Netflix-inspired dark UI with custom design tokens, smooth animations, and advanced playback features, rather than completely relying on Streambert's styles.

## Live Snapshot & Version Roadmap
As requested, we will establish a dedicated version document at [version_implementations.md](file:///d:/Projects/Orion%20-%20A%20Multiverse%20of%20Stories/docs/version_implementations.md) to log and track version-based implementations.

The release roadmap is structured as:
* **v1.0.0 (Foundation)**: Custom titlebar, collapsible sidebar, Setup flow (TMDB key prompt), System Check diagnostics panel, IPC bridges, and ad-blocking session filters. (Done)
* **v1.1.0 (Refined Streaming UI)**: Fixed `.media-card` components, Netflix-inspired dark grids, robust home carousels with fluid directional animations, full-page Discover genre filters, and Search page results. (Current Focus)
* **v1.2.0 (Premium Playback & Custom Controls)**: Custom webview keyboard control injection (`Space`, arrows, fullscreen, volume, mute), seek-on-load progress tracking, resume prompt modal, next episode autoplay countdown HUD, and auto-failover source switcher HUD. (Current Focus)
* **v1.3.0 (Library & Download Manager)**: Watchlist sync, Watch History with deduplicated tracking, queue manager, local scanning, custom downloader folders, and Subtitle downloader integrations. (Next Focus)
* **v1.4.0 (Settings & Polish)**: Settings modal with tabbed sections, customizable accents, theme Zoom scaling, auto-update checker, backups. (Final Focus)

---

## User Review Required

> [!IMPORTANT]
> **Media Card Styling Sync**: Orion's component code `MediaCard.jsx` was refactored to use `.media-card` BEM namespaces, but the corresponding CSS rules inside `src/styles/components.css` were left with the old `.card` selector. This mismatch is why card details render broken/unformatted. We will write dedicated `.media-card` classes styled with modern HSL tokens and subtle shadows.

> [!TIP]
> **Slider Animations on Home**: We will implement native keyframe animations (`mediaCarouselSlideInFwd` and `mediaCarouselSlideInBwd`) on `.media-carousel-track` using CSS variables to create smooth sliding transitions when switching items.

---

## Open Questions

* **Slider Interaction**: Do you want auto-rotation of the home carousels paused completely when the user places their mouse cursor over them? (Recommended: Yes, it provides a much cleaner browsing experience).
* **Keyboard Hotkeys Injection**: Are there additional hotkeys you want injected in the webview, such as `S` for intro skipping? (Recommended: Yes, intro skipping can hook into `aniSkip` data for Anime).

---

## Proposed Changes

### Documentation Component

#### [NEW] [version_implementations.md](file:///d:/Projects/Orion%20-%20A%20Multiverse%20of%20Stories/docs/version_implementations.md)
* Create a dedicated log outlining features, completion status, and notes per version.

### Style Component

#### [MODIFY] [components.css](file:///d:/Projects/Orion%20-%20A%20Multiverse%20of%20Stories/src/styles/components.css)
* Add styling for `.media-card` and all sub-elements (`.media-card-poster`, `.media-card-info`, `.media-card-title`, `.media-card-meta`, `.media-card-type-badge`, `.media-card-placeholder`) utilizing theme variables.
* Add slide animations and tracking for `.media-carousel-track` with directional transition keyframes (`mediaCarouselSlideInFwd` / `mediaCarouselSlideInBwd`).
* Clean up outdated `.card` class rules to avoid redundancy.

### Carousel Component

#### [MODIFY] [MediaCarousel.jsx](file:///d:/Projects/Orion%20-%20A%20Multiverse%20of%20Stories/src/components/media/MediaCarousel.jsx)
* Add standard React mouse events (`onMouseEnter`, `onMouseLeave`) to pause auto-cycling while hover is active.
* Verify the track transitions match the new slide animation CSS classes.

---

## Verification Plan

### Automated Tests
* Run `npm run build` to verify Vite builds the React client successfully.
* Run `node --check index.js` to ensure main process file syntax is sound.

### Manual Verification
* Launch the Electron app using `npm start`.
* Verify that the movie cards on the Home page grid/carousels now display with correct layout, sizing, typography, and hover zoom effects.
* Navigate using arrows on the Home carousel and verify the sliding animation is active, smooth, and pauses on hover.
