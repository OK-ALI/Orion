# Orion Phase 11 — P11.2 Completion Audit

Date: 2026-09-06

## Scope

Phase 11: Reliable Orion Connect

P11.2 ownership:
- bounded ordered input scheduling
- native socket-pressure handling
- pre-IPC realtime input coalescing
- reliable-command ordering
- reliable commands must remain serviceable under high-rate realtime input
- active-controller authority and controller revision fencing
- cancellation and cleanup across disconnect / ownership invalidation
- no cursor or gesture catch-up backlog
- no stuck high-rate input after disconnect

P11.2 was implemented in three internal slices:

- P11.2A — realtime transport pressure and lane correctness
- P11.2B — active-controller authority and takeover semantics
- P11.2C — bounded reliable scheduling and controller-epoch fencing

This audit records the accepted implementation, signed production candidate,
GitHub Preview publication, updater-integrity repair, and physical-validation
boundary for P11.2.

P11.2 does not own:
- final cursor rendering or interpolation
- provider/WebView pointer routing
- final scroll visual tuning
- Windows master volume / mute controls
- capability-aware display brightness
- seek-scrubbing reconciliation
- final Orion Connect Mobile UX polish

Those remain in P11.3 / P11.4.

## Implementation authority

P11.1 completion checkpoint:

999bee0c038980a12fc370e553a15b77e2091512

P11.2A checkpoint:

7abcab028063da34f0a4049fb847f8842f41394a

Parent:

999bee0c038980a12fc370e553a15b77e2091512

Message:

P11.2A: bound realtime transport pressure

P11.2B checkpoint:

4fe87bf7fb7b7fdf62b922bbab9a1e964c02ec59

Parent:

7abcab028063da34f0a4049fb847f8842f41394a

Message:

P11.2B: add active controller ownership

P11.2C checkpoint:

057f4aef6d0476aff2567de3cb03cea89623fd39

Parent:

4fe87bf7fb7b7fdf62b922bbab9a1e964c02ec59

Message:

P11.2C: bound reliable scheduling by controller epoch

Signed physical-candidate checkpoint:

37c64bf24eaab915b77edc122423d0188dc9f94f

Parent:

057f4aef6d0476aff2567de3cb03cea89623fd39

Message:

P11.2: prepare 2.2.20 signed physical candidate

Candidate identity:
- Desktop: 2.2.20
- Mobile: 2.2.20
- Android versionCode: 53
- Android package: com.okali.orion
- root package identity remains 2.1.2

The P11.2 committed delta from the P11.1 completion checkpoint contains
23 implementation / test / distribution files.

Completion inspection proved:
- the P11.1 completion checkpoint is an ancestor of the candidate checkpoint
- staged count was zero before completion-audit work
- none of the protected/deferred local files entered the committed P11.2 delta
- the worktree remained at the known four-file protected/deferred state

## P11.2A — realtime transport pressure

Accepted implementation includes:
- `cursor_click` uses the reliable ACKed command path
- Mobile native socket pressure is surfaced to the JS control layer
- Mobile pointer health receives native backpressure state
- cursor move and scroll use coherent realtime / droppable classification
- Desktop performs pre-IPC realtime coalescing
- accumulated scroll remains bounded
- realtime work is flushed before reliable work where required for ordering
- realtime diagnostics expose coalescing evidence

The intended behavior is latest-value realtime truth, not replay of every
historical finger sample.

This is important for later visual interpretation: dropping obsolete pointer
samples is correct P11.2 behavior and must not be undone merely to make cursor
motion appear smoother.

## P11.2B — active-controller authority

Accepted implementation includes:
- Desktop-owned active-controller authority
- controller state associated with trusted device identity
- explicit controller revision changes
- passive-controller rejection rather than silent control
- takeover semantics in the implemented authority model
- cleanup / cancellation hooks when authority changes
- disconnect handling without stale authority work surviving
- reconnect behavior fenced by authoritative controller state

