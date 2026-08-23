# Orion v3 Phase 9 F9 — Mobile Update Availability Blocker Repair

**Date:** 2026-08-23
**Phase:** Phase 9 — Distribution, updates, availability and notifications
**Repair:** F9 Mobile full-application update availability
**Status:** SOURCE REPAIRS IMPLEMENTED / 2.1.3 AND 2.1.4 PHYSICAL F6 FAILURES CAPTURED / V3 REPAIRED BRIDGE PENDING
**Baseline branch:** `codex/orion-v3-p9-distribution-updates`
**Baseline HEAD:** `d8e49c4c58b8437b5497f02338a43d3556c4d103`

## Safety boundary

The baseline worktree was clean before editing. This repair is limited to the
Android full-application update environment query, its focused regression test,
and this evidence record.

The following remain outside this source-only checkpoint and require separate
authorization: commit, push, release mutation or publication, production APK
build, installation, Android permission changes, uninstall, application-data
clearing, and physical acceptance.

The existing `v2.1.2` release is immutable. Desktop Orion, Quick Updates,
Orion Cloud, My List, Watched, History, playback positions, preferences and
credentials are not modified.

## Confirmed failure

The production-signed Mobile `v2.1.1` installation discovered the published
Preview `v2.1.2` release and rendered its release notes, but classified full-app
installation as **Unavailable**. The **App updates** action and global update
announcement were consequently absent. Quick Updates independently displayed
its legacy **Recovery** state.

The evidence establishes that this was not caused by release truth, Android
package identity, signing identity, or a missing manifest declaration:

- installed package: `com.okali.orion`;
- installed version: `2.1.1` / version code `3`;
- installed APK size: `68,406,756` bytes;
- installed APK SHA-256:
  `E8FD26D0E0FCDB30793384D2245D3ABC9FE1E870705CD06C33ACE43899EAB835`;
- production certificate SHA-256:
  `4422EC4BC16B1C83C914A0AD1B688BE8F7C158FF7F99BCD223A909966AC7A1BD`;
- installed manifest declares
  `android.permission.REQUEST_INSTALL_PACKAGES`;
- the native `OrionUpdates` module and package registration are compiled into
  the installed binary;
- the published `v2.1.2` Preview release and integrity manifest agree on tag,
  version, APK name, size, SHA-256 and production signer.

## Root cause

`OrionUpdateModule.installedPackageInfo()` requested signing metadata only.
Android populates `PackageInfo.requestedPermissions` only when package metadata
is queried with `PackageManager.GET_PERMISSIONS`.

The native module therefore received a null/empty permission list and returned:

`requestInstallPackagesDeclared = false`

The canonical application-update state correctly fails closed on that field,
which explains all three visible symptoms without an additional UI defect:

- full-app state **Unavailable**;
- no **Allow installs** or **Download & install** action;
- no actionable update announcement banner.

The same native precondition also guards `installDirectApk()`. A Quick Update
cannot replace this compiled Kotlin defect, so installed `v2.1.1` cannot repair
its own full-app updater.

## Repair

The installed-package query now combines the existing SDK-compatible signing
flag with `PackageManager.GET_PERMISSIONS`. No integrity or installation
safeguard is weakened.

Expected canonical behavior after packaging the repair is:

- declared permission plus Android grant absent -> `permission-required`;
- declared permission plus Android grant present -> `available`;
- missing declaration, signer mismatch, missing native environment or invalid
  release integrity -> `unavailable`.

No public JavaScript API, persisted schema, release-truth contract or banner
special case is added.

## Automated evidence

Focused source/native contract suite after the repair:

- command: `node --test` over P9.2, P9-F4/F5 and P9-F9 updater tests;
- result: **15/15 PASS**;
- installed-package query requests signing and permission metadata;
- permission declaration remains a fail-closed native prerequisite;
- integrity and signer failures remain unavailable;
- permission-required and available states retain their explicit actions;
- actionable states continue to own the update announcement;
- Quick Updates remains on its separate runtime-update path.

Complete Mobile validation results are recorded below after execution:

- Mobile typecheck: **PASS**
- Mobile tests: **327/327 PASS**
- source-size gate: **PASS** for 159 files
- Expo Doctor: **20/20 PASS**
- web export: **PASS**
- `git diff --check`: **PASS**

The first sandboxed Expo Doctor attempt could not reach Expo and React Native
package metadata services. The authorized network-enabled rerun completed all
20 checks successfully; no project defect was reported.

## Screenshot evidence

| Evidence | Bytes | SHA-256 |
| --- | ---: | --- |
| `Screenshot_20260823_204602_Orion.jpg` | 440,148 | `14675F179E50837B430F8D0FFC917411942CF9982EA0564E5995E7A7F6F6A5A2` |
| `Screenshot_20260823_204612_Orion.jpg` | 480,336 | `04A3261D797D3C893890EE8B6EA011BA45D0BE7098FE2E49298B6E230F6CBCE9` |
| `Screenshot_20260823_204616_Orion.jpg` | 565,117 | `ED76A79146B1F096D85145443846263C810AD14CA0913273E2FD0997312BCBD3` |
| `Screenshot_20260823_204619_Orion.jpg` | 482,603 | `6E4E7630156928035F42FB56C5F6D6C44A94253AA8C21F636ED05CF6FA31FE7A` |

