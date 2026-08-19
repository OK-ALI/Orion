# Orion Phase 8 Steady-State Conflict Recovery – Post-Lock Amendment Audit

**Project:** Orion – A Multiverse of Stories
**Subsystem:** Phase 8 / My List + Watched steady-state synchronization
**Audit date:** 2026-08-20
**Audit status:** **COMPLETE & LOCKED when committed with the validated candidate**
**Starting canonical HEAD:** `26fdaa0d8cdaa4a92a85679b5984bb1cb3c3488e`
**Branch:** `codex/orion-v3-p8.1-candidate-1`
**Phase 8 overall:** **NOT LOCKED**

---

## 1. Purpose

P8.3 My List and P8.4 C3-D Watched automatic steady-state synchronization were already COMPLETE & LOCKED.

Physical Phase 8 acceptance then proved the intended safety behavior for a genuine post-checkpoint two-sided divergence:

- one-sided changes reconcile automatically,
- genuine two-sided changes stop at `Needs review` / `Review`,
- Orion does not silently choose a winner.

That test also exposed a product-completeness gap: after detecting a genuine two-sided steady-state divergence, `Check now` could only re-prove the same conflict. There was no explicit recovery action for an already-enrolled domain.

This controlled post-lock amendment closes that recovery gap without weakening the existing reconciliation contracts.

---

## 2. Scope

The amendment adds explicit **whole-copy recovery** for already-enrolled My List and Watched domains after a verified checkpoint has diverged on both sides.

Accepted steady-state recovery choices are:

- keep the current device copy,
- keep Orion Cloud.

The choice is explicit and confirmed before mutation.

The amendment does **not** add last-write-wins behavior and does **not** add automatic conflict merging.

---

## 3. Why steady-state `Combine both` is intentionally absent

This audit records an important product/architecture clarification discovered during physical validation.

### First-enrollment My List conflict

The earlier P8.3 Desktop My List post-lock amendment handles a different conflict class: Desktop and Orion Cloud both contain populated My Lists **before Desktop has a verified reconciliation checkpoint**.

For that first-enrollment case, the UI intentionally offers:

- `Combine both`,
- `Keep Desktop My List`,
- `Keep Orion Cloud My List`.

Physical first-enrollment validation previously proved:

- Desktop: 134 titles,
- Orion Cloud: 28 titles,
- shared: 11 titles,
- combined result: 151 titles,
- Desktop, Orion Cloud and Mobile converged to 151.

`Combine both` is safe there because Orion is establishing the first shared copy and the product promise is to preserve active titles from both previously independent lists.

### Post-checkpoint steady-state conflict

After a verified checkpoint exists, the semantics are different.

The v1 My List checkpoint stores semantic signatures, not the complete prior record set. Therefore Orion **cannot safely infer which removals were intentional** after both sides changed independently.

Example:

- last verified list: `A, B, C`,
- Desktop removes `A` and adds `D`,
- Mobile/Cloud removes `B` and adds `E`.

A blind union would produce `A, B, C, D, E`, resurrecting both intentionally removed `A` and intentionally removed `B`.

Therefore the steady-state resolver intentionally offers only a whole-copy choice:

- keep this device,
- keep Orion Cloud.

This is not a regression or removal of the earlier `Combine both` feature. It is a deliberate distinction between **first enrollment** and **post-checkpoint divergence**.

### Watched

Watched requires the same or stronger restriction.

An absent Watched record can represent an intentional `Mark Unwatched` action. Blind union could resurrect Watched state and discard explicit user intent.

Therefore steady-state Watched divergence also requires an explicit device-or-cloud whole-copy choice and never auto-unions competing Watched/Unwatched intent.

### UX follow-up

Both situations can appear to a user as a conflict/review state while allowing different resolution actions. Final Account / Orion Cloud production polish should make this distinction clearer so a user who previously saw `Combine both` during first enrollment does not interpret its absence during later steady-state recovery as missing functionality.

---

## 4. Shared recovery contract

The amendment introduces shared conflict-recovery owners for My List and Watched.

### My List

Shared owner:

`packages/shared/src/api/portableMyListSteadyStateConflict.ts`

The resolver:

- requires the checkpoint profile identity to match,
- rejects unsafe local previews,
- performs a fresh cloud read,
- proves the current condition is still a genuine two-sided divergence,
- never auto-merges,
- revalidates the selected source before mutation,
- supports `keep-local` and `keep-cloud` only,
- preserves unrelated PortableProfileV3 namespaces,
- uses revision-aware conditional writes when the local copy wins,
- performs bounded semantic read-back verification after cloud mutation,
- verifies local application when Orion Cloud wins,
- creates a new checkpoint only after verified convergence,
- returns Needs Review again if local/cloud/account readiness changes while recovery is in flight.

