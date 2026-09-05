# Orion Phase 10A Connection completion audit

Date: 2026-09-05 (Asia/Karachi)

Classification: COMPLETE & LOCKED (with the documented manual-upgrade exception).

Repository: OK-ALI/Orion

Branch: `codex/orion-v3-p10-mobile-downloads-offline-library`

Accepted implementation and Desktop release source: `6d9c5a846051e622399daf4bb93abc78d4f8f35a`

This closes the Connection tranche on the basis of retained acceptance records, the user's confirmation of successful prior testing, and independently verified release/manual-installation evidence. The one-time manual upgrade exception and evidence limitations below are part of this acceptance. This document does not claim that the repaired updater has completed an end-to-end production upgrade.

## Authority and evidence provenance

The scope and acceptance IDs come from [the Phase 10A plan](ORION-PHASE-10A-CONNECTION-PLAN.md). The [P10A.0 baseline](ORION-PHASE-10A-P10A0-BASELINE-AND-CONTRACT-FREEZE.md) and [Phase 10 completion audit](ORION-V3-P10-F-PHASE-10-COMPLETION-AUDIT.md) remain historical authorities. Detailed publication and installation observations are preserved in the [P10A.6 checkpoint](ORION-PHASE-10A-P10A6-RELEASE-AND-LOCK-CHECKPOINT.md).

Evidence categories used here:

- Retained acceptance: existing repository records, particularly the detailed P10A.2 closure.
- User-reported acceptance: the user confirmed reaching P10A.6 with all testing successful, but no longer has the previous detailed P10A.3-P10A.6 reports. This supports acceptance of prior work; it is not a reconstructed test transcript or independently observed physical matrix.
- Independently verified now: source and release identities, package integrity/signing, installed production payload, focused candidate/release checks, and protected-file hashes.

No per-case physical results, benchmark numbers, test counts or hardware coverage are invented where the underlying report was not retained. Missing historical detail is recorded as an evidence limitation, not silently replaced with a fresh broad test claim.

## Implementation boundaries

| Stage | Boundary | Delivered scope |
| --- | --- | --- |
| P10A.0 | `c595c0c34f5ecfca47dffb4104a778d47378e5ce` | Baseline and architecture freeze, following plan and Download Modal contract commits |
| P10A.1 | `cf6eaff4f3e3d80cb9a3098ff5d9d170974902e1` | Mobile connection/recovery consumption and Desktop connection foundation |
| P10A.2 | `0a08be1f45d77f32670061ab1069dc71bbdbea48` | Recorded Mobile offline-product and physical acceptance closure |
| P10A.3 | `53b892b047997e73a107778eff6c0b8267139ad4` | Desktop offline/local Music and recovery, UI cohesion, Mobile library/filter/sort hardening |
| P10A.4 | `fa0e592bccb87e226f4a5502a8d795bd2ba566ea` | Desktop download preparation, library controls, and updater reliability |
| P10A.5 | `03544377c6b244867d3694e1b3b165270c4b9c03` | Existing performance coordinator extension, hardware capability, streaming/ambient budgets, Music rendering and lazy startup boundaries |
| P10A.6 | `6d9c5a846051e622399daf4bb93abc78d4f8f35a` | Desktop 2.2.17 candidate identity and final Electron-test maintenance |

The current Mobile candidate remains 2.2.16 / Android versionCode 50, with its tag at `913891fd6366cd9c83bc79d016f3776f09ea800b`. No new Mobile package was created for this closure.

The Phase 10 implementation remains `66f647af1a5f77d4792fe82ea2d4662fc3f05351`, with lock `50987dc2492f02ba7aa3dd9e235ba08a589a6b1c` and completion-audit floor `bd046de312de8edd0abe62d41d75b1c50eb2a9e2`. Remote v2.2.11 still targets the accepted Phase 10 implementation. Inspection of the Mobile native Java subtree shows no committed diff from that floor to this candidate.

## Acceptance contract reconciliation

All implementation contracts are accepted within the provenance stated here. Physical acceptance inherited from the user's general confirmation is explicitly identified, rather than relabelled as independently rerun evidence.

