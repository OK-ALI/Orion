# Orion P8.4 Candidate 3-B — Watched Namespace Machinery Audit

**Project:** Orion — A Multiverse of Stories
**Subsystem:** Phase 8 cross-platform viewing-state synchronization
**Audit date:** 2026-08-19
**Audit status:** **COMPLETE & LOCKED**
**Starting checkpoint:** `de8b61cbde812e4ba4dc4b10c5bbdcc14b50913f`
**Next phase:** P8.4 C3-C — Explicit Watched Enrollment / One-Shot Reconciliation
**Phase 8 overall:** **NOT LOCKED**

---

## 1. Purpose

P8.4 C3-B establishes the portable Watched synchronization machinery shared by Orion Desktop and Orion Mobile.

This candidate intentionally does not activate cloud synchronization.

It establishes:

- exact movie Watched portability,
- exact TV episode Watched portability,
- Watched namespace signatures,
- explicit tombstones,
- revision-aware record evolution,
- Desktop local apply semantics,
- Mobile local apply semantics,
- unrelated PortableProfileV3 namespace preservation.

---

## 2. Canonical portable identity

Movies use:

`movie_<id>`

Exact TV episodes use:

`tv_<seriesId>_s<season>_e<episode>`

Whole-series Watched summaries remain derived/local and are not portable records.

Continue Watching remains derived and has no portable namespace.

---

## 3. Shared Watched machinery

New shared owner:

`packages\shared\src\types\portableWatchedSync.ts`

The shared machinery defines Watched-specific:

- namespace normalization,
- semantic signatures,
- active record handling,
- tombstone handling,
- revision advancement,
- profile mutation limited to the Watched namespace,
- reconstruction of active Watched truth.

No new synchronization engine was introduced.

The machinery is designed to be consumed by the existing Phase 8 synchronization architecture established in P8.3.

---

## 4. Tombstone contract

Portable Watched deletion is explicit.

When previously active portable Watched truth disappears from the authoritative local set, the resulting portable record becomes a tombstone rather than silently vanishing.

This prevents a stale offline device from resurrecting removed Watched state merely because it still contains an older positive copy.

Existing cloud tombstones remain meaningful synchronization truth.

---

## 5. Desktop adapter contract

New owner:

`apps\desktop\src\renderer\features\library\watchedSyncAdapter.js`

Existing adapter extended narrowly:

`apps\desktop\src\renderer\features\library\viewingStatePortableAdapter.js`

Desktop may retain its native local episode key representation, including forms such as:

`tv_9_s1e2`

The portable boundary canonicalizes the same semantic episode as:

`tv_9_s1_e2`

Cloud apply reconstructs the Desktop-local representation required by the existing Desktop library behavior.

History and Progress verification rules are unchanged.

---

## 6. Mobile adapter contract

New owner:

`apps\mobile\src\features\library\watchedSyncAdapter.ts`

Existing adapter extended narrowly:

`apps\mobile\src\features\library\viewingStatePortableAdapter.ts`

Mobile preserves semantic episode identity through:

- series ID,
- season number,
- episode number.

Portable exact episode records can therefore be materialized locally without requiring the portable schema to inherit Mobile-specific episode-ID storage keys.

Derived whole-series summaries remain local.

---

## 7. Mutation boundary

C3-B does not:

- read Google Drive automatically,
- write Google Drive,
- enroll Watched sync,
- perform first-device reconciliation,
- activate automatic Watched sync,
- synchronize History,
- synchronize Progress,
- create a Continue Watching namespace,
- migrate legacy Desktop cloud viewing data,
- modify My List synchronization semantics.

C3-B is synchronization machinery only.

---

## 8. Expo SDK 57 baseline amendment

During final Mobile validation, Expo Doctor identified patch-level SDK 57 dependency drift already present in the C3-A baseline.

The workspace was aligned using Expo's own SDK-compatible dependency resolver.

Direct package adjustments remained within SDK 57, including:

- `expo` 57.0.12 → 57.0.14
- `expo-build-properties` 57.0.10 → 57.0.12
- `expo-linking` 57.0.5 → 57.0.6
- `expo-router` 57.0.12 → 57.0.14
- `expo-splash-screen` 57.0.6 → 57.0.7