### Watched

Shared owner:

`packages/shared/src/api/portableWatchedSteadyStateConflict.ts`

The Watched resolver applies the same safety posture while using the locked Watched planner/signatures and exact movie/episode truth.

It does not create another Watched reconciliation engine.

---

## 5. Desktop integration

Desktop steady-state owners now expose recovery only after a genuine `both-changed` result.

My List surfaces:

- current Desktop count,
- current Orion Cloud count,
- `Keep Desktop My List`,
- `Keep Orion Cloud My List`,
- `Check again`.

Watched exposes the equivalent current-device / Orion Cloud recovery choices.

A successful resolution:

- saves the verified replacement checkpoint,
- returns the domain to `Synced`,
- does not mutate the other sync domain.

The existing first-enrollment My List `Combine both` flow remains separate and unchanged.

---

## 6. Mobile integration

Mobile receives the same steady-state recovery concept using Mobile-native layout and existing Account/Settings grammar.

My List and Watched recovery:

- remain domain-specific,
- require explicit user choice,
- use the shared resolver contract,
- preserve local Auto Sync policy,
- return to Synced only after verified convergence.

No Desktop card layout is transplanted into Mobile.

---

## 7. Candidate artifacts

Primary implementation candidate:

`Orion-P8-Steady-State-Conflict-Recovery-Candidate-1.zip`

SHA-256:

`97d82578f82806282594d06e780e63439fd550591d5d16a24134049da35d5cb0`

Narrow Candidate 1.1 repair:

`Orion-P8-Steady-State-Conflict-Recovery-Candidate-1.1.zip`

SHA-256:

`fe51cab76aee843fbeb88f559de54cfc3eb5e55b85a3524f9d0db9f07ac851fb`

Candidate 1.1 changes only the My List shared resolver explanatory comment so the source contract states the accepted rationale directly: Orion cannot safely infer which removals were intentional. Runtime logic is unchanged by 1.1.

No source-size ceiling was raised.

---

## 8. Exact implementation manifest

The validated implementation candidate owns these 17 paths:

1. `apps/desktop/src/renderer/features/account/MyListSteadyStateSync.jsx`
2. `apps/desktop/src/renderer/features/account/WatchedSteadyStateSync.jsx`
3. `apps/desktop/src/renderer/features/settings/components/MyListSyncCard.jsx`
4. `apps/desktop/src/renderer/features/settings/components/WatchedSyncCard.jsx`
5. `apps/desktop/tests/unit/renderer/myListConflictRecovery.test.js`
6. `apps/desktop/tests/unit/renderer/myListSteadyStateSync.test.js`
7. `apps/desktop/tests/unit/renderer/watchedOneShotSync.test.js`
8. `apps/mobile/src/features/account/MyListSteadyStateSync.tsx`
9. `apps/mobile/src/features/account/WatchedSteadyStateSync.tsx`
10. `apps/mobile/src/features/settings/MyListEnrollmentPreflight.tsx`
11. `apps/mobile/src/features/settings/WatchedSyncControl.tsx`
12. `apps/mobile/tests/myListSteadyStateSync.test.cjs`
13. `apps/mobile/tests/watchedOneShotSync.test.cjs`
14. `packages/shared/src/api/index.ts`
15. `packages/shared/src/api/portableMyListSteadyStateConflict.ts`
16. `packages/shared/src/api/portableWatchedSteadyStateConflict.ts`
17. `packages/shared/src/api/portableWatchedSteadyStateSync.ts`

Canonical documentation for this lock additionally changes:

18. `docs/audits/ORION-P8-STEADY-STATE-CONFLICT-RECOVERY-POST-LOCK-AUDIT.md`
19. `docs/handoffs/ORION-PHASE-8-RESUME-HANDOFF.md`

Expected staged manifest for the canonical commit is therefore **19 paths**.

---

## 9. Focused automated evidence

### Mobile/shared

Mobile TypeScript:

**PASS**

Focused My List + Watched reconciliation/recovery contracts:

**25 / 25 PASS**

The initial Candidate 1 focused run was 24 / 25 because one source-contract assertion required the explicit phrase `cannot safely infer which removals were intentional`. Candidate 1.1 aligned the source rationale without changing runtime logic. The immediate rerun passed 25 / 25.

### Desktop

Focused renderer files:

**3 / 3 PASS**

Focused tests:

**32 / 32 PASS**

Included:

- My List steady-state sync,
- My List conflict recovery,
- Watched one-shot / recovery contract.

