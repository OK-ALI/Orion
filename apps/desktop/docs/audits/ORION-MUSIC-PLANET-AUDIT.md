# Orion Desktop — Music Planet Stabilization Audit

**Project:** Orion — A Multiverse of Stories
**Subsystem:** Music Planet
**Workspace:** `C:\Projects\Orion - A Multiverse of Stories\apps\desktop`
**Audit date:** 2026-08-18
**Audit status:** **LOCKED**
**Stabilization scope:** Playback/provider recovery + Music Planet UI/UX stabilization + collection/library correctness + responsive/theme/overlay finalization
**Master audit target:** `docs\audits\ORION-DESKTOP-V3-AUDIT.md`

---

## 1. Purpose of this audit

This document is the canonical subsystem audit for **Orion Desktop → Music Planet**.

It exists so that future Orion chats, Codex sessions, engineering passes, and the Orion Desktop V3 audit do not need to reconstruct Music Planet state from conversation history.

This file records:

- what was stabilized,
- what defects were found,
- what architectural owners were established,
- what was explicitly locked,
- what automated evidence passed,
- what was physically validated,
- what known warnings remain,
- what future work is allowed to touch,
- and what the Orion Desktop V3 audit should inherit from this subsystem.

**Rule:** Future Music Planet work must treat this audit as authoritative unless a later dated amendment explicitly supersedes part of it.

---

## 2. Final lock state

### Overall

**MUSIC PLANET UI/UX STABILIZATION — LOCKED**

### Phase board

| Phase | Area | Final state |
|---|---|---|
| MUSIC-P0 | Playback / provider recovery | LOCKED |
| C1 | Surface System + Theme Foundation | LOCKED |
| C2 | Shared Tracklists, Menus + Row Interaction | LOCKED |
| C3 | Detail Surface Architecture | LOCKED |
| C4 | Now Playing + Listening Console + Music-native Appearance + Navigation Restoration | LOCKED |
| C5 | Library Galaxy + Collection UX | LOCKED |
| C6.1 | Context Cursor | LOCKED |
| C6.1.1 | Search Control Geometry | LOCKED |
| C6.2 | Responsive + Theme + Overlay Final Coherence | LOCKED |

No C6.3 was required because the final evidence did not expose a remaining blocking defect.

---

## 3. Locked boundaries

The following areas are considered stable and must not be casually refactored:

- Music provider playback recovery contract.
- Stream resolution workaround that restored YouTube Music playback.
- AudioEngine playback/loading behavior validated during MUSIC-P0.
- Shared Music track-list geometry and row interaction.
- Shared overflow/menu behavior.
- Shared Music entity hero/detail architecture.
- Music-local return/history and exact scroll restoration.
- Music-native appearance/theme behavior.
- Favorites identity/store ownership.
- Playlist live-refresh behavior.
- Playlist artwork system.
- Library Overview continuation behavior.
- Library Galaxy continuation behavior.
- Local library scan lifecycle.
- Context cursor state system.
- Search clear/loading control geometry.
- Final responsive containment contract.
- Final Music overlay/z-index hierarchy.

**Do not reopen these areas for speculative cleanup.** Re-entry requires one of:

1. a real regression,
2. an important new product requirement,
3. a proven accessibility defect,
4. a proven performance defect,
5. or an explicit post-lock architecture project.

---

## 4. Stabilization outcome

The stabilization began as a Music Planet UI/UX pass but expanded into a full product stabilization effort because physical validation uncovered backend and functional defects that affected the user experience.

The final result includes both **visual-system stabilization** and **functional correctness recovery**.

### Major categories resolved

- Music playback/provider failures.
- Stream-resolution compatibility.
- Player loading-state behavior.
- Projector Silver theme ownership.
- Shared Music list geometry.
- Overflow menu architecture.
- Detail-page composition.
- Music navigation/return restoration.
- Now Playing / listening console hierarchy.
- Music-local appearance controls.
- Favorites consistency.
- Playlist mutation/live refresh.
- Playlist artwork generation and persistence.
- Missing-artwork fallback.
- Local library counts and Overview continuation.
- Real newest-first Recently Added behavior.
- Scan status lifecycle.
- Search clear/loading control collision.
- Context-aware cursor behavior.
- Narrow-window containment.
- Overlay hierarchy.
- Plugin theme ownership and removal of component-local raw styling.

---

## 5. MUSIC-P0 — Playback / Provider Recovery

### Problem

