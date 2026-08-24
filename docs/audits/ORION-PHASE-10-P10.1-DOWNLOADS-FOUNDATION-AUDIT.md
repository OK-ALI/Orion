# PROJECT ORION PHASE 10 — P10.1 DOWNLOADS FOUNDATION AUDIT

**Status:** P10.1 COMPLETE AT THE PRODUCT / CONTRACT / DESTINATION-OWNERSHIP BOUNDARY
**Phase 10 overall:** IN PROGRESS, NOT LOCKED
**Branch:** `codex/orion-v3-p10-mobile-downloads-offline-library`
**Parent checkpoint:** `e30e0f0933b5fcbb68b02d5352c4d00143f7bd18`
**P10.1 checkpoint:** `9a105730d6d18d122d9553ebd19eff86b1f36dda`
**Commit:** `checkpoint: complete P10.1 downloads foundation`
**Date:** 2026-08-24

## 1. Scope accepted

P10.1 established the Mobile downloads product, contract and destination-ownership foundation without claiming a working native download engine.

Accepted scope:

- versioned `MobileDownloadCandidateV1`, `MobileDownloadJobV1`, `MobileDownloadAssetV1` and `OfflineMediaEntryV1` contracts;
- exact movie / series / anime and TV season / episode identity;
- restart-safe MMKV-owned repository and download-preference schemas;
- field-by-field persistence normalization that strips unknown hitchhiker fields;
- canonical durable job-state transitions and truthful progress presentation;
- dual destination ownership for Orion Library and Device Storage;
- premium Downloads product foundation using existing Orion theme and responsive owners;
- honest unavailable/disabled download actions while the engine is absent;
- Downloads settings ownership for downloader behavior;
- Downloads notification-category ownership under the existing Phase 9 `Settings -> Notifications` architecture, with no duplicate notification preference in Downloads settings;
- Expo SDK 57 patch alignment required by the repository Expo Doctor gate without reopening the retired Expo runtime updater architecture.

## 2. Checklist reconciliation

### `V3-P10-001` — OPEN, FOUNDATION IMPLEMENTED

The engineering-oriented locked page has been replaced by an Orion product foundation, and download actions remain honestly unavailable while no real engine exists.

The checklist remains open because the later P10.4 acceptance boundary still requires full queue/completed/failed productization plus physical six-theme, responsive, orientation, large-text and Reduced Motion validation.

### `V3-P10-002` — COMPLETE

The four required V1 contracts exist with restart-safe non-sensitive persistence.

Runtime acceptance proves:

- repository state survives module restart;
- download preferences survive module restart;
- future schemas fail closed;
- unknown sensitive hitchhiker fields are stripped before durable persistence;
- canonical job transitions reject illegal state movement;
- non-completed work cannot present `100%`;
- only completed jobs present `100%`.

### `V3-P10-014` — OPEN, FOUNDATION IMPLEMENTED

Dual destination ownership and safe destination identity contracts exist.

The checklist remains open because real Android Storage Access Framework selection, free-space checks, native destination finalization, external move/delete reconciliation and representative-device physical scoped-storage validation are not yet implemented or accepted.

## 3. Evidence

Focused and regression evidence accumulated during P10.1:

- initial P10.1 + affected regression suite: `48/48`;
- final P10.1 executable acceptance suite: `12/12`;
- final full Mobile suite: `332/332`;
- Mobile strict TypeScript: PASS;
- Mobile source-size gate: PASS for `162` files;
- Expo Doctor: `20/20`;
- production web export: PASS;
- shared Mobile download contract strict compile: PASS;
- `git diff --check`: PASS;
- exact staged and committed manifest: `22` files;
- no unstaged or untracked leftovers at checkpoint;
- local checkpoint SHA equals remote branch SHA;
- final worktree clean.

The Expo patch-alignment maintenance updated SDK 57 patch versions only. The two affected Phase 9 tests were updated only for the corresponding literal dependency versions; all Phase 9 updater-retirement and notification behavior assertions remained green.

## 4. Exact checkpoint manifest

1. `apps/mobile/app/(tabs)/downloads.tsx`
2. `apps/mobile/app/(tabs)/settings.tsx`
3. `apps/mobile/package.json`
4. `apps/mobile/src/components/DownloadModal.tsx`
5. `apps/mobile/src/features/downloads/contracts.ts`
6. `apps/mobile/src/features/downloads/downloadIdentity.ts`
7. `apps/mobile/src/features/downloads/downloadPreferences.ts`
8. `apps/mobile/src/features/downloads/downloadRepository.ts`
9. `apps/mobile/src/features/downloads/DownloadSettingsContent.tsx`
10. `apps/mobile/src/features/media-detail/MediaDetailScreen.tsx`
11. `apps/mobile/src/features/notifications/MobileNotificationResponseRouter.tsx`
12. `apps/mobile/src/features/settings/NotificationSettingsContent.tsx`
13. `apps/mobile/src/features/settings/settingsArchitecture.ts`
14. `apps/mobile/src/services/downloadManager.ts`
15. `apps/mobile/src/services/mobileNotifications.ts`
16. `apps/mobile/tests/adaptivePolish.test.cjs`
17. `apps/mobile/tests/p101DownloadFoundation.test.cjs`
18. `apps/mobile/tests/p92ExpoRuntimeUpdates.test.cjs`
19. `apps/mobile/tests/p93AvailabilityNotifications.test.cjs`
20. `package-lock.json`
21. `packages/shared/src/types/index.ts`
22. `packages/shared/src/types/mobileDownloads.ts`

## 5. Percentage decision

Phase 10 remains at the canonical `10%` phase completion and `0.8%` weighted contribution after P10.1.

Reason:

- `V3-P10-002` is fully accepted;
- `V3-P10-001` and `V3-P10-014` have meaningful foundations but remain open;
- the Master Audit does not assign per-checklist subweights;
- the existing 10% Phase 10 baseline already represents foundation credit;
- inventing additional sub-item weights here would overstate evidence.

Therefore Orion v3 remains at the exact `87.28%`, rounded to `87%`, while Phase 10 status advances from **Foundation only** to **In progress**.

A later evidence checkpoint may increase the percentage when accepted checklist coverage clearly exceeds the existing foundation baseline.

## 6. Phase 9 boundary preservation

P10.1 does not reopen Phase 9.

- Expo runtime update/recovery remains retired from Orion production.
- The permanently signed direct GitHub/APK updater remains the sole Mobile application-update path.
- Downloads optional completion/problem alerts belong to the existing Phase 9 notification policy.
- Required Android foreground-service progress notification implementation remains P10.3 work and does not create a parallel notification architecture.

## 7. Next stage

Proceed to **P10.2 — Candidate capture, preflight and request-context security**.

Primary contracts:

- `V3-P10-003`
- `V3-P10-004`
- `V3-P10-007`

P10.2 must prove active-session scoped candidate capture, direct/HLS/DASH/extensionless classification, opaque presentation, reachability/expiry/manifest/storage/protection preflight and a narrow provider-descendant request-context boundary before P10.3 native download execution begins.