| Contract | Accepted scope and evidence |
| --- | --- |
| P10A-C01 | Per-platform truthful connection state; P10A.1 commits and prior successful-test confirmation |
| P10A-C02 | Service degradation versus transport-offline distinction; connection policy/network tests exist, with prior acceptance reported |
| P10A-C03 | Mobile useful offline cold start; retained P10A.2 F10A-M1/M2 acceptance |
| P10A-C04 | Mid-session loss preserves local capability; retained F10A-M3 acceptance |
| P10A-C05 | Mobile connection-aware navigation/actions; retained P10A.2 closure and focused-test results |
| P10A-C06 | Recovery without app restart or interrupted local playback; retained F10A-M4 acceptance |
| P10A-C07 | Desktop offline Home/Discover; P10A.3 source boundaries and user-reported prior acceptance |
| P10A-C08 | Desktop Downloads/Library/local playback; P10A.3/P10A.4 boundaries and user-reported prior acceptance |
| P10A-C09 | Music local-first capability and remote-action truth; P10A.3 boundaries and user-reported prior acceptance |
| P10A-C10 | Desktop download presentation/preparation contract; existing contract tests extended in P10A.4, with prior successful-test confirmation |
| P10A-C11 | Streaming performance hardening; P10A.5 source and user-reported prior testing. Historical numerical before/after measurements were not recovered; no quantified speedup is claimed |
| P10A-C12 | Music visual workload responds to tier, Reduced Motion and Battery Saver; P10A.5 budget/scene owners and prior accepted testing |
| P10A-C13 | Mobile performance extends existing ownership through request/recovery resilience; P10A.2 retained automated evidence and later prior acceptance |
| P10A-C14 | Theme/accessibility behavior; retained Mobile six-theme/Reduced Motion acceptance and user-reported later Desktop acceptance |
| P10A-C15 | Prior regression/physical testing reported successful; saved Electron last-run marker passed; independently verified candidate, release and installed payload; manual-upgrade exception below |
| P10A-C16 | This standalone audit, publication checkpoint, exact published manifest evidence and documentation lock; no Master Audit credit assigned |

The original Download Modal contract SHA256 in P10A.0 is historical. The candidate test has SHA256 `73761d70097a64cab44b66ec8c4b108df7aa28fa294651b8e895a092c0c7fa68`; P10A.4 extended that test rather than keeping the entire file byte-identical. This audit does not misrepresent the original whole-file hash as the candidate hash.

## Regression and physical evidence

Retained P10A.2 evidence in the plan records 54 focused presentation tests, 208 relevant regression tests, Mobile typecheck, the 190-file source-size gate, 3 distribution/version tests and 14 signing/runtime/build contract tests as passed. Those historical counts were not rerun or independently recounted here.

The plan records F10A-M1 through F10A-M5 functional physical acceptance on v2.2.13, followed by two presentation revalidations on v2.2.14. Later Mobile 2.2.16 and Desktop P10A.3-P10A.6 acceptance rely on the user's current confirmation that prior testing succeeded. Detailed F10A-D1-D5 and F10A-P1-P4 observations and numerical measurements are not recoverable in this session. Do not infer representative physical iGPU coverage or universal low-end performance from that confirmation.

The saved Desktop Electron `.last-run.json` reports `passed` and an empty failedTests array (2026-09-05 19:10:26 local). This marker does not independently establish a full inventory, count or source SHA for that run.

Independently executed during closure:

1. `node --test apps/desktop/tests/unit/main/p10a6DistributionVersion.test.js`: 1 passed, 0 failed; confirms Desktop 2.2.17 and preserved Mobile/root identities.
2. Existing shared production release resolver checked against the final GitHub release response and manifest: Preview resolves 2.2.17, Stable excludes this prerelease, installer is available, binary names/sizes/SHA256 values bind, and installer signer metadata matches.
3. Published metadata, tag, artifact digests, downloaded manifest hash, local Authenticode, installed payload hashes, installed version/process path, and protected-file invariance checks passed.

No application source was changed during closure. Broad previously green suites were not rerun for documentation-only work.

## Final published Desktop identity

