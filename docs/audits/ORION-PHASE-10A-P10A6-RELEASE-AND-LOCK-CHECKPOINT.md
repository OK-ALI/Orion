# Phase 10A P10A.6 release and lock checkpoint

Date: 2026-09-05

Status: CLOSED; release and manual upgrade accepted, with final closure in ORION-PHASE-10A-COMPLETION-AUDIT.md. Intermediate pending states below are historical observations, superseded by the final acceptance entry.

## Source authority

- Local HEAD and remote `codex/orion-v3-p10-mobile-downloads-offline-library`: `6d9c5a846051e622399daf4bb93abc78d4f8f35a`.
- Desktop candidate: 2.2.17. Mobile remains 2.2.16 / Android code 50.
- Remote v2.2.11 tag still targets `66f647af1a5f77d4792fe82ea2d4662fc3f05351`.
- Before publication approval, v2.2.17 tag was absent locally and remotely; release lookup returned HTTP 404 before publication was attempted. Automatic approval review rejected the publication command before execution. No tag or release was created by the rejected command. The subsequently approved publication is documented below.

## Independently verified package evidence

| Artifact | Bytes | SHA256 |
| --- | ---: | --- |
| Orion Setup 2.2.17.exe | 100597696 | 043b875fe0699dce53368ec22c6440ab136e259da50c66febdc918f2a2758544 |
| Orion-2.2.17-win.zip | 136495462 | 6ef4564a7df840048963c438f3e9f96bde38bde3d6fcb86c36ce158daf051d05 |
| orion-release-integrity-v1.json | 814 | 215015e1dec02c1580238e4649ffc2a87a300d5498f5df7a21a13605472a5330 |

Installer and ZIP reside in `apps/desktop/release/`. The manifest resides at `C:/Users/aliwa/Downloads/orion-release-integrity-v1.json`.

Installer Authenticode: Valid. Signer certificate SHA1: `563AE69B35B819BBC845A37D850241D19EE6B6C5`. SHA256 derived directly from signer certificate bytes: `99b64a75f98bbe40ac9a435753c41b5159297df9870fb3fe7a927d2d50db6dc5`.

The manifest declares schemaVersion 1, tag v2.2.17, version 2.2.17, the exact installer and ZIP hashes/sizes, the installer signer SHA256, and null ZIP signer metadata. All three file hashes match the user's prior release-integrity record. Existing package files were not rebuilt or changed.

## Validation provenance

- User confirmed in this session: they reached P10A.6 with all testing successful; the previous detailed regression and physical acceptance results are unavailable.
- Treat earlier testing as user-reported acceptance. Do not invent individual case outcomes, performance measurements, hardware coverage, or detailed test counts from that statement.
- Existing `apps/desktop/test-results/.last-run.json`, last written 2026-09-05 19:10:26 local time, reports `status: passed` and an empty failedTests array. This file alone does not bind a full test inventory or commit to the run.
- Independently reran `node --test apps/desktop/tests/unit/main/p10a6DistributionVersion.test.js`: 1 test passed, 0 failed. This verifies candidate version ownership and preserved Mobile/root identities.
- Broad previously successful gates were not rerun merely to reconstruct missing history.

## Protected and deferred workspace baseline

These files were not edited, staged, reverted, or normalized:

| File | SHA256 |
| --- | --- |
| apps/mobile/tests/prePhase3UiPolish.test.cjs | 9B2B5048A85A1811EB72F42128B8D80ED1D268B3FB469FE8226013FAEB662652 |
| docs/Orion-v3-Mobile-Desktop-Readiness-Audit-2026-07-31.md | D07A1D8C3F60836037DB507EF444D4F7E3303F343A1C37981FF73E786184D48D |
| docs/Orion-Phase-10A-P10A.3-Inspection-Ownership-Baseline-2026-09-02.md | C3700EA07C19FA579A9E9D41C283A9F8B9A10873A7D4BF71EB68ED0AA6B4BA81 |

## Original remaining gates (historical; superseded by publication update below)

1. Obtain explicit publication approval, as required by automatic approval review. Publish `Orion Desktop 2.2.17 Preview` as a prerelease, with latest=false, targeting the full candidate SHA above and uploading exactly the three verified assets. Release notes are prepared in the session's temporary `orion-v2.2.17-preview-release-notes.md` file. Recheck current state before retrying publication.
2. Verify published tag target, prerelease status, asset inventory, sizes and SHA256 values; retrieve and verify the published manifest. Preserve all prior releases.
3. Perform the real installed-updater proof. Registry inspection identifies Orion 2.1.2, with DisplayIcon pointing to `C:/Program Files/Orion X Music Planet/Orion.exe`. Start that installed version, use its Preview update flow, download/verify/install 2.2.17 through Orion, and verify the relaunched installed version and retained user data. Registry presence alone is not runtime proof. Do not substitute a development launch or manual installer run for this acceptance case.
4. Record upgrade observations, including update discovery, successful installation/relaunch, installed version, retained settings/library/downloads, and any failure. Physical interaction and user observations remain necessary; they have not yet been performed in this session.
5. Consolidate the Phase 10A completion audit against P10A-C01 through P10A-C16 and the canonical definition of done. Label prior user-reported acceptance separately from independently observed evidence, and retain any unresolved coverage limitations.
6. Only after outstanding acceptance closes, create the phase lock boundary, stage exact authorized files, commit/push/verify, and preserve the immutable v2.2.17 candidate tag. Master Audit reconciliation remains a later explicit step.

