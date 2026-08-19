# Orion P8.4 Candidate 3-D â€” Automatic Watched Steady-State Sync Audit

**Project:** Orion â€” A Multiverse of Stories
**Subsystem:** Phase 8 cross-platform Watched synchronization
**Audit date:** 2026-08-19
**Audit status:** **COMPLETE & LOCKED**
**Starting checkpoint:** `29aa89a361642b350e465a91b95d7becda0e3d2f`
**Previous checkpoint:** P8.4 C3-C â€” COMPLETE & LOCKED
**Phase 8 overall:** **NOT LOCKED**

---

## 1. Purpose

P8.4 C3-D activates automatic steady-state synchronization for the already-enrolled Watched domain on Orion Mobile and Orion Desktop.

C3-D is automation around the locked C3-C reconciliation coordinator. It does not create a second reconciliation algorithm and it does not change first-enrollment policy.

The candidate adds:

- per-device Watched Auto Sync policy,
- automatic reconciliation after an established Watched checkpoint,
- automatic one-sided local push,
- automatic one-sided cloud pull,
- automatic tombstone propagation through the existing C3-C mutation path,
- Paused behavior when Auto Sync is disabled,
- manual Sync now while automatic policy remains disabled,
- account-switch cancellation before mutation,
- Mobile app-state and network-triggered catch-up,
- Desktop focus/visibility and network-triggered catch-up,
- Needs Review behavior for unresolved divergence.

---

## 2. First enrollment remains explicit

C3-D does not automatically enroll Watched.

If no verified Watched checkpoint exists, the automatic steady-state coordinator returns `unenrolled` before cloud reconciliation work begins.

The explicit C3-C Check / confirmation path remains the owner of first enrollment.

This preserves the C3-C rule that pre-checkpoint local absence is not interpreted as an intentional unwatch.

---

## 3. Reused reconciliation engine

Shared steady-state entry point:

`reconcilePortableWatchedSteadyStateSyncV1`

This coordinator composes:

- `inspectPortableWatchedOneShotSyncV1`,
- `executePortableWatchedOneShotSyncV1`.

It therefore reuses the already-locked C3-C guarantees:

- fresh local preview,
- fresh cloud read,
- namespace-specific reconciliation,
- conditional cloud mutation,
- tombstones for removals,
- stable pull verification,
- full semantic post-write read-back,
- unrelated namespace preservation,
- checkpoint creation only after verified convergence,
- Needs Review on unsafe divergence.

No last-write-wins path was introduced.

---

## 4. Automatic reconciliation policy

After an established checkpoint exists:

- both copies unchanged â†’ verify and refresh checkpoint,
- local-only change â†’ automatic conditional cloud update,
- cloud-only change â†’ automatic stable local pull,
- both sides changed to the same semantic truth â†’ verify,
- genuine two-sided divergence â†’ Needs Review,
- local removal â†’ existing portable tombstone path,
- conditional conflict â†’ Needs Review,
- local/account/policy change during an automatic transaction â†’ cancel or fail closed before unsafe convergence.

Automatic execution does not silently choose a winner for genuine divergence.

---

## 5. Per-device policy

### Mobile

The reusable P8.3 sync-policy registry is extended from:

- My List

to:

- My List,
- Watched.

Existing stored My List policy remains compatible. Watched automatic policy is local to the signed-in device/account and defaults to enabled when no stored Watched policy exists.

### Desktop

Desktop receives its own local per-profile Watched automatic policy store.

Desktop and Mobile policies are intentionally device-local. Turning Auto Sync off on one Orion client does not disable it on another client.

---

## 6. Paused and manual behavior

When Watched Auto Sync is OFF:

- automatic cloud mutation is blocked,
- local Watched changes remain local,
- status becomes Paused,
- local state is not erased,
- cloud state is not erased,
- the established checkpoint remains available,
- manual `Sync now` remains available.

Manual reconciliation while paused still uses the same C3-C coordinator and safety checks.

Turning Auto Sync back ON schedules a fresh reconciliation rather than assuming the paused state is already synchronized.

---

## 7. Offline behavior

Mobile and Desktop steady-state owners both stop automatic reconciliation before cloud I/O when their network state reports offline.

The local Watched state remains authoritative on-device while offline. Network/app-state/focus changes schedule a fresh reconciliation when connectivity is restored.