Release: [Orion Desktop 2.2.17 Preview](https://github.com/OK-ALI/Orion/releases/tag/v2.2.17)

Tag/source: `v2.2.17` -> `6d9c5a846051e622399daf4bb93abc78d4f8f35a`

GitHub release ID: 383273972. Published prerelease, not draft; latest=false. GitHub latest stable remains v2.0.1.

| Published artifact | Bytes | SHA256 |
| --- | ---: | --- |
| Orion.Setup.2.2.17.exe | 100597696 | 043b875fe0699dce53368ec22c6440ab136e259da50c66febdc918f2a2758544 |
| Orion-2.2.17-win.zip | 136495462 | 6ef4564a7df840048963c438f3e9f96bde38bde3d6fcb86c36ce158daf051d05 |
| orion-release-integrity-v1.json | 814 | 4d160ab17dc64f0ef2858580e8fd0a6cf58d6c366122e0d3fd576d963dd04990 |

Installer Authenticode is Valid. Signer SHA1: `563AE69B35B819BBC845A37D850241D19EE6B6C5`. Certificate-byte-derived SHA256: `99b64a75f98bbe40ac9a435753c41b5159297df9870fb3fe7a927d2d50db6dc5`.

GitHub normalized spaces in the installer filename to periods, including on an attempted rename. Because Orion matches manifest entries by exact name, the new release's manifest was corrected only to use that published filename. Installer and ZIP bytes/hashes did not change. The original local manifest remains 814 bytes with SHA256 `215015e1dec02c1580238e4649ffc2a87a300d5498f5df7a21a13605472a5330`; that is prepublication evidence, not the final published manifest digest.

The [exact final manifest](evidence/p10a6-v2.2.17/orion-release-integrity-v1.json) is preserved alongside this audit. The final release contains exactly these three assets. Prior releases were not modified and the candidate tag was not moved.

## Manual production upgrade and accepted exception

The user explicitly stated that the installed 2.1.2 updater has a known issue already repaired in the subsequent implementation and authorized manual installation for this transition only. The signed candidate installer was launched after integrity checks.

Independently observed:

- Before: installed executable 2.1.2 / ProductVersion 2.1.2.0 and registry version 2.1.2.
- After: installed executable 2.2.17 / ProductVersion 2.2.17.0 and registry version 2.2.17.
- Running Orion processes originate from `C:/Program Files/Orion X Music Planet/Orion.exe`.
- Installed Orion.exe and resources/app.asar hashes match the corresponding payload entries in the verified 2.2.17 portable ZIP.
- Eight sampled local data files remain present; seven retained exact hashes. The current Music SQLite database changed after launch. A hash change alone establishes neither data loss nor correct migration; no contents were inspected to invent a result.

In response to the installation/launch/data-retention question, the user reported no error, successful manual updating, and displayed version 2.2.17. This is recorded as user acceptance of the manual upgrade. It is not a per-record reconciliation of every library/download item.

The old 2.1.2 updater was deliberately not used. A real end-to-end upgrade originating from the repaired installed updater remains future production coverage, to be obtained with the next suitable genuine version. The user's one-time manual-upgrade instruction makes this a documented exception for this closure; it is not silently marked as an in-app-updater PASS. No synthetic release or version bump was created for testing.

## Lock and exclusions

Lock marker: f8611c6d18738f4d187b5d1e19fdf1c4766bf4c6

The lock marker is verified as a zero-diff direct child of the accepted implementation. The subsequent documentation commit records this audit and plan closure without altering packaged source. The release tag remains on the candidate, not the lock or audit commit.

Exact protected/deferred files remain excluded from staging and unchanged from the session baseline:

| File | SHA256 |
| --- | --- |
| apps/mobile/tests/prePhase3UiPolish.test.cjs | 9b2b5048a85a1811eb72f42128b8d80ed1d268b3fb469fe8226013faeb662652 |
| docs/Orion-v3-Mobile-Desktop-Readiness-Audit-2026-07-31.md | d07a1d8c3f60836037db507ef444d4f7e3303f343a1c37981ff73e786184d48d |
| docs/Orion-Phase-10A-P10A.3-Inspection-Ownership-Baseline-2026-09-02.md | c3700ea07c19fa579a9e9d41c283a9f8b9a10873a7d4bf71eb68ed0aa6b4ba81 |

Phase 11 Orion Connect expansion, Phase 12 final-release validation, universal low-end hardware certification and Master Audit percentage reconciliation are not completed by this tranche. Master Audit reconciliation remains a later explicit task. Accepted implementation is frozen unless a new reproducible defect justifies a separately scoped repair.
