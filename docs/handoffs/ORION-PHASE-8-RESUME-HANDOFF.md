# Orion – Phase 8 Resume Handoff

**Purpose:** Resume the frozen Orion Mobile Phase 8 work after Desktop stabilization without losing the architectural context that caused the freeze.

---

# 1. Where Phase 8 paused

Orion Mobile had already reached a locked/stable baseline before Phase 8.

Phase 8 began as the **cross-platform benefits/integration phase** between Mobile and Desktop.

Important Phase 8 areas include:

- Desktop/Mobile cross-platform behavior,
- Google authentication,
- Google Drive architecture,
- portable/shared user state,
- and the contracts required for Desktop and Mobile to behave as one Orion ecosystem.

During this work, Desktop-side issues became significant enough that continuing Mobile integration on top of an unstable Desktop baseline would have been risky.

Therefore:

**Mobile Phase 8 was intentionally frozen.**

---

# 2. Why Desktop stabilization happened first

The sequencing decision was:

1. freeze Mobile Phase 8,
2. stabilize Orion Desktop,
3. stabilize Cinema,
4. stabilize Music Planet,
5. produce subsystem audits,
6. update the Desktop V3 audit,
7. then return to Mobile Phase 8.

This avoided building new cross-platform contracts on top of unstable Desktop behavior.

---

# 3. Desktop work completed during the freeze

## Cinema

Cinema stabilization was completed in its dedicated chat.

That chat is now producing its canonical subsystem audit.

The Cinema audit should be treated as authoritative for Cinema locked boundaries.

## Music Planet

Music Planet stabilization is complete and LOCKED.

Canonical audit:

`apps\desktop\docs\audits\ORION-MUSIC-PLANET-AUDIT.md`

Cross-chat handoff:

`apps\desktop\docs\audits\ORION-MUSIC-PLANET-CROSS-CHAT-HANDOFF.md`

Music stabilization began as UI/UX work but also recovered backend/functional defects, including playback/provider behavior and several collection/library contracts.

Do not casually reopen Music Planet during Phase 8.

---

# 4. Before resuming Phase 8

The Mobile Phase 8 chat should read:

1. the current Mobile Phase 8 handoff/roadmap,
2. the latest Desktop V3 audit,
3. the relevant Desktop subsystem audits,
4. this resume handoff,
5. `docs/governance/ORION-CROSS-CHAT-ENGINEERING-RULES.md`.

Then inspect the actual current workspace.

Do not resume from memory alone.

---

# 5. Phase 8 audit rule

At the end of every P8.x subphase:

- perform an explicit roadmap audit,
- verify the intended cross-platform contract,
- verify locked boundaries,
- record automated evidence,
- record physical validation,
- update the Phase 8 audit/handoff,
- then mark the subphase complete.

At **P8.7**:

Perform a full Phase 8 cross-platform audit.

Do not lock Phase 8 unless every required contract is proven by:

- code,
- tests,
- build,
- E2E/integration evidence where applicable,
- and physical validation.

---

# 6. Cross-platform ownership rule

When implementing Phase 8, ask:

**Who owns this contract?**

Potential owners include:

- Desktop main process,
- Desktop renderer,
- Mobile client,
- shared protocol,
- cloud adapter,
- authentication layer,
- portable-state serializer,
- Google Drive integration layer,
- local persistence,
- Smart Connect protocol.

Avoid implementing two separate interpretations of the same contract.

The Mobile and Desktop sides should agree on one explicit behavior.

---

# 7. Locked Desktop warning

Desktop stabilization is now much stricter than when Phase 8 first began.

If Phase 8 needs to modify a locked Desktop area:

1. identify the exact cross-platform requirement,
2. identify the locked owner,
3. determine whether a change is truly required,
4. treat the change as a controlled post-lock amendment,
5. run the relevant Desktop subsystem evidence again,
6. update that subsystem audit,
7. then continue Phase 8.

Do not silently weaken a Desktop lock to make Mobile integration easier.

---

# 8. Google Auth / Google Drive continuity

Phase 8 includes cross-platform work involving:

- Google authentication,
- Google Drive architecture,
- and shared/portable Orion state.

When resuming:

- inspect the current implemented state first,
- do not recreate already-working auth/Drive pieces,
- verify Desktop and Mobile use compatible identity/state contracts,
- verify secrets/tokens remain outside portable payloads,
- verify machine-specific paths are not synchronized,
- preserve local-first behavior where required,
- validate conflict/recovery behavior instead of assuming cloud state is authoritative.

---

# 9. Mobile physical validation

When a standalone Android APK is built for a Phase 8 checkpoint, physical validation on the Samsung S24 Ultra is required.

The chat should proactively provide the exact ADB install commands at that point.

Do not treat emulator-only behavior as final acceptance when the feature affects:

- networking,
- authentication,
- lifecycle,
- pairing,
- gestures,
- WebView/media behavior,
- or device-specific UI.

---

# 10. Resume sequence