During physical validation, Orion Mobile correctly entered its offline product state and blocked network-backed title loading. Because the normal title surface itself is unavailable offline, a new Watched mutation could not be initiated from that exact screen while disconnected.

This audit does **not** claim a separate physical offline-Watched mutation proof. The lock accepts the observed offline gating plus the implemented no-cloud-I/O boundary, rather than manufacturing a redundant runtime path that the current product surface cannot reach.

---

## 8. Account-switch / policy cancellation

C3-D adds an optional `shouldProceed` guard to the existing C3-C executor.

Manual C3-C callers are unchanged because they do not provide this guard.

Automatic callers use it to stop before mutation if:

- the signed-in profile changes,
- Auto Sync is turned off while an automatic transaction is in flight.

This preserves account isolation and prevents an automatic transaction from committing under stale policy/account ownership.

---

## 9. Controlled C3-C Desktop writer amendment

Physical C3-D validation exposed a Desktop runtime limitation in the locked C3-C conditional-write boundary.

Observed failure:

- Desktop could read the current PortableProfileV3,
- Drive v3 returned only the monotonic `version` token at runtime,
- the existing writer required a strong ETag for `If-Match`,
- Orion correctly refused the write rather than performing an unsafe overwrite.

The repair does not weaken conditional-write safety.

Final Desktop update policy:

1. use the existing strong v3 ETag path when available,
2. when the stable v3 snapshot has only a version token, obtain the matching strong v2 ETag for the same file/version,
3. require the version to remain unchanged while obtaining that ETag,
4. perform the media update with `If-Match`,
5. map HTTP 412 / version drift to conflict,
6. continue failing closed if a strong conditional token cannot be proven.

No blind read-then-overwrite fallback was introduced.

This is a controlled post-lock amendment to the C3-C Desktop PortableProfileV3 writer boundary, required to make its already-locked atomic-update contract work with observed production Drive metadata behavior.

---

## 10. Candidate / repair artifacts

Implementation candidate:

`Orion-P8.4-C3D-Automatic-Watched-Steady-State-Candidate-1.zip`

SHA-256:

`42de3f573336b3950f8c6d33dfff6162b2de332b2db529738c4b48ed199d4fc7`

Narrow repairs applied during validation:

- Mobile token import repair
  `43186153cc3ec8f3ec7dead96e1aa3c169d2402b2dab0b4218ce2b55ddff72ef`
- Desktop source-size repair
  `d7dea971285f6f69db76f231339f94bde9400b1a065e9d11256e96ccec3087cb`
- Mobile full-gate stale contract repair
  `7cbe221c2130fb3729fe62e0c5166ec7c10a2c819131eee255f16f64fadf0d74`
- Desktop conditional-write runtime repair
  `caa936c15575ce54f0890cbab7a6ef2108c5f70407cd4e3ff1eb01b36b6ab8c1`

No source-size ceiling was raised.

---

## 11. Focused automated evidence

### Mobile/shared

Focused C3-D / C3-C / P8.3 contracts:

**25 / 25 PASS**

Mobile TypeScript:

**PASS**

Mobile source-size:

**PASS**

### Desktop renderer

C3-C + C3-D Watched reconciliation contracts:

**20 / 20 PASS**

Desktop source-size:

**PASS**

Desktop renderer bindings:

**PASS**

Desktop IPC contract:

**PASS**

### Desktop main-process conditional-write amendment

Portable profile store repair contract:

**15 / 15 PASS**

The repair preserves strong `If-Match` semantics and fail-closed conflict behavior.

---

## 12. Full automated evidence

The complete Mobile gate passed after the stale P8.3 copy assertion was updated to the C3-D product boundary.

The complete Desktop gate passed for the C3-D candidate. After the Desktop conditional-write owner was reopened, the Desktop main-process repair was regated before runtime acceptance.

No source-size ceiling was increased to obtain a passing result.

Known pre-existing non-blocking warnings remain outside C3-D ownership.

---

## 13. Physical validation

### Baseline

Established C3-C topology survived the upgraded Mobile build:

- Mobile: 97
- Cloud: 97
- Desktop: 97

Mobile showed Verified with Watched Auto Sync ON.

### Mobile â†’ cloud â†’ Desktop

One new Mobile Watched item:

- Mobile: 97 â†’ 98 automatically,
- cloud: 97 â†’ 98 automatically,
- Desktop: 97 â†’ 98 automatically after normal runtime reconciliation,
- manual sync actions: 0.

**PASS**

### Desktop conditional-write runtime discovery

After Desktop local additions, automatic reconciliation initially failed closed because the runtime Drive response did not expose the strong v3 ETag expected by the C3-C writer.

No unsafe cloud overwrite occurred.

After the controlled writer amendment, the same pending Desktop local delta reconciled successfully:

- Desktop: 98 â†’ 100,
- cloud: 98 â†’ 100,
- status: Verified.

**PASS after controlled repair**

### Desktop â†’ cloud â†’ Mobile

A further Desktop Watched addition proved the repaired steady-state path independently:

- Desktop: 100 â†’ 101 automatically,
- cloud: 100 â†’ 101 automatically,
- Mobile: 100 â†’ 101 automatically,
- manual sync actions: 0.

**PASS**

### Auto Sync OFF / Paused isolation

Starting aligned at 101:

- Desktop Auto Sync was turned OFF,
- one local Desktop Watched item was added,
- Desktop entered Paused,
- cloud remained 101,
- Mobile remained 101.

This proves automatic cloud work remained paused while local Watched truth was preserved.

**PASS**

### Manual Sync now while paused

With Desktop automatic policy still OFF:

- manual `Sync now` reconciled the pending item,
- Desktop / cloud reached 102,
- Desktop remained Paused,
- Mobile automatically pulled 102.

**PASS**

### OFF â†’ ON recovery

With Desktop paused at 102:

- another local Watched item was added,
- Auto Sync was re-enabled without manual Sync now,
- Desktop / cloud automatically reached 103,
- Mobile automatically reached 103.

**PASS**

### Offline product-state observation

Mobile was placed offline and visibly entered Orion's offline state. Network-backed title loading was intentionally unavailable, so the exact proposed "open a new title and mark it Watched while offline" interaction was not reachable from that surface.

The physical suite was stopped at this point because bidirectional mutation, pause isolation, manual-while-paused behavior, policy recovery, checkpoint persistence and Desktop conditional-write recovery had already been independently proven.

This limitation is documented rather than misreported as a physical offline-mutation pass.

---

## 14. Locked-boundary audit

C3-D changes only the minimum owners required for automatic steady-state Watched synchronization.

C3-D does **not** activate or alter:

- automatic first enrollment,
- History cloud synchronization,
- Progress cloud synchronization,
- Continue Watching as a cloud namespace,
- legacy Desktop `orion-sync-manifest.json` viewing authority,
- automatic migration of old Desktop cloud viewing data,
- C1 verified viewing-evidence thresholds,
- Start Over / Not Started semantics,
- Cinema,
- Music Planet,
- Smart Connect.

P8.3 My List reconciliation remains the architecture pattern. Its policy registry is extended to include Watched, but its reconciliation semantics are not replaced.

PortableProfileV3 envelope semantics remain unchanged.

---

## 15. Product UX follow-up

C3-D physical validation exposed remaining engineering-era Account / Settings presentation on both platforms.

The next focused productization pass should retain functionality while translating implementation into Orion-facing vocabulary.

Known items include:

- replace normal user-facing Drive / Google Drive storage language with Orion Cloud where provider detail is not required,
- remove Phase / Candidate / PortableProfileV3 language from normal UI,
- remove `Sync` from data-domain names such as `Watched Sync`,
- align Desktop and Mobile wording for the same states,
- stabilize conditional action-button layout,
- make paused/pending local changes more legible,
- keep Google wording for identity/provider actions where it is meaningful.

This audit does not assign that polish pass a new canonical P8.x number.

---

## 16. Final status

**P8.4 C3-D â€” COMPLETE & LOCKED**

The lock becomes canonical when:

- this audit,
- the controlled C3-C amendment,
- the Phase 8 handoff update,
- and the validated implementation

are committed and pushed together.

Phase 8 remains **NOT LOCKED**.

---

## 17. Next work

Immediate next work is the agreed focused **Account / Sync UX productization pass** for Orion Desktop and Orion Mobile.

After that pass is stabilized, resume the remaining Phase 8 roadmap from the canonical handoff.
