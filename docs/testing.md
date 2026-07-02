# Testing Orion

## Local gates

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run test:electron
```

`npm run check` runs source-size enforcement, unresolved source/JSX binding detection, the IPC compatibility snapshot, secret and theme-color scanning, dependency-cycle detection, node tests, renderer tests, and a production Vite build.

Electron tests use a temporary Chromium profile and disable GPU acceleration for deterministic automation. They do not read or modify the real Orion user profile.

## Manual release matrix

- Start with no existing profile and with copied v1.0.7, v1.0.9 and v1.0.10 profiles appropriate to the migration under test.
- Open Home, Discover, Library, Settings, Movie, TV, and Downloads.
- Stream one movie and two consecutive TV episodes; test resume, watched state, failover, fullscreen, automatic mini-player, pop-out ownership, and pop-out-to-mini return.
- Download a direct HLS item and a browser-context/proxy item; test pause, resume, retry, cancellation, subtitles, and app restart.
- Close the main window during an active download and verify tray progress and controls.
- Verify SubDL and Wyzie with user-owned keys; verify the bundled TMDB token without user setup.
- Seek through a large local file, enable a sidecar subtitle, move/repair it, and verify opaque token rejection.
- Verify battery state, critical-battery download pause/resume, adaptive performance diagnostics and Windows media-session commands on supported Windows hardware.
- Capture Home, Discover, Search, Person, Settings, Movie, TV, Library, Downloads, mini-player and local-player baselines in Midnight Premiere, AMOLED, Mocha, Slate, Projector Silver and Custom; repeat the interaction pass with Reduced Motion.
- Install both the NSIS and ZIP builds on a clean Windows account without system `yt-dlp`, ffmpeg, or Python.

Live provider tests are intentionally manual because hosts and signed URLs change independently of Orion.

The v1.1.0 automated suite covers retained person search results, same-title/language disambiguation, independent type/cinema filtering in quick and full search, quick type filters beyond the 12-result cap, role/job merging, known-for ranking, key-crew extraction, explicit pagination, stale-query rejection, retryable Person failures, keyboard media-card activation, cast/crew navigation and quick-search-to-Person back-stack behavior. Constellation coverage adds regional query generation, South Indian multi-language discovery, credit-derived membership, person deduplication, weighted ranking, bounded mapping, progressive Load more results, valid-cache reuse, cache expiry/versioning, personalized seed deduplication, preference persistence, offline-cache behavior and Sidebar → Constellation → Person → Back navigation. Network coverage verifies rounded HTTP round-trip measurement, offline short-circuiting, latency tiers and title-bar placement beside battery status. Electron coverage captures the expanded, non-blurred disambiguated quick-search workspace in Midnight Premiere and Projector Silver. The remaining release checks are user validation of Constellation pagination and connectivity display, the complete six-theme visual matrix, live Movie/TV regression smoke tests, copied-profile validation and clean Windows packaging. v1.1.0 must not be published until those checks are explicitly accepted.

Library compatibility coverage starts with reduced v1.0.x saved records and an incomplete `savedOrder`, verifies non-destructive TMDB metadata repair, confirms legacy year fallback never renders as `N/A`, and exercises live Custom/A-Z/Top-rated/Newest sorting through the real Electron shell.
