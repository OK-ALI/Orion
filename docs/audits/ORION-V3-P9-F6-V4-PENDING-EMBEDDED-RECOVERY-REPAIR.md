# Orion v3 Phase 9 F6 V4 — Pending Embedded-Update Recovery Repair

**Date:** 2026-08-24
**Phase:** Phase 9 — Distribution, updates, availability and notifications
**Repair:** F6 V4 inherited `PENDING` embedded-update recovery
**Status:** SOURCE REPAIR AND AUTOMATED VALIDATION COMPLETE / PHYSICAL ACCEPTANCE PENDING
**Baseline branch:** `codex/orion-v3-p9-distribution-updates`
**Baseline HEAD:** `d8e49c4c58b8437b5497f02338a43d3556c4d103`

## Executive outcome

The v2.1.5/code7 physical failure was caused by a remaining gap in Orion's
Expo Updates recovery backport. V3 could rehabilitate the exact current
embedded update when its inherited database status was `EMBEDDED` or `READY`,
but not when Expo retained the same row as `PENDING` with a positive failed
launch count.

V4 closes that gap without clearing the Expo database, deleting updates,
weakening launcher selection, or changing Orion application data.

The source repair and complete Mobile automated gate pass. Production-signed
v2.1.6/code8 packaging, installation and physical acceptance remain pending
separate authorization.

## Preserved failure evidence

The production-signed v2.1.5 bridge was installed in place over preserved
user-0 state and subjected to one controlled cold launch.

Physical identity reported by the capture:

- package: `com.okali.orion`;
- versionName: `2.1.5`;
- versionCode: `7`;
- minSdk: `24`;
- targetSdk: `36`;
- data directory: `/data/user/0/com.okali.orion`.

Exact local v2.1.5 artifact:

- path:
  `apps/mobile/android/app/build/outputs/apk/distribution/orion-mobile-v2.1.5.apk`;
- bytes: `68,406,760`;
- SHA-256:
  `0D442410A2818E2B3DC9C40DE14F2BDFA6A3E53EAC3DAEED5049D4B968B8A352`.

Controlled first-launch log:

- path:
  `C:\Users\aliwa\AppData\Local\Temp\orion-p9f6-215-v3-first-cold-launch.log`;
- bytes: `391,580`;
- SHA-256:
  `E3543613516BF791401BA6032DAC14DBDD1BA529A9D48EB596C7B9AB9C2D9FA1`.

The exact v2.1.5 DEX contains all three V3 recovery markers, proving that the
failure was not caused by packaging an older Expo Updates implementation.

## Failure classification

The first controlled launch recorded:

- Expo `StartStartup` followed by `EndStartup`;
- `UpdatesController loaderTask onFailure`;
- `Unexpected error encountered while loading this app`;
- `Failed to launch embedded or launchable update`;
- `UpdateFailedToLoad` from `DatabaseLauncher.kt:79`.

The stack reached `LoaderTask.kt:354`. That line is inside the embedded-reload
branch; the no-reload path would have reached line 356. Embedded re-registration
therefore ran and returned without an embedded-copy exception, but the final
database selection still found no launchable update.

No V3 incomplete-registration, inherited-quarantine or successful-
rehabilitation marker appeared.

## Root cause

Expo's launchable query excludes:

- statuses outside `READY`, `EMBEDDED` and `DEVELOPMENT`;
- rows with zero successful launches and one or more failed launches.

The current embedded row can therefore enter this sequence:

1. The row is `PENDING`, has zero successful launches and a positive failed
   launch count.
2. The initial launcher query excludes it.
3. Normal embedded selection approves re-registration.
4. `EmbeddedLoader` restores its assets and changes its status to `EMBEDDED`.
5. V3 does not reset the inherited failed count because its recovery flag was
   computed before loading and excluded `PENDING`.
6. The final launcher query excludes the repaired row again.
7. `DatabaseLauncher` fails at line 79.

This control flow accounts for the physical log without requiring a second UI,
release-truth or application-update defect.

## V4 repair

The authoritative patch now recognizes an inherited failed-launch quarantine
only when all of these preconditions hold:

