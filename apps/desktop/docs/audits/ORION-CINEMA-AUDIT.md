# Orion Desktop — Cinema Stabilization Audit

**Project:** Orion — A Multiverse of Stories
**Subsystem:** Cinema UI/UX
**Workspace:** `C:\Projects\Orion - A Multiverse of Stories\apps\desktop`
**Audit date:** 2026-08-18
**Audit status:** **LOCKED**
**Stabilization scope:** Cinema shell/navigation + Search/Discovery entry UX + appearance/theme coherence + shared Desktop UX contracts validated through Cinema
**Master audit target:** `docs\audits\ORION-DESKTOP-V3-AUDIT.md`

---

## 1. Purpose of this audit

This document is the canonical subsystem audit for **Orion Desktop → Cinema UI/UX**.

It exists so future Orion chats, Codex sessions, engineering passes, and the Orion Desktop V3 audit do not need to reconstruct Cinema stabilization state from conversation history.

This file records:

- the final Cinema lock state,
- the exact stabilization scope owned by this chat,
- the major UI/UX defects and contracts repaired,
- the shared owners established for Sidebar, Search Orb, Search workspace, and appearance semantics,
- the automated and Electron evidence used at lock,
- the final physical acceptance,
- known non-blocking warnings,
- boundaries that belong to other subsystem audits,
- future reopen rules,
- and the summary entry the master V3 audit should inherit.

**Rule:** Future Cinema work must treat this audit as authoritative unless a later dated amendment explicitly supersedes part of it.

---

## 2. Final lock state

### Overall

**ORION CINEMA UI/UX STABILIZATION — LOCKED**

Cinema was explicitly accepted after physical validation as **polished, stabilized, and complete** for the stabilization scope covered here.

### Stabilization board

| Area | Final state |
|---|---|
| Cinema rail-first Sidebar + navigation shell | LOCKED |
| Sidebar semantic icon system | LOCKED |
| Projector Silver / semantic appearance foundation | LOCKED |
| Projector Red independent accent | LOCKED |
| Custom Appearance compatibility for shared semantic tokens | LOCKED |
| Global Search Orb base UX | LOCKED |
| Cinema Quick Search | LOCKED |
| Full Cinema Search entry / focus / return behavior | LOCKED |
| Search Orb drag / persistence / placement | LOCKED |
| Search filter rail + result containment | LOCKED |
| Cinema Search / Music-provider ownership boundary | LOCKED |
| Cinema physical UI/UX acceptance | LOCKED |

This audit does **not** claim ownership of the Desktop playback/downloader core, Smart Connect runtime, or Music Planet. Those are separate subsystem boundaries.

---

## 3. Scope and exclusions

### Included in this Cinema audit

Direct stabilization work covered:

- Cinema Sidebar behavior and migration from the retired three-width model.
- Auto rail and Keep Open behavior.
- Non-reflowing hover reveal.
- Cinema/Music independent Sidebar preferences at the shared shell boundary.
- Semantic Sidebar icon cleanup and world-switch identity.
- Desktop Projector Silver warmth/coherence at the shared appearance owner.
- Projector Red as an independent accent.
- semantic glass/border/disabled/shadow tokens.
- Custom Appearance compatibility with the semantic appearance bridge.
- the floating Search Orb.
- Search Orb drag, clamping, edge assistance, persistence, and reset.
- left-click full Cinema Search.
- right-click Cinema Quick Search.
- Quick Search placement around the Orb.
- Quick Search panel hierarchy and result containment.
- horizontal mouse-wheel behavior for overflowing filter rails.
- Cinema Movies / TV / People search filtering.
- Cinema filter behavior in the expanded Quick Search workspace.
- Search input focus behavior.
- Search Orb hidden state while full Search is active.
- Back navigation restoring the Orb after leaving Search.
- Search overlay transition ownership.
- keeping Cinema Search independent from MusicProvider requirements.
- preserving the established Cinema `View all results for …` accessible contract.
- source-size governance when Search Orb integration pushed the application shell over its temporary ceiling.

### Explicitly excluded

This audit does not authorize changes to:

- playback/provider internals,
- downloader internals,
- Smart Connect production runtime,
- Music Planet stabilization contracts,
- Mobile Orion,
- frozen shared Mobile boundaries,
- or unrelated Desktop core behavior.

