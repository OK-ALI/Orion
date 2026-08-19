# Orion P8.4 Candidate 3-C — Explicit Watched One-Shot Sync Audit

**Project:** Orion — A Multiverse of Stories
**Subsystem:** Phase 8 cross-platform Watched synchronization
**Audit date:** 2026-08-19
**Audit status:** **COMPLETE & LOCKED**
**Starting checkpoint:** `ae3989caac125588d176000506338799c9e09f41`
**Previous checkpoint:** P8.4 C3-B — COMPLETE & LOCKED
**Next candidate:** P8.4 C3-D — Automatic Steady-State Watched Sync
**Phase 8 overall:** **NOT LOCKED**

---

## 1. Purpose

P8.4 C3-C introduces the first real PortableProfileV3 Watched mutation path.

The candidate is deliberately explicit and user-controlled.

It provides:

- read-only Watched preflight,
- explicit confirmation,
- safe first enrollment,
- conditional PortableProfileV3 writes,
- bounded semantic read-back verification,
- Mobile local Watched application,
- Desktop local Watched application,
- verified per-device Watched checkpoints.

C3-C does not activate automatic Watched synchronization.

---

## 2. Portable Watched truth

Portable Watched contains only:

- exact movies,
- exact TV episodes.

Canonical keys remain:

- movie: `movie_<id>`
- episode: `tv_<seriesId>_s<season>_e<episode>`

Whole-series Watched state remains derived locally and is not portable truth.

Continue Watching remains derived and has no PortableProfileV3 namespace.

---

## 3. First-enrollment policy

Local absence before a verified Watched checkpoint does not mean intentional unwatch.

Safe first enrollment therefore distinguishes:

### Both copies equal

Establish a verified checkpoint without mutation.

### Local is a subset of cloud

Pull cloud positives locally.

### Cloud is a subset of local

Push local positives conditionally.

### Both sides contain unique positive records

Build an explicit union/merge candidate.

### Local positive collides with cloud tombstone

Fail closed and require review.

A cloud tombstone is never automatically resurrected during first enrollment.

---

## 4. Post-checkpoint reconciliation policy

After a verified checkpoint exists:

- unchanged / unchanged → verified,
- local-only change → conditional cloud update,
- cloud-only change → local pull,
- both changed to the same semantic truth → verified,
- conflicting two-sided change → review,
- local removal → portable tombstone,
- stale conditional write → conflict/review.

No side silently wins a genuine divergence.

---

## 5. Explicit confirmation contract

The Check Watched action is read-only.

A Ready plan produces an explicit Confirm sync action.

Before Confirm executes mutation, Orion re-reads:

- current local Watched truth,
- current cloud PortableProfileV3,
- current cloud revision state.

The execution plan must still match the previously confirmed semantic plan.

A stale confirmation cannot blindly mutate cloud or local state.

---

## 6. Desktop PortableProfileV3 write bridge

C3-C extends the C3-A Desktop bridge from read-only access to a guarded PortableProfileV3 write path.

New IPC contract:

- preload method: `writePortableProfile`
- IPC channel: `portable-profile:write`

Final Desktop IPC contract:

**222 methods / 141 channels**

The Desktop main-process boundary validates:

- PortableProfileV3 structure,
- profile identity,
- profile size,
- namespace/record structure,
- revision requirements.

The stable Google subject must match `PortableProfileV3.profileId`.

Identity or malformed-profile failures occur before Drive mutation.

The legacy Desktop `orion-sync-manifest.json` path remains separate and unchanged.

---

## 7. Conditional cloud mutation

Cloud writes remain revision-aware.

Desktop existing-profile updates require a strong atomic conditional revision token and fail closed if that guarantee is unavailable.

Mobile continues using its native Google Drive appDataFolder transport and native token boundary.

OAuth/access tokens do not cross into portable profile payloads.

A conditional conflict never proceeds to local convergence.

---

## 8. Post-write verification

C3-C initially required the read-back opaque Drive revision token to equal the token returned by the write.

Physical validation demonstrated that a successful cloud mutation could be semantically present while immediate opaque revision-token equality had not converged.

The verifier was repaired.

Final post-write acceptance requires semantic equality of the complete expected PortableProfileV3 document rather than treating the opaque concurrency token as document identity.

The concurrency token still protects the write itself.

Read-back verification proves:

- profile identity,
- complete expected Watched namespace,
- expected tombstones,
- expected profile revision/state,
- unrelated known namespaces preserved,
- unknown namespaces preserved.

Any semantic body divergence still fails closed.

---

## 9. Mobile local application boundary

Mobile exposes a Watched-only local replacement operation.

It may mutate only local Watched state.

It does not mutate:

- My List,
- History,
- Progress,
- Continue Watching persistence.

Local persistence failure is surfaced and does not silently become a successful checkpoint.

---

## 10. Desktop local application boundary

Desktop converts canonical portable exact-episode identity back into the existing Desktop Watched representation.

Local apply changes Watched truth only.

Existing History, Progress, playback verification, Start Over / Not Started behavior and Continue Watching derivation remain unchanged.

---

## 11. Physical-validation amendment: derived series summaries