These images are failure evidence from installed Mobile `v2.1.1`; they are not
physical acceptance of the repair.

## Release and physical acceptance ? current evidence

### Frozen 2.1.3 / versionCode 5 bridge

Production-signed Mobile 2.1.3 / version code 5 remains frozen as the first
physical F6 failure artifact.

Frozen APK SHA-256:

`055D794D64C2DDBC59D51087A17AC5B818BB178F14F887464236708899C45BAF`

It successfully proved the P9-F9 installed-package metadata repair but failed
to heal the inherited user-0 Expo Updates state on first controlled cold
launch.

The physical failure reached:

`DatabaseLauncher.launch(DatabaseLauncher.kt:79)`

with no launchable update.

### Frozen 2.1.4 / versionCode 6 bridge

The first F6 repair was extended with narrow failed-launch rehabilitation and
packaged as production-signed Mobile 2.1.4 / version code 6.

Frozen artifact:

- file: `orion-mobile-v2.1.4.apk`;
- bytes: `68406756`;
- SHA-256:
  `6752AEA32EBEA0D8BB3E0C7B9687C72C22C8EB3F8B3F2C84C1EC50A0D3A37E66`;
- package: `com.okali.orion`;
- versionName: `2.1.4`;
- versionCode: `6`;
- production signer verified;
- APK Signature Scheme v2 verified;
- F9 GET_PERMISSIONS repair compiled;
- F6 quarantine detection compiled;
- F6 targeted failed-launch reset compiled;
- embedded JavaScript and Expo manifest verified.

2.1.4 was installed in place over user-0 2.1.3 without uninstalling Orion or
clearing application data.

The original first-install timestamp remained unchanged and the user-0 data
directory remained present.

Managed-profile user 10 remained installed and was not launched.

### Second F6 physical failure

The first controlled user-0 2.1.4 cold launch still failed at:

`DatabaseLauncher.launch(DatabaseLauncher.kt:79)`

The following new F6 rehabilitation markers were absent:

- inherited failed-launch quarantine detection;
- successful embedded-update rehabilitation;
- incomplete embedded-registration retry.

There was also no embedded-copy exception.

This proved that the 2.1.4 current embedded row did not satisfy the
failed-launch rehabilitation predicate and that another launcher-selection
blocker remained.

### Channel-override launcher diagnosis

Local Expo Updates 57.0.16 inspection established an asymmetry between the
embedded loader decision and final database launcher selection.

When there is no current launchable update, the embedded loader can register
the current binary's embedded recovery update.

The final launcher policy then additionally compares persisted update URL and
request headers against the active Expo Updates configuration.

Orion intentionally implements runtime channel switching through request
headers while preserving the native update URL.

The current binary's embedded recovery update therefore carries its build-time
request headers, while the active runtime channel configuration can legitimately
use different channel headers.

This can leave the current binary's healthy embedded recovery floor excluded
solely by request-header equality even though its runtime version and manifest
filters remain valid.

### V3 channel-override-safe recovery-floor repair

The repaired launcher policy preserves the existing safety gates:

- runtimeVersion equality remains mandatory;
- manifest-filter matching remains mandatory;
- ordinary non-embedded updates still require the existing URL and request
  header compatibility checks;
- no arbitrary update is selected directly;
- stale embedded rows from older binaries remain excluded by
  DatabaseLauncher before launcher-policy selection.

Only an `EMBEDDED` row representing the current binary's recovery floor may
survive the URL/request-header equality gate.

The previous F6 protections also remain:

- atomic embedded-registration prevention;
- legacy incomplete-registration healing;
- narrow inherited failed-launch rehabilitation;
- no Expo database wipe;
- no unrelated update deletion.

Automated evidence after the V3 repair:

- focused P9-F6 suite: **7/7 PASS**;
- complete Mobile tests: **328/328 PASS**;
- source-size: **159 files PASS**;
- Expo Doctor: **20/20 PASS**;
- web export: **PASS**;
- tracked diff validation: **PASS**.

### Next controlled physical bridge

Because 2.1.4/code6 is frozen physical failure evidence, the V3 repair must use
a new Mobile identity.

The next controlled bridge is therefore:

- versionName: **2.1.5**;
- Android versionCode: **7**;
- root package remains **2.1.2**;
- Desktop remains **2.1.2**;
- runtimeVersion remains `orion-mobile-native-r1`.

2.1.5 must be production-signed and independently inspected before being
installed in place over preserved user-0 2.1.4.

No uninstall or application-data clear is permitted.

Its first controlled cold launch is the next decisive F6 physical gate.

### Genuine Orion-owned self-update target

2.1.5 is a controlled repair bridge and must not be published as the general
Preview target.

Only after 2.1.5 physically proves F6 healing should the genuine updater target
be prepared.

Current expected trajectory:

`2.1.3/code5 first F6 failure -> 2.1.4/code6 channel-override F6 failure -> 2.1.5/code7 V3 repaired manual bridge -> 2.1.6/code8 Orion-owned published self-update target`