Where shared components are referenced here, the lock applies to the behavior physically and automatically validated through Cinema, not to unrelated subsystem internals.

---

## 4. Locked boundaries

The following Cinema/shared UX contracts are stable and must not be casually refactored:

- Auto rail is the canonical resting Sidebar mode.
- Keep Open is the only persistent full Sidebar mode.
- Retired `expanded` / `compact` / `collapsed` Sidebar values migrate to Auto rail.
- Hover reveal overlays the current page and does not force page reflow.
- Cinema and Music retain independent Sidebar mode storage.
- Search Orb base drag/persistence geometry.
- Search Orb left-click full-search contract.
- Search Orb right-click anchored Quick Search contract.
- Search Orb hidden behavior inside full Search.
- Back-navigation restoration of the Search Orb.
- Cinema Search must not require MusicProvider merely because SearchModal is shared.
- Cinema Quick Search result-type and cinema-filter behavior.
- overflowing Quick Search filter rails translate vertical wheel input into horizontal scrolling.
- result rows must remain contained inside the Quick Search panel rather than becoming horizontally scrollable.
- Projector Silver remains warm/projector-paper rather than clinical white.
- Projector Red remains an independent accent and is not forced by Projector Silver.
- Custom Appearance continues to feed the same semantic theme system rather than becoming a parallel visual implementation.
- source-size limits remain architectural signals and are not raised simply to admit new code.

**Do not reopen these areas for speculative cleanup.** Re-entry requires one of:

1. a proven regression,
2. an important new product requirement,
3. a proven accessibility defect,
4. a proven performance defect,
5. or an explicit post-lock architecture project.

---

## 5. Stabilization outcome

The Cinema pass began as a visual/navigation refinement and became a shared Desktop UX stabilization effort because physical review exposed issues that isolated screenshots or unit tests could not fully judge.

The final result established a coherent shell rather than a collection of page-local patches.

### Major categories resolved

- three-width Sidebar model retired in favor of rail-first navigation,
- Sidebar reveal/no-reflow behavior,
- persistent Keep Open mode,
- independent Cinema/Music Sidebar preferences,
- semantic Sidebar icon cleanup,
- warmer Projector Silver foundation,
- independent Projector Red accent,
- shared semantic appearance bridge,
- floating movable Search Orb,
- anchored frosted Quick Search,
- Search Orb persistence and safe viewport geometry,
- Search-page Orb hiding and Back restoration,
- Quick Search filter-wheel behavior,
- Quick Search result containment,
- Cinema Movies/TV/People filter behavior,
- SearchModal provider-boundary isolation,
- established Cinema View All accessibility wording,
- Search overlay enter/exit ownership,
- application-shell source-size ownership.

---

## 6. Rail-first Sidebar + navigation shell

### Previous model

Cinema previously carried a permanent three-width Sidebar cycle based around expanded, compact, and collapsed states.

The final design intentionally retired that model.

### Final contract

Two states remain:

- **Auto rail (recommended)**
- **Keep open**

Auto rail behavior:

- the resting state is the vertical `ORION CINEMA` rail,
- hover/focus reveals full navigation,
- reveal is a temporary overlay,
- leaving the reveal returns to the rail,
- content does not shift merely because the Sidebar was revealed.

Keep Open behavior:

- full navigation remains persistently open,
- the user can return to Auto rail.

### Migration

Legacy stored values:

- `expanded`
- `compact`
- `collapsed`

are migrated to `auto` rather than preserving the old width model.

### Persistence

Cinema and Music store their Sidebar preferences independently:

- `orion.sidebar.cinema.mode`
- `orion.sidebar.music.mode`

### Icon system

The stabilization also removed duplicate/raw semantic identities across Sidebar destinations. Cinema navigation now uses distinct semantic icons rather than reusing unrelated marks.

### Current workspace owner

- `src\renderer\components\layout\Sidebar.jsx`
- `src\renderer\components\layout\sidebarState.js`
- `src\renderer\styles\components\sidebar-rail.css`
- `src\renderer\styles\components\sidebar-dux1.css`

### Validation

Current workspace unit coverage preserves:

- collapsed rail resting state,
- hover reveal without pinning,
- Keep Open and return-to-auto behavior,
- independent Cinema/Music preference restoration,
- legacy-mode migration,
- distinct semantic destination icons.

Electron coverage preserves the Auto-rail / Music Keep-Open separation and verifies that Cinema reveal remains a peek rather than a pinned layout change.

**Cinema Sidebar shell: LOCKED**

---

## 7. Appearance foundation — Projector Silver, Projector Red + semantic themes

### Projector Silver

Desktop Projector Silver was changed from a cooler/plain-light presentation toward a warmer projector-paper/ivory foundation.

The current contract is anchored by:

- `--bg-base: #f1ede5`
- `--bg-elevated: #faf8f4`
- `--bg-surface: #e8e2d9`

The visual target is:

- warm silver,
- projector-paper / ivory character,
- not plain white,
- not yellow/beige.

### Projector Red

A separate Desktop accent was added:

- **Projector Red:** `#a1121d`

Projector Silver does **not** force Projector Red.

Users may combine Projector Silver with Orion Violet, Projector Red, Blue, Green, or other supported accents.

### Semantic bridge

Appearance work repaired semantic ownership for tokens such as:

- glass backgrounds,
- borders,
- disabled text,
- shadows,
- Quick Search glass,
- interaction hover treatment.

The implementation deliberately avoids treating Custom Appearance as a separate CSS universe.

### Custom Appearance

Custom appearance values continue to feed semantic Orion surfaces and text ownership. Current unit coverage verifies both preset and custom paths derive semantic glass/border/disabled/shadow behavior.

### Current workspace owners