During the first Mobile physical preflight, five Watched records were reported as unsafe.

Inspection proved that the Mobile portable boundary treated derived whole-series Watched summaries as rejected data.

That contradicted the already-locked C3-B contract that whole-series summaries are derived/local rather than portable truth.

The Mobile adapter was repaired so:

- derived whole-series summaries are ignored at the portability boundary,
- they do not enter portable Watched,
- they do not affect signatures,
- they do not block synchronization.

Malformed and genuinely non-portable records continue to block synchronization.

This is a controlled C3-B implementation amendment restoring the existing locked semantics rather than changing them.

---

## 12. Historical test-harness amendments

Two older source-contract tests required narrow maintenance after the legitimate C3-C implementation changed surrounding source layout/semantics.

### P8.3 My List source-boundary test

The test previously sliced `replaceMyListFromSync` until a later unrelated declaration.

Insertion of the new Watched replacement function caused that slice to accidentally include Watched code.

The test boundary was narrowed to the actual My List function.

No P8.3 production sync semantics changed.

### P8.4 C1 viewing-state source expectation

The older test expected the literal `derived-series-summary` rejection marker.

After physical validation proved derived series summaries must be ignored, the test was changed to assert the semantic behavior directly:

- summary recognized as derived,
- summary skipped,
- summary not portable.

C1 canonical episode identity, verified History/Progress truth, and no-cloud-mutation boundaries remain unchanged.

---

## 13. Focused automated evidence

### Mobile/shared

Final focused verifier group:

**13 / 13 PASS**

Mobile TypeScript:

**PASS**

Mobile source-size:

**131 files PASS**

### Desktop

Watched one-shot + Watched adapter:

**19 / 19 PASS**

Desktop focused architecture:

- source-size: 352 files
- renderer bindings: 306 files
- IPC: 222 methods / 141 channels

---

## 14. Full automated evidence

### Mobile

- TypeScript: PASS
- tests: **209 / 209**
- source-size: **131 files**
- Expo Doctor: **20 / 20**
- production web export: PASS

### Desktop

- source-size: **352 files**
- bindings: **306 files**
- IPC: **222 methods / 141 channels**
- secrets: PASS
- theme colors: PASS
- circular dependencies: none
- Node: **102 / 102**
- Renderer: **52 files / 208 tests**
- production build: PASS

No source-size ceiling was raised.

---

## 15. Android physical validation

The standalone Android candidate was built, installed and launched on the Samsung S24 Ultra.

The Account surface, Google identity, Drive readiness and Watched controls rendered and operated correctly.

Derived whole-series-summary compatibility was physically verified after its amendment.

---

## 16. Cross-device physical acceptance

### Initial enrollment

Initial portable Watched topology:

- Desktop: 0
- Cloud: 0
- Mobile: 96

Mobile explicitly planned and confirmed a 96-item cloud update.

A fresh Mobile read verified 96 cloud items.

Desktop independently detected a cloud-only 96-item change and explicitly restored it.

Result:

- Desktop: 96
- Cloud: 96
- Mobile: 96

### Post-write verifier repair proof

Starting topology:

- Desktop: 96
- Cloud: 96
- Mobile: 96

One previously-unwatched movie was marked Watched on Mobile.

Mobile Check Watched produced an explicit 97-item update plan.

Mobile Confirm sync completed with immediate:

**97 Watched items verified across this device and Orion cloud.**

No restart and no false-negative warning were required.

Desktop independently detected:

**Cloud has 97 Watched items ready to restore on this Desktop.**

Desktop Confirm sync completed with:

**97 Watched items verified across this Desktop and Orion cloud.**

Final physical topology:

- Desktop: **97**
- Cloud: **97**
- Mobile: **97**

**CROSS-DEVICE PHYSICAL ACCEPTANCE — PASS**

---

## 17. Locked-boundary audit

C3-C does not activate or alter:

- automatic Watched synchronization,
- History cloud synchronization,
- Progress cloud synchronization,
- Continue Watching as a cloud namespace,
- legacy Desktop viewing-state cloud authority,
- old Desktop backup migration,
- P8.3 My List reconciliation semantics,
- Cinema,
- Music Planet,
- Smart Connect,
- playback evidence thresholds,
- Start Over / Not Started truth.

C3-C changes the minimum locked owners required for explicit Watched one-shot synchronization only.

---

## 18. Final status

**P8.4 C3-C — COMPLETE & LOCKED**

The lock becomes canonical when this audit and the validated candidate are committed and pushed together.

Phase 8 remains **NOT LOCKED**.

---

## 19. Next candidate

Next:

**P8.4 C3-D — Automatic Steady-State Watched Sync**

C3-D must reuse the proven C3-C reconciliation machinery.

It may add per-device Watched automatic-sync policy and automatic reconciliation, but must not create another synchronization algorithm.

C3-D must preserve:

- explicit tombstones,
- namespace-specific signatures,
- conditional cloud writes,
- semantic read-back verification,
- offline safety,
- Needs review on unresolved divergence,
- manual Sync while automatic policy is paused.

Automatic History and Progress synchronization remain separate future work unless the Phase 8 roadmap explicitly advances them.
