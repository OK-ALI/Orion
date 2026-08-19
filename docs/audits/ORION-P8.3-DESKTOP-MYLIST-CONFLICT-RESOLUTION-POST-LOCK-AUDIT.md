# Orion P8.3 Desktop My List Conflict Resolution — Post-Lock Amendment Audit

**Project:** Orion — A Multiverse of Stories
**Subsystem:** Phase 8 / P8.3 My List Portable Sync
**Audit date:** 2026-08-19
**Audit status:** **COMPLETE & LOCKED when committed with the validated candidate**
**Starting HEAD:** `c57cf1512073ba668e32f1bee3d02fdd5b9cd25c`
**Branch:** `codex/orion-v3-p8.1-candidate-1`
**Phase 8 overall:** **NOT LOCKED**

---

## 1. Purpose

P8.3 My List Portable Sync was already COMPLETE & LOCKED.

This post-lock amendment closes a Desktop product gap discovered during real
cross-platform use: when Desktop and Orion Cloud both contained different
non-empty My List state before Desktop had a verified reconciliation checkpoint,
Desktop correctly refused to guess, but offered no user-controlled resolution.

The amendment adds explicit Desktop conflict resolution without weakening the
existing P8.3 synchronization contract.

---

## 2. Accepted Desktop synchronization ownership

Desktop now has the same product-level My List synchronization model already
established on Mobile:

- My List synchronization is mounted globally inside the existing application boundary.
- synchronization uses PortableProfileV3 rather than the legacy Desktop backup manifest.
- successful synchronization is evidenced by a verified checkpoint, not a persisted boolean.
- automatic synchronization is controlled by a local per-device My List policy.
- disabling Auto sync pauses automatic cloud activity without deleting local or cloud data.
- explicit Check now / reconciliation remains available.
- local-only changes use revision-aware conditional cloud writes.
- cloud-only changes can be applied locally.
- semantic read-back verification is required after mutation.
- unrelated PortableProfileV3 namespaces are preserved.
- genuine unresolved two-sided divergence does not silently choose a winner.

---

## 3. Explicit conflict-resolution amendment

When Desktop and Orion Cloud contain divergent populated My Lists and there is
no safe automatic winner, Desktop exposes explicit user-controlled choices:

- Combine both
- Keep Desktop My List
- Keep Orion Cloud My List

The Combine path produces the semantic union of both active My Lists while
deduplicating shared titles.

A chosen resolution is not allowed to trust stale inspection state.

Before mutation Orion re-reads current cloud state and preserves the existing
identity, revision, conditional-write and read-back verification boundaries.

---

## 4. Physical conflict topology

Physical validation used a real divergent My List state:

- Desktop: 134 titles
- Orion Cloud: 28 titles
- already shared across both copies: 11 titles

Expected semantic union:

134 + 28 - 11 = 151 unique titles

Desktop presented:

`151 titles after combining. Every title currently present in either My List will be preserved.`

The user explicitly selected Combine.

Result on Desktop:

- My List: 151
- status: Synced
- Auto sync remained available

Result on Orion Mobile:

- My List sync: Synced
- device count: 151
- Orion profile count: 151
- actual Library / My List count: 151

The Mobile Library itself was inspected, proving that this was real collection
convergence rather than only a status-counter update.

**DESKTOP -> ORION CLOUD -> MOBILE PHYSICAL CONVERGENCE: PASS**

---

## 5. Watched isolation

The My List resolution did not absorb or rewrite Watched synchronization.

Watched remains an independent PortableProfileV3 domain with its own:

- enrollment/checkpoint,
- automatic-sync policy,
- reconciliation machinery,
- exact movie / exact episode portable truth.

P8.4 C3-D Automatic Steady-State Watched Sync remains intact.

Derived whole-series Watched state remains local.

---

## 6. Desktop automated evidence

Final Desktop regression evidence after the amendment:

- source-size: 361 files PASS
- renderer bindings: 315 files PASS
- IPC contract: 222 methods / 141 channels
- secrets: PASS
- theme-color gate: PASS
- circular dependencies: none
- Node tests: 106 / 106 PASS
- renderer test files: 55 / 55 PASS
- renderer tests: 227 / 227 PASS
- production Vite build: PASS

Focused relevant suites included:

- myListSteadyStateSync
- myListConflictResolution
- accountSyncProductization
- storage
- watched sync regression coverage

Known pre-existing non-blocking warnings were not hidden or converted into
false passes.

---

## 7. Mobile regression evidence

A fresh full Mobile regression gate was run against the same integrated
workspace after physical convergence.

Result:

- strict TypeScript: PASS
- automated tests: 210 / 210 PASS
- failures: 0
- source-size: 132 files PASS
- Expo Doctor: 20 / 20 PASS
- web export: PASS

The gate includes P8.3 My List enrollment, checkpoint, steady-state,
per-domain policy and P8.4 Watched synchronization contracts.

---

## 8. Locked-boundary audit

This amendment does not reopen or redefine:

- PortableProfileV3 schema ownership
- P8.3 My List canonical identity rules
- P8.4 Watched exact movie / exact episode identity
- Watched tombstone semantics
- playback evidence thresholds
- History portability contract
- Progress portability contract
- Continue Watching derivation
- legacy Desktop viewing-state cloud fence
- Start Over / Not Started truth
- Cinema
- Music Planet
- Smart Connect
- downloader behavior
- provider security boundaries

History automatic cloud synchronization is still not activated.

Verified playback Progress automatic cloud synchronization is still not activated.

Continue Watching remains derived from verified progress and intentionally has
no independent PortableProfileV3 namespace.

---

## 9. Final status

**P8.3 My List Portable Sync remains COMPLETE & LOCKED.**

**P8.3 Desktop My List Conflict Resolution post-lock amendment:
COMPLETE & LOCKED when this audit and the validated source tree are committed
and pushed together.**

P8.4 C3-D Automatic Steady-State Watched Sync remains COMPLETE & LOCKED.

Phase 8 overall remains **NOT LOCKED**.

The next Phase 8 viewing-state work must continue through the existing portable
namespace, checkpoint, conditional-revision, semantic-read-back and per-domain
policy architecture. It must not introduce a second synchronization engine.

History and verified playback Progress remain separate future synchronization
domains. Continue Watching must remain derived.