- `src\renderer\shared\utils\appearance.js`
- `src\renderer\features\settings\sections\InterfaceSettings.jsx`
- `src\renderer\styles\tokens.css`
- shared component styles under `src\renderer\styles\components\`

### Validation

Current appearance unit coverage verifies:

- warm Projector Silver values,
- independent Projector Red,
- live interaction appearance,
- semantic glass/border/disabled/shadow derivation for presets,
- semantic derivation for Custom Appearance.

**Cinema appearance foundation: LOCKED**

---

## 8. Global Search Orb

### Purpose

Provide a global Search entry point without making the user return to the top of a page or permanently occupying navigation space.

### Final Cinema interaction contract

#### Hover

- visual feedback only,
- no navigation,
- no Quick Search opening.

#### Left click

- enters full Cinema Search,
- full Search input receives focus,
- the Orb hides while the Search workspace is active.

#### Right click

- opens anchored Cinema Quick Search beside the Orb,
- the current page remains underneath,
- the Quick Search input receives focus,
- right-clicking the Orb again closes the panel.

#### Drag

- a movement threshold distinguishes drag from click,
- the Orb is clamped to a safe Orion viewport,
- position persists in normalized form,
- resize/restoration does not strand it off-screen,
- gentle edge assistance occurs only when near an edge,
- Settings can reset the position.

### Search return contract

Inside full Search:

- the Orb stays hidden,
- returning to Search from a result must not resurrect it,
- leaving the Search workspace via Back restores the Orb,
- the previous saved position is retained.

### Placement

Quick Search placement is derived from the Orb rectangle and viewport:

- right-side Orb → panel opens left,
- left-side Orb → panel opens right,
- lower Orb → panel can open upward,
- upper Orb → panel can open downward.

### Current workspace owners

- `src\renderer\components\search\SearchOrb.jsx`
- `src\renderer\components\search\searchOrbGeometry.js`
- `src\renderer\app\hooks\useSearchOverlayController.js`
- `src\renderer\app\AppOverlays.jsx`
- `src\renderer\components\modals\SearchModal.jsx`
- `src\renderer\features\settings\sections\InterfaceSettings.jsx`

### Source-size ownership

Initial Search Orb integration pushed:

- `src\renderer\app\App.jsx`

from within its temporary limit to **1110 lines**, above the **1100-line** ceiling.

The limit was **not** increased.

Search-overlay orchestration was extracted into a dedicated controller/overlay owner. The current authoritative workspace has `App.jsx` at **1095 lines**, within the existing 1100-line allowance.

This is part of the lock contract: source-size gates signal ownership problems rather than being values to silence.

**Cinema Search Orb base UX: LOCKED**

---

## 9. Cinema Quick Search + full Search

### Quick Search shell

The panel was refined from visually disconnected filter/results regions into a single deliberate search surface.

Final layout principles include:

- one coherent frosted panel,
- compact/adaptive sizing,
- filter rails aligned with the search/results hierarchy,
- result rows contained within the panel,
- vertical results scrolling,
- horizontal filter overflow only where needed,
- mouse-wheel translation for overflowing horizontal filter rails.

### Cinema result domains

Cinema Quick Search supports the shared Cinema search domains exercised during stabilization:

- Movies,
- TV,
- People.

Cinema filters remain available in the expanded quick-search workspace.

### Result containment

A late physical pass exposed result content/type badges being quarter-clipped after filter scrolling was repaired.

The shared result row was corrected so artwork, shrinkable metadata, and the fixed type badge remain inside the panel rather than causing result-level horizontal overflow.

### Search provider boundary

A DUX-2.3 regression exposed an architectural leak:

`SearchModal` called the strict Music context hook even when rendered as Cinema Quick Search.

That caused Cinema `PeopleUi` tests to throw:

`useMusic must be used inside MusicProvider.`

The production architecture was corrected rather than wrapping Cinema tests in a Music provider.

Final rule:

**Cinema Search has zero requirement for MusicProvider.**

Shared Search may consume Music context optionally only when the active world actually requires it.

### View All contract

A subsequent test caught a copy/accessibility regression where Cinema changed from the established:

`View all results for …`

to:

`View all Cinema results for …`

The established Cinema accessible contract was restored instead of weakening the test.

### Current workspace coverage

Relevant current unit files include:

- `tests\unit\renderer\PeopleUi.test.jsx`
- `tests\unit\renderer\QuickSearchFilterRail.test.jsx`
- `tests\unit\renderer\searchOrbGeometry.test.js`

Current `PeopleUi` coverage includes:

- same-title result separation with cinema filters,
- View All from capped Quick Search,
- filtering Quick Search without hiding People beyond the All-results cap,
- cinema filters in the expanded Quick Search workspace,
- stale search response protection.

**Cinema Search workspace: LOCKED**

---

## 10. Automated evidence — Cinema lock chain

The Cinema stabilization was validated repeatedly while the DUX candidates were being refined. The audit distinguishes the enumerated lock snapshots from later current-workspace totals rather than inventing one synthetic baseline.

### Fully enumerated DUX-2.1 gate

The source-size/controller refactor passed the complete Desktop gate with:

| Gate | Result |
|---|---|
| Source-size | 314 files passed |
| Renderer bindings | 284 files passed |
| IPC | 220 methods / 139 channels preserved |
| Secrets | PASS |
| Theme-color check | PASS |
| Circular dependencies | none |
| Node tests | 84 / 84 |
| Renderer tests | 41 files / 169 tests |
| Production build | PASS |

### Fully enumerated DUX-2.3.2 gate

After Search-provider isolation and the View All contract correction, the complete Desktop gate passed with:

| Gate | Result |
|---|---|
| Source-size | 319 files passed |
| Renderer bindings | 287 files passed |
| IPC | 220 methods / 139 channels preserved |
| Secrets | PASS |
| Theme-color check | PASS |
| Circular dependencies | none |
| Node tests | 84 / 84 |
| Renderer tests | 42 files / 170 tests |
| Production build | PASS |

The renderer suite specifically showed:

- `PeopleUi.test.jsx`: PASS after the provider-boundary and View All corrections,
- `QuickSearchFilterRail.test.jsx`: PASS,
- `appearance.test.js`: PASS,
- `Sidebar.test.jsx`: PASS,
- `searchOrbGeometry.test.js`: PASS.

### Final DUX-2.3.7 gate

After the last Cinema Quick Search result-containment polish, the user ran the full:

`npm.cmd run check`

and the command completed through the production Vite build successfully.

The pasted final tail showed the production build passing; because `check` is a chained fail-fast command in the current `package.json`, reaching that final build establishes that the preceding gate stages completed successfully for that run. This audit does not invent per-stage counts that were not present in the pasted final tail.

---

## 11. Electron E2E evidence

### Cinema Search Orb contract

Current Electron coverage in:

`tests\electron\search-orb.spec.js`

verifies the Cinema path:

1. Search Orb visible on a normal Cinema page.
2. right-click opens anchored Quick Search.
3. panel identifies itself as `Cinema quick search`.
4. Quick Search input is focused.
5. right-click again closes Quick Search.
6. left-click opens full Search.
7. full Search input is focused.
8. Search Orb is hidden in full Search.
9. Back through Cinema navigation exits Search.
10. Search Orb returns.

### Sidebar contract

Current Electron coverage in:

`tests\electron\sidebar.spec.js`

verifies:

- Cinema starts from Auto rail,
- Cinema rail reveals as `revealed` + `peeking`,
- the reveal is not the persistent `expanded` state,
- Cinema/Music Sidebar preferences remain independent.

### Final focused suite

The final focused production Electron sweep ran:

- `tests\electron\search-orb.spec.js`
- `tests\electron\music-themes.spec.js`
- `tests\electron\sidebar.spec.js`

and completed:

**4 / 4 PASS**

The mixed suite included Music-specific regression coverage because Search Orb and Sidebar have shared cross-world owners. Music-specific behavior is governed canonically by `ORION-MUSIC-PLANET-AUDIT.md`; it is not reclassified here as Cinema evidence.

**Cinema/shared focused E2E: PASS**

---

## 12. Physical validation

Physical review was mandatory throughout the Cinema stabilization.

It directly exposed issues that automated tests alone did not establish, including:

- Projector Silver feeling too plain/cool before refinement,
- Quick Search upper/lower visual hierarchy mismatch,
- filter-rail mouse-wheel behavior,
- Search Orb context/visibility expectations,
- Search page return behavior,
- result-row/type-badge clipping,
- Sidebar animation/presentation details.

Those findings were repaired at their shared owners and revalidated.

### Final user acceptance

After the final Cinema automated and focused-E2E chain, the user explicitly declared Cinema:

- polished,
- completely stabilized,
- ready to be treated as complete before moving to dedicated Music Planet stabilization.

That declaration is the final physical acceptance for this subsystem audit.

**Cinema physical validation: PASS**

---

## 13. Current authoritative workspace confirmation

The current post-Music-lock workspace supplied for this audit was inspected rather than assuming the earlier Cinema snapshot still represented current code.

The current workspace still contains the locked Cinema/shared owners and tests described above.

Confirmed current contracts include:

### Sidebar state owner

`src\renderer\components\layout\sidebarState.js`

currently defines only:

- `auto`
- `pinned`

and explicitly migrates the retired expanded/compact/collapsed values to Auto rail.

### Search Orb owner

`src\renderer\components\search\SearchOrb.jsx`

currently retains:

- persisted enabled state,
- persisted normalized position,
- drag threshold,
- viewport clamping,
- edge settling,
- reset event,
- world-specific accessible Search label,
- hidden state,
- right-click Quick Search.

### Search overlay owner

`src\renderer\app\hooks\useSearchOverlayController.js`

currently retains separate:

- full-search opening,
- anchored Quick Search opening,
- world ownership,
- deferred exit cleanup.

### Appearance owner

`src\renderer\shared\utils\appearance.js`

currently retains:

- Projector Red `#a1121d`,
- warm Projector Silver semantic values,
- preset/custom semantic application.