Recommended resume flow:

### Step 1
Finish/collect the Cinema canonical audit.

### Step 2
Ensure Music Planet audit is installed.

### Step 3
Update `ORION-DESKTOP-V3-AUDIT.md` from canonical subsystem audits.

### Step 4
Return to the original frozen Mobile Phase 8 chat.

### Step 5
Give that chat:

- `ORION-CROSS-CHAT-ENGINEERING-RULES.md`
- this `ORION-PHASE-8-RESUME-HANDOFF.md`
- the latest Desktop V3 audit
- the relevant Desktop subsystem audits
- the existing Mobile Phase 8 roadmap/handoff

### Step 6
Ask it to restate:

- current P8.x checkpoint,
- locked Mobile boundaries,
- relevant Desktop locks,
- next cross-platform acceptance contract,
- files needed, using exact paths.

### Step 7
Continue from the last validated Phase 8 checkpoint.

**Do not restart Phase 8 from P8.0.**

---

# 11. Expected Phase 8 posture

Phase 8 should be treated as integration of two already-serious products:

**Orion Desktop + Orion Mobile**

not as Mobile merely calling Desktop APIs.

The goal is coherent cross-platform behavior with explicit ownership, durable state contracts, and validation on both sides.

---

# 12. Final resume statement for another chat

Use this context:

> Orion Mobile Phase 8 was intentionally frozen because Desktop-side instability was discovered while implementing cross-platform benefits involving Desktop integration, Google authentication, and Google Drive architecture. Desktop stabilization was then completed in dedicated Cinema and Music Planet workstreams. Music Planet is now LOCKED and has a canonical subsystem audit; Cinema is producing its own audit. These subsystem audits are being used to update the Desktop V3 audit. Once that audit state is current, resume the original Mobile Phase 8 roadmap from its last validated checkpoint. Do not restart earlier Mobile work. Preserve locked Mobile and Desktop boundaries, use controlled post-lock amendments when cross-platform requirements truly require them, audit every P8.x subphase, and perform a full cross-platform audit at P8.7 before Phase 8 can lock.

---

## P8.4 C3-A lock checkpoint

**Status:** COMPLETE & LOCKED

P8.4 C3-A established a read-only Desktop bridge to the same PortableProfileV3 used by Orion Mobile.

Physical validation proved:

- PortableProfileV3 is visible through the Desktop Google connection,
- Desktop Google stable subject identity matches `PortableProfileV3.profileId`,
- Drive revision-token evidence is available,
- the legacy Desktop `orion-sync-manifest.json` backup remains separate and untouched.

C3-A introduced no PortableProfileV3 write capability.

Canonical audit:

`apps\desktop\docs\audits\ORION-P8.4-C3A-PORTABLE-PROFILE-BRIDGE-AUDIT.md`

Current Phase 8 board:

- P8.0 – COMPLETE
- P8.1 – LOCKED
- P8.2 – LOCKED
- P8.3 – COMPLETE & LOCKED
- P8.4 C1 – COMPLETE & LOCKED
- P8.4 C2 – COMPLETE & LOCKED
- P8.4 C3-A – COMPLETE & LOCKED
- P8.4 C3-B – NEXT
- Phase 8 overall – NOT LOCKED

C3-B begins Watched namespace machinery. It must reuse the P8.3 synchronization architecture rather than introduce a second sync engine.

---

## P8.4 C3-B lock checkpoint

**Status:** COMPLETE & LOCKED

P8.4 C3-B established the shared Watched synchronization machinery for Desktop and Mobile.

Locked contract:

- movies use canonical portable movie identity,
- exact TV episodes use canonical season/episode identity,
- whole-series Watched state remains derived locally,
- Watched removals use explicit tombstones,
- namespace signatures remain Watched-specific,
- Desktop and Mobile retain their own local storage representations,
- unrelated PortableProfileV3 namespaces are preserved,
- no automatic cloud synchronization is activated.

The Mobile SDK 57 dependency graph was also patch-aligned during final validation. Expo Doctor returned 20/20 and the standalone Android application was physically smoke-tested successfully.

Canonical audit:

`docs\audits\ORION-P8.4-C3B-WATCHED-NAMESPACE-AUDIT.md`

Current Phase 8 board:

- P8.0 – COMPLETE
- P8.1 – LOCKED
- P8.2 – LOCKED
- P8.3 – COMPLETE & LOCKED
- P8.4 C1 – COMPLETE & LOCKED
- P8.4 C2 – COMPLETE & LOCKED
- P8.4 C3-A – COMPLETE & LOCKED
- P8.4 C3-B – COMPLETE & LOCKED
- P8.4 C3-C – NEXT
- Phase 8 overall – NOT LOCKED


---

## P8.4 C3-C lock checkpoint

**Status:** COMPLETE & LOCKED

P8.4 C3-C establishes explicit cross-device Watched one-shot synchronization.

Locked contract:

- exact movies and exact episodes only,
- derived whole-series summaries stay local,
- Check Watched is read-only,
- cloud/local mutation requires explicit confirmation,
- first enrollment treats pre-checkpoint local absence conservatively,
- cloud tombstones are not silently resurrected,
- writes are conditional and identity-safe,
- confirmation is revalidated before execution,
- full expected PortableProfileV3 semantics are verified after writes,
- unresolved divergence becomes Review rather than guessed reconciliation,
- local application changes Watched only,
- automatic Watched synchronization remains disabled.

Physical validation proved:

- initial Mobile 96 → cloud 96 → Desktop 96 convergence,
- repaired incremental Mobile 96 → 97 write,
- immediate Mobile 97 verification without restart,
- Desktop independent detection of the 97 cloud-only change,
- Desktop restore to 97,
- final 97 / 97 / 97 Desktop / Cloud / Mobile convergence.

Canonical audit:

`docs\audits\ORION-P8.4-C3C-EXPLICIT-WATCHED-ONE-SHOT-AUDIT.md`

Current Phase 8 board:

- P8.0 – COMPLETE
- P8.1 – LOCKED
- P8.2 – LOCKED
- P8.3 – COMPLETE & LOCKED
- P8.4 C1 – COMPLETE & LOCKED
- P8.4 C2 – COMPLETE & LOCKED
- P8.4 C3-A – COMPLETE & LOCKED
- P8.4 C3-B – COMPLETE & LOCKED
- P8.4 C3-C – COMPLETE & LOCKED
- P8.4 C3-D – NEXT
- Phase 8 overall – NOT LOCKED

---

## P8.4 C3-D lock checkpoint

**Status:** COMPLETE & LOCKED

P8.4 C3-D activates automatic steady-state Watched synchronization after explicit C3-C enrollment.

Locked contract:

- first enrollment remains explicit,
- automatic work requires an established Watched checkpoint,
- the C3-C inspector/executor remains the single reconciliation engine,
- local-only changes may automatically push,
- cloud-only changes may automatically pull,
- local removals use the existing tombstone path,
- genuine two-sided divergence becomes Needs Review,
- Auto Sync policy is local per device/profile,
- Auto Sync OFF pauses automatic cloud work without deleting local or cloud state,
- manual Sync now remains available while paused,
- OFF → ON performs a fresh reconciliation,
- account/policy changes can cancel an automatic transaction before unsafe mutation,
- History and Progress remain unenrolled,
- Continue Watching remains derived and has no cloud namespace,
- legacy Desktop cloud viewing remains fenced.

Desktop conditional-write amendment:

- observed Drive v3 runtime metadata could provide only a version token,
- Orion continued to fail closed rather than overwrite unsafely,
- the C3-C Desktop writer now preserves atomic `If-Match` safety by resolving a matching strong v2 ETag only when the same file version is still current,
- version drift / HTTP 412 remains conflict,
- blind overwrite is still prohibited.

Physical acceptance proved:

- Mobile 97 → 98 automatic push and Desktop automatic pull,
- repaired Desktop 98 → 100 automatic push,
- Desktop 100 → 101 automatic push and Mobile automatic pull,
- Auto Sync OFF preserved a local Desktop 102 while cloud/Mobile stayed 101,
- manual Sync now while paused converged Desktop/cloud/Mobile to 102,
- OFF → ON automatically converged the next local change to 103 on both clients,
- Mobile visibly entered Orion's offline product state when disconnected; network-backed title loading prevented the exact proposed new-title Watched mutation from that screen, so that redundant physical subcase is documented rather than falsely claimed.

Canonical audit:

`docs\audits\ORION-P8.4-C3D-AUTOMATIC-WATCHED-STEADY-STATE-AUDIT.md`

Current Phase 8 board:

- P8.0 – COMPLETE
- P8.1 – LOCKED
- P8.2 – LOCKED
- P8.3 – COMPLETE & LOCKED
- P8.4 C1 – COMPLETE & LOCKED
- P8.4 C2 – COMPLETE & LOCKED
- P8.4 C3-A – COMPLETE & LOCKED
- P8.4 C3-B – COMPLETE & LOCKED
- P8.4 C3-C – COMPLETE & LOCKED
- P8.4 C3-D – COMPLETE & LOCKED
- Phase 8 overall – NOT LOCKED

Immediate next work is the focused Account / Sync UX productization pass already agreed for Orion Desktop and Orion Mobile. This handoff does not assign that polish pass a new canonical P8.x number.


---

## P8.3 Desktop My List conflict-resolution post-lock amendment

**Status:** COMPLETE & LOCKED when committed with the validated candidate
**Date:** 2026-08-19

P8.3 My List Portable Sync remains locked.

A post-lock Desktop product amendment adds explicit first-checkpoint conflict
resolution when Desktop and Orion Cloud both contain divergent populated
My Lists.

Accepted resolution choices:

- Combine both
- Keep Desktop My List
- Keep Orion Cloud My List

No option silently executes merely because divergence exists.