- the row is loaded by the exact current embedded update ID;
- no launchable update exists;
- normal embedded selection approves loading it;
- successful launch count is zero;
- failed launch count is positive;
- pre-registration status is `PENDING`, `EMBEDDED` or `READY`.

After `EmbeddedLoader` finishes, V4 re-reads the exact current embedded row and
resets its failed-launch count only when:

- the row still exists at that exact ID;
- its launch asset exists;
- final status is `EMBEDDED` or `READY`;
- successful launch count remains zero;
- the inherited failed count remains positive.

`PENDING` is intentionally rejected as a successful post-registration status.
Missing assets, incomplete registration or an unsafe final status leave the
failed count unchanged and keep the update quarantined.

Existing safeguards remain unchanged:

- atomic embedded registration;
- runtime-version equality;
- manifest-filter matching;
- channel-override-safe current embedded recovery floor;
- stale embedded-row exclusion;
- ordinary remote-update URL and request-header gates;
- no database wipe or unrelated update deletion.

## Changed source and tests

V4 work is contained in:

- `scripts/patch-expo-updates-embedded-registration.cjs`;
- `apps/mobile/tests/p9fExpoEmbeddedRegistration.test.cjs`;
- this standalone evidence report.

The transformer supports and verifies:

- original vulnerable Expo source -> V4;
- Orion V1 source -> V4;
- Orion V3 source -> V4;
- repeated V4 application -> no change.

The authoritative lifecycle applied the repair to the installed
`expo-updates 57.0.16` source. A second invocation reported the source already
fixed, proving idempotence.

## Automated validation

- focused P9-F6 suite: **9/9 PASS**;
- complete Mobile tests: **330/330 PASS**;
- Mobile typecheck: **PASS**;
- source-size: **159 files PASS**;
- Expo Doctor: **20/20 PASS**;
- web export: **PASS**;
- patch lifecycle idempotence: **PASS**;
- diff and whitespace validation: **PASS**.

Focused coverage proves:

- inherited `PENDING` rows are included in the pre-repair predicate;
- `EMBEDDED` and `READY` recovery remains supported;
- V3 source is upgraded rather than incorrectly accepted as fixed;
- reset occurs after exact-ID and launch-asset read-back;
- final `PENDING` status cannot authorize reset;
- the existing stale-row, remote-update and channel safeguards remain present.

## Production artifact — pending

The next controlled manual bridge is:

- versionName: **2.1.6**;
- Android versionCode: **8**;
- runtimeVersion: `orion-mobile-native-r1`;
- signer: Orion's permanent production identity.

Pending artifact evidence:

- APK path, bytes and SHA-256: PENDING;
- package/version/SDK inspection: PENDING;
- production signer verification: PENDING;
- embedded bundle and manifest verification: PENDING;
- updater permission and FileProvider verification: PENDING;
- compiled V4 predicate and recovery-marker verification: PENDING.

No debug APK may be used for physical acceptance.

## Physical acceptance — pending

v2.1.5/code7 must remain installed as preserved V3 failure state until the
production-signed v2.1.6 bridge is inspected and approved.

Installation requirements:

- in-place user-0 update only;
- no uninstall;
- no application-data clear;
- no user-10 launch;
- no pre-acceptance launch outside the controlled capture.

First controlled v2.1.6 cold launch must prove:

- inherited-quarantine detection marker;
- successful rehabilitation marker;
- Expo startup success;
- no `DatabaseLauncher.kt:79`;
- no loader failure or `UpdateFailedToLoad`;
- Orion identity and application data preserved.

Second controlled cold launch must prove:

- normal startup without another rehabilitation cycle;
- no duplicate or repeated recovery mutation;
- Quick Updates no longer reports the inherited startup failure.

Only after v2.1.6 passes may production-signed v2.1.7/code9 be prepared as the
published Orion-owned self-update target.

## Boundaries and roadmap handling

This repair does not modify Desktop Orion, release truth, application-update
integrity, Orion Cloud, My List, Watched, History, playback positions,
preferences or credentials.

No additional roadmap percentage is awarded for repairing an already required
Phase 9 behavior. Phase 9 remains open until production artifact and physical
acceptance evidence are complete.
