# Orion V3 P8-006A C3 - Viewing Activity Steady-State Audit

**Date:** 2026-08-20
**Scope:** History + verified playback Progress steady-state cross-platform synchronization
**Status:** C3 COMPLETE and checkpoint-ready
**P8-006A:** NOT LOCKED
**Phase 8:** NOT LOCKED

## Architecture decision

C3 extends the existing Phase 8 synchronization architecture. It does not introduce a second synchronization system.

History and Progress are treated as one Viewing Activity synchronization domain because they originate from the same verified playback truth and must reconcile coherently.

Continue Watching is explicitly excluded from Cloud ownership. It remains a locally derived presentation of synchronized verified Progress.

Watched remains its own previously locked synchronization domain.

## Owner boundaries

Desktop:

- ViewingActivitySteadyStateSync is the thin steady-state platform owner.
- Existing DesktopPortableProfileCloudStore is reused.
- Existing Desktop local Library/viewing-state owners remain authoritative.
- Desktop local library remains device-scoped by design.
- Profile-scoped sync checkpoints fence Cloud reconciliation.

Mobile:

- ViewingActivitySteadyStateSync is the thin steady-state platform owner.
- Existing GoogleDriveCloudProfileStore is reused.
- Existing LibraryProvider remains the single History/Progress state owner.
- Existing account-scoped Library profile boundary remains authoritative.
- Account, profile readiness, AppState and synchronization policy fence automatic work.

Shared:

- portableViewingActivitySteadyStateSync owns steady-state planning/execution.
- portableViewingActivitySteadyStateConflict owns explicit post-checkpoint recovery.
- PortableProfileV3 continues to preserve unrelated/unknown namespaces.

## Safety semantics

C3 requires:

- verified playback evidence only;
- exact TV episode identity;
- account/profile-scoped checkpoints;
- conditional Cloud writes;
- semantic read-back verification;
- local-apply verification;
- stale in-flight account/profile fencing;
- event-time reconciliation;
- tombstones for removals;
- no resurrection of ambiguous deletions;
- fail-closed equal-time contradictory truth;
- explicit whole-copy resolution for ambiguous two-sided post-checkpoint divergence.

## Candidate repair chain

### Candidate 1

Introduced shared steady-state Viewing Activity coordination plus thin Desktop/Mobile global owners and SyncPolicy enrollment.

### Candidate 1.1

Repaired stale C2 enrollment tests that incorrectly forbade later steady-state enrollment.

### Candidate 1.2

Repaired Mobile TypeScript narrowing/state contract in ViewingActivitySyncControl and strengthened the steady-state contract test.

### Candidate 1.3

Repaired stale My List/Watched policy tests that still hard-coded only two synchronization domains.

### Candidate 1.4

Repaired harmless presentation/metadata-only same-time drift so semantically aligned Viewing Activity does not falsely enter Needs review.

### Candidate 1.5

Repaired the first-real-push path so harmless older metadata drift cannot block propagation of an unrelated genuinely new verified playback event.

### Candidate 1.6

Repaired a stale Electron playback-lifecycle harness assumption around the intentionally hidden auto-hide Sidebar. No production playback implementation was modified.

## Physical evidence

### Mobile -> Desktop

A new Mobile verified playback event propagated through Orion Cloud to Desktop.

Observed:

- History increased on Mobile and Desktop;
- verified playback position propagated;
- Desktop displayed the synchronized title in History;
- Desktop Continue Watching re-derived the received resumable state locally.

### Desktop -> Mobile

A new Desktop verified playback event propagated through Orion Cloud to Mobile.

Observed:

- History and Progress converged;
- Mobile displayed the incoming resumable position;
- Mobile Continue Watching derived the received state locally.

### Auto Sync OFF

With Mobile Auto Sync disabled:

- a new local playback event changed Mobile History/Progress;
- Desktop did not automatically receive it;
- explicit Sync now reconciled it;
- Desktop then received the new state.

Result: PASS.

### Offline playback

Physical offline playback is N/A for C3 under the current product boundary because current streaming playback cannot open media offline.

This does not waive offline-first synchronization/reconciliation safety. Full downloaded offline playback belongs to Phase 10.

## Final automated evidence

### Mobile

- TypeScript: PASS
- Tests: 239/239 PASS
- Source-size: PASS, 137 files
- Expo Doctor: 20/20 PASS
- Web production export: PASS

### Desktop

- Source-size: PASS, 365 files
- Renderer binding: PASS, 319 files
- IPC: 222 methods / 141 channels preserved
- Secret scan: PASS
- Theme-color check: PASS
- Circular dependency gate: PASS, 350 files processed
- Node tests: 106/106 PASS
- Renderer tests: 262/262 PASS across 59 test files
- Vite production build: PASS

### Electron

- Focused repaired playback-handoff test: 1/1 PASS
- Full Electron E2E: 22/22 PASS

## Known non-blocking warnings

- Mobile MODULE_TYPELESS_PACKAGE_JSON warning for trailerCandidateService.
- Desktop SQLite experimental warning.
- MiniPlayer React act warning.
- Vite >500 kB chunk advisory.

These warnings were previously classified and did not fail C3 validation.

## Productization findings

C3 engine behavior is accepted, but Phase 8 must remain open for productization.

Mandatory pre-lock findings:

- Count Semantics & Data Truth Audit.
- Mobile Settings -> Account unification.
- Desktop/Mobile synchronization vocabulary consistency.
- Replace ambiguous user-facing Progress wording with playback-position language where appropriate.
- Remove implementation-shaped copy such as Manual, portable and v1 checkpoint.
- Explicit Sync now must visibly enter a busy/Syncing presentation before returning to Paused if Auto Sync remains OFF.
- Accessibility/responsiveness/theme/spacing/typography/busy-state review.

## Lock decision

C3 is complete and checkpoint-ready.

P8-006A is not declared locked by this audit.

Phase 8 is not declared locked.

Remaining Phase 8 work includes portable Preferences, supported Music disposition, remaining policy/reconciliation requirements, Count Semantics & Data Truth Audit, production polish, Mobile Account unification and the final P8.7 cross-platform audit.
