# Orion Phase 11 — P11.1 Completion Audit

Date: 2026-09-06

## Scope

Phase 11: Reliable Orion Connect

P11.1 ownership:
- reliable startup Play
- truthful playback context
- mini-player ownership and handoff
- bounded playback preparation
- cancellation of stale/pending playback operations
- Music Planet playback control truth

This audit records the accepted implementation, production-distribution,
updater, and physical-validation boundary for P11.1.

P11.1 does not own:
- controller takeover scheduling
- high-rate pointer scheduling
- provider/WebView pointer routing
- final cursor rendering
- Windows master volume/brightness controls
- final Orion Connect Mobile UX polish

Those remain in later Phase 11 stages.

## Implementation authority

Phase 11 starting checkpoint:

fa2dfee005c8e35bd98c3f8d9bccc514af6490d1

P11.1 implementation checkpoint:

f90c3159a1bd24cf35edd11e8836eb89db86350d

Failed first production-validation candidate:

0cc7e1ef6b6759c42b17233fcb380ef5022d2cc7

Desktop mini-player startup repair checkpoint:

c75a7b50abd24ff4568bfe0ff32267cea2196d30

Replacement production-validation candidate:

43c7b5f356d31aa1aaea205bbd1a10eabf7bd261

Candidate identity:
- Desktop: 2.2.19
- Mobile: 2.2.19
- Android versionCode: 52
- Android package: com.okali.orion
- root package identity remains 2.1.2

## Mini-player startup regression

The 2.2.18 physical candidate exposed a Desktop regression where ordinary
embedded Movie/TV playback could incorrectly create a mini-player shell.

Root cause was isolated to null mini-player handling in the Desktop renderer.

The repair:
- treats a null mini-player request as clear-only
- does not arm manual mini-player state for ordinary playback
- prevents delayed null-session callbacks from creating a truthy mini-player
- preserves explicit mini-player handoff behavior

Focused renderer regression coverage passed.

Physical local validation after repair confirmed:
- ordinary Movie playback does not open an unsolicited mini-player
- ordinary TV playback does not open an unsolicited mini-player
- explicit Mini Player still works

The v2.2.18 tag/release remains preserved as historical failed-candidate evidence.

## Automated evidence

Accepted P11.1 implementation evidence includes:
- Desktop Node tests: 151 passed
- focused Desktop renderer validation after final repair: green
- Mobile Connect protocol/trusted pairing/live telemetry/unified remote: green
- Mobile typecheck: green
- Desktop source bindings: green
- IPC boundary preserved
- Desktop production build: green
- expected existing source-size exceptions retained honestly

One broad renderer playlist UI wait-budget failure was previously isolated and
the affected MusicCollectionActions test passed independently. It was retained
honestly rather than hidden.

## Production candidate artifacts

### Desktop installer

Orion.Setup.2.2.19.exe

- bytes: 100602800
- SHA256:
  97947F9E937725E63D5E05FDE1C0A56554A3C0DEAA5F5D877566FDA79E39813D
- Authenticode: Valid
- signer certificate SHA256:
  99B64A75F98BBE40AC9A435753C41B5159297DF9870FB3FE7A927D2D50DB6DC5

### Desktop ZIP

Orion-2.2.19-win.zip

- bytes: 136503294
- SHA256:
  0389B5E3C2779CA2D714BE553C05C2B642FB6E2290A64FD5B92E57AD832DF252

### Mobile APK

orion-mobile-v2.2.19.apk

- bytes: 106169847
- SHA256:
  CF6D8473BF6C58D1B431A83956AFED27B8A5BC35FE8E660BE87CABC57F83C678
- package: com.okali.orion
- versionName: 2.2.19
- versionCode: 52
- APK Signature Scheme v2: verified
- permanent signing certificate SHA256:
  4422EC4BC16B1C83C914A0AD1B688BE8F7C158FF7F99BCD223A909966AC7A1BD

### Integrity manifest

orion-release-integrity-v1.json

- bytes: 780
- SHA256:
  67773F2580A4F7FC29B87016F2EBA686797025908DA35CACA3DAE7B9384C3728

## GitHub Preview publication

Release:

v2.2.19 — Orion 2.2.19 Preview

- prerelease: true
- draft: false
- target:
  43c7b5f356d31aa1aaea205bbd1a10eabf7bd261
- four intended public assets published
- GitHub-reported artifact sizes and SHA256 digests matched local frozen payload

## Production updater acceptance

Desktop production updater:

2.2.18 -> 2.2.19: PASS

Acceptance included:
- Orion Preview updater discovery
- Orion-managed download/install
- relaunch on 2.2.19
- normal Movie playback without unsolicited mini-player
- normal TV playback without unsolicited mini-player
- explicit Mini Player still functional
- application state preserved

Mobile production updater:

2.2.18 -> 2.2.19: PASS

Acceptance path:

permanently signed APK
-> GitHub Preview release
-> Orion Mobile in-app updater
-> physical Android installation

Debug APKs and adb installation are not acceptance evidence.

Installed matched physical pair:

Desktop 2.2.19 + Mobile 2.2.19

## P11.1 physical validation

### Case 1 — startup Play / bounded preparation

Verdict: PASS through the bounded-failure path represented by current providers.

Observed provider classes:

1. Auto-start sources
   - provider begins playback without Mobile startup Play
   - no startup action is required from Orion Connect

