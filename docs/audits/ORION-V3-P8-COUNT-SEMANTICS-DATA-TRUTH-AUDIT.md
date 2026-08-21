# Orion V3 Phase 8 Count Semantics and Data Truth Audit

**Date:** 2026-08-21
**Canonical parent:** `53048b7c9ed43e8304509ba0ecf821d1b2c4af09`
**Branch:** `codex/orion-v3-p8.1-candidate-1`
**Classification:** COMPLETE
**Phase 8 overall:** NOT LOCKED

## 1. Purpose

This audit traces every Phase 8 user-visible library/synchronization count to its real owner and population, validates those semantics against actual Mobile data, repairs functional divergence where found, and refuses to make unrelated populations numerically match for presentation purposes.

## 2. Count ownership findings

### My List

Mobile Library:

- population: saved titles
- observed audited population: 155

Mobile Account / portable profile:

- population: ordered portable My List identities
- observed audited population: 155

Classification: correct and aligned.

### Watched

Mobile Library:

- population: watched titles that are also present in My List
- observed audited population: 11

Mobile Account / Orion Cloud:

- population: portable watched movies plus exact watched TV episodes
- observed audited population: 105

Classification: intentional different populations. No data defect.

### History

Mobile Library:

- population: local displayable History identities
- audited population at the first data snapshot: 43

Portable Viewing Activity History:

- population: verified portable exact identities
- audited population at the first data snapshot: 38

The five-record difference was proven to be local TV History with missing exact season/episode identity. These records were not silently promoted to portable truth.

Classification: safe local/portable population difference. User-facing wording requires polish, not count forcing.

### Playback positions

Raw local progress contained more records than portable playback positions because:

- watched truth can supersede resumable progress,
- legacy/title-level TV progress can lack a portable exact episode identity,
- Continue Watching applies additional eligibility and grouping rules.

Portable playback-position count is therefore not expected to equal raw local progress or Continue Watching.

### Continue Watching

Continue Watching is locally derived. It is not an Orion Cloud namespace.

Canonical eligibility after this repair:

- verified playback truth,
- current time at least 30 seconds,
- not completed,
- percentage below 90 percent when percentage is known,
- not already Watched,
- TV episodes grouped by series,
- only the most recently played eligible episode remains for each series.

## 3. Functional defects recovered

### A. Mobile TV fallback identity divergence

Before repair, Mobile PlayerScreen could use S1E1 when building a TV playback source URL while the persisted playback identity still used nullable route season/episode values.

This allowed verified title-level TV History/Progress records to be created even though an exact episode was actually playing.

Repair:

- one route-playback identity resolver owns the effective TV fallback;
- missing TV season defaults to 1;
- missing TV episode defaults to 1;
- source URL, progress lookup, completion behavior and telemetry identity use the same effective episode identity.

Historical ambiguous records are not retroactively guessed.

### B. Desktop Continue Watching eligibility divergence

Desktop previously used legacy percentage-only thresholds greater than 2 percent and below 98 percent.

Repair:

- one shared Continue Watching policy owns the 30-second / below-90-percent eligibility contract;
- Desktop derives Continue Watching from verified portable viewing truth rather than legacy percentage alone.

### C. Desktop Home versus Library series grouping

After the eligibility repair, physical testing showed Desktop My Library correctly collapsed Reacher episodes but Desktop Home still rendered both S1E1 and S1E2.

Repair:

- `useLibraryState` now owns canonical eligibility, recency ordering and latest-episode-per-series grouping;
- Home and Library consume the same canonical in-progress population;
- Library no longer applies a second independent series-grouping algorithm.

## 4. Candidate chain

Candidate 1:

- Mobile TV fallback identity repair
- shared Continue Watching policy
- Desktop verified Continue Watching derivation

Candidate 1.1:

- repaired direct Node test loading through the existing `@orion/shared/api/*` package subpath contract
- restored the shared API barrel to canonical content

Candidate 1.2:

- repaired one stale Desktop LibraryState test fixture by supplying durable verified Progress details
- production behavior unchanged