The implementation remains in the codebase as defensive architecture.

### Phase 11 product-scope decision

The original Phase 11 plan included simultaneous multiple trusted phones,
exactly one active controller, and explicit Take Control physical acceptance.

During P11.2 physical validation, the product scope was explicitly narrowed to
**one supported live remote at a time** for Phase 11.

Therefore:
- no second-phone UI or Take Control UX is required for Phase 11 acceptance
- simultaneous multi-phone physical acceptance is not a P11.2 exit requirement
- existing ownership / revision / takeover internals are retained
- those internals are not removed or weakened
- future multi-remote product support may qualify the dormant behavior in a
  later dedicated scope

This audit is the recorded scope override for P11.2 physical acceptance. The
user-owned Phase 11 plan itself remains untouched.

## P11.2C — bounded reliable scheduling

Accepted implementation includes:
- bounded per-connection reliable scheduling
- strict ordinary reliable-command ordering
- bounded queue depth
- explicit queue-full failure
- controller-revision fencing
- stale-revision rejection
- ownership / socket invalidation of obsolete work
- renderer ACK propagation with controller revision
- Mobile compatibility with revision-aware responses
- preemptible startup Play behavior so long preparation does not monopolize the
  reliable command lane
- stress coverage for ordering, queue depth, epoch cancellation, and
  Play/click preemption

The scheduler prevents transport pressure from turning into an unbounded input
or reliable-command backlog.

## Automated evidence

Previously accepted P11.2 gates include:

### P11.2A
- Mobile Connect tests: 24 / 24
- Desktop Connect core tests: 7 / 7
- Mobile typecheck: PASS
- Android native release compile: PASS
- Desktop / Mobile syntax gates: PASS

### P11.2B
- controller ownership model tests: 5 / 5
- Mobile controller guard tests: 8 / 8
- Desktop source guard: 1 / 1
- focused Desktop tests: 12 / 12
- Mobile Connect tests: 26 / 26
- Mobile typecheck: PASS
- source bindings: 352
- IPC boundary: 224 methods / 142 channels
- Desktop Node tests: 156 / 156
- Desktop production build: PASS
- Mobile Expo export: PASS

### P11.2C
- focused Desktop tests: 15 / 15
- Mobile Connect tests: 28 / 28
- Mobile typecheck: PASS
- scheduler stress:
  - 200 ordered reliable commands
  - bounded depth 24
  - 24 controller-epoch cancellations
  - 100 Play/click preemption cases
- source bindings: 353
- IPC boundary: 224 methods / 142 channels
- Desktop Node tests: 161 / 161
- Desktop production build: PASS
- Mobile web export: PASS

The signed 2.2.20 candidate version boundary was also verified exactly before
publication.

## Production candidate artifacts

### Desktop installer

Orion.Setup.2.2.20.exe

- bytes: 100606240
- SHA256:
  004277BD34D8B8A0459D1C0D0005BC62D6A287D7318A93B421E8874A65BAEBFD
- Authenticode: Valid
- signer certificate SHA256:
  99B64A75F98BBE40AC9A435753C41B5159297DF9870FB3FE7A927D2D50DB6DC5

### Desktop ZIP

Orion-2.2.20-win.zip

- bytes: 136506531
- SHA256:
  7375B101AD1C09994FA0AC2301CF99E03DBC10E8399B4527B6A0303CED4CB122

### Mobile APK

orion-mobile-v2.2.20.apk

- bytes: 106171683
- SHA256:
  F89E1E7ADF7D75A1238EB35CB885B067DEFCF7831D612323F7B65664DC19A8E9
- package: com.okali.orion
- versionName: 2.2.20
- versionCode: 53
- APK signature verification: PASS
- permanent signing certificate SHA256:
  4422EC4BC16B1C83C914A0AD1B688BE8F7C158FF7F99BCD223A909966AC7A1BD

