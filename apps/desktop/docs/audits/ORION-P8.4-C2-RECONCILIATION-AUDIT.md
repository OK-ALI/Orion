# Orion P8.4 Candidate 2 — Desktop Verified Viewing Truth + Legacy Sync Fence Reconciliation Audit

**Project:** Orion — A Multiverse of Stories
**Subsystem:** Phase 8 cross-platform viewing-state prerequisite / Orion Desktop
**Workspace:** `C:\Projects\Orion - A Multiverse of Stories`
**Audit date:** 2026-08-19
**Audit status:** **COMPLETE & LOCKED**
**Next phase:** P8.4 Candidate 3
**Phase 8 overall:** **NOT LOCKED**

---

## 1. Purpose

This document is the canonical reconciliation audit for **P8.4 Candidate 2: Desktop Verified Viewing Truth + Legacy Sync Fence**.

Candidate 2 originally passed automated checks but remained unlocked because physical Desktop validation exposed pre-existing playback, persistent-session, reset, and downloader defects. Mobile Phase 8 was frozen while Desktop was stabilized.

This audit reconciles the original Candidate 2 contract against the stabilized current Desktop workspace and records the evidence that permits Candidate 2 to close without a new C2.2 implementation candidate.

---

## 2. Final lock state

**P8.4 C2 — DESKTOP VERIFIED VIEWING TRUTH + LEGACY SYNC FENCE: COMPLETE & LOCKED**

The reconciliation found no remaining Candidate 2 implementation blocker.

P8.4 Candidate 3 may resume only after the Phase 8 handoff records this lock.

Phase 8 as a whole remains **NOT LOCKED**.

---

## 3. Evidence packages inspected

The reconciliation was performed from fresh project-root-relative workspace packages:

1. `Orion-P8.4-C2-Reconciliation.zip`
2. `Orion-P8.4-C2-Reconciliation-Supplement.zip`
3. `Orion-P8.4-C2-Final-Reset-Evidence.zip`

The first package established the verified-viewing and legacy-cloud-fence owners. The supplement established playback-intent, Mini Player, webview lifecycle, and reset call-site ownership. The final package established the shared reset implementation and persistent `persist:player` clearing path.

The local workspace remains authoritative.

---

## 4. Candidate 2 contract

Candidate 2 had two primary goals:

1. establish durable **verified viewing truth** on Desktop,
2. fence the old Desktop Google Drive backup system so it cannot compete with PortableProfileV3 viewing-state authority.

The locked Candidate 1 contract remains unchanged:

- Watched
- verified History
- verified playback Progress
- Continue Watching derived from verified Progress
- exact TV episode portability
- canonical TV key form `tv_<id>_s<season>_e<episode>`

There is no standalone Continue Watching portable namespace.

---

## 5. Verified playback evidence owner

Primary owners:

- `apps\desktop\src\renderer\features\player\hooks\useCinemaPlaybackEvidence.js`
- `apps\desktop\src\renderer\features\player\services\playerEventProgress.js`
- `apps\desktop\src\renderer\services\viewingStateVerification.js`

The current contract requires real advancing playback observations before playback becomes verified.

Focused tests prove:

- finite recent provider events normalize correctly,
- stale/unusable events are rejected,
- only actual time advancement counts as playback evidence,
- two real advancing observations are required before verification,
- verified progress snapshots are portable-safe,
- later opened/seek-only samples do not overwrite the last verified snapshot,
- History-disabled operation does not create new portable-safe progress.

### Lock result

Durable verified History/Progress cannot be created merely because a media item was opened.

**PASS**

---

## 6. Portable adapter contract

Owner:

- `apps\desktop\src\renderer\features\library\viewingStatePortableAdapter.js`

Focused tests prove:

- legacy watched keys are canonicalized,
- whole-series TV summaries are not promoted to portable watched truth,
- opened-only History is not elevated,
- unmarked legacy progress is not elevated,
- only verified History/Progress are exposed,
- Continue Watching remains derived,
- the old raw Google backup is classified/fenced rather than treated as PortableProfileV3.

