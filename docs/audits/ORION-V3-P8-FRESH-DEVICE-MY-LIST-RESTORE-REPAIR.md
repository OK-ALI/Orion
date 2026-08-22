# Orion V3 Phase 8 Fresh-Device My List Restore Repair

Date: 2026-08-22

Version: `2.0.1`

Status: automated repair checkpoint ready; physical-device acceptance pending

## Scope and classification

This is a post-lock repair of the accepted Phase 8 fresh-device My List restore contract. It does not reopen Phase 8, award additional roadmap percentage, or change the historical Phase 8 completion record. Phase 9 remains the next active phase after physical acceptance closes this repair.

The confirmed regression was in the Mobile confirmation dialog: the UI displayed **Restore**, but its primary action always called `confirmEnrollment()`. The repair explicitly dispatches fresh-device cloud inventory to `confirmRestore()`, keeps new/empty-cloud enrollment on `confirmEnrollment()`, preserves the existing reconciliation choices, and safely rejects stale or unexpected confirmation states.

## Safe checkpoint

- Rollback HEAD before repair: `27f71d111a6f64ed84943261b1626989c398b4c4`
- Atomic repair checkpoint subject: `fix(mobile): restore My List during fresh-device cloud bootstrap`
- Atomic repair checkpoint hash: the commit containing this evidence document; resolve with `git log -1 --format=%H -- docs/audits/ORION-V3-P8-FRESH-DEVICE-MY-LIST-RESTORE-REPAIR.md` after checkpoint creation.
- Physical-acceptance documentation checkpoint: pending; it must use `docs: close Phase 8 fresh-device restore regression` only after the device procedure passes.

The repair targets were clean before editing. No stash, reset, or unrelated staging was performed.

### Dirty Phase 9 inventory preserved at repair start

- `apps/desktop/src/renderer/app/App.jsx`
- `apps/desktop/src/renderer/app/AppRoutes.jsx`
- `apps/desktop/src/renderer/components/common/Icons.jsx`
- `apps/desktop/src/renderer/components/layout/Sidebar.jsx`
- `apps/desktop/src/renderer/features/settings/sections/GeneralSettings.jsx`
- `apps/desktop/src/renderer/services/settingsStore.js`
- `apps/desktop/src/renderer/shared/utils/updates.js`
- `apps/desktop/src/renderer/styles/components/part-01.css`
- `apps/desktop/tests/unit/renderer/Sidebar.test.jsx`
- `apps/mobile/app/(tabs)/settings.tsx`
- `apps/mobile/package.json`
- `apps/mobile/scripts/build-android-standalone.cjs`
- `apps/mobile/src/features/settings/settingsArchitecture.ts`
- `apps/mobile/tests/adaptivePolish.test.cjs`
- `packages/shared/src/types/index.ts`
- `apps/desktop/src/renderer/features/updates/GetOrionMobilePage.jsx` (untracked)
- `apps/desktop/src/renderer/features/updates/get-orion-mobile.css` (untracked)
- `apps/desktop/tests/unit/renderer/GetOrionMobilePage.test.jsx` (untracked)
- `apps/desktop/tests/unit/renderer/p91ReleaseTruth.test.js` (untracked)
- `apps/mobile/scripts/build-android-release.cjs` (untracked)
- `apps/mobile/src/features/settings/UpdatesSettingsContent.tsx` (untracked)
- `apps/mobile/src/services/mobileReleaseTruth.ts` (untracked)
- `apps/mobile/tests/p91AndroidReleaseSigning.test.cjs` (untracked)
- `apps/mobile/tests/p91ReleaseTruthProductization.test.cjs` (untracked)
- `packages/shared/src/types/orionReleaseTruth.ts` (untracked)

## Repair behavior

- Restore and enrollment confirmations are explicitly routed by verified preflight state.
- A single synchronous in-flight guard prevents repeated taps from starting concurrent restore or enrollment work.
- Restore re-reads Orion Cloud and revalidates the account-scoped store, profile identity, cloud revision, My List namespace signature, normalized cloud preview signature, and the unchanged empty local preflight signature.
- Cloud My List records and order are converted into one exact `saved` plus `savedOrder` replacement.
- The active profile's native persistence owner writes the pair transactionally, reads both keys back, and compares raw item count, normalized item identities, exact ordering, and normalized content signature.
- A failed write or semantic read-back restores the previous persisted pair and does not update React library state.
- The checkpoint and **Synced** state occur only after the verified native persistence receipt succeeds.
- Restore failure retains a recoverable **Restore My List** action and states that Orion Cloud was not changed.
- The restore path contains no Orion Cloud write and no Watched, History, playback-position, preference, credential, or unrelated profile-domain mutation.

## Automated evidence

| Check | Result |
| --- | --- |
| Focused My List repair + enrollment + steady-state tests | PASS — 40/40 |
| Mobile typecheck | PASS |
| Mobile source-size | PASS — 145 source files within ceiling |
| Expo Doctor | PASS — 20/20 |
| Mobile web export | PASS — 1,607 modules |
| Bundled standalone APK | PASS — Gradle 597 tasks; embedded `assets/index.android.bundle` verified |
| Full Mobile tests | 282/283 PASS; one unrelated dirty Phase 9 test remains in progress |

The sole full-suite failure is `P9.1 Desktop reuses normalized release truth and keeps installation QR distinct from Connect pairing`. Its assertion expects `Get Orion Mobile` in the already-dirty Phase 9 Desktop `GeneralSettings.jsx`; this repair neither edits nor stages that work. All Phase 8 and focused restore tests pass.

The focused repair suite covers explicit Restore/enrollment routing, unexpected-state rejection, repeated-tap idempotence, cloud/profile/revision/signature drift, local preflight mutation, exact saved/order persistence, write failure rollback, semantic read-back mismatch rollback, checkpoint ordering, checkpoint-free cloud discovery, remote non-mutation, unrelated-domain isolation, and version preservation.

## APK evidence

- Artifact: `apps/mobile/android/app/build/outputs/apk/standalone/orion-mobile-standalone.apk`
- Size: `118122446` bytes
- SHA-256: `99FA7F1C6BC6FB2158394B8F06D9D00ED62452D64C0E5659B8BFFBCB339B011E`
- Build type: bundled standalone debug-signed acceptance APK, arm64-v8a
- Embedded JavaScript: verified present

## Physical-device acceptance

Physical acceptance remains pending and must not be inferred from automated evidence.

| Evidence | Expected | Recorded result |
| --- | --- | --- |
| Cloud discovery — My List | 162 titles | Pending |
| Cloud discovery — Watched | 158 items | Pending |
| Cloud discovery — Viewing Activity | 43 History entries, 2 positions | Pending |
| Restored local My List | Exactly 162 titles in cloud order | Pending |
| Force-close/restart/reboot persistence | Exact list persists | Pending |
| Follow-up sync | No duplicates or order changes | Pending |
| Watched and Viewing Activity isolation | Counts and content remain intact | Pending |
| Screenshots | Discovery, Restore confirmation, Synced 162, post-restart persistence | Pending |

After those checks pass, add the restored counts, device/build identification, and screenshot paths here, then update the master audit in the separate documentation-only checkpoint `docs: close Phase 8 fresh-device restore regression`.

No tokens, Drive identifiers, credentials, account identifiers, raw cloud payloads, or private diagnostics are recorded in this evidence.