## GitHub Preview publication

Release:

v2.2.20 — Orion 2.2.20 Preview

Accepted release identity:
- prerelease: true
- draft: false
- target:
  37c64bf24eaab915b77edc122423d0188dc9f94f
- tag directly references the same commit
- exactly four intended public assets are present after integrity repair
- GitHub-reported binary sizes and SHA256 digests match the frozen candidate

## Release-integrity metadata incident and repair

The first published `orion-release-integrity-v1.json` payload had SHA256:

06396112A1924A0343B946F7BB4EEA3C3FFEB2FA21CEC487966F26FED9D23AF8

The signed binaries were correct, but the metadata did not match Orion's
installed updater contract.

The rejected payload used:
- `schema` instead of `schemaVersion`
- no required release `tag`
- artifact `bytes` instead of artifact `size`

The installed Desktop updater correctly failed closed and disabled automatic
installation with an integrity-contract error.

The defect was repaired as metadata only.

Corrected manifest:
- schemaVersion: 1
- tag: v2.2.20
- version: 2.2.20
- artifact count: 3
- SHA256:
  8FF31A423518EB60B90CB4ABDC44DC82ABB9DE7AD5DFDD9DB0DC5AA5F1EC291B

The corrected manifest was:
- uploaded over only the integrity asset on the existing v2.2.20 Preview
- re-read through the GitHub release API
- downloaded back from GitHub
- SHA256 re-proved after round trip
- accepted by the installed production updater

The release tag, checkpoint, and three signed binaries were not changed.

Post-repair GitHub asset identities:

### Orion.Setup.2.2.20.exe
- bytes: 100606240
- digest:
  sha256:004277bd34d8b8a0459d1c0d0005bc62d6a287d7318a93b421e8874a65baebfd

### Orion-2.2.20-win.zip
- bytes: 136506531
- digest:
  sha256:7375b101ad1c09994fa0ac2301cf99e03dbc10e8399b4527b6a0303ced4cb122

### orion-mobile-v2.2.20.apk
- bytes: 106171683
- digest:
  sha256:f89e1e7adf7d75a1238eb35cb885b067defcf7831d612323f7b65664dc19a8e9

### orion-release-integrity-v1.json
- bytes: 1193
- digest:
  sha256:8ff31a423518eb60b90cb4abdc44dc82abb9de7ad5dfdd9db0dc5aa5f1ec291b

The original rejected manifest remains preserved as immutable failure evidence.

## Production updater acceptance

Desktop production updater:

2.2.19 -> 2.2.20: PASS

Acceptance included:
- Preview release discovery
- initial fail-closed behavior against invalid integrity metadata
- metadata-only repair
- fresh updater fetch
- integrity warning removed
- Install Update enabled
- Orion-managed download / installation
- relaunch on Desktop 2.2.20
- Up to date state confirmed on Preview channel

Mobile production updater:

2.2.19 -> 2.2.20: PASS

Acceptance path:
- permanently signed APK
- GitHub Preview release
- Orion Mobile in-app updater
- physical Android installation
- launch on Mobile 2.2.20

Debug APKs, adb installation, manual sideloading, and manual Desktop EXE
installation are not acceptance evidence.

Installed matched physical pair:

Desktop 2.2.20 + Mobile 2.2.20

## P11.2 physical validation

Physical acceptance is intentionally scoped to the supported single-live-remote
product model recorded above.

### Case 1 — trust and reconnect baseline

Verdict: PASS

Physical validation confirmed:
- existing trusted pairing survived the production updates
- Mobile reconnected without re-pairing
- Orion Connect reached connected state
- remote pointer movement worked
- reliable click worked

### Case 2 — sustained realtime transport stress

Verdict: PASS at the P11.2 backlog / reliability boundary.

Physical validation included sustained rapid pointer movement, scrolling, and
reliable click activity.