### Lock result

Desktop portable preview remains truthful and read-only at C2.

**PASS**

---

## 7. Playback-surface coverage

Current verified-viewing coverage includes:

- Movie provider playback
- TV episode provider playback
- Mini Player
- local/download playback

Important owners include:

- `apps\desktop\src\renderer\features\movies\hooks\useMovieWebview.js`
- `apps\desktop\src\renderer\features\tv\hooks\useTVWebview.js`
- `apps\desktop\src\renderer\app\AppOverlays.jsx`
- `apps\desktop\src\renderer\components\MiniPlayer.jsx`
- `apps\desktop\src\renderer\features\downloads\components\LocalPlayer.jsx`

Mini Player reconciliation confirmed it observes playback evidence, marks History verified only when evidence becomes ready, persists progress with the verification result, and gates automatic watched completion on verified playback.

### Lock result

No known Desktop playback surface can trivially bypass C2 and create portable-safe viewing truth by opening alone.

**PASS**

---

## 8. Watched truth

The current adapter preserves two intentional truth paths:

- explicit/manual watched is user truth,
- automatic watched requires verified playback evidence.

Exact TV episode watched state is portable; whole-series summaries remain local/derived.

### Lock result

**PASS**

---

## 9. Explicit playback-intent stabilization

Owner:

- `apps\desktop\src\renderer\features\player\services\playbackIntent.js`

The stabilized architecture distinguishes:

- `FRESH`
- `RESUME`
- `START_FROM_ZERO`

Focused `playbackIntent` tests prove:

- an ordinary zero-time launch uses fresh semantics,
- positive saved position uses resume semantics,
- explicit Start Over is preserved as `START_FROM_ZERO`,
- a pending Not Started reset outranks resume/handoff time.

### Lock result

Zero is no longer interpreted as “do not seek.” Start Over is an affirmative playback intent.

**PASS**

---

## 10. Webview lifecycle stabilization

Owner:

- `apps\desktop\src\renderer\features\player\services\webviewLifecycle.js`

Focused lifecycle tests prove:

- pre-`dom-ready` access returns a safe null rather than surfacing an Electron lifecycle exception,
- ready webviews return a valid WebContents ID,
- superseded `ERR_ABORTED` navigation is classified as expected,
- real main-frame load failures remain reportable.

Mini Player tests additionally prove handoff does not create a second active playback surface and that late subframe loading does not incorrectly restore startup loading state.

### Lock result

The historical attach/`dom-ready` race is reconciled with the current stabilized architecture.

**PASS**

---

## 11. Shared Not Started reset owner

Owner:

- `apps\desktop\src\renderer\features\player\services\viewingReset.js`

Call sites include current Movie details, TV episode UI/overlays, and Continue Watching/library reset paths.

`resetViewingToNotStarted()` performs:

- explicit unwatched transition when provided,
- deletion of percentage progress through `saveProgress(key, null)`,
- deletion of `dlTime_<key>`,
- deletion of `progressDetails[key]`,
- `requestPlaybackReset(key)` so the next launch is forced through zero-start intent.

### Lock result

Not Started does not leave ghost verified progress or a legacy resume position behind.

**PASS**

---

## 12. Global Clear Watch Progress owner

Renderer owner:

- `apps\desktop\src\renderer\features\player\services\viewingReset.js`

Settings owner:

- `apps\desktop\src\renderer\features\settings\SettingsPage.jsx`

Electron owner:

- `apps\desktop\src\main\ipc\filesystemIpc.js`

`clearAllViewingState()` removes:

- `WATCH_PROGRESS`
- `PROGRESS_DETAILS`
- `HISTORY`
- `WATCHED`
- `PLAYBACK_RESET_PENDING`
- all renderer `orion_dlTime_*` entries

The Settings handler then invokes `window.electron.clearWatchData()`.