Music search/catalog behavior could work while actual searched playback failed even though managed `yt-dlp` / FFmpeg tooling was healthy.

### Recovery

The Music-only provider path was corrected without reopening Cinema/download core.

The successful recovery kept the workaround isolated to the Music streaming path and preserved the broader resolution/format contract.

### Lock result

Validated behavior included:

- play,
- pause,
- seek,
- track switching,
- sustained playback.

### Boundary

Do not touch the Music provider workaround, stream resolver, media range handling, AudioEngine playback behavior, downloader, or Cinema playback unless a new defect is evidenced.

---

## 6. C1 — Surface System + Theme Foundation

### Purpose

Establish theme-safe Music surfaces and remove raw visual slabs, especially under Projector Silver.

### Resolved

- Raw wrapper/background slabs.
- Projector Silver primary-action contrast.
- Shared semantic action ownership.

### Result

Projector Silver and dark-theme behavior passed automated and physical validation.

**C1: LOCKED**

---

## 7. C2 — Shared Tracklists, Menus + Row Interaction

### Purpose

Move Music track interaction away from repeated card-like patches into a shared list system.

### Resolved

- Real overflow SVG/icon control.
- Shared action rail.
- Compact Quick Play.
- Dedicated track-list stylesheet.
- Track rows converted from over-carded blocks into coherent list rhythm.
- Source-size ownership respected rather than expanding a giant stylesheet.

### Physical result

Tracklists were explicitly accepted as visually correct.

**C2: LOCKED**

---

## 8. C3 — Detail Surface Architecture

### Root cause discovered

A detail flex layout was being overridden by a later stylesheet with `display: block`, producing large empty acreage and broken composition.

### Architecture introduced

- Shared `MusicEntityHero`.
- Dedicated detail-surface ownership.
- Projector Silver detail slab corrected at shared owner.

### Result

Artist/album/detail composition passed physical validation.

**C3: LOCKED**

---

## 9. C4 — Listening, Navigation + Appearance

### Scope

- Music-local return history.
- Exact Home scroll restoration.
- Search-context restoration.
- Listening console hierarchy.
- Music-native theme quick switch.
- Settings/appearance behavior.

### Result

Automation and physical validation passed.

### Boundary

Playback core remained untouched.

**C4: LOCKED**

---

## 10. C5 — Library Galaxy + Collection UX

C5 required multiple evidence-driven iterations because physical validation surfaced defects that automated tests alone did not reveal.

### C5.1

Introduced:

- shared Favorites payload/identity,
- Home favorite unwrap,
- grouped Favorites view,
- Library Galaxy lanes,
- collection controls,
- collection tests/E2E.

Physical validation exposed stale Home favorites/playlists and collection-layout problems.

### C5.2

Corrected:

- shared Favorites store as live owner,
- metadata-light Home favorite preview support,
- favorite toggles through store ownership,
- collection-change refresh,
- Home playlist refresh,
- Library stats/empty lane,
- Playlist workspace hierarchy,
- playlist selection/filter state.

Automation passed, then physical validation exposed overlay/artwork/fallback issues.

### C5.3 — Artwork + Overlay polish

Introduced:

- body-portal track menu with viewport clamping,
- playlist artwork helper,
- Smart Mosaic,
- six preset artwork modes,
- custom image artwork,
- empty-playlist deterministic fallback,
- spectral missing-artwork fallback,
- collection detail polish.

Playlist artwork modes included:

- Smart Mosaic,
- Orion Glow,
- Velvet Orbit,
- Signal Bloom,
- Night Drive,
- Solar Dust,
- Monochrome,
- custom image.

A first E2E failure was traced to stale production `dist` caused by running E2E before rebuilding. After the correct source → full gate/build → E2E order, the C5.3 chain passed.

### C5.4 — Library Overview + Lifecycle

The real-world acceptance case used a **66-song imported folder**.

Resolved:

- Overview previously showed only 8 tracks with no continuation.
- Recently Added previously inherited current sort rather than true newest-first order.
- Search could temporarily replace authoritative totals with search-subset totals.
- Scan completion lifecycle lacked desired transient behavior.

Final behavior:

- Overview previews remain bounded.
- `8 of N` continuation is shown when more items exist.
- View All opens the complete local collection.
- Recently Added is truly newest-first.
- Search filters the visible list without replacing authoritative full-library totals.
- Home Library Galaxy has compact continuation behavior.
- Scan status:
  - appears during active scan,
  - completion auto-hides,
  - cancelled state auto-hides on a longer delay,
  - terminal state can be dismissed,
  - errors remain visible,
  - next scan reappears correctly.