### Current source-size state

`src\renderer\app\App.jsx` is currently **1095 lines** against its existing **1100-line** temporary ceiling.

No source-size limit increase is required or authorized by this audit.

This current-workspace inspection confirms that later Music Planet work did not erase the locked Cinema/shared contracts documented here.

---

## 14. Known non-blocking warnings

The following warnings were observed during the stabilization chain and do **not** invalidate the Cinema lock:

1. Vite chunk-size warning for bundles larger than 500 kB.
2. Node SQLite experimental-feature warning.
3. MiniPlayer renderer-test warning about a React update not wrapped in `act(...)`.

These remain backlog/informational items.

**Do not increase the Vite chunk-size warning threshold merely to silence the warning.**

---

## 15. Engineering principles confirmed during Cinema stabilization

### Shared defect → shared owner → global repair

Sidebar, Search Orb, Search panel geometry, and theme semantics were repaired at shared owners rather than with page-local CSS piles.

### Physical validation is mandatory

Multiple visual/interaction defects appeared only in the running app despite green automated checks.

### Test failure classification matters

Do not change production code merely to satisfy a stale test assumption.

Examples from this stabilization included Sidebar E2E helpers that assumed the old always-open Sidebar. Those helpers were aligned to the new rail-first contract instead of reverting production behavior.

