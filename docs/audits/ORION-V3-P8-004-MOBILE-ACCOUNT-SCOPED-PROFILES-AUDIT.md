# Orion V3-P8-004 Mobile Account-Scoped Profiles – Lock Audit

**Project:** Orion – A Multiverse of Stories
**Subsystem:** Phase 8 / Mobile account-scoped local library profiles
**Audit date:** 2026-08-20
**Audit status:** **COMPLETE & LOCKED when committed with the validated implementation and this canonical audit**
**Starting canonical HEAD:** `f2bdb44c37bb3d90f5b50f37e149f8aa90af44f6`
**Branch:** `codex/orion-v3-p8.1-candidate-1`
**Phase 8 overall:** **NOT LOCKED**

---

## 1. Requirement being closed

This audit closes revised master requirement **V3-P8-004**:

> Add account-namespaced Mobile profiles and non-destructive anonymous-profile import.

The implementation is intentionally Mobile-owned. It does not introduce a parallel Desktop profile migration and does not reopen the locked My List/Watched cloud reconciliation engines.

---

## 2. Archaeology conclusion

Pre-candidate archaeology proved the missing boundary was local Mobile ownership, not cloud identity or reconciliation machinery.

Existing components already provided:

- Google Account identity,
- SecureStore account session,
- Orion-owned Google identity and Drive authorization,
- `PortableProfileV3`,
- Google Drive cloud profile storage,
- My List portable synchronization,
- Watched portable synchronization,
- per-profile My List/Watched checkpoints,
- per-profile Auto Sync policy,
- conflict recovery,
- tombstones/revisions,
- the existing `LibraryContext` playback/library truth owner.

The actual gap was that Mobile `LibraryContext` still persisted five user-library domains through global MMKV keys:

- `saved`,
- `savedOrder`,
- `history`,
- `watched`,
- `progress`.

No hidden account-scoped replacement for those five keys was found. Therefore V3-P8-004 was a real remaining requirement, not duplicate implementation.

---

## 3. Locked architecture

### 3.1 One library owner

`LibraryContext` remains Orion Mobile's single My List / History / Watched / Progress state owner.

P8-004 changes `LibraryProvider` to receive an `IStorageAdapter`. It does not create a second library context or duplicate library state.

`LibraryProfileProvider` owns only profile selection and migration orchestration.

### 3.2 Storage scopes

Schema:

`p8.libraryProfile.v1`

Supported local scopes:

- `local`
- `google:<encodeURIComponent(stable account id)>`

Google scope identity uses the stable account ID only. It does not use:

- email,
- OAuth tokens,
- Drive file identifiers,
- device IDs.

### 3.3 Preserved legacy recovery source

The five old global keys are copied byte-for-byte into the `local` profile on first migration.

P8-004 does not remove or rewrite those global keys. They remain a non-destructive recovery source.

After migration, active library mutations occur through the selected scoped adapter rather than through the old global keys.

### 3.4 Account-profile creation

On first sign-in to an account without a ready scoped profile:

1. ensure the preserved Local profile exists,
2. copy Local's five library keys into the Google account scope,
3. read back and verify exact equality,
4. write a `staging` manifest,
5. retire stale synchronization proof where required,
6. reverify Local vs account-scoped bytes,
7. write the account `ready` manifest last.

A staged, invalid, or mismatched account profile is not exposed as active library truth and is not eligible for cloud synchronization.

### 3.5 Account switching

Provider readiness is bound to the current AccountContext target.

`LibraryProvider` is keyed by the active profile scope so React library state remounts across Local / Account A / Account B transitions.

My List and Watched steady-state providers additionally require:

- a ready cloud-eligible library profile,
- the active library profile ID to equal the signed-in account ID,
- in-flight operations to remain on that same identity.

This prevents stale account work from mutating a newly selected profile.

---

## 4. Cloud enrollment remains separately owned

P8-004 does not duplicate cloud merge or conflict policy.

The existing My List and Watched engines remain authoritative for:

- first enrollment,
- explicit conflict resolution,
- conditional cloud mutation,
- semantic read-back verification,
- steady-state reconciliation,
- Needs Review,
- tombstones,
- per-device/per-profile Auto Sync policy.

The preserved `local` profile is never cloud eligible.

A new account-local profile therefore does not silently imply Orion Cloud enrollment.

---

## 5. Watched C1 regression and C1.1 repair

### 5.1 Physical finding