---

## 10. Full automated evidence

### Mobile

Full `npm run check`:

- TypeScript: **PASS**
- tests: **212 / 212 PASS**
- source-size: **132 files PASS**
- Expo Doctor: **20 / 20 PASS**
- web export: **PASS**

Known non-blocking warning:

- `MODULE_TYPELESS_PACKAGE_JSON` for the existing trailer candidate service.

### Desktop

Full `npm run check`:

- source-size: **361 files PASS**
- renderer bindings: **315 files PASS**
- IPC: **222 methods / 141 channels preserved**
- secret scan: **PASS**
- theme-color contract: **PASS**
- circular dependencies: **none**
- Node: **106 / 106 PASS**
- renderer: **56 files / 232 tests PASS**
- production Vite build: **PASS**

Known pre-existing non-blocking warnings remain:

- SQLite experimental warning,
- MiniPlayer React `act(...)` warning,
- Vite >500 kB chunk-size warning.

The Vite warning threshold was not raised.

---

## 11. Physical validation

Physical validation used the real two-sided conflicts already created for the final Phase 8 acceptance matrix rather than manufacturing another synthetic conflict.

### Environment

- fresh Candidate 1.1 Desktop runtime,
- fresh standalone Android Candidate 1.1 build,
- standalone APK installed successfully on the Samsung S24 Ultra using the local Android SDK `adb.exe` after confirming global `adb` was not on PATH.

### My List two-sided steady-state recovery

A genuine post-checkpoint divergence already existed.

Desktop displayed:

- `Needs review`,
- Desktop: 153 titles,
- Orion Cloud: 153 titles,
- explanatory copy that both copies changed and Orion could not safely infer intentional removals,
- `Keep Desktop My List`,
- `Keep Orion Cloud My List`,
- `Check again`.

Equal counts did not suppress the conflict because reconciliation is semantic, not count-based.

The user selected **Keep Desktop My List**.

Result:

- Desktop My List returned to **Synced**,
- Orion Cloud adopted the verified Desktop copy,
- Mobile My List converged back to Synced,
- no silent winner was chosen before confirmation.

**PASS**

### Watched two-sided steady-state recovery

The independent Watched conflict exposed the corresponding recovery actions.

The user selected **Keep Orion Cloud**.

Result:

- the local conflicting Watched copy was replaced by the verified Orion Cloud Watched copy,
- Mobile Watched returned to **Synced**,
- Desktop Watched remained/converged Synced,
- final Mobile evidence showed 104 Watched items synced with Orion Cloud.

**PASS**

### Domain isolation

The two physical recoveries intentionally exercised opposite directions:

- My List: current Desktop copy -> Orion Cloud -> Mobile,
- Watched: Orion Cloud -> local Mobile copy.

Resolution of one domain did not silently resolve or mutate the other domain.

**PASS**

---

## 12. Locked boundaries preserved

This amendment does **not** activate or change:

- History cloud synchronization,
- verified playback Progress cloud synchronization,
- Continue Watching as a cloud namespace,
- Preferences synchronization,
- Music state synchronization,
- Downloads synchronization,
- legacy Desktop viewing-state cloud authority,
- Cinema,
- Music Planet,
- Smart Connect,
- first-enrollment automatic mutation,
- My List first-enrollment `Combine both` semantics.

Continue Watching remains derived.

No new local storage domain was introduced.

No new PortableProfileV3 namespace was introduced.

---

## 13. Final audit verdict

**Steady-state conflict detection:** PASS
**No silent winner:** PASS
**Explicit My List recovery:** PASS
**Explicit Watched recovery:** PASS
**Device-wins path:** PASS
**Orion-Cloud-wins path:** PASS
**Conditional / revalidated mutation:** PASS
**Semantic verification:** PASS
**Unrelated namespace preservation:** PASS
**Cross-domain isolation:** PASS
**First-enrollment Combine contract preserved:** PASS
**Mobile focused/full gates:** PASS
**Desktop focused/full gates:** PASS
**Standalone S24 Ultra physical validation:** PASS

### Status

**COMPLETE & LOCKED when the exact validated 19-path manifest is committed.**

Phase 8 overall remains **NOT LOCKED** pending the remaining P8.7 cross-platform audit/lock sequence and the agreed final production-polish work.

The next product work is not History/Progress sync. The next sequence remains:

1. canonicalize this post-lock amendment,
2. complete the Phase 8 functional acceptance/audit closure,
3. perform the broad Account / Orion Cloud production-polish pass across Desktop and Mobile,
4. separately decide later whether History and verified Progress should become synchronization domains.