The eventual 2.1.6 target must satisfy the complete Orion production release,
integrity, signing, publication and in-app updater acceptance contracts.

## V4 pending embedded-update recovery repair

**Date:** 2026-08-24

### Preserved 2.1.5 physical failure evidence

The production-signed 2.1.5/code7 V3 bridge was installed in place over the
preserved user-0 state and subjected to one controlled cold launch.

Installed identity reported by the physical capture:

- package: `com.okali.orion`;
- versionName: `2.1.5`;
- versionCode: `7`;
- minSdk: `24`;
- targetSdk: `36`;
- data directory: `/data/user/0/com.okali.orion`.

Exact local 2.1.5 artifact:

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

The 2.1.5 DEX contains all three V3 recovery markers. The failure was therefore
not caused by packaging an older unpatched Expo Updates binary.

The captured stack reached `LoaderTask.kt:354`, proving that the embedded
reload branch ran. It then failed at `DatabaseLauncher.kt:79` because no update
was launchable. The alternate no-reload branch would have reached
`LoaderTask.kt:356` instead.

No incomplete-registration, inherited-quarantine or successful-rehabilitation
marker appeared, and no embedded-copy exception was logged.

### V4 root cause

The V3 predicate recognized inherited failed-launch quarantine only when the
current embedded row's pre-registration status was `EMBEDDED` or `READY`.

Expo can retain the exact current embedded row as `PENDING` with zero successful
launches and a positive failed-launch count. In that state:

1. the initial database query excludes the row because `PENDING` is not
   launchable;
2. normal embedded selection requests re-registration;
3. `EmbeddedLoader` restores the row and marks it `EMBEDDED`;
4. the V3 flag remains false because it was computed from the earlier
   `PENDING` state;
5. the inherited failed-launch count is not reset;
6. the final database query excludes the repaired row again.

This exactly explains the observed silent embedded reload followed by the same
`DatabaseLauncher.kt:79` failure.

### V4 implementation

The authoritative Expo patch now treats only the exact current embedded row as
recoverable when all of the following are true:

- no launchable update exists;
- normal embedded selection approves loading it;
- successful launch count is zero;
- failed launch count is positive;
- pre-registration status is `PENDING`, `EMBEDDED` or `READY`.

The failed-launch count is still reset only after `EmbeddedLoader` completes
and semantic read-back proves:

- the row was loaded by the exact current embedded ID;
- a launch asset exists;
- final status is `EMBEDDED` or `READY`;
- the inherited failed-launch condition remains present.

`PENDING` is deliberately not accepted as a successful post-registration
status. Failed registration, absent launch assets or an unsafe final status
therefore leave quarantine intact.

The transformer now upgrades original vulnerable Expo source, Orion V1 and the
installed V3 source. A second lifecycle invocation reports the source already
fixed and makes no further change.

V4 source/report files:

- `scripts/patch-expo-updates-embedded-registration.cjs`;
- `apps/mobile/tests/p9fExpoEmbeddedRegistration.test.cjs`;
- `docs/audits/ORION-V3-P9-F9-MOBILE-UPDATE-BLOCKER-REPAIR.md`.

### V4 automated evidence

- focused P9-F6 suite: **9/9 PASS**;
- original vulnerable source transformation: **PASS**;
- Orion V1 upgrade: **PASS**;
- Orion V3 -> V4 `PENDING` upgrade: **PASS**;
- exact post-registration identity/asset/status/reset ordering: **PASS**;
- patch lifecycle idempotence: **PASS**;
- complete Mobile tests: **330/330 PASS**;
- Mobile typecheck: **PASS**;
- source-size: **159 files PASS**;
- Expo Doctor: **20/20 PASS**;
- web export: **PASS**;
- diff validation: **PASS**.

### Next controlled bridge and genuine updater target

2.1.5/code7 remains frozen V3 failure evidence. After separate production-build
authorization, the next manual bridge is:

- versionName: **2.1.6**;
- Android versionCode: **8**;
- runtimeVersion remains `orion-mobile-native-r1`;
- production signer remains Orion's permanent signing identity.

The v2.1.6 APK identity, SHA-256, production signer and compiled V4 DEX
inspection remain PENDING until the separately authorized production build.

2.1.6 must be inspected and installed in place over preserved user-0 2.1.5
without uninstalling or clearing application data.

Pending first-launch acceptance:

- inherited-quarantine detection marker: PENDING;
- successful rehabilitation marker: PENDING;
- Expo startup success: PENDING;
- no `DatabaseLauncher.kt:79`, loader failure or `UpdateFailedToLoad`: PENDING;
- preserved Orion identity and data: PENDING.

Pending second-launch acceptance:

- normal cold startup: PENDING;
- no repeated rehabilitation cycle: PENDING;
- Quick Updates recovery state settled: PENDING.

Only after 2.1.6 passes may 2.1.7/code9 become the production-signed published
Orion-owned self-update target.

## Roadmap handling

This is a regression repair inside the existing Phase 9 update contract. It
does not award additional roadmap percentage. Phase 9 remains open until the
production artifact and physical updater path are accepted.