The resolution path reuses the existing P8.3 machinery:

- PortableProfileV3 My List namespace
- profile identity validation
- fresh cloud reads
- revision-aware conditional mutation
- semantic read-back verification
- namespace-specific checkpoints
- preservation of unrelated namespaces
- per-device automatic-sync policy
- Needs review when safe reconciliation cannot be proven

Physical Combine validation:

- Desktop: 134
- Orion Cloud: 28
- shared: 11
- expected union: 151
- Desktop after Combine: 151 / Synced
- Mobile after cloud reconciliation: 151 / Synced
- actual Mobile Library My List: 151

Desktop final gate:

- source-size: 361
- bindings: 315
- IPC: 222 methods / 141 channels
- Node: 106 / 106
- Renderer: 227 / 227
- production build: PASS

Mobile final regression gate:

- TypeScript: PASS
- tests: 210 / 210
- source-size: 132
- Expo Doctor: 20 / 20
- web export: PASS

Watched remains an independent domain and P8.4 C3-D remains locked.

Current Phase 8 board:

- P8.0 – COMPLETE
- P8.1 – LOCKED
- P8.2 – LOCKED
- P8.3 – COMPLETE & LOCKED
- P8.3 Desktop My List conflict-resolution amendment – COMPLETE & LOCKED
- P8.4 C1 – COMPLETE & LOCKED
- P8.4 C2 – COMPLETE & LOCKED
- P8.4 C3-A – COMPLETE & LOCKED
- P8.4 C3-B – COMPLETE & LOCKED
- P8.4 C3-C – COMPLETE & LOCKED
- P8.4 C3-D – COMPLETE & LOCKED
- Phase 8 overall – NOT LOCKED

History and verified playback Progress remain required Phase 8 synchronization domains and are not implemented yet.
Continue Watching remains a derived cross-device outcome and must not become an independent cloud namespace.
Portable Preferences still require an explicit whitelist/policy, and supported Music data requires an explicit Phase 8 disposition before Phase 8 can lock.

Canonical amendment audit:

`docs\audits\ORION-P8.3-DESKTOP-MYLIST-CONFLICT-RESOLUTION-POST-LOCK-AUDIT.md`


---

## Phase 8 steady-state conflict-recovery post-lock amendment

**Status:** COMPLETE & LOCKED when committed with the validated Candidate 1.1
**Date:** 2026-08-20

Final Phase 8 physical acceptance proved that the locked My List and Watched steady-state engines correctly stop on genuine post-checkpoint two-sided divergence, but also exposed that `Check now` alone could leave an enrolled domain in a Review dead end.

The controlled recovery amendment adds explicit whole-copy resolution for genuine enrolled-domain divergence:

- keep the current device copy,
- keep Orion Cloud.

The selected source is revalidated before mutation. Device-wins recovery uses the existing conditional-write / semantic-read-back architecture. Cloud-wins recovery uses a stable re-read before verified local replacement. A new checkpoint is accepted only after convergence is proven.

No silent winner and no last-write-wins path were introduced.

### Important `Combine both` clarification

The earlier P8.3 My List `Combine both` option is **first-enrollment conflict resolution**, not general steady-state conflict resolution.

It remains valid and unchanged for the pre-checkpoint case where Desktop and Orion Cloud already contain different populated My Lists and Orion is establishing the first shared copy. That path was physically proven with 134 Desktop titles + 28 Cloud titles - 11 shared = 151 combined titles.

After a verified checkpoint exists, `Combine both` is intentionally absent. The v1 checkpoint stores semantic signatures rather than the complete prior record set, so Orion cannot safely infer which missing records represent intentional removals. Blind union could resurrect titles deliberately removed on either device.

Watched follows the same steady-state rule even more strictly because a missing Watched record may represent an explicit `Mark Unwatched` action.

Therefore:

- first-enrollment My List conflict: `Combine both` / keep device / keep Cloud,
- post-checkpoint My List divergence: keep device / keep Cloud,
- post-checkpoint Watched divergence: keep device / keep Cloud,
- blind steady-state union: prohibited.

Final Account / Orion Cloud production polish should make these two conflict classes visually/copy-wise distinct so the intentional difference in available actions is obvious to normal users.

### Automated evidence

Mobile:

- focused TypeScript: PASS,
- focused My List + Watched: 25 / 25,
- full tests: 212 / 212,
- source-size: 132,
- Expo Doctor: 20 / 20,
- web export: PASS.

Desktop:

- focused conflict recovery: 32 / 32,
- source-size: 361,
- bindings: 315,
- IPC: 222 methods / 141 channels,
- Node: 106 / 106,
- renderer: 232 / 232,
- production build: PASS.

### Physical acceptance

A fresh Candidate 1.1 standalone APK was installed on the Samsung S24 Ultra and a fresh Desktop runtime was used.

Real existing two-sided conflicts were recovered in opposite directions:

- My List: user selected **Keep Desktop My List** -> Desktop / Orion Cloud / Mobile returned to Synced,
- Watched: user selected **Keep Orion Cloud** -> local Watched was replaced by verified cloud truth and both platforms returned to Synced.

The recoveries remained domain-isolated.

Canonical audit:

`docs\audits\ORION-P8-STEADY-STATE-CONFLICT-RECOVERY-POST-LOCK-AUDIT.md`

Current Phase 8 board:

- P8.0 – COMPLETE
- P8.1 – LOCKED
- P8.2 – LOCKED
- P8.3 – COMPLETE & LOCKED
- P8.3 Desktop My List first-enrollment conflict-resolution amendment – COMPLETE & LOCKED
- P8.4 C1 – COMPLETE & LOCKED
- P8.4 C2 – COMPLETE & LOCKED
- P8.4 C3-A – COMPLETE & LOCKED
- P8.4 C3-B – COMPLETE & LOCKED
- P8.4 C3-C – COMPLETE & LOCKED
- P8.4 C3-D – COMPLETE & LOCKED
- Phase 8 steady-state conflict-recovery post-lock amendment – COMPLETE & LOCKED when committed
- Phase 8 overall – NOT LOCKED

History and verified playback Progress remain required Phase 8 synchronization domains and are not implemented yet. Continue Watching remains a derived cross-device outcome and must not become an independent cloud namespace. Portable Preferences still require an explicit whitelist/policy, and supported Music data requires an explicit Phase 8 disposition before Phase 8 can lock.

---

## V3-P8-004 Mobile account-scoped profiles lock checkpoint

**Status:** COMPLETE & LOCKED when committed with the validated implementation and canonical audit
**Date:** 2026-08-20

V3-P8-004 completes the revised Phase 8 requirement for account-namespaced Mobile library profiles and non-destructive anonymous/local-profile preservation.

### Locked ownership contract

Mobile now has one active local-library profile at a time:

- signed out: preserved `local` profile,
- signed in: `google:<stable account id>` account-scoped profile.

The existing `LibraryProvider` remains the single library owner. The profile layer selects and injects the active storage adapter; it does not create a second My List, Watched, History, or Progress state manager.

The five legacy Mobile library keys remain preserved as a recovery source:

- `saved`,
- `savedOrder`,
- `history`,
- `watched`,
- `progress`.

The migration copies them byte-for-byte into the local profile and does not remove or rewrite the legacy recovery source.

On first sign-in for a Google identity, Orion copies the preserved local profile into that account namespace, verifies exact read-back, retires stale synchronization proof where required, and commits the account profile `ready` marker last. A staged or mismatched profile is never eligible for cloud synchronization.

Existing My List and Watched enrollment/conflict engines remain authoritative. P8-004 does not add another merge engine and does not duplicate `Keep device`, `Keep Orion Cloud`, or `Combine both` policy.

The preserved local profile is never a cloud-sync participant.

### C1 Watched checkpoint regression and C1.1 repair

Physical C1 validation exposed one migration-only regression: an already-enrolled Watched domain could appear as `Manual` after the application update because C1 retired the pre-migration Watched checkpoint unconditionally.

Manual `Check Watched` recreated a valid checkpoint, after which automatic Watched synchronization worked and persisted across relaunch. This proved the steady-state engine itself was healthy and isolated the defect to migration-time checkpoint retirement.

Candidate 1.1 repairs that boundary without weakening first enrollment:

- an existing Watched checkpoint may survive the storage-only migration only when the newly scoped Watched preview has no rejected keys and its portable truth signature exactly equals the checkpoint's verified local truth signature,
- if equality cannot be proven, the checkpoint is retired and explicit Watched enrollment remains required,
- no checkpoint is synthesized or rewritten merely because migration occurred.

This preserves the locked rule that genuinely unenrolled Watched state cannot silently auto-enroll.

### Automated evidence

C1 focused validation:

- TypeScript: PASS,
- focused tests: 62 / 62 PASS.

C1 full Mobile gate:

- tests: 219 / 219 PASS,
- source-size: 134 files PASS,
- Expo Doctor: 20 / 20 PASS,
- web export: PASS.

C1.1 focused repair validation:

- TypeScript: PASS,
- focused tests: 44 / 44 PASS,
- includes the semantic checkpoint-carry invariant.

C1.1 full Mobile gate:

- tests: 220 / 220 PASS,
- source-size: 134 files PASS,
- Expo Doctor: 20 / 20 PASS,
- web export: PASS.

No source-size ceiling was raised.

### Physical Samsung S24 Ultra evidence

The preserving-install migration retained the existing real user library without visible duplication, storage failure, or unexpected conflict.

Observed post-migration baseline included:

- My List: 153,
- Watched: 104,
- History: 37,
- Google identity connected,
- Orion Cloud connected,
- verified playback Progress/Continue Watching remained available.

The user later clarified that an earlier Library screenshot showing `Continue 0` preceded the later playback that created the visible Continue Watching entry; it is not recorded as a cross-surface defect.