The main-process `clear-watch-data` handler clears storage data and cache for:

- `persist:player`

### Lock result

Global watch reset clears both Orion-owned viewing truth and persistent provider/browser state.

**PASS**

---

## 13. Legacy Google sync fence

Owners:

- `apps\desktop\src\main\ipc\legacyCloudSyncFence.js`
- `apps\desktop\src\main\ipc\googleAuthIpc.js`
- `apps\desktop\src\renderer\services\backup.js`
- `apps\desktop\src\renderer\app\App.jsx`
- `apps\desktop\src\renderer\features\settings\sections\GeneralSettings.jsx`

The legacy viewing domains remain:

- `history`
- `progress`
- `progressDetails`
- `watched`

Current contract:

- new legacy cloud sync files omit viewing state,
- existing legacy cloud viewing fields are reinserted unchanged/frozen when other legacy backup fields update,
- legacy cloud restore strips viewing state before applying local restore,
- local/manual backup remains complete,
- the legacy fence marker is internal and not persisted into the actual cloud file.

Focused main-process tests prove:

- old viewing state is frozen while non-viewing backup fields may update,
- new legacy sync files omit viewing state and the internal fence marker.

### Lock result

The old `orion-sync-manifest.json` architecture cannot become competing current viewing-state authority.

**PASS**

---

## 14. C2 cloud boundary

Candidate 2 remains a **read-only portable viewing-state stage**.

It does not activate Desktop viewing-state writes into PortableProfileV3.

PortableProfileV3 viewing writes begin only in a later controlled cross-platform candidate.

### Lock result

**PASS**

---

## 15. Locked boundaries preserved

C2 reconciliation did not require reopening:

- Orion Mobile implementation
- P8.3 My List synchronization
- shared portable viewing contract
- Cinema stabilization
- Music Planet stabilization
- Smart Connect protocol implementation
- provider registry
- Cinema Shield

Desktop stabilization changes that affected playback/reset were treated as current owner evidence, not as a reason to undo the stabilized system.

**PASS**

---

## 16. Automated evidence

### Focused C2 contract tests present in the current reconciled workspace

- `tests\unit\main\legacyCloudSyncFence.test.js`
  - freezes old viewing state while allowing other fields to update
  - new legacy sync files omit viewing state/fence marker

- `tests\unit\renderer\viewingStateVerification.test.js`
  - evidence-backed progress only
  - verified snapshot overwrite protection
  - History-disabled safety

- `tests\unit\renderer\viewingStatePortableAdapter.test.js`
  - watched-key canonicalization
  - rejects opened-only/unverified legacy truth
  - exposes verified History/Progress only
  - Continue Watching derived
  - legacy Google backup fenced

- `tests\unit\renderer\playerEventProgress.test.js`
  - normalized provider events
  - rejects stale events
  - advancement-only evidence
  - two-advance verification threshold

- `tests\unit\renderer\playbackIntent.test.js`
  - fresh/resume/Start Over distinction
  - pending Not Started reset precedence

- `tests\unit\renderer\webviewLifecycle.test.js`
  - lifecycle readiness/failure classification

- `tests\unit\renderer\MiniPlayer.test.jsx`
  - playback handoff uniqueness
  - `dom-ready` loading lifecycle

### Later full Desktop closing baseline

The canonical Music Planet audit records:

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

This later full-Desktop baseline includes the stabilized workspace in which the C2 contract owners and tests were reconciled.

---

## 17. Physical/runtime evidence

Candidate 2 originally remained unlocked because runtime testing exposed real Desktop defects despite green automation.

The dedicated Desktop stabilization detour subsequently repaired and physically validated the relevant playback/reset behaviors, including:

- Resume
- Start Over
- Replay Last 30 Seconds
- user-seek precedence
- cross-provider playback intent
- Not Started
- Continue Watching reset
- webview lifecycle
- persistent `persist:player` behavior
- Clear Watch Progress