Conversely, when Cinema Search genuinely depended on MusicProvider, production architecture was corrected because the tests had exposed a real ownership defect.

### Production E2E requires fresh `dist`

The correct order is:

1. source change,
2. focused tests where useful,
3. full Desktop gate/build,
4. production Electron E2E,
5. physical validation.

Do not test new source against stale production output.

### Source-size limits are ownership signals

The `App.jsx` Search Orb overflow was resolved by extracting responsibility rather than raising the 1100-line ceiling.

### Local workspace is authoritative

Do not silently restore or overwrite the validated current workspace from GitHub.

---

## 16. Relationship to other Orion subsystem locks

This audit covers **Cinema UI/UX and the shared UX contracts validated through Cinema**.

It does not replace other canonical subsystem audits.

### Music Planet

Music Planet is separately **LOCKED** and governed by:

`docs\audits\ORION-MUSIC-PLANET-AUDIT.md`

Do not amend Music Planet merely because a shared component is mentioned here. Follow the Music audit's post-lock reopen rules.

### Desktop core / playback / downloader

Cinema UI/UX stabilization did not authorize speculative changes to playback or downloader internals.

These should receive their own canonical audit if not already created.

### Smart Connect

Smart Connect production behavior is outside this Cinema audit and should be governed by its own subsystem evidence/audit.

### Mobile

Mobile Orion remains outside this Desktop Cinema audit.

---

## 17. Instructions for future Cinema work

Before editing a locked Cinema/shared UX area:

1. Read this audit.
2. Identify the exact owner and locked contract.
3. State why reopening is justified.
4. Inspect the real current local workspace.
5. Keep Music Planet's separate lock in mind when touching shared components.
6. Prefer shared-owner fixes over page-local patches.
7. Do not raise source-size limits to admit architectural sprawl.
8. Run focused unit tests.
9. Run the full Desktop gate.
10. Rebuild before production Electron E2E.
11. Run focused E2E.
12. Physically validate.
13. Add a dated post-lock amendment below if the lock contract changed.

---

## 18. Post-lock amendment template

Append future justified Cinema changes below this section.

```md
## Post-Lock Amendment — YYYY-MM-DD

### Reason
Why was a locked Cinema/shared UX area reopened?

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

## 19. Required V3 audit entry

The Orion Desktop V3 audit should include at minimum:

```md
### Cinema
**Status:** LOCKED
**Subsystem audit:** `docs/audits/ORION-CINEMA-AUDIT.md`

- Cinema UI/UX stabilization: PASS
- Rail-first Sidebar/navigation shell: PASS
- Semantic Sidebar icon system: PASS
- Projector Silver / semantic appearance foundation: PASS
- Projector Red independent accent: PASS
- Custom Appearance semantic compatibility: PASS
- Global Search Orb base UX: PASS
- Cinema Quick Search / full Search entry: PASS
- Search Orb persistence / placement / Back restoration: PASS
- Cinema Search provider-boundary isolation: PASS
- Source-size governance: PASS
- Production build: PASS
- Focused Electron E2E: PASS
- Final physical validation: PASS

Known non-blockers:
- Vite >500 kB chunk warning
- SQLite experimental warning
- MiniPlayer `act(...)` test warning
```

The master V3 audit should summarize this file rather than duplicating the full DUX stabilization history.

---

# FINAL DECLARATION

**CINEMA RAIL-FIRST SIDEBAR / NAVIGATION — LOCKED**
**CINEMA APPEARANCE / THEME FOUNDATION — LOCKED**
**CINEMA SEARCH ORB / QUICK SEARCH / SEARCH RETURN CONTRACT — LOCKED**
**CINEMA SHARED UX OWNERSHIP BOUNDARIES — LOCKED**

## ORION CINEMA UI/UX STABILIZATION — LOCKED

This subsystem is considered stable as of **2026-08-18** based on the actual stabilization code, repeated full Desktop gates, focused unit coverage, production Electron E2E, final physical review, and explicit user acceptance.