Candidate 1 initially retired both My List and Watched checkpoints when creating a new scoped account lineage.

Physical validation showed an existing Watched user could therefore appear as:

`Manual / Check Watched`

immediately after the application update.

After the user manually checked Watched:

- the checkpoint was recreated,
- Auto Sync returned,
- new Watched changes synchronized,
- Auto Sync remained active after relaunch.

This isolated the defect to migration-time checkpoint retirement rather than the steady-state Watched engine.

### 5.2 Why My List and Watched differ

My List already has a safe read-only semantic-equality path that can establish fresh proof when appropriate.

Watched deliberately keeps first enrollment explicit. Automatically recreating a missing Watched checkpoint would weaken that locked rule.

### 5.3 C1.1 rule

Candidate 1.1 therefore carries an existing Watched checkpoint across the storage-only migration only if:

- a valid account-specific checkpoint already exists,
- the newly scoped `watched` payload parses safely,
- the portable Watched preview contains no rejected keys,
- `portableWatchedTruthSignatureV1(newScopedPreview)` exactly equals the checkpoint's `localTruthSignature`.

If any proof fails, the checkpoint is cleared and explicit enrollment remains required.

The checkpoint is not rewritten or synthesized during a successful carry.

This treats the checkpoint as semantic reconciliation evidence, not as a lease on one MMKV path.

---

## 6. Automated evidence

### Candidate 1 focused

- Mobile TypeScript: **PASS**
- focused P8.1/P8.3/P8.4/P8-004 contracts: **62 / 62 PASS**

### Candidate 1 full Mobile gate

- TypeScript: **PASS**
- tests: **219 / 219 PASS**
- source-size: **134 files PASS**
- Expo Doctor: **20 / 20 PASS**
- production web export: **PASS**

### Candidate 1.1 focused repair

- Mobile TypeScript: **PASS**
- focused account/profile/My List/Watched contracts: **44 / 44 PASS**
- semantic Watched checkpoint-carry contract: **PASS**

### Candidate 1.1 full Mobile gate

- TypeScript: **PASS**
- tests: **220 / 220 PASS**
- source-size: **134 files PASS**
- Expo Doctor: **20 / 20 PASS**
- production web export: **PASS**

Known non-blocking Node warning during the full suite:

`MODULE_TYPELESS_PACKAGE_JSON` for `trailerCandidateService.ts`.

No source-size limit was changed.

---

## 7. Physical Samsung S24 Ultra acceptance

### 7.1 Non-destructive migration

Candidate 1 was installed over the existing Orion application without uninstalling it, preserving the real on-device storage lineage.

Observed post-migration real-user state included:

- My List: **153**
- Watched: **104**
- History: **37**
- Google identity: connected
- Orion Cloud: connected
- verified playback Progress/Continue Watching remained available
- no visible duplicate titles
- no storage/migration error
- no unexpected conflict.

A Library screenshot showing `Continue 0` was captured earlier than the later verified playback session that created the visible Continue Watching entry. The user explicitly clarified the chronology, so no Library/Home inconsistency is recorded.

### 7.2 Watched migration regression observation

After the update, Watched could appear Manual until the user ran `Check Watched`.

Once checked:

- Auto Sync appeared,
- Watched changes synchronized automatically,
- Auto Sync persisted across relaunch.

This finding produced Candidate 1.1.

### 7.3 Final profile-isolation matrix

The final C1.1 physical acceptance used probe titles created after migration.

#### Account A

- A-Probe existed in Account A,
- synchronization worked,
- state survived relaunch.

#### Signed-out Local

After disconnecting Google:

- A-Probe was absent,
- Local remained independent.

#### Account B

After signing into Account B:

- Orion showed **Ready to sync**, not an already-enrolled automatic-sync state,
- Account A-specific state was absent,
- no accidental cloud enrollment occurred.

#### A -> B -> A

Returning to Account A restored Account A's scoped library and did not expose B-specific probe state.

The physically proven invariant is:

`Local ≠ Account A ≠ Account B`

The user reported every final isolation validation passed.

---

## 8. Desktop ownership audit and no-change decision

A separate focused Desktop archaeology reviewed:

- account sync providers,
- My List steady-state sync,
- Watched steady-state sync,
- sync checkpoints,
- local My List/Watched storage adapters,
- settings/storage ownership,
- shared portable contracts,
- current Phase 8 documentation.