Final profile-isolation acceptance physically proved:

1. **Account A probe**
   - a title added after migration existed in Account A and synchronized normally,
   - it survived relaunch.

2. **Signed-out Local**
   - after disconnecting Google, the Account A probe was absent,
   - the preserved Local profile remained intact.

3. **Account B**
   - Account B showed `Ready to sync` rather than silently appearing enrolled/automatic,
   - Account A-specific state did not leak into B,
   - no accidental Orion Cloud enrollment was observed.

4. **Return to Account A**
   - Account A's own scoped state returned,
   - Account B-specific state did not bleed into A.

Physical acceptance therefore proved the isolation invariant:

`Local ≠ Account A ≠ Account B`

The user reported all final validation steps passed.

### Desktop ownership audit

A focused Desktop account/local-ownership archaeology was performed before extending Phase 8 to additional sync domains.

Result: **no Desktop P8-004 migration candidate is required.**

Desktop local Cinema library state remains installation/device-local, while My List/Watched checkpoints and automatic-sync policy are already keyed by Google profile identity. Desktop does not perform the Mobile `global local storage -> account-scoped local storage` migration that created the C1 checkpoint-lineage issue.

Existing Desktop enrollment/checkpoint guards prevent an unverified account from silently becoming a steady-state cloud participant. Therefore copying Mobile's profile-migration architecture into Desktop would add unnecessary storage migration risk and is outside the explicit V3-P8-004 Mobile-profile requirement.

This is a recorded no-change decision, not evidence that future History/Progress synchronization may bypass Desktop's existing identity/checkpoint safety rules.

### Candidate artifacts

Primary P8-004 candidate:

`Orion-v3.0-P8-004-Mobile-Account-Scoped-Profiles-Candidate-1.zip`

SHA-256:

`78A7D40847D6C1A1EB9D95CEE3BF18A5DE418DA7E91EE64B823680C448B676F5`

Watched checkpoint migration repair:

`Orion-v3.0-P8-004-Watched-Checkpoint-Migration-Repair-Candidate-1.1.zip`

SHA-256:

`D4799EA005FB2FB2A4367FFC4F12CEB6D17C726AADC4F855968350A328B2B74A`

### Canonical implementation manifest

The validated runtime/test implementation owns these 9 project paths:

1. `apps/mobile/app/_layout.tsx`
2. `apps/mobile/src/context/LibraryContext.tsx`
3. `apps/mobile/src/features/account/LibraryProfileContext.tsx`
4. `apps/mobile/src/features/account/MyListSteadyStateSync.tsx`
5. `apps/mobile/src/features/account/WatchedSteadyStateSync.tsx`
6. `apps/mobile/src/features/account/watchedSyncCheckpoint.ts`
7. `apps/mobile/src/features/library/libraryProfileStorage.ts`
8. `apps/mobile/tests/accountScopedLibraryProfile.test.cjs`
9. `apps/mobile/tests/myListSteadyStateSync.test.cjs`

Canonical lock documentation additionally changes:

10. `docs/audits/ORION-V3-P8-004-MOBILE-ACCOUNT-SCOPED-PROFILES-AUDIT.md`
11. `docs/handoffs/ORION-PHASE-8-RESUME-HANDOFF.md`

The expected lock commit manifest is therefore exactly **11 paths**.

Canonical audit:

`docs\audits\ORION-V3-P8-004-MOBILE-ACCOUNT-SCOPED-PROFILES-AUDIT.md`

### Phase 8 board after V3-P8-004

- P8.0 – COMPLETE
- P8.1 – LOCKED
- P8.2 – LOCKED
- P8.3 – COMPLETE & LOCKED
- P8.3 Desktop My List first-enrollment conflict-resolution amendment – COMPLETE & LOCKED
- P8.4 C1 – COMPLETE & LOCKED
- P8.4 C2 – COMPLETE & LOCKED
- P8.4 C3-A – COMPLETE & LOCKED
- P8.4 C3-B – COMPLETE & LOCKED
- P8.4 C3-C – COMPLETE & LOCKED
- P8.4 C3-D – COMPLETE & LOCKED
- Phase 8 steady-state conflict-recovery post-lock amendment – COMPLETE & LOCKED
- **V3-P8-004 Mobile account-scoped profiles & non-destructive local import – COMPLETE & LOCKED when committed**
- Phase 8 overall – **NOT LOCKED**

### Remaining revised Phase 8 scope

The saved master roadmap remains the original Phase 8 baseline and is intentionally not rewritten at this checkpoint. Its final reconciliation occurs after the final Phase 8 build/audit.

The remaining Phase 8 work must continue to satisfy that baseline:

- synchronize **History**,
- synchronize **verified Progress**,
- derive **Continue Watching** locally from verified Progress rather than create another cloud namespace,
- define and synchronize an explicit portable **Preferences** whitelist,
- make an explicit supported-**Music** Phase 8 disposition rather than silently dropping the requirement,
- extend revisions/tombstones/offline reconciliation through the remaining portable domains,
- complete interruption/rollback acceptance tied to the final account/sync lifecycle,
- perform the P8.7 full cross-platform audit before Phase 8 can lock.

