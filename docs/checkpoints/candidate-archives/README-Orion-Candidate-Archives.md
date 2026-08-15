# Orion Candidate Archives

Historical development artifacts preserved before Phase 8.

These archives are **reference/checkpoint material only**. They are not runtime dependencies and should never override the active Orion workspace, the accepted audit, or the current locked checkpoint.

## Archives

### `Orion-Phase5-Candidates.zip`

- SHA-256: `1CE10B6492596C1522342F64B633EB941886FC253F01848C4EC92C5B0182986E`
- Size: 9,424,567 bytes
- Contains the Phase 5 candidate progression plus the Phase 5 closeout audit bundle.
- The closeout audit includes validation text, source snapshots, APK archive checks, and a captured bundled JavaScript artifact.
- Preserve as historical evidence of the Phase 5 streaming-safety/source-reliability work.

Top-level candidate artifacts:
- `Phase_5_Candidate_1/Orion-Phase5-Candidate-1.zip`
- `Phase_5_Candidate_1a/Orion-Phase5.1a-Candidate-1.zip`
- `Phase_5_Candidate_2/Orion-Phase5-Candidate-2.zip`
- `Phase_5_Candidate_3/Orion-Phase5-Candidate-3.zip`
- `Phase_5_Candidate_4/Orion-Phase5-Candidate-4.zip`
- `Phase_5_Candidate_5/Orion-Phase5-Candidate-5.zip`
- `Phase_5_closeout_audit.zip`

### `Orion-Phase7-Candidates.zip`

- Original uploaded filename: `Orion-Phase7-Candiadates.zip`
- SHA-256: `27865B59D381A72D915B955DE912169EAFF29DA52499C920233656D15C4474B7`
- Size: 722,523 bytes
- The repository copy may use the corrected filename `Orion-Phase7-Candidates.zip`; renaming does not change the archive bytes or hash.

Contained candidate artifacts:
- `Phase7.1-Candidate1/Orion-Phase7.1-Candidate-1.zip`
- `Phase7.8.3/Orion-Phase7.8.3-Catalog-CPU-Biography-Candidate-1.zip`
- `Phase7.9.1b/Orion-Phase7.9.1b-Auto-Profile-RAM-Candidate-1.zip`
- `Phase7.9.1c/Orion-Phase7.9.1c-Native-Startup-Splash-Candidate-1.zip`
- `Phase7.10.1/Orion-Phase7.10.1-Media-Detail-Episode-Hierarchy-Candidate-1.zip`
- `Phase7.10.2/Orion-Phase7.10.2-Search-Safe-Placement-Candidate-1.zip`
- `Phase7.10.3/Orion-Phase7.10.3-Episode-Card-Light-Hero-Candidate-1.zip`
- `Phase7.10.4/Orion-Phase7.10.4-Person-Hero-Parallax-Boundary-Candidate-1.zip`

Important historical note:
- **Phase 7.10.2 Search Safe Placement was rejected and rolled back.** It is intentionally preserved here as development history, not accepted production behavior.

## Security / repository note

A recursive pattern scan of both uploaded archives, including the large Phase 5 closeout audit bundle and its captured JavaScript bundle, found no obvious private-key, GitHub-token, AWS-key, Google-API-key, client-secret, refresh-token, password-assignment, or long Bearer-token signatures.

This is a best-effort archival scan, not a cryptographic guarantee. Keep Orion's normal secret-handling and `.gitignore` rules in force.

## Recommended repository location

```text
docs/
  checkpoints/
    candidate-archives/
      README.md
      Orion-Phase5-Candidates.zip
      Orion-Phase7-Candidates.zip
```

Keep these files out of application imports, build scripts, package manifests, and release bundles.

## Current checkpoint relationship

These archives preserve earlier development history. The active pre-Phase-8 checkpoint is newer than either archive and includes the accepted post-Phase-7 viewing hardening work. The canonical locked Phase 7 APK/hash remains a separate checkpoint and is not replaced by these archives.