The root lockfile resolved the associated compatible SDK 57 package graph.

This was a toolchain/baseline repair, not Watched product functionality.

Final Expo Doctor:

**20 / 20 PASS**

---

## 9. Focused automated evidence

Mobile/shared focused contracts:

**11 / 11 PASS**

Mobile TypeScript:

**PASS**

Desktop focused contracts:

- Watched sync adapter
- existing viewing-state portable adapter

Result:

**9 / 9 PASS**

Desktop focused gates:

- source-size: 348 files
- renderer bindings: 302 files
- IPC: 221 methods / 140 channels

---

## 10. Full evidence

### Mobile

- TypeScript: PASS
- full tests: 203 / 203
- source-size: 129 files
- Expo Doctor after alignment: 20 / 20
- full Mobile gate rerun: PASS
- standalone Android build: PASS
- bundled JavaScript verification: PASS

### Desktop

- source-size: 348 files
- renderer bindings: 302 files
- IPC: 221 methods / 140 channels
- secrets: PASS
- theme colors: PASS
- circular dependency check: PASS
- Node tests: 94 / 94
- Renderer tests: 51 files / 194 tests
- production build: PASS

---

## 11. Candidate integrity proof

All eight intended C3-B source/test files matched the validated candidate SHA-256 hashes.

Result:

**8 / 8 PASS**

`git diff --check` reported no whitespace errors.

---

## 12. Physical validation

The post-Expo-alignment standalone Android APK was built and installed on the Samsung S24 Ultra.

Physical smoke validation confirmed:

- installation succeeds,
- Orion launches normally,
- existing application UI loads correctly,
- no obvious Account/Library startup regression is introduced.

No Watched synchronization UI was expected in C3-B because runtime cloud mutation and enrollment are intentionally not activated yet.

**PHYSICAL SMOKE PASS**

---

## 13. Locked-boundary audit

C3-B did not reopen:

- Cinema behavior
- Music Planet behavior
- Smart Connect
- downloader behavior
- playback verification thresholds
- Start Over / Not Started semantics
- legacy Google viewing-state authority
- P8.3 My List reconciliation algorithm
- PortableProfileV3 envelope
- History portability rules
- Progress portability rules

The Desktop C2-owned viewing-state adapter received only the Watched-specific extension required for C3-B.

C2 verified History/Progress and legacy-cloud fencing remain unchanged.

---

## 14. Final status

**P8.4 C3-B — COMPLETE & LOCKED**

C3-B establishes Watched synchronization semantics but grants no permission for automatic cloud activity.

Phase 8 remains **NOT LOCKED**.

---

## 15. Next candidate

Next:

**P8.4 C3-C — Explicit Watched Enrollment / One-Shot Reconciliation**

C3-C may introduce the first actual Watched PortableProfileV3 mutation.

It must reuse:

- the C3-A verified Desktop/Mobile cloud identity bridge,
- the C3-B Watched namespace machinery,
- the P8.3 conditional-write/readback architecture.

C3-C must remain explicit and user-controlled.

Automatic steady-state Watched synchronization belongs to a later candidate.


---

## Post-lock amendment — P8.4 C3-C physical validation

**Date:** 2026-08-19

C3-C physical validation exposed one implementation mismatch with the already-locked C3-B contract.

Mobile derived whole-series Watched summaries were being classified as rejected portable data.

C3-B already defines those summaries as derived/local rather than portable truth.

The Mobile adapter was therefore corrected so derived whole-series summaries are ignored at the portability boundary.

They:

- remain local,
- are not uploaded,
- do not affect Watched signatures,
- do not block synchronization.

Malformed and genuinely non-portable Watched records remain blocking failures.

C3-C also extends the shared Watched machinery with explicit one-shot reconciliation planning while preserving the C3-B canonical identity, tombstone and namespace-signature contracts.

Focused contracts, complete Mobile gates and physical 96 → 97 cross-device validation passed.

Canonical C3-C audit:

`docs\audits\ORION-P8.4-C3C-EXPLICIT-WATCHED-ONE-SHOT-AUDIT.md`

**P8.4 C3-B remains COMPLETE & LOCKED.**