Immediate next implementation work is therefore the remaining V3-P8-006/007/008/010 synchronization and reconciliation scope, beginning with History + verified Progress architecture.

<!-- V3-P8-006A-C3-CHECKPOINT-2026-08-20 -->

## V3-P8-006A C3 - Viewing Activity steady-state checkpoint

**Date:** 2026-08-20
**Canonical entry HEAD:** `03f31444c9b601b1f4100ff75e7fbc28b15d6947`
**Branch:** `codex/orion-v3-p8.1-candidate-1`
**Checkpoint status:** C3 implementation and acceptance COMPLETE; commit not yet created at the time of this handoff entry.
**P8-006A lock status:** NOT LOCKED.
**Phase 8 status:** NOT LOCKED.

### Outcome

History and verified playback Progress now participate in steady-state cross-platform synchronization after explicit enrollment.

The implementation extends the existing Phase 8 synchronization architecture:

- one shared Viewing Activity reconciliation coordinator owns History + Progress;
- Desktop and Mobile remain thin platform adapters;
- existing CloudProfileStore implementations are reused;
- existing Library owners remain authoritative for local History and Progress;
- checkpoints are account/profile scoped reconciliation evidence;
- conditional Cloud writes and semantic read-back verification remain mandatory;
- stale in-flight work is fenced by active account/profile identity;
- later verified event time wins where deterministic;
- tombstones prevent deleted records from being silently resurrected;
- equal-time contradictory truth fails closed;
- two-sided post-checkpoint ambiguity requires an explicit Keep this device/Desktop or Keep Orion Cloud decision;
- Continue Watching remains locally derived from synchronized verified Progress and has no Cloud namespace.

### Physical acceptance

Initial enrolled state converged on Mobile and Desktop.

Mobile -> Orion Cloud -> Desktop:

- new verified playback created new History;
- playback position propagated;
- Desktop received the synchronized state;
- Desktop Continue Watching re-derived locally from the received Progress.

Desktop -> Orion Cloud -> Mobile:

- new Desktop verified playback propagated to Mobile;
- History and playback position appeared on Mobile;
- Mobile Continue Watching re-derived locally and displayed the received resumable position.

Auto Sync OFF:

- new local Mobile Viewing Activity remained local while automatic synchronization was paused;
- Desktop remained unchanged;
- explicit Sync now reconciled the new state successfully.

Offline playback physical validation is **N/A for C3 under the current product boundary** because current streaming playback cannot open media while offline. Full offline media playback belongs to Phase 10. Offline-first synchronization/reconciliation safety remains covered by the C3 contracts and tests.

### Repair history

Candidate 1.4 repaired metadata-only same-time presentation drift so already-equivalent portable Viewing Activity does not enter false review.

Candidate 1.5 repaired the first-real-push path so old harmless presentation drift cannot block propagation of an unrelated genuinely new verified event.

Candidate 1.6 repaired a stale Electron E2E harness assumption. The playback-lifecycle test had attempted a normal Playwright click on a mounted but intentionally hidden auto-hide Sidebar item. The test now triggers the mounted Home item directly, consistent with the existing navigation harness. Production playback code was not changed.

### Final automated evidence

Mobile:

- TypeScript PASS;
- 239/239 tests PASS;
- source-size PASS for 137 files;
- Expo Doctor 20/20 PASS;
- production web export PASS.

Desktop:

- source-size PASS for 365 files;
- renderer binding PASS for 319 files;
- IPC contract preserved at 222 methods / 141 channels;
- secret scan PASS;
- theme-color gate PASS;
- no circular dependencies across 350 processed files;
- Node tests 106/106 PASS;
- renderer tests 262/262 PASS across 59 files;
- fresh Vite production build PASS.

Electron:

- previously failing playback-handoff test 1/1 PASS;
- full Electron E2E 22/22 PASS.

Known non-blocking warnings remain classified:

- Mobile `MODULE_TYPELESS_PACKAGE_JSON` trailerCandidateService warning;
- Desktop SQLite experimental warning;
- MiniPlayer React `act(...)` warning;
- Vite chunk-size advisory.

### C3 workspace boundary

Checkpoint candidate scope before documentation:

- 13 tracked modifications;
- 6 new C3 source/test files;
- 19 C3-owned paths total;
- staged index empty;
- C3 whitespace clean;
- existing My List, Watched, Library apply and CloudProfileStore owners not rewritten;
- Continue Watching did not acquire Cloud ownership;
- historical archaeology left untouched.

### Mandatory work before Phase 8 lock

The following is explicit roadmap work.

**Count Semantics & Data Truth Audit**

- trace every displayed count on Desktop and Mobile;
- prove the population represented by My List, Watched, History, playback positions and Continue Watching;
- do not alter correct backend semantics merely to make numbers visually agree;
- Library represents user-facing content truth;
- Settings -> Account represents account/Orion Cloud synchronization truth;
- different populations require explicit wording.