The stale test expectation `"Local Signals"` was updated to the intentional `"Recently Added"` contract rather than reverting product copy.

### Final C5 result

Automation and real-library physical validation passed, including:

- Favorites overflow menu,
- Projector Silver filter rail,
- playlist artwork,
- custom artwork persistence,
- missing-artwork fallback,
- aligned Library counts,
- 66-track continuation,
- Recently Added ordering,
- scan lifecycle.

**C5: LOCKED**

---

## 11. C6.1 — Context Cursor

### Root cause

The original custom cursor effectively had only:

- a small default dot,
- and a large generic hover ring.

This treated compact precision controls, text fields, sliders, draggable elements, disabled controls, and normal actions too similarly.

The Search clear control was smaller than the original hover ring, making the cursor visually dominate the control.

### Final semantic cursor states

- `default`
- `action`
- `precision`
- `text`
- `adjust`
- `drag`
- `blocked`

### Additional fixes

- Track-menu portal participates in cursor ownership.
- Reduced-motion/native cursor fallback preserved.
- Rogue component-local `cursor:none` ownership removed.
- Playlist dialog close controls gained accessible labels.

### Validation

Focused unit tests, full Desktop gates, dedicated Electron cursor E2E, and physical validation passed.

**C6.1: LOCKED**

---

## 12. C6.1.1 — Search Control Geometry

Physical validation correctly exposed that the remaining Search issue was not primarily the cursor ring.

### Defect 1 — clear button moved on hover

The Search clear control was vertically centered using `translateY(-50%)`, but a shared hover rule replaced its transform, causing the circular `×` control itself to move.

### Defect 2 — loader and clear control shared the same space

The loading spinner and Search clear control were positioned in nearly the same right-side slot and could overlap.

### Final behavior

- Search clear control preserves its vertical-centering transform on hover/focus.
- Loading spinner uses a separate slot to the left.
- Input reserves enough right-side space while both controls exist.
- Product behavior remains unchanged.

### Validation

- Focused Search/Cursor contracts passed.
- Full Desktop gates passed.
- Dedicated Search-control Electron E2E passed.
- Physical validation passed.

**C6.1.1: LOCKED**

---

## 13. C6.2 — Responsive + Theme + Overlay Final Coherence

### Purpose

Perform the final Music-wide structural sweep without redesigning locked C1–C5 surfaces.

### Final ownership added

#### Overlay layer tokens

A documented hierarchy was established:

`detail < sidebar < track menu < dialog < modal < cursor`

This replaced scattered reasoning about local z-index values with a semantic final contract.

#### Responsive contract

Final responsive layers were defined around:

- 1040px,
- 820px,
- 680px.

The goal was containment and usability, not redesign.

Covered areas included:

- Music Home,
- Search,
- detail overlays,
- Library,
- Playlists,
- toolbar/control groups,
- plugin cards,
- dialogs,
- narrow desktop windows.

#### Plugin coherence

The Plugins section no longer owns raw component-local presentation styles.

It now uses dedicated theme-aware stylesheet ownership.

### Automated evidence

Final run:

- source-size check: **342 files passed**
- renderer bindings: **296 files passed**
- IPC: **220 methods / 139 channels preserved**
- secrets: passed
- theme-color check: passed
- circular dependencies: none
- Node tests: **89 / 89 passed**
- Renderer tests: **49 files / 185 tests passed**
- Vite production build: passed
- final cross-Music Electron E2E: **4 / 4 passed**

The final E2E sweep covered:

- context cursor,
- final narrow-window containment,
- playlist overlay flows,
- broader Music Planet provider/context behavior.

### Physical evidence

Final physical sweep passed across:

- Projector Silver,
- dark theme,
- Custom Appearance,
- Home,
- Search,
- Album/Artist detail,
- Library,
- Playlist workspace,
- Now Playing,
- Plugins,
- narrow desktop widths,
- overlay/menu/dialog ordering,
- horizontal containment.

**C6.2: LOCKED**

---

## 14. Final automated evidence snapshot

The final C6.2 validation established the closing baseline:

| Gate | Result |
|---|---|
| Source-size | 342 files passed |
| Renderer bindings | 296 files passed |
| IPC | 220 methods / 139 channels preserved |
| Secrets | PASS |
| Theme color check | PASS |
| Circular dependency check | PASS |
| Node tests | 89 / 89 |
| Renderer tests | 49 files / 185 tests |
| Production build | PASS |
| Final focused contracts | 6 / 6 |
| Final cross-Music E2E | 4 / 4 |
| Final physical validation | PASS |