Candidate 1.3:

- moved latest-episode-per-series ownership into Desktop `useLibraryState`
- unified Desktop Home and Library Continue Watching semantics

## 5. Automated evidence

Candidate 1.2 grouped full gate:

- shared type contract: PASS
- Mobile full gate: PASS
- Desktop full gate: PASS
- diff integrity: PASS
- staged index: CLEAN

Candidate 1.3 final Desktop gate:

- source-size: PASS for 365 files
- renderer bindings: PASS for 319 files
- IPC contract: 222 methods / 141 channels
- secret scan: PASS
- theme-color check: PASS
- circular dependencies: none
- Node tests: 106 / 106
- renderer tests: 263 / 263 across 60 files
- production build: PASS, 351 modules transformed
- final diff integrity: PASS
- staged index: CLEAN

Known non-blocking warnings remained the established SQLite experimental warning, MiniPlayer React act warning, and Vite large-chunk warning.

## 6. Physical data-truth evidence

### Michael cross-device proof

Michael was played on Mobile.

Desktop subsequently showed:

- History: 39
- Progress: 9
- Michael present in Continue Watching at about 22 percent

This physically confirmed Mobile playback truth reaching Desktop through the existing Viewing Activity sync path.

### Outer Banks exact TV identity proof

The final title-level TV validation used Outer Banks through the Mobile title-level playback route.

The resulting verified Mobile record used exact:

- media type: TV
- season: 1
- episode: 1
- portable key: `tv_100757_s1_e1`
- evidence: provider video event

No new Outer Banks null-season/null-episode record was created.

The final portable signatures showed:

- Mobile local portable History: 40
- Mobile local portable Progress: 10
- verified Orion Cloud History: 40
- verified Orion Cloud Progress: 10

Outer Banks S1E1 was represented in both local portable truth and verified Orion Cloud truth.

### Desktop Continue Watching parity proof

Final physical Desktop screenshots showed:

- Home Continue Watching: 6
- My Library Continue: 6
- Reacher only once as S1E2 / First Dance
- older Reacher S1E1 excluded from the canonical derived population
- above-90-percent Supergirl excluded

Desktop Home and Library therefore derive the same canonical Continue Watching population.

## 7. Accepted semantic contract

The Count Semantics and Data Truth audit accepts:

- different populations may have different counts;
- labels must explain the population instead of forcing numbers to match;
- exact TV episode identity is required for portable Viewing Activity;
- historical ambiguous local TV records remain local;
- Watched remains an independent synchronized domain;
- Continue Watching remains locally derived from synchronized playback truth;
- Continue Watching has no Cloud namespace;
- no preference synchronization was introduced;
- no Mobile Music synchronization was introduced;
- unknown/future namespaces remain governed by the existing preservation contract.

## 8. Final classification

**Phase 8 Count Semantics and Data Truth Audit: COMPLETE.**

No further functional Count Truth implementation is required unless later source changes or the final Phase 8 audit finds a regression.

This checkpoint is not an overall Phase 8 lock.

## 9. Post-audit status before P8.7

The production-polish work required by this audit is now physically accepted:

- Mobile Settings -> Account is unified around Orion Cloud and the three synchronized domains;
- user-facing count language distinguishes titles, watched movies & episodes, History entries and playback positions;
- explicit Sync now exposes visible Syncing/busy feedback while Auto sync is paused;
- Desktop Account/Orion Cloud presentation and global My List/Watched indicators are productized;
- Desktop passive Cloud pickup is covered by a bounded heartbeat;
- Viewing Activity recovered from `Needs review` to `Synced` through the guarded steady-state path.

The later live Desktop snapshot showed 39 History entries and 8 playback positions. That operational count does not replace or invalidate the historical 40 History / 10 Progress portable proof recorded in Section 6.

Immediate next work is the pre-P8.7 checkpoint gate and checkpoint commit, followed by the independent P8.7 full cross-platform audit.

Phase 8 remains NOT LOCKED.