2. Provider-gated sources
   - startup requires provider-owned controls
   - Orion Connect reports provider-control-only capability
   - playback timing is reported unavailable when provider timing is unavailable
   - Mobile returns a healthy bounded failure rather than hanging
   - no late ghost playback observed
   - no duplicate Play behavior observed

A direct-control provider with a manually catchable preparation-stage Play
operation was not represented by the current Cinema provider inventory.

This is not classified as a failure.

Provider/WebView startup-button interaction belongs to P11.3.

### Case 2 — Home / Mini Player ownership

Verdict: PASS

Physical validation confirmed:
- active playback handed off correctly on Home navigation
- Mobile retained the correct surviving playback context
- Mobile Pause controlled the surviving Mini Player
- Mobile Resume controlled the surviving Mini Player
- Mobile Stop terminated playback
- Mobile context cleared after Stop
- no late owner/context resurrection occurred

Vidking showed intermittent repeated loading/reload behavior.

Current classification:

PROVIDER-SPECIFIC OBSERVATION / NOT A P11.1 BLOCKER

It should be promoted to an Orion defect only if equivalent behavior is shown
across providers or Orion itself demonstrably causes restoration/reload.

### Case 3 — pending Cinema Play cancellation

Physical direct pending-Play race:

NOT REPRESENTED BY CURRENT PROVIDER INVENTORY

Reason:
- auto-start sources do not require Mobile startup Play
- provider-gated sources return bounded failure instead of retaining a live
  direct-control pending operation

No physical stale-source resurrection or ghost playback defect was observed.

Automated cancellation coverage remains the accepted evidence for:
- source change
- Stop
- disconnect
- teardown
- expiry
- stale owner replacement

### Case 4A — Music Planet controls

Verdict: PASS

Physical validation confirmed:
- correct Music track/context shown on Mobile
- Controls Ready state
- Pause
- Resume
- seek controls
- Previous
- Next
- Stop
- live playback timing

### Case 4B — Stop during pending track resolution

Physical timing window:

NOT PRACTICALLY REPRODUCIBLE

Observed behavior:
- track lookup typically resolves too quickly to intercept manually
- during unresolved/non-authoritative states Orion Connect may temporarily
  report provider/control capability rather than expose a usable Stop race

No physical late-track resurrection defect was observed.

Automated pending-resolver cancellation coverage remains accepted.

## Deferred observations

### Seek scrubbing reconciliation

Physical testing on both Cinema and Music Planet found:

- normal playback progress is healthy
- live progress moves correctly
- final seek destination is correct
- while the user holds/drags a new seek position, incoming live telemetry can
  temporarily fight the local scrub position
- the progress thumb may move back and forth before settling at the intended
  target

Classification:

P11.4 SEEK RECONCILIATION / UX TUNING

Not a P11.1 playback-truth blocker.

P11.4 must inspect ownership between:
- local active scrub state
- outbound seek requests
- incoming authoritative Desktop telemetry
- post-seek reconciliation

Expected behavior:
- local scrub position owns the thumb while actively dragging
- stale telemetry must not visually fight the finger
- final seek requests should be bounded/coalesced
- post-seek telemetry should reconcile smoothly
- Cinema and Music Planet should use the same truthful model where timing exists
- provider-only sources must not fabricate timing

### Phase 11 remainder

The user-maintained local Phase 11 plan is:

docs/Orion-Phase-11-Plan.txt

It remains outside this P11.1 completion checkpoint.

It preserves later ownership including:
- P11.2 ordered/bounded input scheduling and controller ownership
- P11.3 provider/WebView pointer and click routing
- P11.4 Windows master volume/mute
- P11.4 capability-aware display brightness
- P11.4 Orion Connect Mobile UI/UX polish
- Search shortcut floater preservation
- fixed Orion page-title/header preservation
- Smart Connect navigation label correction to Orion Connect
- seek scrubbing reconciliation
- P11.5 broad physical/release acceptance

## Phase 11 planning authority binding

The authoritative local remainder plan for Phase 11 is:

docs/Orion-Phase-11-Plan.txt

Frozen local identity at P11.1 completion:

- bytes: 13469
- SHA256:
  6039194E467E40B9506B0226DA84AA196152B54C2668977E3A1925367D17CFBE

The plan records the accepted P11.1 physical evidence and the declared
ownership of P11.2 through P11.5, including the expanded P11.4 work for:

- Windows master volume/mute
- capability-aware display brightness
- Cinema/Music seek-scrubbing reconciliation
- Orion Connect Mobile UI/UX polish
- Search shortcut floater preservation
- fixed Orion page-title/header preservation
- Smart Connect navigation label correction to Orion Connect

The plan remains user-owned local planning authority and is intentionally
outside this P11.1 completion-audit checkpoint.

Accepted updater summary:

- Desktop 2.2.18 -> 2.2.19 via Orion Preview updater: PASS
- Mobile 2.2.18 -> 2.2.19 via Orion in-app updater: PASS
- Installed matched pair: Desktop 2.2.19 + Mobile 2.2.19

## P11.1 completion verdict

P11.1 is COMPLETE at its accepted evidence boundary.

No known P11.1 blocker remains.

Branches that cannot be physically produced by the current provider inventory
are recorded explicitly rather than falsely marked as exercised.

Deferred provider-surface interaction and UX/control refinements remain owned by
their declared later Phase 11 stages.

Authorization:

P11.2 — Bounded Ordered Input Scheduling + Controller Ownership

may begin after this audit is frozen as its own checkpoint.