---

## 15. Known non-blocking warnings

These were present at lock and do **not** invalidate the Music Planet stabilization lock:

1. Vite chunk-size warning for bundles larger than 500 kB.
2. Node SQLite experimental-feature warning.
3. MiniPlayer test warning about a React update not wrapped in `act(...)`.

These are backlog items, not reasons to reopen Music Planet stabilization.

**Do not increase the Vite chunk-size warning threshold merely to silence the warning.**

---

## 16. Engineering principles confirmed during stabilization

### Shared defect → shared owner → global repair

A defect that appears across surfaces should be fixed at its owner rather than patched page-by-page.

### Page-specific defect → page composition repair

Do not add global CSS antidotes for a one-page composition problem.

### Physical validation is mandatory

Multiple important defects only appeared after real-app inspection despite green automated tests.

### Production E2E requires a fresh build

The correct order is:

1. source change,
2. focused tests where useful,
3. full Desktop gate/build,
4. production Electron E2E,
5. physical validation.

### Source-size limits are architectural signals

Do not raise source-size limits to make a large file pass.

Split responsibility into dedicated owner files instead.

### Local workspace is authoritative

Do not silently restore or overwrite current workspace state from GitHub.

---

## 17. Relationship to other Orion locks

This audit covers **Music Planet** only.

It must not be interpreted as authorization to modify other locked Orion areas.

Known locked/frozen boundaries referenced during this work include:

- Orion Desktop core,
- Cinema UI/UX,
- downloader/playback core,
- Smart Connect production behavior,
- sidebar mechanics,
- Search Orb base behavior,
- Mobile Orion remains outside this Desktop stabilization work.

If another subsystem has its own audit, that subsystem audit is authoritative for its own lock.

---

## 18. Instructions for future Music Planet work

Before editing Music Planet:

1. Read this audit.
2. Identify whether the requested change touches a locked contract.
3. If it does, state why reopening is justified.
4. Inspect the real current workspace before patching.
5. Prefer shared owners over page-local fixes.
6. Keep new source files within source-size policy.
7. Run focused validation.
8. Run the full Desktop gate.
9. Rebuild before Electron E2E.
10. Physically validate.
11. Add a dated post-lock amendment here if the lock contract changed.

---

## 19. Post-lock amendment template

Append future justified Music Planet changes below this section.

```md
## Post-Lock Amendment — YYYY-MM-DD

### Reason
Why was a locked Music Planet area reopened?

### Scope
Files / owners changed.

### Locked contracts affected
What previously locked behavior was touched?

### Evidence
- focused tests:
- full gate:
- production build:
- E2E:
- physical validation:

### Result
PASS / FAIL / PARTIAL

### New lock state
What is locked after this amendment?
```

---

## 20. Required V3 audit entry

The Orion Desktop V3 audit should include at minimum:

```md
### Music Planet
**Status:** LOCKED
**Subsystem audit:** `docs/audits/ORION-MUSIC-PLANET-AUDIT.md`

- Playback/provider recovery: PASS
- Music UI/UX stabilization: PASS
- Theme system: PASS
- Tracklist/detail architecture: PASS
- Listening/navigation/appearance: PASS
- Favorites/playlists/library: PASS
- Context cursor/search geometry: PASS
- Responsive/theme/overlay final audit: PASS
- Production build: PASS
- Focused final contracts: PASS
- Cross-Music Electron E2E: PASS
- Final physical validation: PASS

Known non-blockers:
- Vite >500 kB chunk warning
- SQLite experimental warning
- MiniPlayer `act(...)` test warning
```

The V3 audit should summarize this file rather than duplicating every implementation detail.

---

# FINAL DECLARATION

**MUSIC-P0 — LOCKED**
**C1 — LOCKED**
**C2 — LOCKED**
**C3 — LOCKED**
**C4 — LOCKED**
**C5 — LOCKED**
**C6.1 — LOCKED**
**C6.1.1 — LOCKED**
**C6.2 — LOCKED**

## MUSIC PLANET UI/UX STABILIZATION — LOCKED

This subsystem is considered stable as of **2026-08-18** based on code changes, focused tests, full Desktop gates, production builds, Electron E2E coverage, and repeated physical validation.