Phase 10A is not yet declared complete or locked by this checkpoint.

## Publication and manual-upgrade update

The user explicitly approved publication and requested a one-time manual upgrade because the installed 2.1.2 updater has an issue they report was fixed in the later implementation. This instruction supersedes the historical updater route above.

### Published release

- URL: https://github.com/OK-ALI/Orion/releases/tag/v2.2.17
- GitHub release ID: 383273972.
- Remote tag directly targets 6d9c5a846051e622399daf4bb93abc78d4f8f35a.
- draft=false; prerelease=true; publication used latest=false.
- Latest stable remains v2.0.1. The prior v2.2.11 tag remains unchanged.

GitHub normalized the installer asset name to `Orion.Setup.2.2.17.exe`. An API rename to the original name was also normalized. The existing shared integrity resolver uses exact artifact-name matching, so the originally prepared manifest could not bind the normalized published installer name.

The new release's manifest was corrected only by changing `Orion Setup 2.2.17.exe` to `Orion.Setup.2.2.17.exe`. Installer/ZIP bytes, sizes, hashes, signer identity, source commit, and tag were unchanged. The original Downloads manifest remains intact. The published manifest and release notes were updated during publication verification; no prior release was modified.

- Final published manifest bytes: 814.
- Final published manifest SHA256: 4d160ab17dc64f0ef2858580e8fd0a6cf58d6c366122e0d3fd576d963dd04990.
- Final inventory contains exactly Orion.Setup.2.2.17.exe, Orion-2.2.17-win.zip, and orion-release-integrity-v1.json.
- GitHub-reported SHA256 digests, byte sizes and uploaded state match all three expected assets.
- The corrected manifest was downloaded from the published browser-download URL and its SHA256 independently verified.
- The original manifest hash above documents prepublication evidence; it is not the final published manifest hash.

### Manual installation status and evidence limit

The installed executable at `C:/Program Files/Orion X Music Planet/Orion.exe` reported FileVersion 2.1.2 and ProductVersion 2.1.2.0 before installation. Registry evidence agrees. Selected local data fingerprints were recorded privately before installation without printing account or library contents.

After release verification, the signed local installer was rechecked for exact SHA256 and Valid Authenticode with the expected signer, then launched interactively (initial process ID 30388). Launch success alone is not installation or data-retention proof. User confirmation and installed runtime/version verification remain pending.

This is a user-approved one-time manual upgrade exception. It does not prove that the repaired in-app updater has completed a real upgrade. That coverage limit must remain explicit in the final audit; no artificial version or additional release is created solely to manufacture proof.

### Current remaining gates

1. Complete manual installation and open the installed application. Record installed version 2.2.17, successful launch, retained settings/library/downloads, and any failure. Do not substitute a development launch for installed production verification.
2. Consolidate the completion audit against P10A-C01 through P10A-C16 and the canonical definition of done. Separate user-reported prior acceptance from independently observed evidence, and record the manual-upgrade exception and remaining coverage limits.
3. After acceptance closes, create the phase lock boundary, stage exact authorized files, commit/push/verify, and preserve the v2.2.17 candidate tag. Master Audit reconciliation remains a later explicit step.

Phase 10A is not yet declared complete or locked by this checkpoint.
## Post-install verification

- Installed executable FileVersion: 2.2.17; ProductVersion: 2.2.17.0.
- Uninstall registry: Orion 2.2.17 / DisplayVersion 2.2.17.
- Running Orion processes use `C:/Program Files/Orion X Music Planet/Orion.exe`, not a development executable.
- Installed `Orion.exe` and `resources/app.asar` SHA256 values each match their corresponding entries extracted in memory from the previously verified 2.2.17 portable ZIP. This binds the installed payload to the published distribution bytes.
- All eight sampled pre-upgrade data files remain present across the legacy and current user-data directories. Seven retain identical hashes. The current `@orion/desktop/music-library.sqlite` hash changed after launch; that observation alone proves neither loss nor successful migration. User-facing settings/library/download retention remains pending confirmation.
- A focused check executed the existing `packages/shared/src/types/orionReleaseTruth.ts` resolver against the final GitHub release response and published manifest. PASS: Preview resolves Desktop v2.2.17 with an installer; Stable excludes this prerelease; both binary names, sizes and hashes bind exactly; installer signer metadata matches.

The manual installation and installed process-launch checks are complete. User-visible data retention is the remaining upgrade acceptance observation before the completion audit and phase lock can be finalized.

## Final acceptance and lock

The user reported no error, successful manual updating, and displayed version 2.2.17 in response to the installation/launch/data-retention question. Together with the installed payload/version checks, this closes the one-time manual upgrade acceptance. It is not a per-record data reconciliation or an in-app updater PASS.

Phase 10A completion is recorded in [the completion audit](ORION-PHASE-10A-COMPLETION-AUDIT.md), with the documented evidence limitations and manual-upgrade exception. Zero-diff lock: f8611c6d18738f4d187b5d1e19fdf1c4766bf4c6. The candidate tag remains at 6d9c5a846051e622399daf4bb93abc78d4f8f35a. Master Audit reconciliation remains deferred.