Downloader stabilization was also completed separately, including HLS/DASH/DIRECT validation and false-completion prevention. Those downloader repairs are important Desktop stabilization evidence but are not part of the portable viewing-state payload itself.

### Lock result

The runtime blockers that prevented C2 closure have been reconciled against the stabilized Desktop endpoint.

**PASS**

---

## 18. Known non-blocker

`filesystemIpc.js` correctly returns `{ ok: false, error }` if `persist:player` storage/cache clearing fails, while the current `SettingsPage.jsx` success flow does not surface that failure result before reload.

This is recorded as hardening backlog, not a C2 blocker, because:

- renderer viewing truth is cleared independently,
- the validated normal persistent-session reset path passes,
- no current physical failure was evidenced.

Reopen only if a real reset failure is reproduced or product requirements demand explicit failure reporting.

---

## 19. Reopen rules

P8.4 C2 is now locked.

Reopen only for:

1. a proven regression in verified viewing truth,
2. a proven provider/session reset defect,
3. a proven legacy-cloud authority leak,
4. a cross-platform requirement that genuinely requires changing a C2 owner,
5. an accessibility/performance defect affecting these owners,
6. or an explicit architecture migration.

Any future C2-area change must be a dated post-lock amendment and must rerun the relevant focused/full/runtime evidence.

---

## 20. Exact Phase 8 status after this audit

| Phase | State |
|---|---|
| P8.0 | COMPLETE |
| P8.1 | LOCKED |
| P8.2 | LOCKED |
| P8.3 | COMPLETE & LOCKED |
| P8.4 C1 | COMPLETE & LOCKED |
| **P8.4 C2** | **COMPLETE & LOCKED** |
| P8.4 C3 | NEXT |
| Phase 8 overall | NOT LOCKED |

---

## 21. Master Desktop V3 summary entry

When the master Desktop V3 audit is created or updated from canonical subsystem audits, it should inherit the following summary rather than reconstructing C2 from chat memory:

> **Phase 8 / P8.4 C2 — Desktop Verified Viewing Truth + Legacy Sync Fence: LOCKED.** Desktop now requires evidence-backed real playback before History/Progress become portable-safe; automatic watched is evidence-gated while explicit watched remains user truth; exact TV episode identity is preserved; Start Over/Not Started/global watch reset are authoritative across Orion state and `persist:player`; and the legacy Google `orion-sync-manifest.json` viewing domains are frozen/fenced so they cannot compete with future PortableProfileV3 viewing-state authority. C2 remains read-only with respect to PortableProfileV3 viewing writes. Runtime blockers were repaired during dedicated Desktop stabilization and reconciled against the current workspace.

---

## 22. Next phase

Next: **P8.4 Candidate 3 — controlled Desktop ↔ Mobile viewing-state synchronization.**

Candidate 3 must reuse the P8.3 synchronization architecture and must not invent another sync engine.

Candidate 3 does not inherit permission to casually modify locked Desktop subsystems. Any genuinely necessary locked-owner change follows the post-lock amendment process.

---

## Post-lock amendment — P8.4 C3-A

**Date:** 2026-08-19  
**Reason:** Phase 8 required Desktop to inspect the same PortableProfileV3 cloud document used by Mobile before cross-platform viewing-state synchronization could begin.

The C2 lock was not weakened.

A new, separate, read-only PortableProfileV3 bridge was added through:

- `portable-profile:read`
- `readPortableProfile`

The existing legacy Google backup path remains unchanged and continues to use:

- `orion-sync-manifest.json`
- the C2 legacy viewing-state fence

C3-A creates, writes, migrates, and deletes no cloud data.

Focused tests, the full Desktop gate, production build, and physical same-account PortableProfileV3 visibility/identity validation passed.

Canonical C3-A audit:

`apps\desktop\docs\audits\ORION-P8.4-C3A-PORTABLE-PROFILE-BRIDGE-AUDIT.md`

**C2 remains COMPLETE & LOCKED.**