Desktop does not perform the Mobile storage-lineage migration.

Its local Cinema library remains device/installation-local, while existing synchronization evidence and policy are account-specific:

- Watched checkpoints are keyed by `profileId`,
- My List checkpoints are account-specific,
- Auto Sync policy is account/profile-specific,
- no-checkpoint guards prevent unverified Watched steady-state mutation,
- My List first enrollment retains its existing safe enrollment semantics.

Therefore **no Desktop P8-004 or C1.1-equivalent production candidate is required**.

This is an explicit no-change decision. Future History/Progress synchronization must still reuse Desktop's established account/checkpoint safety boundaries.

---

## 9. Candidate artifacts

### Candidate 1

`Orion-v3.0-P8-004-Mobile-Account-Scoped-Profiles-Candidate-1.zip`

SHA-256:

`78A7D40847D6C1A1EB9D95CEE3BF18A5DE418DA7E91EE64B823680C448B676F5`

### Candidate 1.1

`Orion-v3.0-P8-004-Watched-Checkpoint-Migration-Repair-Candidate-1.1.zip`

SHA-256:

`D4799EA005FB2FB2A4367FFC4F12CEB6D17C726AADC4F855968350A328B2B74A`

---

## 10. Canonical implementation manifest

Validated runtime/test implementation:

1. `apps/mobile/app/_layout.tsx`
2. `apps/mobile/src/context/LibraryContext.tsx`
3. `apps/mobile/src/features/account/LibraryProfileContext.tsx`
4. `apps/mobile/src/features/account/MyListSteadyStateSync.tsx`
5. `apps/mobile/src/features/account/WatchedSteadyStateSync.tsx`
6. `apps/mobile/src/features/account/watchedSyncCheckpoint.ts`
7. `apps/mobile/src/features/library/libraryProfileStorage.ts`
8. `apps/mobile/tests/accountScopedLibraryProfile.test.cjs`
9. `apps/mobile/tests/myListSteadyStateSync.test.cjs`

Canonical lock documentation:

10. `docs/audits/ORION-V3-P8-004-MOBILE-ACCOUNT-SCOPED-PROFILES-AUDIT.md`
11. `docs/handoffs/ORION-PHASE-8-RESUME-HANDOFF.md`

Expected canonical lock commit manifest: **11 paths exactly**.

---

## 11. Locked boundaries

After the lock commit, do not casually reopen:

- Mobile Local/Google library-scope identity,
- non-destructive preservation of the five legacy recovery keys,
- single `LibraryContext` ownership,
- commit-last scoped-profile readiness,
- Local profile exclusion from cloud sync,
- account-switch remount/fencing,
- existing My List enrollment/conflict ownership,
- explicit-first-enrollment Watched ownership,
- C1.1 semantic-only Watched checkpoint carry.

Reopen only for a proven regression, required accessibility/performance defect, explicit architecture migration, or necessary cross-platform amendment.

---

## 12. Scope deliberately not implemented here

V3-P8-004 does not implement:

- History cloud synchronization,
- verified Progress cloud synchronization,
- a Continue Watching cloud namespace,
- Preferences portability,
- Music portability,
- Desktop account-scoped local-library migration,
- final Phase 8 interruption/rollback acceptance,
- final Phase 8 master-roadmap reconciliation.

Continue Watching remains derived from verified Progress.

---

## 13. Remaining Phase 8 requirements

The saved master roadmap is the original Phase 8 baseline. It is intentionally not rewritten by this subphase lock; the master is reconciled after the final Phase 8 build/audit.

Remaining work includes:

- **V3-P8-006:** History + verified Progress synchronization, derived Continue Watching outcome, portable Preferences policy, explicit supported Music disposition,
- **V3-P8-007:** extend revision/merge/tombstone rules through the remaining portable domains,
- **V3-P8-008:** extend offline-first reconciliation while preserving unknown namespaces,
- **V3-P8-010:** finish interruption/rollback acceptance around the completed identity/profile model,
- **P8.7:** full Phase 8 cross-platform audit before Phase 8 lock.

---

## 14. Lock verdict

Subject to the canonical 11-path commit:

**V3-P8-004 Mobile Account-Scoped Profiles & Non-Destructive Local Import is COMPLETE & LOCKED.**

**Phase 8 overall remains NOT LOCKED.**

Immediate next implementation target:

**History + verified Progress portable synchronization architecture**, while Continue Watching stays derived.