Observed:
- no stuck remote input
- no stale cursor catch-up after the finger stopped
- no delayed historical cursor path replay
- no Desktop application slowdown
- reliable click path remained usable
- connection remained healthy

The test also exposed visual-continuity observations described below. Those are
not classified as P11.2 queue/backlog failures.

### Case 3 — abrupt disconnect / reconnect cleanup

Verdict: PASS

Physical validation confirmed:
- remote input stopped when the phone connection was interrupted
- no delayed cursor / scroll / click appeared after disconnect
- no ghost realtime backlog replayed
- automatic reconnect succeeded after network restoration
- no re-pair was required
- pointer and reliable click worked after reconnect
- connection remained stable afterward

## Deferred visual findings

### Fast cursor continuity

Observed:
- slow pointer movement follows the finger accurately
- fast / instant finger movement can appear stepped or teleport-like
- the Desktop application itself remains smooth
- the issue is isolated to Orion Connect cursor presentation

Classification:

P11.3 CURSOR RENDERING / CONTINUITY

P11.3 must preserve P11.2 latest-value / no-backlog semantics.

A future visual solution may interpolate or otherwise smooth between recent
authoritative points, but it must not resurrect historical coordinate queues or
create cursor catch-up.

### Remote scrolling continuity

Observed:
- Orion Connect scrolling works
- scrolling feels chunkier / laggier than native Desktop scrolling
- no stuck scroll or delayed backlog was observed

Classification:

P11.3 / P11.4 SCROLL APPLICATION / UX TUNING

Later work should preserve bounded accumulated scroll transport while improving
how surviving scroll deltas are presented/applied.

## Phase 11 planning authority binding

The authoritative user-maintained local Phase 11 plan remains:

docs/Orion-Phase-11-Plan.txt

Frozen identity at P11.2 completion inspection:
- bytes: 13469
- SHA256:
  6039194E467E40B9506B0226DA84AA196152B54C2668977E3A1925367D17CFBE

The plan remains user-owned local planning authority and is intentionally
outside this completion-audit checkpoint.

The explicit single-live-remote physical-acceptance decision recorded in this
audit narrows the P11.2 acceptance boundary without requiring the local plan to
be rewritten and without removing already-implemented controller authority /
revision fencing.

Later Phase 11 ownership remains:
- P11.3 surface-aware pointer registry and provider/WebView routing
- P11.3 compact Desktop cursor arrow / halo / no trail / no catch-up backlog
- P11.4 Windows master volume / mute
- P11.4 capability-aware display brightness
- P11.4 Player / Provider / PC control distinction
- P11.4 Music control and pending-resolution hardening where still owned
- P11.4 seek-scrubbing reconciliation
- P11.4 Orion Connect Mobile UX polish
- P11.5 broad automated gates, signed candidates, installed-pair acceptance,
  and Phase 11 completion lock

## Protected / deferred local work

Completion inspection confirmed that none of these files entered the committed
P11.2 delta:

- apps/mobile/tests/prePhase3UiPolish.test.cjs
- docs/Orion-v3-Mobile-Desktop-Readiness-Audit-2026-07-31.md
- docs/Orion-Phase-10A-P10A.3-Inspection-Ownership-Baseline-2026-09-02.md
- docs/Orion-Phase-11-Plan.txt

They remain outside this audit's mutation boundary.

## P11.2 completion verdict

P11.2 is COMPLETE at its accepted evidence boundary.

The bounded transport / scheduling goals have passed automated and supported
single-remote physical validation.

No known P11.2 blocker remains.

The cursor stepping / teleport-like presentation and chunkier remote scrolling
are preserved as explicit deferred observations rather than being hidden or
misclassified as queue failures.

The existing multi-controller ownership / revision implementation remains
present, but simultaneous multi-phone product acceptance is outside the Phase 11
supported physical scope by explicit decision.

Authorization:

P11.3 — Surface-Aware Pointer + Provider Control

may begin after this audit is frozen as its own checkpoint.