**Production polish**

- unify Mobile Settings -> Account;
- normalize Desktop/Mobile Orion Cloud vocabulary and state hierarchy;
- replace backend-shaped Progress wording with clearer playback-position language where appropriate;
- remove developer-oriented wording such as Manual, portable, and v1 checkpoint from user-facing presentation;
- show an actual busy/Syncing state during explicit Sync now even when Auto Sync is OFF;
- retain Paused after the operation if Auto Sync remains OFF;
- audit responsive layout, accessibility, themes, spacing, typography, disabled and busy states.

**Remaining functional Phase 8 scope**

- portable Preferences whitelist/policy;
- supported Music data disposition;
- remaining reconciliation/policy requirements;
- final P8.7 cross-platform audit.

### Current authoritative sequence

V3-P8-006A C3 checkpoint -> remaining Phase 8 functional domains/policies -> Count Semantics & Data Truth Audit -> Phase 8 production polish -> Mobile Account unification -> Desktop/Mobile consistency audit -> final P8.7 cross-platform audit -> Phase 8 LOCK.

<!-- V3-P8-FUNCTIONAL-SYNC-CLOSURE-2026-08-21 -->

## Phase 8 functional synchronization scope closure

**Date:** 2026-08-21
**Canonical floor:** `f4fd5b1e6e095b1bcc74a2c9e090e20ec3b46fa8`
**Functional synchronization status:** COMPLETE
**Phase 8 lock status:** NOT LOCKED

### Final synchronized domains

- My List;
- Watched;
- History;
- verified playback positions through the Viewing Activity domain.

Continue Watching remains locally derived from synchronized verified playback truth and does not own an independent Orion Cloud namespace.

### Portable Preferences disposition

Portable Preferences are intentionally removed from the Orion v3 cross-platform synchronization scope.

Desktop and Mobile retain independent application preferences. This includes platform presentation, accessibility configuration, playback/device configuration, synchronization toggles, storage/download preferences and other settings unless a future roadmap explicitly introduces a new portable contract.

The existing portable-profile schema may continue to recognize or preserve an unknown/legacy preferences namespace for compatibility. Recognition or preservation does not make Preferences an active synchronization domain.

### Music Planet disposition

Music Planet remains Desktop-only in the current Orion v3 product scope.

Orion Mobile does not currently expose Music Planet, so Phase 8 does not create a Mobile Music synchronization owner, placeholder namespace or fake cross-platform Music support.

Music references inside Smart Connect playback/context contracts remain valid Desktop/control-plane concepts and are not Music Planet profile synchronization.

Cross-platform Music synchronization is deferred until a future Mobile Music Planet roadmap explicitly requires it.

### Functional closure evidence

- Desktop SyncPolicy exposes My List, Watched and Viewing Activity only;
- Mobile ORION_SYNC_DOMAINS exposes My List, Watched and Viewing Activity only;
- no portable Preferences synchronization implementation exists;
- no active Music synchronization domain exists;
- Continue Watching has no independent Cloud synchronization owner;
- Watched and Viewing Activity contain fail-closed checkpoint/conflict contracts;
- account/profile fencing evidence is present;
- unrelated/unknown portable namespaces are preserved;
- portable data contracts contain no credential, signed URL, provider URL, device-path or similar sensitive field.

### Remaining Phase 8 work

No additional Orion Cloud data domain is required before productization.

The authoritative remaining sequence is:

Count Semantics & Data Truth Audit -> Phase 8 production polish -> Mobile Settings/Account unification -> Desktop/Mobile consistency and accessibility validation -> final P8.7 cross-platform audit -> Phase 8 LOCK.

<!-- V3-P8-CHECKLIST-RECONCILIATION-2026-08-21 -->

## Phase 8 functional checklist reconciliation

**Date:** 2026-08-21
**Canonical floor:** `e9377ffe5915453cb61ca76e43e02e987f07916a`
**Classification:** documentation drift only
**Runtime repair required:** NO
**Phase 8:** NOT LOCKED

P8-003, P8-004, P8-005, P8-007, P8-008, P8-009 and P8-010 were re-audited after functional synchronization closure and are now treated as implemented.

The audit found existing OAuth/account ownership on Desktop and Mobile, account-scoped Mobile Library ownership, the active PortableProfileV3 contract, revisions/merge/deletion safety across synchronized domains, offline/network-aware reconciliation, unknown namespace preservation, portable sensitive-data exclusions, platform secure-storage ownership, account/profile fencing and fail-closed interruption/recovery behavior.

No production code changed for this reconciliation.

All Phase 8 functional checklist items are now reconciled. Remaining work is productization and final validation:

Count Semantics & Data Truth Audit -> production polish -> Mobile Settings/Account unification -> Desktop/Mobile consistency and accessibility validation -> P8.7 -> Phase 8 LOCK.
